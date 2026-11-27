import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createSocket } from 'node:dgram';
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { buildPreview } from './preview.mjs';

const base = '1'.repeat(40);
const head = '2'.repeat(40);
const digest = value => createHash('sha256').update(value).digest('hex');
const literalLabel = '场景 </script><img id="unexpected">';
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const canIsolate = process.platform === 'darwin' && existsSync('/usr/bin/sandbox-exec') && existsSync(chromePath);
const chromeArgs = ['--disable-background-networking','--disable-component-update','--no-first-run','--no-default-browser-check'];

async function udpPeer() {
  const socket = createSocket('udp4');
  const packets = [];
  socket.on('message',bytes => packets.push(bytes.toString('hex')));
  await new Promise((resolve,reject) => {socket.once('error',reject);socket.bind(0,'127.0.0.1',resolve);});
  return {socket,packets,port:socket.address().port};
}

function rtcProgram(port) {
  return 'window.pc=new RTCPeerConnection({iceServers:[{urls:"stun:127.0.0.1:'+port+'"}]});'+
    'pc.createDataChannel("synthetic");pc.createOffer().then(offer=>pc.setLocalDescription(offer));'+
    'document.body.dataset.rtc="started";';
}

async function probeUdp(browser) {
  const peer = await udpPeer();
  const page = await browser.newPage();
  try {
    await page.setContent('<body><script>'+rtcProgram(peer.port)+'</script></body>');
    assert.equal(await page.locator('body').getAttribute('data-rtc'),'started');
    await page.waitForTimeout(1200);
    return peer.packets;
  } finally {await page.close();peer.socket.close();}
}

// Only synthetic test fixtures use this harness. The published shell does not
// launch or claim to provide an OS/network sandbox.
async function isolatedFixture(data,t) {
  if (!canIsolate) {t.skip('Interactive regression needs the tested macOS IP-network sandbox');return;}
  const control = await chromium.launch({channel:'chrome',headless:true,args:chromeArgs});
  let controlPackets;
  try {controlPackets = await probeUdp(control);} finally {await control.close();}
  assert(controlPackets.length > 0,'The local UDP positive control must be observable');
  const wrapper = join(data.root,'isolated-chrome');
  writeFileSync(wrapper,'#!/bin/sh\nexec /usr/bin/sandbox-exec -p \'(version 1)(allow default)(deny network*)(allow network* (local unix-socket))(allow network* (remote unix-socket))\' '+
    "'"+chromePath+"' \"$@\"\n");
  chmodSync(wrapper,0o700);
  const browser = await chromium.launch({executablePath:wrapper,headless:true,args:chromeArgs});
  t.after(() => browser.close());
  const blockedPackets = await probeUdp(browser);
  assert.deepEqual(blockedPackets,[],'The OS-isolated browser must send no IP packets to the local UDP peer');
  const entryUrl = 'http://127.0.0.1:39181/'+data.root.split('/').at(-1)+'/preview.html';
  const boundaryEvidence = data.pinned('boundary-log.json',JSON.stringify({
    entryUrl,mechanism:'macOS sandbox-exec deny network*; allow only Unix-domain sockets',
    credentialBoundary:'Fresh Playwright browser profile; no user configuration or credentials mounted',
    observations:[
      'Chrome '+browser.version(),
      'Local UDP positive-control packets: '+controlPackets.length,
      'OS-isolated UDP packets: '+blockedPackets.length,
      'STUN positive-control packet bytes: '+controlPackets.join(',')
    ]
  }));
  data.manifest.execution = {mode:'external-isolation',entryUrl,boundaryEvidence};
  const route = page => page.route(entryUrl,request => request.fulfill({contentType:'text/html',body:readFileSync(data.outputPath)}));
  return {browser,entryUrl,route};
}

