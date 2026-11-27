import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { link, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { promisify } from 'node:util';

import { markMilestone, validateAndArchive } from './evidence.mjs';

const executable = resolve(dirname(fileURLToPath(import.meta.url)), 'evidence.mjs');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const baseSha = 'b'.repeat(40);
const headSha = 'a'.repeat(40);
const caseKey = 'send-reviewed-values';
const caseName = '校验待签交易';
const phase = name => ({phase:name, required:true, level:'source', expected:true});
const endpoint = name => ({caseKey, phase:name});
const originalPayload = {recipient:'recipient A', amount:'1.2500', network:'synthetic test chain', memo:null};

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'preview-evidence-test-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const planPath = join(root, 'plan.json');
  const resultPath = join(root, 'result.json');
  const output = join(root, 'runs');
  const plan = {baseSha, headSha, targetConfirmed:markMilestone('target-confirmed'),
    cases:[{key:caseKey, name:caseName, phases:[phase('review'), phase('sign')]}],
    seams:[{key:'review-sign',from:endpoint('review'),to:endpoint('sign'), fields:['recipient','amount','network']}]};
  const material = markMilestone('material');
  const result = {baseSha, headSha, rows:plan.cases[0].phases.map(item => ({
    caseKey, caseName, phase:item.phase, status:'pass', level:'source', actual:true
  })), failures:[], milestones:{material}};
  const inputs = {planPath, resultPath, output};
  async function capture(index, changes = {}) {
    const row = result.rows[index];
    const path = row.phase+'.json';
    const bytes = JSON.stringify({attempt:'fixture attempt', payload:originalPayload, ...changes})+'\n';
    await writeFile(join(root, path), bytes);
    row.evidence = {path, sha256:digest(bytes)};
  }
  await capture(0);
  result.milestones.firstEvidence = {...markMilestone('first-evidence'), ...endpoint('review'),sha256:result.rows[0].evidence.sha256};
  await capture(1);
  async function writeInputs() {
    await Promise.all([writeFile(planPath, JSON.stringify(plan)+'\n'), writeFile(resultPath, JSON.stringify(result)+'\n')]);
  }
  async function verify() {
    await writeInputs();
    return validateAndArchive(inputs);
  }
  async function cli() {
    await writeInputs();
    const response = await promisify(execFile)(process.execPath, [executable, '--plan', planPath, '--result', resultPath, '--out', output])
      .then(output => ({code:0,...output}), error => error);
    return {code:response.code, report:JSON.parse(response.stdout)};
  }
  return {root, output, plan, result, capture, writeInputs, inputs, verify, cli};
}

async function verifyManifest(run, status) {
  const manifest = JSON.parse(await readFile(join(run, 'manifest.json')));
  assert.equal(manifest.status, status);
  for (const [path, fingerprint] of Object.entries(manifest.artifacts)) {
    assert.equal(digest(await readFile(join(run, path))), fingerprint, path);
  }
  return manifest;
}

const hasIssue = (report, code) => report.issues.some(issue => issue.code === code);

test('CLI captures monotonic markers and publishes passing evidence with original input hashes', async t => {
  const item = await fixture(t);
  const mark = JSON.parse((await promisify(execFile)(process.execPath, [executable, '--mark', 'first-evidence'])).stdout);
  assert.equal(mark.stage, 'first-evidence');
  assert.equal(mark.host, item.plan.targetConfirmed.host);
  assert(new Date(mark.wallClockAt).toISOString() === mark.wallClockAt);
  assert(BigInt(mark.monotonicNs) >= BigInt(item.plan.targetConfirmed.monotonicNs));
  const {code, report} = await item.cli();
  assert.equal(code, 0);
  assert.equal(report.status, 'passed');
  assert.equal(report.coverage.length, 2);
  assert.deepEqual(report.seams, [{key:'review-sign',status:'pass'}]);
  assert(report.publicationReceipt.elapsedMs >= report.timing.elapsedMs['first-evidence']);
  assert(report.timing.elapsedMs['first-evidence'] >= report.timing.elapsedMs.material);
  const manifest = await verifyManifest(report.runDirectory, 'passed');
  const archived = JSON.parse(await readFile(join(report.runDirectory, 'summary.json')));
  assert.equal(archived.timing.delivery, undefined);
  assert.equal(archived.timing.elapsedMs.delivery, undefined);
  assert.equal(archived.timing.prepared.stage, 'prepared');
  assert.equal(report.publicationReceipt.runDirectory, report.runDirectory);
  assert.equal(report.publicationReceipt.manifestSha256, digest(await readFile(join(report.runDirectory, 'manifest.json'))));
  assert.equal(manifest.artifacts['plan.json'], digest(await readFile(item.inputs.planPath)));
  assert.equal(manifest.artifacts['result.json'], digest(await readFile(item.inputs.resultPath)));
});

