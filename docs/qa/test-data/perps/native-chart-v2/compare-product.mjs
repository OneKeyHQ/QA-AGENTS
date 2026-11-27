/** Read-only, pinned Git source comparison. No App, network, stubs or code edits.
 * TypeScript is supplied by this QA repository. Product code is loaded from
 * git show, never from the current checkout or an unversioned snapshot.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const args = process.argv.slice(2);
function argument(name) {
  const i = args.indexOf(name);
  if (i < 0 || !args[i + 1]) throw new Error(`Missing ${name}`);
  return args[i + 1];
}

export function compare(expected, actual, tolerance, label = '') {
  const issues = [];
  let cells = 0;
  function visit(e, a, key) {
    if (Array.isArray(e)) {
      if (!Array.isArray(a) || e.length !== a.length) {
        issues.push({ path: key, expected: `array length ${e.length}`, actual: a?.length });
        return;
      }
      e.forEach((value, i) => visit(value, a[i], `${key}[${i}]`));
    } else if (e !== null && typeof e === 'object') {
      if (!a || Object.keys(e).sort().join('|') !== Object.keys(a).sort().join('|')) {
        issues.push({ path: key, expected: Object.keys(e), actual: Object.keys(a ?? {}) });
        return;
      }
      for (const k of Object.keys(e)) visit(e[k], a[k], `${key}/${k}`);
    } else {
      cells += 1;
      if (e === null ? a !== null : !Number.isFinite(a) ||
          Math.abs(e - a) > tolerance.absolute + tolerance.relative * Math.abs(e)) {
        issues.push({ path: key, expected: e, actual: a });
      }
    }
  }
  visit(expected, actual, label);
  return { issues, cells };
}

const tolerance = { absolute: 1e-8, relative: 1e-8 };
if (args.includes('--self-test')) {
  const e = { line: [null, 0, 10] };
  assert.equal(compare(e, e, tolerance).issues.length, 0);
  for (const a of [{ line: [0, 0, 10] }, { line: [null, null, 10] },
    { line: [null, 0, 11] }, { line: [null, 0, NaN] },
    { line: [null, 0, Infinity] }, { line: [null, 0] }, {}]) {
    assert.ok(compare(e, a, tolerance).issues.length > 0);
  }
  console.log('PASS: comparator rejects changed values, null/zero, NaN/Infinity, lengths and missing series');
  process.exit(0);
}

const fixturePath = path.resolve(argument('--fixtures'));
const fixtureText = readFileSync(fixturePath, 'utf8');
// Validate the consumed file, not a separately rebuilt or previously checked file.
try {
  execFileSync(process.env.PYTHON_BIN || 'python3', ['-B', fileURLToPath(new URL('./generate.py', import.meta.url)), '--verify-stdin'],
    { input: fixtureText, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
} catch (error) {
  console.error(`Input contract rejected: ${String(error.stderr || error.message).trim().split('\n').at(-1)}`);
  process.exit(1);
}
const repo = path.resolve(argument('--app-repo'));
const fixture = JSON.parse(fixtureText);
const requireApp = createRequire(path.join(repo, 'package.json'));
const ref = args.includes('--ref') ? argument('--ref') : fixture.sourceSha;
if (!/^[a-f0-9]{40}$/.test(ref)) throw new Error('--ref must be a full 40-character commit SHA');
const git = (...params) => execFileSync('git', ['-C', repo, ...params], { encoding: 'utf8', maxBuffer: 8*1024*1024, stdio: ['ignore', 'pipe', 'pipe'] });
const sha = git('rev-parse', '--verify', `${ref}^{commit}`).trim();
const root = 'packages/kit/src/components/TradingView/TradingViewNative';
const dir = `${root}/utils/chartIndicators`;
const cache = new Map();
const loadedPaths = [];
function load(sourcePath) {
  if (cache.has(sourcePath)) return cache.get(sourcePath).exports;
  if (!(sourcePath.startsWith(`${root}/`) || sourcePath === 'packages/shared/types/tradingViewNative.ts')) {
    throw new Error(`Refusing non-math/UI dependency: ${sourcePath}`);
  }
  const source = git('show', `${sha}:${sourcePath}`);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
    fileName: sourcePath, reportDiagnostics: true,
  });
  const errors = compiled.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error);
  if (errors?.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, {
    getCurrentDirectory: () => repo, getCanonicalFileName: f => f, getNewLine: () => '\n',
  }));
  const module = { exports: {} };
  cache.set(sourcePath, module);
  loadedPaths.push(sourcePath);
  const requireSource = specifier => {
    if (specifier === 'bignumber.js') return requireApp(specifier);
    let target;
    if (specifier.startsWith('.')) target = path.posix.join(path.posix.dirname(sourcePath), specifier);
    else if (specifier === '@onekeyhq/shared/types/tradingViewNative') target = 'packages/shared/types/tradingViewNative';
    else throw new Error(`Unexpected runtime dependency ${specifier} from ${sourcePath}`);
    return load(`${target}.ts`);
  };
  vm.runInNewContext(`(function(require,module,exports){${compiled.outputText}\n})`, {}, { filename: `${sha}/${sourcePath}` })(requireSource, module, module.exports);
  return module.exports;
}
const fn = (file, suffix) => load(`${dir}/${file}.ts`)[`calculateTradingViewNative${suffix}`];
function product(bars, p) {
  const points = bars.map(b => ({ t: b.time, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }));
  const c = bars.map(b => b.close);
  const out = {};
  for (const [name, file, suffix] of [
    ['WMA', 'wma', 'WeightedMovingAverage'], ['VWMA', 'vwma', 'VolumeWeightedMovingAverage'],
  ]) out[name] = Object.fromEntries(p[name].periods.map((n, i) => [`line:${i}`, fn(file, suffix)(name === 'WMA' ? c : points, n)]));
  out.SUPERTREND = fn('superTrend', 'SuperTrend')(points, p.SUPERTREND);
  out.ENV = fn('envelope', 'Envelope')(c, p.ENV);
  out.VWAP = { vwap: fn('vwap', 'VolumeWeightedAveragePrice')(points, p.VWAP.period) };
  out.DC = fn('donchian', 'DonchianChannel')(points, p.DC.period);
  out.KDJ = fn('kdj', 'Kdj')(points, p.KDJ);
  out.SKDJ = fn('kdj', 'Skdj')(points, p.SKDJ);
  out.DMA = fn('dma', 'Dma')(c, p.DMA);
  out.VR = fn('vr', 'VolumeRatio')(points, p.VR);
  out.BRAR = fn('brar', 'Brar')(points, p.BRAR.period);
  out.PSY = fn('psy', 'PsychologicalLine')(c, p.PSY);
  out.PVT = { pvt: fn('pvt', 'PriceVolumeTrend')(points, p.PVT) };
  out.ATR = { atr: fn('atr', 'AverageTrueRange')(points, p.ATR.period) };
  out.SMI = fn('squeezeMomentum', 'SqueezeMomentum')(points, p.SMI);
  out.TSI = { tsi: fn('trendStrengthIndex', 'TrendStrengthIndex')(c, p.TSI.period) };
  out.RVI = fn('relativeVolatilityIndex', 'RelativeVolatilityIndex')(c, p.RVI);
  out.QQE = fn('qqe', 'Qqe')(c, p.QQE);
  out.MASS = { mass: fn('massIndex', 'MassIndex')(points, p.MASS.period) };
  out.KST = fn('kst', 'Kst')(c, p.KST);
  out.BBP = { bbp: fn('bullBearPower', 'BullBearPower')(points, p.BBP.period) };
  out.NVI = fn('nvi', 'NegativeVolumeIndex')(points, p.NVI.movingAveragePeriod, p.NVI);
  out.PMO = fn('pmo', 'PriceMomentumOscillator')(c, p.PMO);
  out.RCI = Object.fromEntries(['short', 'middle', 'long'].map((key, i) => [key, fn('rci', 'RankCorrelationIndex')(c, p.RCI.periods[i])]));
  out.SLOPE = { slope: fn('maSlope', 'MaSlope')(c, p.SLOPE) };
  const sma = fn('ma', 'SimpleMovingAverage');
  for (const [name, file, suffix, key] of [
    ['TRIX', 'trix', 'Trix', 'trix'], ['EMV', 'easeOfMovement', 'EaseOfMovement', 'emv'],
    ['ROC', 'rateOfChange', 'RateOfChange', 'roc'], ['MTM', 'momentum', 'Momentum', 'momentum'],
  ]) {
    const input = name === 'EMV' ? points : name === 'MTM' ? bars.map(b => b[p.MTM.source]) : c;
    const values = fn(file, suffix)(input, name === 'EMV' ? p.EMV : p[name].period);
    out[name] = { [key]: values, movingAverage: sma(values, p[name].movingAveragePeriod) };
  }
  return out;
}
// Run the actual provider and the exact history-normalization function from Git.
const normalizeCandle = load(`${root}/data/providers/hyperliquid/hyperliquidCandleUtils.ts`).normalizeHyperliquidCandle;
const hookPath = `${root}/data/useTradingViewNativeKLine.ts`;
const hookSource = git('show', `${sha}:${hookPath}`);
const hookTree = ts.createSourceFile(hookPath, hookSource, ts.ScriptTarget.Latest, true);
const normalizer = hookTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'normalizeKLinePoints');
assert.ok(normalizer, 'Pinned history normalizer must be present');
const normalizeCode = ts.transpileModule(normalizer.getText(hookTree), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const normalizeHistory = vm.runInNewContext(`${normalizeCode}\nnormalizeKLinePoints`, {}, { filename: `${sha}/${hookPath}` });
function normalizeFeed(bars) {
  const numericText = x => typeof x === 'number' && Number.isFinite(x) ? String(x) : 'NaN';
  const points = bars.map(b => normalizeCandle({
    o: numericText(b.open), h: numericText(b.high), l: numericText(b.low),
    c: numericText(b.close), v: numericText(b.volume), t: b.time*1000,
  })).filter(Boolean);
  return normalizeHistory(points).map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
}
const totals = { calculatorSamples: 0, feedSamples: 0, sequenceFrames: 0, workloadFrames: 0, periodSwitchFrames: 0,
  comparedIndicatorCells: 0, comparedCandleFields: 0, failures: 0 };
const examples = [];
function record(expected, actual, label, counter) {
  const result = compare(expected, actual, tolerance, label);
  totals[counter] += result.cells;
  totals.failures += result.issues.length;
  examples.push(...result.issues.slice(0, Math.max(0, 12-examples.length)));
}
function checkFeed(sample, params, label) {
  assert.equal(params.PVT.zeroVolumeIsMissing, false, 'Perps uses reported zero volume');
  assert.equal(params.NVI.zeroVolumeIsMissing, false, 'Perps uses reported zero volume');
  assert.equal(params.MTM.source, 'close', 'Perps settings expose numeric MTM parameters only; source resolves to close');
  const actual = normalizeFeed(sample.inputBars);
  record(sample.bars, actual, `${label}/normalized-bars`, 'comparedCandleFields');
  record(sample.expected, product(actual, params), label, 'comparedIndicatorCells');
}
assert.equal(fixture.schemaVersion, 4);
for (const [profile, item] of Object.entries(fixture.profiles)) {
  for (const [variant, sample] of Object.entries(item.variants)) {
    record(sample.expected, product(sample.bars, item.parameters), `calculator/${profile}/${variant}`, 'comparedIndicatorCells');
    totals.calculatorSamples += 1;
  }
  for (const [variant, sample] of Object.entries(item.feedVariants)) {
    checkFeed(sample, item.parameters, `feed/${profile}/${variant}`);
    totals.feedSamples += 1;
  }
  for (const [name, frames] of Object.entries(item.sequences)) {
    for (const sample of frames) {
      checkFeed(sample, item.parameters, `sequence/${profile}/${name}/${sample.event}`);
      totals.sequenceFrames += 1;
    }
  }
}
for (const panel of fixture.workloads['four-panel'].panels) {
  for (const frame of panel.frames) {
    checkFeed(frame, frame.parameters ?? panel.parameters, `workload/${panel.panel}/${frame.event}`);
    totals.workloadFrames += 1;
  }
  const roundTrip = panel.periodSwitch;
  for (const frame of roundTrip.frames) {
    const interval = frame.intervalSeconds;
    assert.ok(interval > 0 && interval % 60 === 0);
    assert.equal(frame.bars.length, 256);
    assert.ok(frame.bars.every((b, i, bars) => b.time % interval === 0 &&
      (i === 0 || b.time-bars[i-1].time === interval)), 'Period-switch buckets must match selected interval');
    assert.equal(frame.bars.at(-1).time+interval-1, roundTrip.clockTime);
    checkFeed(frame, frame.parameters, `workload/${panel.panel}/${frame.event}/${interval}s`);
    totals.periodSwitchFrames += 1;
  }
}
assert.ok(totals.calculatorSamples && totals.feedSamples && totals.sequenceFrames && totals.workloadFrames && totals.periodSwitchFrames);
assert.ok(totals.comparedIndicatorCells > 0 && totals.comparedCandleFields > 0);
console.log(JSON.stringify({ sourceSha: sha, ...totals, examples, loadedSourceFiles: loadedPaths.length+1,
  limitation: 'Snapshot calculations and real feed normalization only; UI caching and performance require App execution' }, null, 2));
process.exitCode = totals.failures ? 1 : 0;
