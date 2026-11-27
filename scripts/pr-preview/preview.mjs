import { createHash } from 'node:crypto';
import { closeSync, openSync, readFileSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import ts from 'typescript';

const assets = new URL('../../assets/pr-preview/', import.meta.url);
const decoder = new TextDecoder('utf-8', { fatal:true });
const shaPattern = /^[a-fA-F0-9]{40}$/;
const digestPattern = /^[a-fA-F0-9]{64}$/;
const versions = ['base','head'];
const sourceKinds = ['original-page','original-component','reconstruction'];
const materialRoles = ['source','layout','style','dictionary','comparison'];
const urlAttributes = new Set([
  'action','background','cite','formaction','href','longdesc','manifest','poster','src','xlink:href'
]);
const svgStyles = new Set(['clip-path','cursor','fill','filter','marker-end','marker-mid','marker-start','mask','stroke']);
const embeddedTags = new Set(['base','embed','frame','iframe','object','portal']);
const inlineMedia = /^data:(?:image\/|font\/|audio\/|video\/|application\/(?:font-|x-font-|vnd\.ms-fontobject|octet-stream))/i;

function record(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(label + ' must be an object');
  return value;
}

function text(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' must be nonempty text');
  return value;
}

function textList(value, label) {
  if (!Array.isArray(value)) throw new Error(label + ' must be an array');
  return value.map(item => text(item,label));
}

function digest(value, pattern, label) {
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(label + ' is not a full hexadecimal fingerprint');
  return value.toLowerCase();
}

function dimension(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(label + ' must be a positive integer');
  return value;
}

function isWithin(root, target) {
  const path = relative(root,target);
  return path && !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
}