test('an actual failed result exits 1; deleting it, omitting its summary, or dropping signing cannot pass', async t => {
  const item = await fixture(t);
  const failed = item.result.rows[1];
  failed.status = 'fail';
  failed.actual = false;
  item.result.failures.push({...endpoint('sign'),reason:'signed value did not match'});
  const complete = await item.cli();
  assert.equal(complete.code, 1);
  assert.equal(complete.report.status, 'failed');
  const [summary] = item.result.failures.splice(0);
  assert(hasIssue(await item.verify(), 'unsummarized-failure'));
  item.result.failures.push(summary);
  item.result.rows.pop();
  const removed = await item.verify();
  assert.equal(removed.exitCode, 2);
  assert(removed.issues.some(issue => issue.code === 'missing-result-row' && issue.phase === 'sign' && issue.required));
  assert(removed.coverage.some(row => row.phase === 'sign' && row.caseName === caseName && row.status === 'missing'));
  assert(hasIssue(removed, 'invalid-summarized-failure'));
});

test('SHA, evidence level, case name, outcome contradictions, and duplicate rows are checked', async t => {
  const item = await fixture(t);
  item.result.headSha = 'e'.repeat(40);
  item.result.rows[0].level = 'reconstruction';
  item.result.rows[0].actual = false;
  item.result.rows.push({...item.result.rows[0]});
  item.result.rows[1].caseName = '其他场景';
  const report = await item.verify();
  assert.equal(report.exitCode, 2);
  for (const code of ['comparison-sha-mismatch','evidence-level-mismatch','outcome-contradicts-evidence',
    'duplicate-result-row','invalid-result-row','missing-result-row']) assert(hasIssue(report, code), code);
});

test('deleted and tampered evidence cannot be linked or copied into a new final archive', async t => {
  const item = await fixture(t);
  const {path:review} = item.result.rows[0].evidence;
  const {path:sign} = item.result.rows[1].evidence;
  await writeFile(join(item.root, review), 'output changed after fingerprint');
  await rm(join(item.root, sign));
  const report = await item.verify();
  assert.equal(report.exitCode, 2);
  assert(hasIssue(report, 'evidence-digest-mismatch'));
  assert(hasIssue(report, 'evidence-unreadable'));
  assert(hasIssue(report, 'unverified-first-evidence'));
  assert.deepEqual(report.evidenceFiles, {});
  await verifyManifest(report.runDirectory, 'protocol-error');
});

test('a declared evidence reference cannot read outside the result directory', async t => {
  const item = await fixture(t);
  const nested = join(item.root, 'inputs');
  const resultPath = join(nested, 'result.json');
  await mkdir(nested);
  const row = item.result.rows[0];
  row.evidence.path = '../review.json';
  await item.writeInputs();
  await writeFile(resultPath, JSON.stringify(item.result));
  const report = await validateAndArchive({...item.inputs, resultPath});
  assert.equal(report.exitCode, 2);
  assert(report.issues.some(issue => issue.code === 'evidence-unreadable' && issue.phase === 'review'));
  assert.equal(Object.hasOwn(report.evidenceFiles, '../review.json'), false);
});

test('an executed row with only actual lacks its required captured file', async t => {
  const item = await fixture(t);
  item.plan.seams = [];
  delete item.result.rows[1].evidence;
  const report = await item.verify();
  assert.equal(report.exitCode, 2);
  assert(report.issues.some(issue => issue.code === 'missing-execution-evidence' && issue.phase === 'sign'));
});

test('an executed row with only a captured file lacks its required actual value', async t => {
  const item = await fixture(t);
  item.plan.seams = [];
  delete item.result.rows[1].actual;
  const report = await item.verify();
  assert.equal(report.exitCode, 2);
  assert(report.issues.some(issue => issue.code === 'missing-execution-actual' && issue.phase === 'sign'));
});

