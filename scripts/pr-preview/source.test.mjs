import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { devNull, tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { createTypeScriptTools, fingerprintDependency, readGitSource } from './source.mjs';

const sha256 = data => createHash('sha256').update(data).digest('hex');
const shellEnvironment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
const gitEnv = {
  ...shellEnvironment, GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_GLOBAL:devNull,
  GIT_CONFIG_SYSTEM:devNull, GIT_ATTR_NOSYSTEM:'1',
  GIT_AUTHOR_NAME:'Preview Fixture', GIT_AUTHOR_EMAIL:'fixture@example.invalid',
  GIT_COMMITTER_NAME:'Preview Fixture', GIT_COMMITTER_EMAIL:'fixture@example.invalid',
};

function git(repository, ...args) {
  return execFileSync('git', [
    '-c', 'core.excludesFile='+devNull, '-c', 'core.attributesFile='+devNull,
    '-c', 'core.hooksPath='+devNull, '-c', 'init.templateDir=', ...args,
  ], {cwd:repository, env:gitEnv, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim();
}

function fixture(t) {
  const home = mkdtempSync(join(tmpdir(),'preview-source-test-'));
  t.after(() => rmSync(home,{recursive:true,force:true}));
  const repository = join(home,'wanted');
  const other = join(home,'other');
  for (const dir of [repository,other]) {
    mkdirSync(dir);
    git(dir,'init','-q');
    git(dir,'config','core.autocrlf','false');
  }
  return {home,repository,other};
}

function commit(repository,path,contents) {
  writeFileSync(join(repository,path),contents);
  git(repository,'add','--',path);
  git(repository,'commit','-qm','fixture');
  return git(repository,'rev-parse','HEAD');
}

test('synthetic Git initialization ignores XDG ignore and attributes defaults', t => {
  const directory = mkdtempSync(join(tmpdir(), 'preview-global-rules-'));
  t.after(() => rmSync(directory, {recursive:true, force:true}));
  const config = join(directory, 'config');
  mkdirSync(join(config, 'git'), {recursive:true});
  writeFileSync(join(config, 'git/ignore'), '*.ts\n');
  writeFileSync(join(config, 'git/attributes'), '*.ts text eol=crlf\n');
  const childEnvironment = Object.fromEntries(Object.entries(shellEnvironment)
    .filter(([key]) => key !== 'NODE_TEST_CONTEXT'));
  const output = execFileSync(process.execPath, [
    '--test', '--test-name-pattern=^fixed object capture ', fileURLToPath(import.meta.url),
  ], {env:{...childEnvironment, XDG_CONFIG_HOME:config}, encoding:'utf8'});
  assert.match(output, /# pass 1\b/);
  assert.match(output, /# fail 0\b/);
});

test('fixed object capture ignores inherited Git locations, configs, replacement refs, and working copy', t => {
  const {home,repository,other} = fixture(t);
  const path = 'with space.ts';
  const actual = Buffer.from('export const value = "海";\r\n','utf8');
  const sha = commit(repository,path,actual);
  const blobSha = git(repository,'rev-parse',sha+':'+path);
  const replacement = commit(repository,path,'export const value = "replacement";\n');
  git(repository,'replace',sha,replacement);
  commit(other,path,'export const value = "wrong repository";\n');
  writeFileSync(join(repository,path),'export const value = "unstaged";\n');
  const config = join(home,'.gitconfig');
  writeFileSync(config,'[broken configuration\n');

  const script = `
    import {readGitSource} from ${JSON.stringify(new URL('./source.mjs',import.meta.url).href)};
    const result=readGitSource({repository:process.argv[1],sha:process.argv[2],path:process.argv[3]});
    console.log(JSON.stringify({...result,bytes:result.bytes.toString('hex')}));
  `;
  const stdout = execFileSync(process.execPath,['--input-type=module','-e',script,repository,sha,path],{
    encoding:'utf8',env:{
      ...shellEnvironment, HOME:home, GIT_DIR:join(other,'.git'), GIT_COMMON_DIR:join(other,'.git'),
      GIT_WORK_TREE:other, GIT_INDEX_FILE:join(other,'.git','index'),
      GIT_OBJECT_DIRECTORY:join(other,'.git','objects'), GIT_ALTERNATE_OBJECT_DIRECTORIES:join(other,'.git','objects'),
      GIT_NAMESPACE:'foreign', GIT_CONFIG_COUNT:'1', GIT_CONFIG_KEY_0:'core.bare', GIT_CONFIG_VALUE_0:'true',
      GIT_CONFIG_PARAMETERS:'malformed', GIT_CONFIG_GLOBAL:config, GIT_CONFIG_SYSTEM:config,
      GIT_NO_REPLACE_OBJECTS:'0',
    },
  });
  assert.deepEqual(JSON.parse(stdout),{sha,path,blobSha,sha256:sha256(actual),bytes:actual.toString('hex')});
});

test('capture requires a full commit object and repository-relative blob path', t => {
  const {repository} = fixture(t);
  const path = 'source.ts';
  const sha = commit(repository,path,'export const value = 7;\n');
  const blob = git(repository,'rev-parse',sha+':'+path);
  assert.throws(() => readGitSource({repository,sha:'HEAD',path}),/完整|full/i);
  assert.throws(() => readGitSource({repository,sha:sha.slice(0,9),path}),/完整|full/i);
  assert.throws(() => readGitSource({repository,sha:blob,path}),/commit/i);
  for (const unsafePath of ['/source.ts','../source.ts','./source.ts','dir//source.ts','dir\\source.ts']) {
    assert.throws(() => readGitSource({repository,sha,path:unsafePath}),/path/i);
  }
  assert.throws(() => readGitSource({repository,sha,path:'missing.ts'}),/missing\.ts/);
});

test('SHA-256 repositories require the full 64-character ID and retain the blob hash', t => {
  const {home} = fixture(t);
  const repository = join(home,'sha256');
  mkdirSync(repository);
  git(repository,'init','-q','--object-format=sha256');
  const path = 'source.ts';
  const sha = commit(repository,path,'export const value = 7;\n');
  const actual = readGitSource({repository,sha,path});
  assert.equal(sha.length,64);
  assert.equal(actual.blobSha,git(repository,'rev-parse',sha+':'+path));
  assert.throws(() => readGitSource({repository,sha:sha.slice(0,40),path}),/full/i);
});

const tools = () => createTypeScriptTools({from:new URL('../../',import.meta.url)});

test('method extraction requires class, records exact source and snippet digests, and rejects ambiguity', () => {
  const source = 'class First {\n  quote(value: number) {\n    return value + 1;\n  }\n}\n'
    + 'class Second {\n  quote(value: number) { return value + 2; }\n}\n';
  const filePath = 'fixture.ts';
  const selection = {kind:'method',className:'First',name:'quote'};
  const ts = tools();
  const result = ts.extract({source,filePath,selection});
  const snippet = 'quote(value: number) {\n    return value + 1;\n  }';
  assert.equal(result.source,snippet);
  assert.equal(result.filePath,filePath);
  assert.equal(result.startLine,2);
  assert.equal(result.endLine,4);
  assert.equal(result.sourceSha256,sha256(source));
  assert.equal(result.sha256,sha256(snippet));
  const second = ts.extract({source,filePath,selection:{...selection,className:'Second'}});
  assert.match(second.source,/value \+ 2/);
  assert.throws(() => ts.extract({source,filePath,selection:{kind:'method',name:'quote'}}),/className/);
  assert.throws(() => ts.extract({source:source+'{ class First { quote() { return 0; } } }',filePath,selection}),/ambiguous/i);
  assert.throws(() => ts.extract({source:'class First { quote() { return 1; } static quote() { return 2; } }',filePath,selection}),/ambiguous/i);
});

test('function, variable and a specifically indexed callback preserve original source', () => {
  const source = 'export function scale(v: number) { return v * 2; }\n'
    + 'const limit = 5_000;\nconst handler = useCallback(ignored, (v: number) => scale(v));\n';
  const filePath = 'fixture.ts';
  const ts = tools();
  const extract = selection=>ts.extract({source,filePath,selection}).source;
  assert.equal(extract({kind:'function',name:'scale'}),'export function scale(v: number) { return v * 2; }');
  assert.equal(extract({kind:'variable',name:'limit'}),'limit = 5_000');
  assert.equal(extract({kind:'callback',name:'handler',argumentIndex:1}),'(v: number) => scale(v)');
  assert.throws(() => extract({kind:'callback',name:'handler',argumentIndex:0}),/function|callback/i);
  assert.throws(() => extract({kind:'callback',name:'handler'}),/argumentIndex/);
  assert.throws(() => extract({kind:'unsupported',name:'handler'}),/kind/);
  assert.throws(() => ts.extract({source:source+'{ function scale(v: number) { return v; } }',filePath,
    selection:{kind:'function',name:'scale'}}),/ambiguous/i);
});

test('an overloaded function extracts its only executable implementation and exact location', () => {
  const snippet = 'export function scale(v: string | number) {\n  return typeof v === "string" ? v.length : v;\n}';
  const source = 'export function scale(v: string): number;\nexport function scale(v: number): number;\n'+snippet+'\n';
  const filePath = 'fixture.ts';
  assert.deepEqual(tools().extract({source,filePath,selection:{kind:'function',name:'scale'}}),{
    source:snippet,filePath,startLine:3,endLine:5,sourceSha256:sha256(source),sha256:sha256(snippet),
  });
});

test('an overloaded class method extracts its only executable implementation', () => {
  const snippet = 'quote(value: string | number) {\n    return typeof value === "string" ? value.length : value;\n  }';
  const source = 'class First {\n  quote(value: string): number;\n  quote(value: number): number;\n  '+snippet+'\n}\n'
    + 'class Second { quote() { return 0; } }';
  const filePath = 'fixture.ts';
  assert.deepEqual(tools().extract({source,filePath,selection:{kind:'method',className:'First',name:'quote'}}),{
    source:snippet,filePath,startLine:4,endLine:6,sourceSha256:sha256(source),sha256:sha256(snippet),
  });
});

test('declaration-only functions and abstract methods need an executable implementation', () => {
  const ts = tools();
  const filePath = 'fixture.ts';
  assert.throws(() => ts.extract({source:'declare function scale(value: number): number;',filePath,
    selection:{kind:'function',name:'scale'}}),/cannot find executable implementation for function scale/i);
  assert.throws(() => ts.extract({source:'abstract class First { abstract quote(): number; }',filePath,
    selection:{kind:'method',className:'First',name:'quote'}}),/cannot find executable implementation for method First\.quote/i);
});

test('transpilation removes types and returns input/output fingerprints without executing the result', () => {
  const source = 'import type { Rate } from "./types";\nimport { audit } from "./side-effect";\n'
    + 'export const scale = (value: Rate) => value * 2;\nthrow new Error("fixture is never evaluated");\n';
  const ts = tools();
  const result = ts.transpile({source,filePath:'fixture.ts'});
  assert.match(result.code,/import \{ audit \} from ["']\.\/side-effect["']/);
  assert.match(result.code,/export const scale = \(value\) => value \* 2/);
  assert.match(result.code,/fixture is never evaluated/);
  assert.doesNotMatch(result.code,/import type|value: Rate/);
  assert.equal(result.sourceSha256,sha256(source));
  assert.equal(result.sha256,sha256(result.code));
});

test('dependency fingerprints match locally resolved package and syntax errors identify file and line', () => {
  const from = new URL('../../',import.meta.url);
  const fingerprint = fingerprintDependency({name:'typescript',from});
  assert.equal(fingerprint.name,'typescript');
  assert.equal(fingerprint.version,JSON.parse(readFileSync(fingerprint.manifestPath,'utf8')).version);
  assert.equal(fingerprint.entrySha256,sha256(readFileSync(fingerprint.entryPath)));
  assert.equal(fingerprint.manifestSha256,sha256(readFileSync(fingerprint.manifestPath)));
  assert.deepEqual(tools().compiler,fingerprint);

  const source = '\nexport const bad: number = ;\n';
  const ts = tools();
  assert.throws(() => ts.transpile({source,filePath:'invalid.ts'}),/invalid\.ts:2:\d+/);
  assert.throws(() => ts.extract({source,filePath:'invalid.ts',selection:{kind:'variable',name:'bad'}}),/invalid\.ts:2:\d+/);
});