function pinnedReader(root) {
  const cache = new Map();
  return function pinned(value, label) {
    const {path: configuredPath, sha256: suppliedHash} = record(value,label);
    const path = text(configuredPath,label + '.path');
    const sha256 = digest(suppliedHash,digestPattern,label + '.sha256');
    if (/[\\:\u0000-\u001f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error(label + '.path must be a local path below the manifest directory');
    }
    if (!cache.has(path)) {
      const absolute = realpathSync(resolve(root,path));
      if (!isWithin(root,absolute) || !statSync(absolute).isFile()) {
        throw new Error(label + ' must reference a file below the manifest directory');
      }
      const bytes = readFileSync(absolute);
      cache.set(path,{bytes,actual:createHash('sha256').update(bytes).digest('hex'),absolute});
    }
    const {bytes,actual,absolute} = cache.get(path);
    if (actual !== sha256) throw new Error(label + ' SHA-256 mismatch for ' + path);
    return {path,sha256,bytes,absolute};
  };
}

function localResource(value, label) {
  const url = value.trim();
  if (url && !url.startsWith('#') && !inlineMedia.test(url)) {
    throw new Error(label + ' refers to a non-inline resource or navigation');
  }
}

function srcsetResources(value, label) {
  let remaining = value;
  while ((remaining = remaining.replace(/^[\s,]+/, ''))) {
    const [candidate] = remaining.match(/^\S+/);
    localResource(candidate.replace(/,+$/, ''),label);
    remaining = remaining.slice(candidate.length);
    if (!candidate.endsWith(',')) {
      const comma = remaining.indexOf(',');
      remaining = comma === -1 ? '' : remaining.slice(comma+1);
    }
  }
}

function inlineStyle(value, label) {
  const style = value.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\\([\da-f]{1,6})\s?|\\([^\n\r])/gi,(_match,hex,character) => {
    if (!hex) return character;
    const code = parseInt(hex,16);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '\uFFFD';
  });
  if (/@import\b/i.test(style.replace(/"[^"]*"|'[^']*'/g,''))) {
    throw new Error(label + ' contains a stylesheet import');
  }
  for (const [token,double,single,bare] of style.matchAll(/\burl\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)|"[^"]*"|'[^']*'/gi)) {
    if (/^url\(/i.test(token)) localResource(double ?? single ?? bare,label);
  }
  for (const [,images] of style.matchAll(/\bimage-set\(([^;{}]+)/gi)) {
    const bareStrings = images.replace(/\burl\(\s*(?:"[^"]*"|'[^']*'|[^)]*?)\s*\)|\btype\(\s*(?:"[^"]*"|'[^']*')\s*\)/gi,'');
    for (const [,double,single] of bareStrings.matchAll(/"([^"]*)"|'([^']*)'/g)) {
      localResource(double ?? single,label);
    }
  }
}

function inlineScript(element, label) {
  if (element.hasAttribute('src')) throw new Error(label + ' requires scripts embedded in the HTML');
  const type = element.getAttribute('type')?.trim().toLowerCase();
  if (type && !['module','text/javascript','application/javascript'].includes(type)) return;
  const program = ts.createSourceFile('artifact.js',element.textContent,ts.ScriptTarget.Latest,false,ts.ScriptKind.JS);
  const check = node => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
      throw new Error(label + ' references a module that must be bundled into inline JavaScript');
    }
    ts.forEachChild(node,check);
  };
  check(program);
}

function standaloneHtml(html, label) {
  const { window } = new JSDOM(html,{virtualConsole:new VirtualConsole()});
  let fragmentLinks = false;
  try {
    const check = root => {
      for (const element of root.querySelectorAll('*')) {
        const tag = element.localName.toLowerCase();
        if (embeddedTags.has(tag) || (tag === 'meta' && element.getAttribute('http-equiv')?.trim().toLowerCase() === 'refresh')) {
          throw new Error(label + ' contains unsupported embedding or automatic navigation');
        }
        if (tag === 'script') inlineScript(element,label);
        if (tag === 'link' && element.hasAttribute('href') && !element.relList.contains('icon')) {
          throw new Error(label + ' requires resources embedded in the HTML');
        }
        if (tag === 'style') inlineStyle(element.textContent,label + ' <style>');
        for (const {name,value} of element.attributes) {
          if (name === 'srcset' || name === 'imagesrcset') srcsetResources(value,label + ' ' + name);
          else if (name === 'ping' && value.trim()) throw new Error(label + ' contains link ping URLs');
          else if (urlAttributes.has(name)) localResource(value,label + ' ' + name);
          else if (name === 'style' || svgStyles.has(name)) inlineStyle(value,label + ' ' + name);
          if ((tag === 'a' || tag === 'area') && (name === 'href' || name === 'xlink:href') && value.trim().startsWith('#')) {
            const target = element.getAttribute('target')?.trim().toLowerCase();
            if (target && target !== '_self') throw new Error(label + ' fragment links must target their own product document');
            fragmentLinks = true;
          }
        }
        if (tag === 'template' && element.content) check(element.content);
      }
    };
    check(window.document);
    return fragmentLinks;
  } finally {
    window.close();
  }
}

function sourceVariant(value, expectedSha, label, pinned, copied) {
  const {artifact,source} = record(value,label);
  const {kind,repo,sha,materials,mocks,unverified} = record(source,label + '.source');
  if (!sourceKinds.includes(kind)) throw new Error(label + ' needs an explicit source kind');
  const sourceSha = digest(sha,shaPattern,label + '.source.sha');
  if (sourceSha !== expectedSha) throw new Error(label + ' source SHA does not match its version');
  if (!Array.isArray(materials)) throw new Error(label + '.source.materials must be an array');
  const evidence = materials.map(item => {
    const {role} = record(item,label + '.source.material');
    if (!materialRoles.includes(role)) throw new Error(label + ' has an unsupported evidence role');
    const {path,sha256} = pinned(item,label + '.source.' + role);
    return {role,path,sha256};
  });
  const required = kind === 'reconstruction' ? ['layout','style','dictionary'] : ['source'];
  for (const role of required) {
    if (!evidence.some(item => item.role === role)) throw new Error(label + ' is missing ' + role + ' evidence');
  }
  const pending = textList(unverified,label + '.source.unverified');
  if (!evidence.some(item => item.role === 'comparison')) pending.push('实际 App 或已确认设计的视觉对照待核实');
  const checked = pinned(artifact,label + '.artifact');
  if (!/\.html?$/i.test(checked.path)) throw new Error(label + '.artifact must be a standalone HTML file');
  if (!copied.has(checked.absolute)) {
    const html = decoder.decode(checked.bytes);
    const fragmentLinks = standaloneHtml(html,label + '.artifact');
    copied.set(checked.absolute,{html,fragmentLinks});
  }
  return {
    artifact:{path:checked.path,sha256:checked.sha256,...copied.get(checked.absolute)},
    source:{
      kind,repo:text(repo,label + '.source.repo'),sha:sourceSha,materials:evidence,
      mocks:textList(mocks,label + '.source.mocks'),unverified:pending
    }
  };
}

function parseExecution(value, pinned) {
  if (value === undefined) return {mode:'static'};
  const {mode,entryUrl,boundaryEvidence} = record(value,'execution');
  if (mode === 'static') return {mode};
  if (mode !== 'external-isolation') throw new Error('execution.mode must be static or external-isolation');
  const entry = new URL(text(entryUrl,'execution.entryUrl'));
  if (entry.protocol !== 'http:' || !['127.0.0.1','[::1]'].includes(entry.hostname) || !entry.port
    || entry.username || entry.password || entry.search || entry.hash || entry.href !== entryUrl
    || entry.pathname.split('/').filter(Boolean).length < 2) {
    throw new Error('execution.entryUrl must be one canonical credential-free loopback HTTP run URL with an explicit port');
  }
  const checked = pinned(boundaryEvidence,'execution.boundaryEvidence');
  const log = record(JSON.parse(decoder.decode(checked.bytes)),'execution boundary log');
  if (log.entryUrl !== entryUrl) throw new Error('execution boundary log entryUrl does not match the controlled entry');
  text(log.mechanism,'execution boundary log mechanism');
  text(log.credentialBoundary,'execution boundary log credentialBoundary');
  const observations = textList(log.observations,'execution boundary log observations');
  if (!observations.length) throw new Error('execution boundary log needs actual observations');
  return {mode,entryUrl,boundaryEvidence:{path:checked.path,sha256:checked.sha256},
    mechanism:log.mechanism,credentialBoundary:log.credentialBoundary,observations};
}

function parseManifest(value, pinned) {
  const {title,comparison,scenes} = record(value,'manifest');
  const execution = parseExecution(value.execution,pinned);
  const boundary = record(comparison,'comparison');
  const commits = Object.fromEntries(versions.map(version => [version,digest(boundary[version],shaPattern,'comparison.'+version)]));
  if (!Array.isArray(scenes) || !scenes.length) throw new Error('scenes must contain at least one entry');
  const ids = new Set();
  const copied = new Map();
  const entries = scenes.map((value,index) => {
    const path = 'scenes['+index+']';
    const {id,label,platform,widths,initialWidth,initialLocale,initialVersion,height=620,versions:branches} = record(value,path);
    if (typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) || ids.has(id)) {
      throw new Error(path + '.id must be a unique URL fragment ID');
    }
    ids.add(id);
    if (!Array.isArray(widths) || !widths.length || new Set(widths).size !== widths.length) {
      throw new Error(path + '.widths must contain distinct widths');
    }
    for (const width of widths) dimension(width,path + '.widths');
    if (!widths.includes(initialWidth)) throw new Error(path + '.initialWidth must be a declared width');
    const definition = record(branches,path + '.versions');
    const available = Object.fromEntries(Object.entries(definition).map(([version,locales]) => {
      if (!versions.includes(version)) throw new Error(path + ' has an unsupported version: ' + version);
      const variants = Object.entries(record(locales,path + '.' + version));
      if (!variants.length) throw new Error(path + '.' + version + ' has no language variants');
      return [version,Object.fromEntries(variants.map(([locale,details]) =>
        [text(locale,path + '.locale'),sourceVariant(details,commits[version],path + '.' + version + '.' + locale,pinned,copied)]
      ))];
    }));
    if (available.base && available.head && !Object.keys(available.base).some(locale => Object.hasOwn(available.head,locale))) {
      throw new Error(path + ' (' + id + ') has no shared locale between base and head; provide a shared locale or use separate scenes');
    }
    if (!Object.hasOwn(available,initialVersion) || !Object.hasOwn(available[initialVersion],initialLocale)) {
      throw new Error(path + ' has no artifact for the initial version and locale');
    }
    return {
      id,label:text(label,path+'.label'),platform:text(platform,path+'.platform'),widths,
      initialWidth,initialLocale,initialVersion,height:dimension(height,path+'.height'),versions:available
    };
  });
  if (execution.mode === 'external-isolation' && entries.some(scene =>
    Object.values(scene.versions).some(locales => Object.values(locales).some(variant => variant.artifact.fragmentLinks)))) {
    throw new Error('external-isolation does not support native fragment links; use static mode or an externally isolated original page with its own navigation adapter');
  }
  return {title:text(title,'title'),comparison:commits,execution,scenes:entries};
}

