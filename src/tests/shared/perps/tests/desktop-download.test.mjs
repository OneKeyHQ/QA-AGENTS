import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { captureDesktopDownload } from '../desktop-download.mjs';

async function scenario(fn) {
  const root=mkdtempSync(join(tmpdir(),'perps-download-test-')),cdp=new EventEmitter(),calls=[];
  let downloadPath,detached=false;
  cdp.send=async(method,params)=>{calls.push({method,params});if(params?.downloadPath)downloadPath=params.downloadPath;};
  cdp.detach=async()=>{detached=true;};
  const page={context:()=>({browser:()=>({newBrowserCDPSession:async()=>cdp})})};
  const output=join(root,'output.png'),guid='12345678-1234-1234-1234-123456789abc';
  const begin=(name='onekey-position-123.png')=>cdp.emit('Browser.downloadWillBegin',{guid,suggestedFilename:name});
  const finish=(bytes)=>{writeFileSync(join(downloadPath,guid),bytes);cdp.emit('Browser.downloadProgress',{guid,state:'completed',totalBytes:bytes.length,receivedBytes:bytes.length});};
  try {
    await fn({capture:action=>captureDesktopDownload(page,{root,output,filename:/^onekey-position-\d+\.png$/,timeout:40},action),begin,finish,cdp,guid,output});
    assert.equal(detached,true);
    assert.deepEqual(calls.at(-1),{method:'Browser.setDownloadBehavior',params:{behavior:'default',eventsEnabled:false}});
    assert.equal(cdp.listenerCount('Browser.downloadWillBegin'),0);
    assert.ok(readdirSync(root).every(name=>!name.startsWith('perps-qa-download-')));
  } finally {rmSync(root,{recursive:true,force:true});}
}
test('retains the actual completed file and removes its temporary directory',()=>scenario(async({capture,begin,finish,output})=>{
  const bytes=Buffer.from('independent downloaded bytes');
  const result=await capture(async()=>{begin();finish(bytes);});
  assert.deepEqual(result,{bytes,count:1});assert.deepEqual(readFileSync(output),bytes);
}));
test('canceled file is a failure',()=>scenario(async({capture,begin,cdp,guid})=>{
  await assert.rejects(capture(async()=>{begin();cdp.emit('Browser.downloadProgress',{guid,state:'canceled'});}),/canceled/);
}));
test('missing download times out and cleans up',()=>scenario(async({capture})=>{
  await assert.rejects(capture(async()=>{}),/timed out/);
}));
test('unexpected filename fails instead of accepting another download',()=>scenario(async({capture,begin})=>{
  await assert.rejects(capture(async()=>begin('unrelated.png')),/Unexpected/);
}));
test('duplicate begin event fails instead of treating two exports as one',()=>scenario(async({capture,begin,finish})=>{
  await assert.rejects(capture(async()=>{begin();begin();finish(Buffer.from('bytes'));}),/duplicate/);
}));
test('CDP session acquisition failure leaves no download directory',async()=>{
  const root=mkdtempSync(join(tmpdir(),'perps-download-session-'));
  const page={context:()=>({browser:()=>({newBrowserCDPSession:async()=>{throw Error('session unavailable');}})})};
  try {
    await assert.rejects(captureDesktopDownload(page,{root,filename:/png$/,output:join(root,'out.png')},async()=>{}),/session unavailable/);
    assert.deepEqual(readdirSync(root),[]);
  } finally {rmSync(root,{recursive:true,force:true});}
});
