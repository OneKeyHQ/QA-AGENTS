import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { mkdir, mkdtemp, open, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { hostname } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual, parseArgs } from 'node:util';

const directory = dirname(fileURLToPath(import.meta.url));
const defaultOutput = resolve(directory, '../../shared/reports/pr-preview-evidence/runs');
const statuses = new Set(['pass', 'fail', 'blocked', 'pending', 'na']);
const executed = status => status === 'pass' || status === 'fail';
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && Boolean(value.trim());
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gitSha = /^[a-f0-9]{40}$/u;
const fingerprint = /^[a-f0-9]{64}$/u;
const pair = (caseKey, phase) => JSON.stringify([caseKey, phase]);
const milestoneStages = new Set(['target-confirmed', 'material', 'first-evidence', 'prepared', 'delivery']);
const numberTag = {type:'number', value:'-0'};
const interruptExitCodes = {SIGINT:130, SIGTERM:143};

class ArchiveInterrupted extends Error {
  constructor(signal) {
    super('Evidence archive interrupted by '+signal);
    this.name = 'ArchiveInterrupted';
    this.signal = signal;
  }
}

function abortReason(error, signal) {
  return signal?.aborted && error?.code === 'ABORT_ERR' ? signal.reason : error;
}

function withCleanupError(error, cleanup) {
  return Object.assign(new Error(error?.message ?? String(error), {cause:error}), {
    name:error?.name ?? 'Error', code:error?.code, signal:error?.signal, archive:error?.archive,
    archiveCleanup:{name:cleanup.name, code:cleanup.code, message:cleanup.message}
  });
}

export function markMilestone(stage) {
  if (!milestoneStages.has(stage)) throw new Error('Unknown milestone '+stage);
  return {stage, monotonicNs:process.hrtime.bigint().toString(), wallClockAt:new Date().toISOString(), host:hostname()};
}

function comparable(value) {
  if (typeof value === 'number' && (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)))) {
    throw new Error('Use a string for values outside the safe numeric range');
  }
  if (Array.isArray(value)) return value.map(comparable);
  if (!record(value)) return value;
  if (isDeepStrictEqual(value, numberTag)) return -0;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, comparable(item)]));
}

function buildPlan(plan, issues) {
  const phases = new Map();
  const caseKeys = new Set();
  if (!Array.isArray(plan.cases) || !plan.cases.length) issues.push({code:'missing-plan-cases'});
  for (const entry of Array.isArray(plan.cases) ? plan.cases : []) {
    if (!record(entry) || !nonempty(entry.key) || !nonempty(entry.name) || !Array.isArray(entry.phases) || !entry.phases.length) {
      issues.push({code:'invalid-plan-case'});
      continue;
    }
    if (caseKeys.has(entry.key)) issues.push({code:'duplicate-plan-case', caseKey:entry.key});
    caseKeys.add(entry.key);
    for (const phase of entry.phases) {
      if (!record(phase) || !nonempty(phase.phase) || !nonempty(phase.level) || typeof phase.required !== 'boolean'
        || !Object.hasOwn(phase, 'expected')) {
        issues.push({code:'invalid-plan-phase', caseKey:entry.key});
        continue;
      }
      const key = pair(entry.key, phase.phase);
      if (phases.has(key)) issues.push({code:'duplicate-plan-phase', caseKey:entry.key, phase:phase.phase});
      phases.set(key, {...phase, caseKey:entry.key, caseName:entry.name});
    }
  }
  return phases;
}

async function readArtifact(root, relativePath, signal) {
  if (!nonempty(relativePath) || /^[A-Za-z]:/u.test(relativePath) || /[\\\u0000-\u001f\u007f]/u.test(relativePath)
    || relativePath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Expected a relative file path inside the result directory');
  }
  const path = await realpath(join(root, relativePath));
  const location = relative(root, path);
  if (!location || location === '..' || location.startsWith('..'+sep) || isAbsolute(location)) {
    throw new Error('Evidence file is outside the result directory');
  }
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const info = await handle.stat({bigint:true});
    if (!info.isFile()) throw new Error('Evidence must be a regular file');
    const bytes = await handle.readFile({signal});
    const digest = sha256(bytes);
    return {bytes, sha256:digest, archivePath:'artifacts/'+digest, identity:`${info.dev}:${info.ino}`};
  } finally {
    await handle.close();
  }
}