function escapedJson(value) {
  return JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
}

export function buildPreview({manifestPath,outputPath}) {
  const manifest = realpathSync(resolve(manifestPath));
  const data = parseManifest(JSON.parse(decoder.decode(readFileSync(manifest))),pinnedReader(dirname(manifest)));
  const template = readFileSync(new URL('preview-shell.html',assets),'utf8');
  const replacements = {
    'preview-shell-style':readFileSync(new URL('preview-shell.css',assets),'utf8'),
    'preview-shell-data':escapedJson(data),
    'preview-shell-script':readFileSync(new URL('preview-shell.js',assets),'utf8')
  };
  const html = template.replace(/<!-- (preview-shell-(?:style|data|script)) -->/g,(_match,name) => replacements[name]);
  const output = resolve(outputPath);
  const file = openSync(output,'wx');
  try {
    writeFileSync(file,html,'utf8');
  } catch (error) {
    unlinkSync(output);
    throw error;
  } finally {
    closeSync(file);
  }
  return { path:output, scenes:data.scenes.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [manifestPath,outputPath,...extra] = process.argv.slice(2);
    if (!manifestPath || !outputPath || extra.length) throw new Error('Usage: node scripts/pr-preview/preview.mjs <manifest.json> <new-output.html>');
    console.log(buildPreview({manifestPath,outputPath}).path);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
