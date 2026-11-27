import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { devNull } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';

const projectRoot = new URL('../../',import.meta.url);
const sha256 = data => createHash('sha256').update(data).digest('hex');

/** Read the exact blob from a commit. Working-tree content and inherited Git settings are ignored. */
export function readGitSource({repository,sha,path}) {
  if (typeof sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(sha)) {
    throw new TypeError('sha must be a full Git commit object ID');
  }
  if (typeof path !== 'string' || path.includes('\\') || path.includes('\0')
    || /^[A-Za-z]:/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new TypeError('path must be a repository-relative Git blob path');
  }

  const cwd = realpathSync(repository);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env,{
    GIT_CONFIG_NOSYSTEM:'1', GIT_CONFIG_SYSTEM:devNull, GIT_CONFIG_GLOBAL:devNull,
    GIT_NO_REPLACE_OBJECTS:'1', GIT_NO_LAZY_FETCH:'1', GIT_ALLOW_PROTOCOL:'',
    GIT_OPTIONAL_LOCKS:'0', GIT_TERMINAL_PROMPT:'0',
  });
  const git = (...args) => execFileSync('git',['--no-pager',...args],{
    cwd,env,timeout:10_000,killSignal:'SIGKILL',maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe'],
  });
  const commit = sha.toLowerCase();
  const resolved = git('rev-parse','--verify','--end-of-options',commit+'^{commit}').toString('ascii').trim();
  if (resolved !== commit) {
    throw new TypeError('sha must be the full Git commit object ID for this repository');
  }
  const bytes = git('cat-file','blob',commit+':'+path);
  const blobSha = createHash(commit.length === 40 ? 'sha1' : 'sha256')
    .update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  return {sha:commit,path,blobSha,sha256:sha256(bytes),bytes};
}

/** Fingerprint the resolved package manifest and entry point without loading the dependency. */
export function fingerprintDependency({name,from=projectRoot}) {
  if (typeof name !== 'string' || !/^(?:@[\w.-]+\/)?[\w-][\w.-]*$/.test(name)) {
    throw new TypeError('name must be an exact package name');
  }
  const resolve = createRequire(join(realpathSync(from),'package.json')).resolve;
  const entry = resolve(name);
  if (!isAbsolute(entry)) throw new TypeError('Dependency must resolve to a local package file');
  const entryPath = realpathSync(entry);

  for (let directory = dirname(entryPath); directory !== dirname(directory); directory = dirname(directory)) {
    const manifestPath = join(directory,'package.json');
    if (!existsSync(manifestPath)) continue;
    const bytes = readFileSync(manifestPath);
    const manifest = JSON.parse(bytes.toString('utf8'));
    if (manifest.name !== name || typeof manifest.version !== 'string' || !manifest.version) continue;
    return {
      name,version:manifest.version,entryPath,entrySha256:sha256(readFileSync(entryPath)),
      manifestPath,manifestSha256:sha256(bytes),
    };
  }
  throw new Error('Cannot identify the resolved package manifest for '+name);
}

function failDiagnostic(ts,diagnostics) {
  const first = diagnostics.find(item => item.category === ts.DiagnosticCategory.Error);
  if (!first) return;
  const message = ts.flattenDiagnosticMessageText(first.messageText,'\n');
  if (!first.file || first.start === undefined) throw new SyntaxError(message);
  const {line,character} = first.file.getLineAndCharacterOfPosition(first.start);
  throw new SyntaxError(first.file.fileName+':'+(line+1)+':'+(character+1)+': '+message);
}

function parseSource(ts,source,filePath) {
  if (typeof filePath !== 'string' || !filePath) throw new TypeError('filePath is required');
  if (typeof source !== 'string' && !Buffer.isBuffer(source)) throw new TypeError('source must be text or a Buffer');
  const text = typeof source === 'string' ? source : new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(source);
  const kind = /\.tsx$/i.test(filePath) ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const tree = ts.createSourceFile(filePath,text,ts.ScriptTarget.ES2022,true,kind);
  failDiagnostic(ts,tree.parseDiagnostics);
  return {tree,text};
}

function collect(ts,tree,isMatch) {
  const results = [];
  function visit(node) {
    if (isMatch(node)) results.push(node);
    ts.forEachChild(node,visit);
  }
  visit(tree);
  return results;
}

function selectOne(results,label) {
  if (!results.length) throw new Error('Cannot find '+label);
  if (results.length !== 1) throw new Error('Ambiguous '+label+' ('+results.length+' matches)');
  return results[0];
}

function selectImplementation(declarations,label) {
  return selectOne(declarations.filter(declaration => declaration.body),'executable implementation for '+label);
}

function selectDeclaration(ts,tree,{kind,name,className,argumentIndex}) {
  if (!['function','variable','method','callback'].includes(kind)) throw new TypeError('Unsupported selection kind');
  if (typeof name !== 'string' || !name) throw new TypeError('selection name is required');
  if (kind === 'method') {
    if (typeof className !== 'string' || !className) throw new TypeError('method selection requires className');
    const classes = collect(ts,tree,node => (ts.isClassDeclaration(node) || ts.isClassExpression(node))
      && node.name?.text === className);
    const enclosingClass = selectOne(classes,'class '+className);
    const methods = enclosingClass.members.filter(member => ts.isMethodDeclaration(member) && member.name.text === name);
    return selectImplementation(methods,'method '+className+'.'+name);
  }
  if (kind === 'function') {
    const functions = collect(ts,tree,node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    return selectImplementation(functions,'function '+name);
  }
  const declaration = selectOne(collect(ts,tree,node => ts.isVariableDeclaration(node) && node.name?.text === name),kind+' '+name);
  if (kind === 'variable') return declaration;

  if (!Number.isInteger(argumentIndex) || argumentIndex < 0) throw new TypeError('callback selection requires argumentIndex');
  const {initializer} = declaration;
  const callback = initializer && ts.isCallExpression(initializer) ? initializer.arguments[argumentIndex] : undefined;
  if (!callback || !(ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
    throw new Error('Cannot find function argument '+argumentIndex+' for callback '+name);
  }
  return callback;
}

/** Use locally installed TypeScript. Extraction and syntax conversion never evaluate source. */
export function createTypeScriptTools({from=projectRoot}={}) {
  const compiler = fingerprintDependency({name:'typescript',from});
  const ts = createRequire(import.meta.url)(compiler.entryPath);
  if (ts.version !== compiler.version) throw new Error('Resolved TypeScript version differs from package manifest');
  return {
    compiler,
    extract({source,filePath,selection}) {
      const {tree,text} = parseSource(ts,source,filePath);
      const node = selectDeclaration(ts,tree,selection);
      const start = node.getStart(tree);
      const end = node.getEnd();
      const snippet = text.slice(start,end);
      return {
        source:snippet,filePath,
        startLine:tree.getLineAndCharacterOfPosition(start).line+1,
        endLine:tree.getLineAndCharacterOfPosition(end-1).line+1,
        sourceSha256:sha256(source),sha256:sha256(snippet),
      };
    },
    transpile({source,filePath}) {
      const {text} = parseSource(ts,source,filePath);
      // Preserve value imports and JSX. This is syntax conversion without semantic type checking.
      const result = ts.transpileModule(text,{
        fileName:filePath,reportDiagnostics:true,
        compilerOptions:{
          target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.Preserve,
          verbatimModuleSyntax:true,
        },
      });
      failDiagnostic(ts,result.diagnostics);
      return {code:result.outputText,sourceSha256:sha256(source),sha256:sha256(result.outputText)};
    },
  };
}