async function checkRows(result, planned, root, issues, signal) {
  const rows = new Map();
  const reads = new Map();
  const artifacts = new Map();
  if (!Array.isArray(result.rows)) issues.push({code:'invalid-results'});
  for (const row of Array.isArray(result.rows) ? result.rows : []) {
    signal?.throwIfAborted();
    const key = pair(row?.caseKey, row?.phase);
    const plan = planned.get(key);
    if (!plan || row.caseName !== plan.caseName || !statuses.has(row.status)) {
      issues.push({code:'invalid-result-row', caseKey:row?.caseKey, phase:row?.phase});
      continue;
    }
    const location = {caseKey:plan.caseKey, phase:plan.phase};
    const issue = (code, detail) => issues.push({code, ...location, ...(detail ? {detail} : {})});
    if (rows.has(key)) {
      issue('duplicate-result-row');
      continue;
    }
    const previousIssueCount = issues.length;
    let artifact;
    if (Object.hasOwn(row, 'evidence')) {
      const {path, sha256:expected} = row.evidence ?? {};
      if (nonempty(path) && typeof expected === 'string' && fingerprint.test(expected)) {
        try {
          if (!reads.has(path)) reads.set(path, readArtifact(root, path, signal));
          const observed = await reads.get(path);
          if (observed.sha256 === expected) {
            artifact = observed;
            artifacts.set(path, artifact);
          } else issue('evidence-digest-mismatch', path);
        } catch (error) {
          signal?.throwIfAborted();
          issue('evidence-unreadable', error.code ?? error.message);
        }
      } else issue('invalid-evidence-reference');
    }
    if (executed(row.status)) {
      if (row.level !== plan.level) issue('evidence-level-mismatch');
      if (!artifact) issue('missing-execution-evidence');
      if (!Object.hasOwn(row, 'actual')) issue('missing-execution-actual');
      try {
        const expected = comparable(plan.expected);
        if (Object.hasOwn(row, 'expected') && !isDeepStrictEqual(comparable(row.expected), expected)) issue('expected-mismatch');
        if (Object.hasOwn(row, 'actual') && isDeepStrictEqual(comparable(row.actual), expected) !== (row.status === 'pass')) {
          issue('outcome-contradicts-evidence');
        }
      } catch (error) { issue('invalid-comparison-value', error.message); }
    } else {
      if (!nonempty(row.gap)) issue('missing-coverage-gap');
      if (row.level !== null && row.level !== undefined && !nonempty(row.level)) issue('invalid-evidence-level');
    }
    rows.set(key, {row, plan, artifact, verified:issues.length === previousIssueCount});
  }
  for (const [key, plan] of planned) {
    if (!rows.has(key)) issues.push({code:'missing-result-row', caseKey:plan.caseKey, phase:plan.phase, required:plan.required});
  }
  return {rows, artifacts};
}

function checkFailureSummary(result, rows, issues) {
  if (!Array.isArray(result.failures)) {
    issues.push({code:'invalid-failure-summary'});
    return;
  }
  const summarized = new Set();
  for (const failure of result.failures) {
    const key = pair(failure?.caseKey, failure?.phase);
    if (!nonempty(failure?.reason) || rows.get(key)?.row.status !== 'fail' || summarized.has(key)) {
      issues.push({code:'invalid-summarized-failure', caseKey:failure?.caseKey, phase:failure?.phase});
    } else summarized.add(key);
  }
  for (const [key, {row}] of rows) {
    if (row.status === 'fail' && !summarized.has(key)) {
      issues.push({code:'unsummarized-failure', caseKey:row.caseKey, phase:row.phase});
    }
  }
}

function capture(endpoint) {
  if (!endpoint.artifact) throw new Error('Both seam endpoints need hashed capture files');
  const captured = JSON.parse(endpoint.artifact.bytes.toString('utf8'));
  if (!record(captured) || !nonempty(captured.attempt) || !record(captured.payload)) {
    throw new Error('Capture requires a nonempty attempt and a payload object');
  }
  const {row} = endpoint;
  if ((Object.hasOwn(row, 'attempt') && row.attempt !== captured.attempt)
    || (Object.hasOwn(row, 'payload') && !isDeepStrictEqual(comparable(row.payload), comparable(captured.payload)))) {
    throw new Error('Declared seam values disagree with the hashed capture');
  }
  return captured;
}

function selectedValue(payload, {path, allowNull}) {
  let value = payload;
  for (const part of path.split('.')) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, part)) {
      throw new Error('Missing payload field '+path);
    }
    value = value[part];
  }
  if (value === null && !allowNull) throw new Error('Null payload field '+path);
  return comparable(value);
}