function product(title, locale, program = '') {
  return '<!doctype html><html lang="'+locale+'"><head><meta charset="utf-8">'+
    '<style>body{margin:0;font-family:monospace}h1{color:rgb(12, 34, 56)}</style></head>'+
    '<body><h1>'+title+'</h1><form><label>Fixture value <input value="initial"></label>'+
    '<button type="submit">Fixture action</button></form><output>ready</output>'+
    '<script>document.querySelector("form").onsubmit=event=>{event.preventDefault();document.querySelector("output").textContent="done";};'+program+
    '</script></body></html>';
}

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(),'pr-preview-'));
  t.after(() => rmSync(root,{recursive:true,force:true}));
  function pinned(path, bytes) {
    writeFileSync(join(root,path),bytes);
    return {path,sha256:digest(bytes)};
  }
  const material = pinned('source.txt','Pinned synthetic test markup reference');
  function variant(path, sha, html, kind = 'original-component') {
    return {
      artifact:pinned(path,html),
      source:{
        kind,repo:'Fixture repo </script><img id="unexpected-repo">',sha,
        materials:(kind === 'reconstruction' ? ['layout','style','dictionary'] : ['source']).map(role => ({role,...material})),
        mocks:['fixture action only'],unverified:['实际产品入口未验']
      }
    };
  }
  const first = {
    id:'first',label:literalLabel,platform:'Fixture desktop',widths:[390,520],height:460,
    initialWidth:390,initialLocale:'zh-CN',initialVersion:'head',
    versions:{
      base:{'zh-CN':variant('base.html',base,product('Base content','zh-CN'))},
      head:{
        'zh-CN':variant('head.html',head,product('Head content','zh-CN')),
        'de-DE':variant('head-de.html',head,product('Deutscher Inhalt','de-DE'))
      }
    }
  };
  const second = {
    id:'second',label:'Second entry',platform:'Fixture mobile',widths:[360],
    initialWidth:360,initialLocale:'zh-CN',initialVersion:'base',
    versions:{base:{'zh-CN':variant('second.html',base,product('Second content','zh-CN'),'reconstruction')}}
  };
  const manifest = {title:'QA </script><img id="unexpected-title">',comparison:{base,head},scenes:[first,second]};
  const manifestPath = join(root,'manifest.json');
  const outputPath = join(root,'preview.html');
  function build(output = outputPath) {
    writeFileSync(manifestPath,JSON.stringify(manifest));
    return buildPreview({manifestPath,outputPath:output});
  }
  return {root,pinned,manifest,manifestPath,outputPath,first,second,variant,build};
}

test('every product and source is pinned and output is created exclusively', t => {
  const data = fixture(t);
  const result = data.build();
  assert.deepEqual(result,{path:data.outputPath,scenes:2});
  const original = readFileSync(data.outputPath);
  assert.throws(() => data.build(),{code:'EEXIST'});
  assert.deepEqual(readFileSync(data.outputPath),original);

  const source = data.first.versions.head['zh-CN'].source;
  source.sha = base;
  assert.throws(() => data.build(join(data.root,'wrong-source.html')), /source SHA does not match/);
  source.sha = head;
  source.materials[0].sha256 = '0'.repeat(64);
  assert.throws(() => data.build(join(data.root,'wrong-digest.html')), /SHA-256 mismatch/);
  source.materials = [];
  assert.throws(() => data.build(join(data.root,'missing-source.html')), /missing source evidence/);
});

test('relative, non-existing and symlink paths stay inside the input directory', t => {
  const data = fixture(t);
  const outside = mkdtempSync(join(tmpdir(),'pr-preview-outside-'));
  t.after(() => rmSync(outside,{recursive:true,force:true}));
  const raw = '<!doctype html><h1>Outside</h1>';
  const output = join(data.root,'must-not-exist.html');
  const external = join(outside,'outside.html');
  writeFileSync(external,raw);
  symlinkSync(external,join(data.root,'escape.html'));
  const variant = data.first.versions.head['zh-CN'];
  for (const path of ['../outside.html','https://example.invalid/page.html',external,'escape.html']) {
    variant.artifact = {path,sha256:digest(raw)};
    assert.throws(() => data.build(output), /below the manifest directory/);
    assert(!existsSync(output));
  }
  variant.artifact = {path:'absent.html',sha256:digest(raw)};
  assert.throws(() => data.build(output),{code:'ENOENT'});
  assert(!existsSync(output));
});

