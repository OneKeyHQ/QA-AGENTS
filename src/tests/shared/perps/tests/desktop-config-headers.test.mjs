import test from 'node:test';
import assert from 'node:assert/strict';

test('Desktop config oracle preserves the installed client version/build gate', async () => {
  const { desktopConfigRequestHeaders } = await import('../desktop-config-headers.mjs');
  const reads=[];
  const page={evaluate:async()=> 'Mozilla/5.0 OneKeyWallet/6.7.0 Chrome/152.0.0.0'};
  const headers=await desktopConfigRequestHeaders(page,{verifyExecutable:async()=>{},readPlist:key=>{
    reads.push(key);
    return {CFBundleShortVersionString:'6.7.0',CFBundleVersion:'20261102200'}[key];
  }});
  assert.equal(headers['X-Onekey-Request-Platform'],'desktop');
  assert.equal(headers['X-Onekey-Request-Version'],'6.7.0');
  assert.equal(headers['X-Onekey-Request-Build-Number'],'20261102200');
  assert.equal(headers['X-Onekey-Request-Locale'],'zh-cn');
  assert.match(headers['User-Agent'],/OneKeyWallet\/6\.7\.0/);
  assert.deepEqual(reads.sort(),['CFBundleShortVersionString','CFBundleVersion']);
  // Observed server gate: missing build/version headers omit Hot/New even for
  // the same URL/configVersion. The oracle must select the installed-client set.
  const server=h=>h['X-Onekey-Request-Version']==='6.7.0'&&h['X-Onekey-Request-Build-Number']==='20261102200'?['热门','新上架','加密货币']:['加密货币'];
  assert.deepEqual(server(headers),['热门','新上架','加密货币']);
  assert.notDeepEqual(server({'User-Agent':headers['User-Agent']}),server(headers));
});

test('Desktop config oracle rejects missing metadata and another running app version', async () => {
  const { desktopConfigRequestHeaders } = await import('../desktop-config-headers.mjs');
  const page={evaluate:async()=> 'OneKeyWallet/6.7.0'};
  for(const metadata of [
    {CFBundleShortVersionString:'6.7.0',CFBundleVersion:''},
    {CFBundleShortVersionString:'6.8.0',CFBundleVersion:'20261102200'},
  ]) await assert.rejects(desktopConfigRequestHeaders(page,{verifyExecutable:async()=>{},readPlist:key=>metadata[key]}));
});


test('Desktop version matching is exact, never a prefix match',async()=>{
  const {desktopConfigRequestHeaders}=await import('../desktop-config-headers.mjs');
  await assert.rejects(desktopConfigRequestHeaders({evaluate:async()=> 'OneKeyWallet/6.7.01'},
    {verifyExecutable:async()=>{},readPlist:key=>key==='CFBundleVersion'?'1':'6.7.0'}));
});
test('Desktop evidence verifies the CDP browser process path and detaches without closing the app',async()=>{
  const {verifyDesktopExecutable}=await import('../desktop-config-headers.mjs');
  assert.equal(typeof verifyDesktopExecutable,'function');
  for(const correct of [true,false]) {
    let detached=false;
    const page={context:()=>({browser:()=>({newBrowserCDPSession:async()=>({
      send:async(method)=>{assert.equal(method,'SystemInfo.getProcessInfo');return {processInfo:[{type:'browser',id:42}]};},
      detach:async()=>{detached=true;},
    })})})};
    const call=verifyDesktopExecutable(page,{expectedExecutable:'/TF/OneKey',canonical:path=>path,
      readProcessCommand:pid=>{assert.equal(pid,42);return correct?'/TF/OneKey':'/MAS/OneKey';}});
    if(correct)await call;else await assert.rejects(call,/executable/);
    assert.equal(detached,true);
  }
});