function checkSeams(plan, planned, rows, issues) {
  const seams = [];
  if (!Object.hasOwn(plan, 'seams')) return seams;
  if (!Array.isArray(plan.seams)) {
    issues.push({code:'invalid-seam-plan'});
    return seams;
  }
  const keys = new Set();
  for (const seam of plan.seams) {
    const {key, from, to, fields} = seam ?? {};
    const left = pair(from?.caseKey, from?.phase);
    const right = pair(to?.caseKey, to?.phase);
    const checks = Array.isArray(fields) ? fields.map(field => typeof field === 'string' ? {path:field} : field) : [];
    if (!nonempty(key) || keys.has(key) || left === right || !planned.has(left) || !planned.has(right) || !checks.length
      || checks.some(field => !record(field) || typeof field.path !== 'string' || !/^[\w$-]+(?:\.[\w$-]+)*$/u.test(field.path)
        || (Object.hasOwn(field, 'allowNull') && typeof field.allowNull !== 'boolean'))
      || new Set(checks.map(field => field.path)).size !== checks.length) {
      issues.push({code:'invalid-seam-plan', seam:key});
      continue;
    }
    keys.add(key);
    const source = rows.get(left);
    const target = rows.get(right);
    if (!source?.verified || !target?.verified || source.row.status !== 'pass' || target.row.status !== 'pass') {
      seams.push({key, status:'pending', reason:'seam-endpoints-unverified'});
      continue;
    }
    try {
      const before = capture(source);
      const after = capture(target);
      if (source.artifact.identity === target.artifact.identity) throw new Error('Seam endpoints need independent capture files');
      if (before.attempt !== after.attempt) throw new Error('Seam endpoints were captured in different attempts');
      const differences = checks.flatMap(field => {
        const source = selectedValue(before.payload, field);
        const target = selectedValue(after.payload, field);
        return isDeepStrictEqual(source, target) ? [] : [field.path];
      });
      seams.push({key, status:differences.length ? 'fail' : 'pass', ...(differences.length ? {differences} : {})});
    } catch (error) { issues.push({code:'invalid-seam-evidence', seam:key, detail:error.message}); }
  }
  return seams;
}

function monotonicTime(mark, stage, prepared, issues) {
  if (!record(mark) || mark.stage !== stage || mark.host !== prepared.host
    || typeof mark.wallClockAt !== 'string' || !Number.isFinite(Date.parse(mark.wallClockAt))
    || typeof mark.monotonicNs !== 'string' || !/^(?:0|[1-9][0-9]{0,20})$/u.test(mark.monotonicNs)) {
    issues.push({code:'invalid-milestone', stage});
    return;
  }
  return BigInt(mark.monotonicNs);
}

function checkTiming(plan, result, rows, prepared, issues) {
  const previousIssueCount = issues.length;
  if (!record(result.milestones)) issues.push({code:'invalid-milestones'});
  const {material, firstEvidence} = result.milestones ?? {};
  const executedRows = [...rows.values()].some(({row}) => executed(row.status));
  if (executedRows && !material) issues.push({code:'missing-material-milestone'});
  if (executedRows && !firstEvidence) issues.push({code:'missing-first-evidence'});
  if (firstEvidence) {
    const linked = rows.get(pair(firstEvidence.caseKey, firstEvidence.phase));
    if (!linked?.verified || !linked.artifact || !executed(linked.row.status) || firstEvidence.sha256 !== linked.artifact.sha256) {
      issues.push({code:'unverified-first-evidence'});
    }
    if (!material && !executedRows) issues.push({code:'missing-material-milestone'});
  }
  const marks = [[plan.targetConfirmed, 'target-confirmed'], [material, 'material'],
    [firstEvidence, 'first-evidence'], [prepared, 'prepared']];
  const times = marks.map(([mark, stage], index) => mark === undefined && (index === 1 || index === 2)
    ? undefined : monotonicTime(mark, stage, prepared, issues));
  let last;
  const elapsedMs = {};
  for (const [index, time] of times.entries()) {
    if (time === undefined) continue;
    const stage = marks[index][1];
    if (last !== undefined && time < last) issues.push({code:'reversed-milestones', stage});
    last = time;
    if (times[0] !== undefined && time >= times[0]) elapsedMs[stage] = Number(time-times[0])/1e6;
  }
  const verified = issues.length === previousIssueCount;
  return {targetConfirmed:plan.targetConfirmed, material, prepared, verified,
    ...(verified ? {firstEvidence, elapsedMs} : {})};
}