test('reconstructions require pinned layout, style and dictionary evidence', t => {
  const data = fixture(t);
  const source = data.second.versions.base['zh-CN'].source;
  source.materials = source.materials.filter(item => item.role !== 'dictionary');
  source.visuallyVerified = true;
  assert.throws(() => data.build(),/missing dictionary evidence/);
});

test('a scene with disconnected locale sets requires a shared locale or separate scenes', t => {
  const data = fixture(t);
  data.first.initialVersion = 'base';
  data.first.versions.head = {'en-US':data.variant('head-en.html',head,product('English content','en-US'))};
  assert.throws(() => data.build(),/no shared locale between base and head; provide a shared locale or use separate scenes/);
  assert(!existsSync(data.outputPath));
});

test('standalone resource checks reject linked scripts, imports, styles, fonts, images and navigation', t => {
  const data = fixture(t);
  const variant = data.first.versions.head['zh-CN'];
  const inputs = [
    ['<script src="app.js"></script>', /scripts embedded/],
    ['<script type="module">import "./app.js";</script>', /bundled into inline JavaScript/],
    ['<script>import("./app.js");</script>', /bundled into inline JavaScript/],
    ['<link rel="stylesheet" href="app.css">', /resources embedded/],
    ['<style>@import "app.css";</style>', /stylesheet import/],
    ['<style>@font-face{font-family:f;src:url("network.woff2")}</style>', /non-inline resource/],
    ['<style>div{background:image-set("network.png" 1x)}</style>', /non-inline resource/],
    ['<img src="https://example.invalid/network.png">', /non-inline resource/],
    ['<img srcset="data:image/png;base64,AA 1x, network.png 2x">', /non-inline resource/],
    ['<template><img src="nested.png"></template>', /non-inline resource/],
    ['<base href="https://example.invalid/">', /unsupported embedding/],
    ['<meta http-equiv="refresh" content="0;url=elsewhere.html">', /automatic navigation/],
    ['<a href="#section" target="_parent">Other context</a>', /own product document/],
    ['<a href="file:///tmp/other.html">Other</a>', /non-inline resource/]
  ];
  for (const [html,error] of inputs) {
    variant.artifact = data.pinned('linked.html',html);
    assert.throws(() => data.build(),error);
    assert(!existsSync(data.outputPath));
  }
  const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+s6i8AAAAASUVORK5CYII=';
  variant.artifact = data.pinned('embedded.html',
    '<link rel="icon" href="'+pixel+'"><style>h1{background-image:image-set(url("'+pixel+
      '") type(\'image/png\') 1x)}h1::after{content:"literal @import and url(not-a-resource)"}</style><h1>Embedded</h1>');
  assert.equal(data.build().path,data.outputPath);
});

test('external execution requires a pinned boundary log bound to one credential-free loopback URL', t => {
  const data = fixture(t);
  const entryUrl = 'http://127.0.0.1:39181/run/preview.html';
  data.manifest.execution = {mode:'external-isolation',entryUrl};
  assert.throws(() => data.build(),/boundaryEvidence/);
  data.manifest.execution.boundaryEvidence = data.pinned('boundary-log.json','true');
  assert.throws(() => data.build(),/boundary log must be an object/);
  data.manifest.execution.boundaryEvidence = data.pinned('boundary-log.json',JSON.stringify({
    entryUrl:entryUrl+'-other',mechanism:'test log',credentialBoundary:'temporary profile',observations:['actual probe log']
  }));
  assert.throws(() => data.build(),/boundary log entryUrl/);
  data.manifest.execution.entryUrl = 'https://example.com/preview.html';
  assert.throws(() => data.build(),/loopback/);
  assert(!existsSync(data.outputPath));
});

