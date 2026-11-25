import {realpathSync} from 'node:fs';
// Public config is version/platform gated. Do not query as an unversioned
// generic client and compare that catalog with the installed Desktop build.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {dirname,resolve} from 'node:path';
import {ONEKEY_BIN} from '../../helpers/constants.mjs';

function installedMetadata(key) {
  return execFileSync('/usr/libexec/PlistBuddy',[
    '-c',`Print :${key}`,resolve(dirname(ONEKEY_BIN),'../Info.plist'),
  ],{encoding:'utf8'}).trim();
}

export async function desktopConfigRequestHeaders(page,{readPlist=installedMetadata,verifyExecutable=verifyDesktopExecutable}={}) {
  await verifyExecutable(page);
  const version=readPlist('CFBundleShortVersionString');
  const buildNumber=readPlist('CFBundleVersion');
  assert.match(version,/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u,'Installed Desktop version required');
  assert.match(buildNumber,/^\d+$/u,'Installed Desktop build required');
  const userAgent=await page.evaluate(()=>navigator.userAgent);
  assert.equal(userAgent.match(/\bOneKeyWallet\/([\w.+-]+)/u)?.[1],version,'Running Desktop and configured executable versions must match exactly');
  return {
    'User-Agent':userAgent,
    'X-Onekey-Request-Locale':'zh-cn',
    'X-Onekey-Request-Platform':'desktop',
    'X-Onekey-Request-Version':version,
    'X-Onekey-Request-Build-Number':buildNumber,
  };
}


// Do not attach the TF bundle's build to a same-version MAS or other CDP app.
const verifiedPages=new WeakSet();
export async function verifyDesktopExecutable(page,{
  expectedExecutable=ONEKEY_BIN, canonical=realpathSync,
  readProcessCommand=pid=>execFileSync('/bin/ps',['-ww','-p',String(pid),'-o','comm='],{encoding:'utf8'}).trim(),
}={}) {
  if(verifiedPages.has(page))return;
  const session=await page.context().browser().newBrowserCDPSession();
  try {
    const {processInfo}=await session.send('SystemInfo.getProcessInfo');
    const browsers=processInfo.filter(p=>p.type==='browser');
    assert.equal(browsers.length,1,'One CDP browser process required');
    const pid=browsers[0].id;
    assert.ok(Number.isSafeInteger(pid)&&pid>0,'Valid CDP browser PID required');
    assert.equal(canonical(await readProcessCommand(pid)),canonical(expectedExecutable),
      'Running Desktop executable must match the selected ONEKEY_BIN');
    verifiedPages.add(page);
  } finally {await session.detach();}
}
