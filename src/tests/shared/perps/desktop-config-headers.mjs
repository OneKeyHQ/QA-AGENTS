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

export async function desktopConfigRequestHeaders(page,{readPlist=installedMetadata}={}) {
  const version=readPlist('CFBundleShortVersionString');
  const buildNumber=readPlist('CFBundleVersion');
  assert.match(version,/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/u,'Installed Desktop version required');
  assert.match(buildNumber,/^\d+$/u,'Installed Desktop build required');
  const userAgent=await page.evaluate(()=>navigator.userAgent);
  assert.ok(userAgent.includes(`OneKeyWallet/${version}`),'Running Desktop and configured executable versions must match');
  return {
    'User-Agent':userAgent,
    'X-Onekey-Request-Locale':'zh-cn',
    'X-Onekey-Request-Platform':'desktop',
    'X-Onekey-Request-Version':version,
    'X-Onekey-Request-Build-Number':buildNumber,
  };
}