test('external execution rejects native fragments rather than silently breaking repeat navigation', t => {
  const data = fixture(t);
  const entryUrl = 'http://127.0.0.1:39181/run/preview.html';
  data.manifest.execution = {mode:'external-isolation',entryUrl,boundaryEvidence:data.pinned('boundary-log.json',JSON.stringify({
    entryUrl,mechanism:'Test fixture boundary',credentialBoundary:'Fresh profile',observations:['Local-only test fixture log']
  }))};
  data.first.versions.head['zh-CN'].artifact = data.pinned('fragment.html','<a href="#section">Jump</a><h2 id="section">Section</h2>');
  assert.throws(() => data.build(),/native fragment links.*static.*original page/i);
  assert(!existsSync(data.outputPath));
});

test('default previews and mismatched external entries keep product scripts disabled and UDP silent', {timeout:20000}, async t => {
  const data = fixture(t);
  const browser = await chromium.launch({channel:'chrome',headless:true,args:chromeArgs});
  t.after(() => browser.close());
  assert((await probeUdp(browser)).length > 0,'The local UDP positive control must be observable');
  const peer = await udpPeer();
  t.after(() => peer.socket.close());
  const html = product('Static fixture','zh-CN',rtcProgram(peer.port));
  data.first.versions.head['zh-CN'].artifact = data.pinned('static.html',html);
  data.build();
  const page = await browser.newPage();
  const checkStatic = async url => {
    await page.goto(url+'#first');
    const frame = page.frameLocator('#preview-stage iframe');
    await frame.getByRole('heading',{name:'Static fixture'}).waitFor();
    assert.equal(await page.locator('iframe').getAttribute('sandbox'),'');
    assert.equal(await frame.locator('body').getAttribute('data-rtc'),null);
    assert.match(await page.locator('#preview-evidence').textContent(),/产品脚本关闭.*交互未验/s);
    await frame.getByRole('textbox').fill('static draft');
    await frame.getByRole('button',{name:'Fixture action'}).click();
    assert.equal(await frame.locator('output').textContent(),'ready');
    await page.waitForTimeout(1200);
    assert.deepEqual(peer.packets,[]);
  };
  await checkStatic(pathToFileURL(data.outputPath).href);
  const entryUrl = 'http://127.0.0.1:39181/controlled/preview.html';
  data.manifest.execution = {mode:'external-isolation',entryUrl,boundaryEvidence:data.pinned('boundary-log.json',JSON.stringify({
    entryUrl,mechanism:'Synthetic mismatch fixture; no runtime boundary claimed',credentialBoundary:'fresh profile',
    observations:['The wrong URL and direct file MUST stay static without trusting this log']
  }))};
  const externalOutput = join(data.root,'external.html');
  data.build(externalOutput);
  await checkStatic(pathToFileURL(externalOutput).href);
  const wrongUrl = entryUrl+'-wrong';
  await page.route(wrongUrl,route => route.fulfill({contentType:'text/html',body:readFileSync(externalOutput)}));
  await checkStatic(wrongUrl);
});