test('seams reject different attempts, shared evidence, invented row payloads, and missing/null fields', async t => {
  const item = await fixture(t);
  const signed = item.result.rows[1];
  signed.payload = {...originalPayload, recipient:'different recipient'};
  assert(hasIssue(await item.verify(), 'invalid-seam-evidence'));
  delete signed.payload;
  await item.capture(1, {attempt:'another attempt'});
  let report = await item.verify();
  assert.equal(report.exitCode, 2);
  assert(report.issues.some(issue => issue.code === 'invalid-seam-evidence' && /different attempts/u.test(issue.detail)));
  signed.evidence = item.result.rows[0].evidence;
  report = await item.verify();
  assert(report.issues.some(issue => issue.code === 'invalid-seam-evidence' && /independent/u.test(issue.detail)));
  await link(join(item.root, 'review.json'), join(item.root, 'alias.json'));
  signed.evidence = {...signed.evidence,path:'alias.json'};
  report = await item.verify();
  assert(report.issues.some(issue => issue.code === 'invalid-seam-evidence' && /independent/u.test(issue.detail)));
  await item.capture(1);
  item.plan.seams[0].fields.push('absentOnBoth');
  assert(hasIssue(await item.verify(), 'invalid-seam-evidence'));
  item.plan.seams[0].fields.pop();
  item.plan.seams[0].fields.push('memo');
  assert(hasIssue(await item.verify(), 'invalid-seam-evidence'));
  item.plan.seams[0].fields[3] = {path:'memo',allowNull:true};
  assert.equal((await item.verify()).exitCode, 0);
});

test('a verified same-attempt payload difference fails with the changed field', async t => {
  const item = await fixture(t);
  await item.capture(1, {payload:{...originalPayload, amount:'1.2501'}});
  const report = await item.verify();
  assert.equal(report.exitCode, 1);
  assert.deepEqual(report.seams, [{key:'review-sign',status:'fail',differences:['amount']}]);
});

test('pending rows can be archived and have no passing claim', async t => {
  const item = await fixture(t);
  for (const row of item.result.rows) {
    delete row.actual;
    delete row.evidence;
    row.status = 'pending';
    row.level = null;
    row.gap = '没有可用的隔离夹具';
  }
  item.result.milestones = {};
  const report = await item.verify();
  assert.equal(report.exitCode, 2);
  assert.equal(report.status, 'pending');
  assert.deepEqual(report.issues, []);
  assert(report.coverage.every(row => row.status === 'pending' && row.gap));
  await verifyManifest(report.runDirectory, 'pending');
});

test('executed runs need linked first evidence and the target clock cannot reset', async t => {
  const item = await fixture(t);
  const first = item.result.milestones.firstEvidence;
  delete item.result.milestones.firstEvidence;
  assert(hasIssue(await item.verify(), 'missing-first-evidence'));
  item.result.milestones.firstEvidence = {...first, sha256:'c'.repeat(64)};
  const invalidLink = await item.verify();
  assert(hasIssue(invalidLink, 'unverified-first-evidence'));
  assert.equal(invalidLink.timing.verified, false);
  assert.equal(invalidLink.timing.firstEvidence, undefined);
  assert.equal(invalidLink.timing.elapsedMs, undefined);
  item.result.milestones.firstEvidence = first;
  item.plan.targetConfirmed.monotonicNs = (BigInt(first.monotonicNs)+1n).toString();
  const report = await item.verify();
  assert.equal(report.exitCode, 2);
  assert(report.issues.some(issue => issue.code === 'reversed-milestones' && issue.stage === 'material'));
  assert.equal(report.timing.elapsedMs, undefined);
});

test('zero, false and null are explicit actual values', async t => {
  const item = await fixture(t);
  for (const actual of [0,false,null]) {
    item.plan.cases[0].phases[1].expected = actual;
    item.result.rows[1].actual = actual;
    assert.equal((await item.verify()).exitCode, 0);
  }
});

test('raw signed zero and the portable negative-zero tag compare exactly', async t => {
  const item = await fixture(t);
  item.plan.cases[0].phases[0].expected = {type:'number',value:'-0'};
  item.result.rows[0].actual = 'SIGNED_ZERO';
  await item.writeInputs();
  const raw = (await readFile(item.inputs.resultPath, 'utf8')).replace('"SIGNED_ZERO"','-0');
  await writeFile(item.inputs.resultPath, raw);
  const preserved = await validateAndArchive(item.inputs);
  assert.equal(preserved.exitCode, 0);
  assert.equal(await readFile(join(preserved.runDirectory,'result.json'), 'utf8'), raw);
  item.result.rows[0].actual = 0;
  const positive = await item.verify();
  assert(hasIssue(positive, 'outcome-contradicts-evidence'));
});