async function verifyArchive(directory, expected, signal) {
  for (const [name, digest] of Object.entries(expected)) {
    const observed = sha256(await readFile(join(directory, name), {signal}));
    if (observed !== digest) {
      throw Object.assign(new Error('Archived bytes disagree with their fingerprint: '+name), {
        code:'ARCHIVE_INTEGRITY', artifact:name, expected:digest, observed
      });
    }
  }
}

async function publish(output, inputs, evidence, signal, complete) {
  signal?.throwIfAborted();
  await mkdir(output, {recursive:true});
  signal?.throwIfAborted();
  const runDirectory = join(output, 'run-'+randomUUID());
  const files = Object.fromEntries(Object.entries(inputs).filter(([,input]) => input.bytes !== undefined)
    .map(([name, input]) => [name+'.json', input.bytes]));
  for (const artifact of evidence.values()) files[artifact.archivePath] = artifact.bytes;
  const temporary = await mkdtemp(join(output, '.staging-'));
  const writeOptions = {flag:'wx', signal};
  let phase = 'writing';
  let committed = false;
  try {
    signal?.throwIfAborted();
    if (evidence.size) await mkdir(join(temporary, 'artifacts'));
    const artifacts = {};
    for (const [name, bytes] of Object.entries(files)) {
      await writeFile(join(temporary, name), bytes, writeOptions);
      artifacts[name] = sha256(bytes);
    }
    // This snapshot is frozen before its own I/O. Full delivery is timed in the returned receipt.
    const summary = complete(markMilestone('prepared'));
    const summaryBytes = JSON.stringify(summary, null, 2)+'\n';
    await writeFile(join(temporary, 'summary.json'), summaryBytes, writeOptions);
    artifacts['summary.json'] = sha256(summaryBytes);
    const manifestBytes = JSON.stringify({status:summary.status, artifacts}, null, 2)+'\n';
    await writeFile(join(temporary, 'manifest.json'), manifestBytes, writeOptions);
    const expected = {...artifacts, 'manifest.json':sha256(manifestBytes)};
    phase = 'staging-verification';
    await verifyArchive(temporary, expected, signal);
    // Submission of the atomic rename seals the result. It is no longer cancellable.
    signal?.throwIfAborted();
    phase = 'publishing';
    await rename(temporary, runDirectory);
    committed = true;
    phase = 'published-verification';
    // Once submitted, finish verification even if a CLI termination signal arrives.
    await verifyArchive(runDirectory, expected);
    const delivery = markMilestone('delivery');
    const elapsedMs = summary.timing.verified
      ? Number(BigInt(delivery.monotonicNs)-BigInt(summary.timing.targetConfirmed.monotonicNs))/1e6 : undefined;
    return {...summary, runDirectory, publicationReceipt:{runDirectory, manifestSha256:expected['manifest.json'],
      delivery, ...(elapsedMs !== undefined ? {elapsedMs} : {})}};
  } catch (error) {
    const primary = abortReason(error, signal);
    if (record(primary) && Object.isExtensible(primary)) {
      primary.archive = {phase, submitted:committed, ...(committed ? {runDirectory} : {}),
        ...(error?.artifact ? {artifact:error.artifact, expected:error.expected, observed:error.observed} : {})};
    }
    try {
      // A failed final readback must not leave our newly published archive claiming success.
      await rm(committed ? runDirectory : temporary, {recursive:true, force:true});
    } catch (cleanup) {
      throw withCleanupError(primary, cleanup);
    }
    throw primary;
  }
}

async function readInput(path, signal) {
  const provenance = {path:resolve(path)};
  let bytes;
  let value;
  let stage = 'read';
  try {
    provenance.resolvedPath = await realpath(path);
    bytes = await readFile(provenance.resolvedPath, {signal});
    Object.assign(provenance, {sha256:sha256(bytes), byteLength:bytes.length});
    stage = 'parse';
    value = JSON.parse(bytes.toString('utf8'));
    if (!record(value)) throw new Error('Input must be a JSON object');
    provenance.comparison = Object.fromEntries(['baseSha', 'headSha']
      .filter(field => typeof value[field] === 'string' && gitSha.test(value[field])).map(field => [field,value[field]]));
  } catch (error) {
    signal?.throwIfAborted();
    provenance.error = {stage, message:error.message, ...(error.code ? {code:error.code} : {})};
  }
  return {bytes, value, provenance};
}