test('product fragment links navigate within the original document without reloading the shell', {timeout:15000}, async t => {
  const data = fixture(t);
  const peer = await udpPeer();
  t.after(() => peer.socket.close());
  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'+
    '<style>a[href^="#"]{color:rgb(21,43,65)}</style></head><body>'+
    '<h1>Fragment fixture</h1><a href="#destination" onclick="document.body.dataset.inlineRan=\'yes\'">Jump to section</a><input value="initial">'+
    '<div style="height:1000px"></div><h2 id="destination">Destination</h2><a href="#">Back to top</a>'+
    '<script>parent.document.body.dataset.escaped="yes";document.body.dataset.scriptRan="yes";'+rtcProgram(peer.port)+'</script></body></html>';
  data.first.versions.head['zh-CN'].artifact = data.pinned('fragment.html',html);
  data.build();
  const browser = await chromium.launch({channel:'chrome',headless:true});
  t.after(() => browser.close());
  const page = await browser.newPage();
  const failures = [];
  page.on('console',message => {
    if (/Not allowed to load local resource|frame-src|form-action/.test(message.text())) failures.push(message.text());
  });
  await page.goto(pathToFileURL(data.outputPath).href+'#first');
  const frame = page.frameLocator('#preview-stage iframe');
  await frame.getByRole('textbox').fill('keep this draft');
  assert.equal(await page.locator('iframe').getAttribute('srcdoc'),html);
  assert.equal(await frame.getByRole('link',{name:'Jump to section'}).getAttribute('href'),'#destination');
  assert.equal(await frame.getByRole('link',{name:'Jump to section'}).evaluate(element => getComputedStyle(element).color),'rgb(21, 43, 65)');
  // Poll in Node: a sandbox without allow-scripts also blocks browser-side
  // waitForFunction timers. The evaluations below only read native DOM state.
  const observe = async predicate => {
    let actual;
    for (let attempt=0;attempt<30;attempt++) {
      actual = await frame.locator('body').evaluate(predicate);
      if (actual) return;
      await new Promise(resolve => setTimeout(resolve,25));
    }
    assert.equal(actual,true,'Native fragment navigation did not reach its target');
  };
  await frame.getByRole('link',{name:'Jump to section'}).click();
  await observe(() => location.hash === '#destination' && scrollY > 0);
  assert.equal(await frame.locator('#destination').evaluate(element => element.getBoundingClientRect().top < innerHeight),true);
  assert.equal(await frame.locator('body').evaluate(() => scrollY > 0),true);
  assert.equal(await frame.getByRole('textbox').inputValue(),'keep this draft');
  assert.equal(await frame.locator('body').getAttribute('data-inline-ran'),null);
  assert.equal(await frame.locator('body').getAttribute('data-script-ran'),null);
  assert.equal(await page.locator('body').getAttribute('data-escaped'),null);
  assert.equal(new URL(page.url()).hash,'#first');
  await frame.getByRole('link',{name:'Back to top'}).click();
  await observe(() => location.hash === '' && scrollY === 0);
  assert.equal(await frame.locator('body').evaluate(() => scrollY),0);
  await page.waitForTimeout(1200);
  assert.deepEqual(peer.packets,[]);
  assert.deepEqual(failures,[]);
});