test('repeated and concurrent runs never modify the existing archive or rely on original logs', async t => {
  const item = await fixture(t);
  await mkdir(item.output);
  await writeFile(join(item.output, 'existing-result.txt'), 'existing evidence');
  await item.writeInputs();
  const [first, second] = await Promise.all([validateAndArchive(item.inputs),validateAndArchive(item.inputs)]);
  assert.notEqual(first.runDirectory, second.runDirectory);
  const baseline = await verifyManifest(first.runDirectory, 'passed');
  await verifyManifest(second.runDirectory, 'passed');
  await rm(join(item.root, 'review.json'));
  assert.equal((await item.verify()).exitCode, 2);
  assert.deepEqual(await verifyManifest(first.runDirectory, 'passed'), baseline);
  assert.equal(await readFile(join(item.output,'existing-result.txt'), 'utf8'), 'existing evidence');
  assert.equal((await readdir(item.output)).filter(name => name.startsWith('run-')).length, 3);
  assert(!(await readdir(item.output)).some(name => name.startsWith('.staging-')));
});

async function runWithArchiveFault(item, mode, signal) {
  const preload = join(item.root, 'archive-fault.cjs');
  await writeFile(preload, `
    const fs = require('node:fs/promises');
    const {basename,join,sep} = require('node:path');
    const {writeSync} = require('node:fs');
    const {setTimeout:delay} = require('node:timers/promises');
    const mode = ${JSON.stringify(mode)};
    const staged = file => file.split(sep).some(part=>part.startsWith('.staging-'));
    const report = () => writeSync(2,'ARCHIVE_CHECKPOINT\\n');
    const write = fs.writeFile, rename = fs.rename, remove = fs.rm, read = fs.readFile;
    fs.readFile = async (file,...args) => {
      const published = file.includes(sep+'run-') && !staged(file);
      if (published && basename(file)==='result.json') {
        if (mode==='published-read-error') throw Object.assign(Error('fixture final read failure'),{code:'EIO'});
        if (mode==='delayed-publication') await delay(220);
      }
      return read(file,...args);
    };
    fs.writeFile = async (file,...args) => {
      if (staged(file) && basename(file)==='summary.json') {
        if (mode==='writing') {report();await delay(220);}
        if (mode==='delayed-publication') await delay(220);
        if (mode==='write-error') throw Object.assign(Error('fixture disk write failure'),{code:'EIO'});
      }
      const result = await write(file,...args);
      if (mode==='corrupt-write' && staged(file) && basename(file)==='result.json') await write(file,'changed after write');
      return result;
    };
    fs.rename = async (file,...args) => {
      if (mode==='committing' && staged(file)) {report();await delay(220);}
      if (mode==='delayed-publication') await delay(220);
      const result = await rename(file,...args);
      if (['corrupt-published','corrupt-published-cleanup'].includes(mode) && staged(file)) await write(join(args[0],'result.json'),'changed during publication');
      return result;
    };
    fs.rm = async (file,...args) => {
      if (mode==='write-error' && staged(file)) throw Object.assign(Error('fixture archive cleanup failure'),{code:'EACCES'});
      if (mode==='corrupt-published-cleanup' && file.includes(sep+'run-')) throw Object.assign(Error('fixture published cleanup failure'),{code:'EACCES'});
      return remove(file,...args);
    };
    require('node:module').syncBuiltinESMExports();
  `);
  const {planPath,resultPath,output} = item.inputs;
  const child = spawn(process.execPath, ['--require', preload, executable, '--plan', planPath, '--result', resultPath, '--out', output], {
    stdio:['ignore','pipe','pipe']
  });
  let stdout = '';
  let stderr = '';
  let sent = false;
  child.stdout.setEncoding('utf8').on('data', chunk => {stdout += chunk;});
  child.stderr.setEncoding('utf8').on('data', chunk => {
    stderr += chunk;
    if (signal && !sent && stderr.includes('ARCHIVE_CHECKPOINT')) sent = child.kill(signal);
  });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 4000);
  try {
    const [code, osSignal] = await once(child, 'close');
    return {code, osSignal, sent, report:stdout ? JSON.parse(stdout) : undefined};
  } finally {
    clearTimeout(timeout);
  }
}