export async function validateAndArchive({planPath, resultPath, output = defaultOutput, signal}) {
  signal?.throwIfAborted();
  const [planInput, resultInput] = await Promise.all([readInput(planPath, signal), readInput(resultPath, signal)]);
  const inputs = {plan:planInput, result:resultInput};
  const provenance = Object.fromEntries(Object.entries(inputs).map(([name,input]) => [name,input.provenance]));
  const inputIssues = Object.entries(inputs).filter(([,input]) => input.provenance.error)
    .map(([input,{provenance}]) => ({code:'invalid-input', input, ...provenance.error}));
  if (inputIssues.length) {
    return publish(resolve(output), inputs, new Map(), signal, prepared => ({
      status:'protocol-error', exitCode:2,
      comparison:{...resultInput.provenance.comparison, ...planInput.provenance.comparison},
      inputs:provenance, coverage:[], failures:[], seams:[], evidenceFiles:{}, issues:inputIssues,
      timing:{prepared, verified:false, reason:'input-preflight-failed'}
    }));
  }
  const plan = planInput.value;
  const result = resultInput.value;
  const issues = [];
  for (const field of ['baseSha', 'headSha']) {
    if (typeof plan[field] !== 'string' || !gitSha.test(plan[field]) || result[field] !== plan[field]) {
      issues.push({code:'comparison-sha-mismatch', field});
    }
  }
  const planned = buildPlan(plan, issues);
  const {rows, artifacts} = await checkRows(result, planned, dirname(resultInput.provenance.resolvedPath), issues, signal);
  checkFailureSummary(result, rows, issues);
  const seams = checkSeams(plan, planned, rows, issues);
  const coverage = [...planned.entries()].map(([key, phase]) => {
    const {row, artifact, verified = false} = rows.get(key) ?? {};
    return {caseKey:phase.caseKey, caseName:phase.caseName, phase:phase.phase, required:phase.required,
      status:row?.status ?? 'missing', verified, plannedLevel:phase.level, level:row?.level ?? null,
      gap:row?.gap, artifact:artifact?.archivePath};
  });
  const failed = coverage.some(row => row.status === 'fail') || seams.some(seam => seam.status === 'fail');
  const pending = !coverage.some(row => executed(row.status)) || coverage.some(row => row.status === 'blocked'
    || row.status === 'pending' || (row.required && row.status === 'na')) || seams.some(seam => seam.status === 'pending');
  return publish(resolve(output), inputs, artifacts, signal, prepared => {
    const timing = checkTiming(plan, result, rows, prepared, issues);
    const status = issues.length ? 'protocol-error' : failed ? 'failed' : pending ? 'pending' : 'passed';
    const exitCode = status === 'passed' ? 0 : status === 'failed' ? 1 : 2;
    return {status, exitCode, comparison:{baseSha:plan.baseSha,headSha:plan.headSha},
      inputs:provenance, coverage, failures:Array.isArray(result.failures) ? result.failures : [], seams, timing, issues,
      evidenceFiles:Object.fromEntries([...artifacts].map(([path, artifact]) => [path, artifact.archivePath]))};
  });
}

async function main() {
  const {values} = parseArgs({options:{plan:{type:'string'}, result:{type:'string'}, out:{type:'string'}, mark:{type:'string'}}});
  if (values.mark && !values.plan && !values.result && !values.out) {
    process.stdout.write(JSON.stringify(markMilestone(values.mark))+'\n');
    return;
  }
  if (!values.plan || !values.result || values.mark) throw new Error('Use --plan <json> --result <json> [--out <runs>] or --mark <stage>');
  const controller = new AbortController();
  for (const signal of Object.keys(interruptExitCodes)) {
    process.on(signal, () => controller.abort(new ArchiveInterrupted(signal)));
  }
  try {
    const summary = await validateAndArchive({planPath:values.plan, resultPath:values.result, output:values.out, signal:controller.signal});
    process.exitCode = summary.exitCode;
    process.stdout.write(JSON.stringify(summary, null, 2)+'\n');
  } catch (error) {
    throw abortReason(error, controller.signal);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    const interrupted = error.name === 'ArchiveInterrupted';
    const exitCode = interrupted ? interruptExitCodes[error.signal] : 2;
    process.exitCode = exitCode;
    process.stdout.write(JSON.stringify({status:interrupted ? 'interrupted' : 'protocol-error', exitCode,
      ...(interrupted ? {signal:error.signal} : {}), issues:[{
        code:interrupted ? 'archive-interrupted' : 'evidence-tool-error', detail:error.message,
        ...(error.code ? {errorCode:error.code} : {}), ...(error.archive ? {archive:error.archive} : {}),
        ...(error.archiveCleanup ? {cleanup:error.archiveCleanup} : {})
      }]})+'\n');
  });
}