test('isolated Chrome restores scene identity and keeps product CSS, exact width and links honest', {timeout:30000}, async t => {
  const data = fixture(t);
  const isolation = await isolatedFixture(data,t);
  if (!isolation) return;
  const requests = [];
  const server = createServer((request,response) => {
    requests.push(request.url);
    response.end('test-only peer');
  });
  await new Promise((resolve,reject) => {
    server.once('error',reject);
    server.listen(0,'127.0.0.1',resolve);
  });
  t.after(() => server.close());
  const target = 'http://127.0.0.1:' + server.address().port;
  const program = 'try{parent.document.title;document.body.dataset.parentAccess="allowed"}catch{document.body.dataset.parentAccess="blocked"};'+
    'fetch('+JSON.stringify(target+'/fetch')+').catch(()=>{document.body.dataset.request="blocked";});'+
    'addEventListener("message",event=>{if(event.data==="try form"){const form=document.querySelector("form");'+
    'form.action='+JSON.stringify(target+'/form')+';form.submit();}else{location.href='+JSON.stringify(target+'/navigation')+';}});';
  const html = product('Head content','zh-CN',program);
  data.first.versions.head['zh-CN'].artifact = data.pinned('head.html',html);
  data.build();

  const {browser,entryUrl:url} = isolation;
  const context = await browser.newContext({viewport:{width:950,height:760}});
  const page = await context.newPage();
  await isolation.route(page);
  await page.goto(url+'#first');
  const stage = page.locator('#preview-stage iframe');
  const frame = page.frameLocator('#preview-stage iframe');
  await frame.getByText('Head content',{exact:true}).waitFor();
  assert.equal(await page.locator('#preview-title').textContent(),data.manifest.title);
  assert.equal(await page.locator('#unexpected, #unexpected-repo, #unexpected-title').count(),0);
  assert.equal(await page.locator('script').count(),2);
  assert.equal(await stage.getAttribute('srcdoc'),html);
  assert.equal(await page.locator('#preview-data').evaluate(element =>
    JSON.parse(element.textContent).scenes[0].versions.head['zh-CN'].artifact.html),html);
  assert.equal(await frame.locator('body').getAttribute('data-parent-access'),'blocked');
  await frame.locator('body[data-request="blocked"]').waitFor();
  assert.equal(await frame.locator('.preview-toolbar').count(),0);
  assert.equal(await frame.locator('h1').evaluate(element => getComputedStyle(element).color),'rgb(12, 34, 56)');
  assert.equal(await frame.locator('body').evaluate(element => getComputedStyle(element).fontFamily),'monospace');
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),390);
  assert.match(await page.locator('#preview-evidence').textContent(),/视觉对照待核实/);

  const input = frame.getByRole('textbox');
  await input.fill('draft');
  await frame.getByRole('button',{name:'Fixture action'}).click();
  assert.equal(await frame.locator('output').textContent(),'done');
  assert.equal(await stage.getAttribute('sandbox'),'allow-scripts allow-forms');
  await page.locator('#preview-width').selectOption('520');
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),520);
  assert.equal(await input.inputValue(),'draft');
  await page.locator('#preview-version').selectOption('base');
  await frame.getByText('Base content',{exact:true}).waitFor();
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),520);
  assert.equal(await input.inputValue(),'initial');
  assert.match(await page.locator('#preview-evidence').textContent(),new RegExp(base));
  await input.fill('second draft');
  await page.getByRole('button',{name:'重开当前场景'}).click();
  await frame.getByText('Base content',{exact:true}).waitFor();
  assert.equal(await input.inputValue(),'initial');
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),520);

  await page.reload();
  await frame.getByText('Head content',{exact:true}).waitFor();
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),390);
  assert.equal(await page.locator('#preview-version').inputValue(),'head');
  await page.locator('#preview-locale').selectOption('de-DE');
  await frame.getByText('Deutscher Inhalt',{exact:true}).waitFor();
  assert.equal(await frame.locator('html').getAttribute('lang'),'de-DE');
  assert.equal(await page.locator('#preview-version option[value="base"]').evaluate(option => option.disabled),true);
  await page.locator('#preview-width').selectOption('520');
  await page.locator('#preview-locale').selectOption('zh-CN');
  await frame.getByText('Head content',{exact:true}).waitFor();
  assert.equal(await page.locator('#preview-version option[value="base"]').evaluate(option => option.disabled),false);
  await page.locator('#preview-version').selectOption('base');
  await frame.getByText('Base content',{exact:true}).waitFor();
  assert.equal(await frame.locator('html').getAttribute('lang'),'zh-CN');
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),520);
  await page.locator('#preview-scene').selectOption('second');
  await frame.getByText('Second content',{exact:true}).waitFor();
  assert.equal(new URL(page.url()).hash,'#second');
  assert.equal(await frame.locator('h1').evaluate(() => innerWidth),360);
  assert.match(await page.locator('#preview-evidence').textContent(),/源码重建产物/);
  await page.reload();
  await frame.getByText('Second content',{exact:true}).waitFor();

  const clean = await browser.newContext();
  const peer = await clean.newPage();
  await isolation.route(peer);
  await peer.goto(url+'#second');
  await peer.frameLocator('iframe').getByText('Second content',{exact:true}).waitFor();
  assert.equal(await peer.locator('#preview-width').inputValue(),'360');
  await clean.close();

  await page.locator('#preview-scene').selectOption('first');
  await frame.getByText('Head content',{exact:true}).waitFor();
  const formBlocked = page.waitForEvent('console',{
    predicate:message => message.text().includes(target) && /frame-src|form-action/.test(message.text()),timeout:2500
  });
  await page.evaluate(() => document.querySelector('iframe').contentWindow.postMessage('try form','*'));
  await formBlocked;
  await page.getByRole('button',{name:'重开当前场景'}).click();
  await frame.getByText('Head content',{exact:true}).waitFor();
  const navigationBlocked = page.waitForEvent('console',{
    predicate:message => message.text().includes(target) && message.text().includes('frame-src'),timeout:2500
  });
  await page.evaluate(() => document.querySelector('iframe').contentWindow.postMessage('try navigation','*'));
  await navigationBlocked;
  assert.deepEqual(requests,[]);
  await context.close();
});