test('SIGINT and SIGTERM before archive submission clean only their own staging', {skip:process.platform === 'win32'}, async t => {
  const item = await fixture(t);
  const baseline = await item.verify();
  const previous = await verifyManifest(baseline.runDirectory,'passed');
  const inputs = await Promise.all([readFile(item.inputs.planPath),readFile(item.inputs.resultPath)]);
  const existing = await readdir(item.output);
  for (const [signal,code] of [['SIGINT',130],['SIGTERM',143]]) {
    const outcome = await runWithArchiveFault(item,'writing',signal);
    assert(outcome.sent);
    assert.deepEqual(await readdir(item.output),existing);
    assert.equal(outcome.code,code);
    assert.equal(outcome.osSignal,null);
    assert.equal(outcome.report.status,'interrupted');
    assert.equal(outcome.report.signal,signal);
    assert.equal(outcome.report.runDirectory,undefined);
  }
  assert.deepEqual(await Promise.all([readFile(item.inputs.planPath),readFile(item.inputs.resultPath)]),inputs);
  assert.deepEqual(await verifyManifest(baseline.runDirectory,'passed'),previous);
});

test('SIGINT and SIGTERM after archive submission leave the published verdict and CLI code consistent', {skip:process.platform === 'win32'}, async t => {
  const item = await fixture(t);
  await item.writeInputs();
  for (const signal of ['SIGINT','SIGTERM']) {
    const outcome = await runWithArchiveFault(item,'committing',signal);
    assert(outcome.sent);
    assert.equal(outcome.code,0);
    assert.equal(outcome.osSignal,null);
    assert.equal(outcome.report.status,'passed');
    await verifyManifest(outcome.report.runDirectory,'passed');
    assert.equal(outcome.report.publicationReceipt.runDirectory,outcome.report.runDirectory);
  }
  assert.equal((await readdir(item.output)).length,2);
});

test('a write failure remains primary when staging cleanup also fails', async t => {
  const item = await fixture(t);
  const baseline = await item.verify();
  const previous = await verifyManifest(baseline.runDirectory,'passed');
  const outcome = await runWithArchiveFault(item,'write-error');
  assert.equal(outcome.code,2);
  assert.equal(outcome.report.status,'protocol-error');
  assert.equal(outcome.report.runDirectory,undefined);
  assert.equal(outcome.report.issues[0].detail,'fixture disk write failure');
  assert.equal(outcome.report.issues[0].errorCode,'EIO');
  assert.equal(outcome.report.issues[0].cleanup.code,'EACCES');
  assert.equal(outcome.report.issues[0].cleanup.message,'fixture archive cleanup failure');
  assert.equal((await readdir(item.output)).filter(name=>name.startsWith('run-')).length,1);
  assert.deepEqual(await verifyManifest(baseline.runDirectory,'passed'),previous);
});

test('library callers can abort before an archive is opened', async t => {
  const item = await fixture(t);
  await item.writeInputs();
  const reason = new Error('caller stopped this archive');
  await assert.rejects(validateAndArchive({...item.inputs,signal:AbortSignal.abort(reason)}),error=>error===reason);
  await assert.rejects(readdir(item.output), {code:'ENOENT'});
});

test('the publication receipt includes archive writes and final readback without rewriting frozen timing', async t => {
  const item = await fixture(t);
  await item.writeInputs();
  const outcome = await runWithArchiveFault(item, 'delayed-publication');
  assert.equal(outcome.code, 0);
  const {report} = outcome;
  const prepared = report.timing.prepared;
  const receipt = report.publicationReceipt;
  assert.ok(receipt, 'a completed publication must return its independently timed receipt');
  assert.ok(prepared, 'frozen archive timing must identify the preparation boundary');
  assert(Number(BigInt(receipt.delivery.monotonicNs)-BigInt(prepared.monotonicNs))/1e6 >= 600);
  assert(receipt.elapsedMs >= report.timing.elapsedMs.prepared+600);
  assert.equal(receipt.manifestSha256, digest(await readFile(join(report.runDirectory, 'manifest.json'))));
  const frozen = JSON.parse(await readFile(join(report.runDirectory, 'summary.json')));
  assert.deepEqual(frozen.timing, report.timing);
  assert.equal(frozen.publicationReceipt, undefined);
});

test('staging and post-publication byte changes cannot produce passing archives', async t => {
  const item = await fixture(t);
  const baseline = await item.verify();
  const original = await verifyManifest(baseline.runDirectory, 'passed');
  for (const mode of ['corrupt-write', 'corrupt-published']) {
    const outcome = await runWithArchiveFault(item, mode);
    assert.equal(outcome.code, 2, mode);
    assert.equal(outcome.report.status, 'protocol-error');
    assert.equal(outcome.report.issues[0].errorCode, 'ARCHIVE_INTEGRITY');
    assert.equal(outcome.report.issues[0].archive.phase, mode === 'corrupt-write' ? 'staging-verification' : 'published-verification');
    assert.equal((await readdir(item.output)).filter(name => name.startsWith('run-')).length, 1);
    assert(!(await readdir(item.output)).some(name => name.startsWith('.staging-')));
    assert.deepEqual(await verifyManifest(baseline.runDirectory, 'passed'), original);
  }
});

test('invalid or unreadable input archives preserve available original bytes, identities, and comparisons', async t => {
  const item = await fixture(t);
  const baseline = await item.verify();
  const original = await verifyManifest(baseline.runDirectory, 'passed');
  const planBytes = await readFile(item.inputs.planPath);
  const invalid = Buffer.from('{');
  await writeFile(item.inputs.resultPath, invalid);
  const blocked = await validateAndArchive(item.inputs);
  assert.equal(blocked.status, 'protocol-error');
  assert.equal(blocked.exitCode, 2);
  assert.deepEqual(blocked.comparison, {baseSha, headSha});
  assert.equal(blocked.inputs.plan.path, item.inputs.planPath);
  assert.equal(blocked.inputs.plan.sha256, digest(planBytes));
  assert.equal(blocked.inputs.result.sha256, digest(invalid));
  assert.equal(blocked.inputs.result.error.stage, 'parse');
  assert.deepEqual(await readFile(join(blocked.runDirectory, 'plan.json')), planBytes);
  assert.deepEqual(await readFile(join(blocked.runDirectory, 'result.json')), invalid);
  await verifyManifest(blocked.runDirectory, 'protocol-error');
  await rm(item.inputs.planPath);
  await writeFile(item.inputs.resultPath, JSON.stringify(item.result));
  const unreadable = await validateAndArchive(item.inputs);
  assert.equal(unreadable.exitCode, 2);
  assert.deepEqual(unreadable.comparison, {baseSha, headSha});
  assert.equal(unreadable.inputs.plan.error.stage, 'read');
  assert.equal(unreadable.inputs.plan.error.code, 'ENOENT');
  assert.equal(unreadable.inputs.result.sha256, digest(await readFile(item.inputs.resultPath)));
  assert.equal(unreadable.inputs.plan.sha256, undefined);
  await verifyManifest(unreadable.runDirectory, 'protocol-error');
  assert.deepEqual(await verifyManifest(baseline.runDirectory, 'passed'), original);
});

test('published read and cleanup errors retain their own diagnostics without a passing return', async t => {
  const item = await fixture(t);
  await item.writeInputs();
  const readFailure = await runWithArchiveFault(item, 'published-read-error');
  assert.equal(readFailure.code,2);
  assert.equal(readFailure.report.status,'protocol-error');
  assert.equal(readFailure.report.issues[0].errorCode,'EIO');
  assert.equal(readFailure.report.issues[0].archive.phase,'published-verification');
  assert.deepEqual(await readdir(item.output),[]);
  const cleanupFailure = await runWithArchiveFault(item, 'corrupt-published-cleanup');
  assert.equal(cleanupFailure.code,2);
  assert.equal(cleanupFailure.report.status,'protocol-error');
  const issue = cleanupFailure.report.issues[0];
  assert.equal(issue.errorCode,'ARCHIVE_INTEGRITY');
  assert.equal(issue.cleanup.code,'EACCES');
  assert.equal(issue.archive.phase,'published-verification');
  assert.equal(issue.archive.submitted,true);
  assert.equal(issue.archive.artifact,'result.json');
  assert.equal((await readdir(item.output)).length,1);
  assert.equal(basename(issue.archive.runDirectory),(await readdir(item.output))[0]);
});
