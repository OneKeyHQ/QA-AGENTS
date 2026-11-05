// CDP's host temporary directory is not writable by a sandboxed macOS TF app.
// Scope download behavior to one action and retain the actual completed file.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ONEKEY_BIN } from '../../helpers/constants.mjs';

function downloadRoot() {
  if (process.platform !== 'darwin') return tmpdir();
  const id = execFileSync('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleIdentifier', resolve(dirname(ONEKEY_BIN), '../Info.plist')], {encoding:'utf8'}).trim();
  if (!/^[a-zA-Z0-9.-]+$/.test(id)) throw Error('Invalid selected Desktop bundle identifier');
  const data = join(homedir(), 'Library/Containers', id, 'Data');
  return existsSync(data) ? join(data, 'tmp') : tmpdir();
}

export async function captureDesktopDownload(page, {filename, output, root = downloadRoot(), timeout = 15000}, action) {
  mkdirSync(root, {recursive:true});
  const dir = mkdtempSync(join(root, 'perps-qa-download-'));
  let cdp;
  try {cdp = await page.context().browser().newBrowserCDPSession();}
  catch(error) {rmSync(dir,{recursive:true,force:true});throw error;}
  let guid, count=0, completed=false, timer;
  let succeed, fail;
  const outcome = new Promise((resolve,reject)=>{succeed=resolve;fail=reject;})
    .then(value=>({value}),error=>({error}));
  const begin = event => {
    count++;
    filename.lastIndex=0;
    if (count !== 1 || !filename.test(event.suggestedFilename) || !/^[a-f0-9-]{36}$/i.test(event.guid)) {
      fail(Error(`Unexpected or duplicate download: ${event.suggestedFilename}`));return;
    }
    guid=event.guid;
  };
  const progress = event => {
    if (event.guid !== guid) return;
    if (event.state === 'canceled') fail(Error('Desktop download canceled'));
    if (event.state === 'completed') {completed=true;succeed(event);}
  };
  cdp.on('Browser.downloadWillBegin',begin);
  cdp.on('Browser.downloadProgress',progress);
  try {
    await cdp.send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath:dir,eventsEnabled:true});
    timer=setTimeout(()=>fail(Error('Desktop download timed out')),timeout);
    await action();
    const {value,error}=await outcome;
    if(error)throw error;
    if(count!==1)throw Error(`Expected one download, received ${count}`);
    const file=join(dir,guid),bytes=readFileSync(file);
    if(!bytes.length || bytes.length!==value.receivedBytes || value.receivedBytes!==value.totalBytes)throw Error('Completed download byte count mismatch');
    mkdirSync(dirname(output),{recursive:true});
    copyFileSync(file,output);
    return {bytes,count};
  } finally {
    clearTimeout(timer);
    cdp.off('Browser.downloadWillBegin',begin);
    cdp.off('Browser.downloadProgress',progress);
    try {
      if(guid&&!completed)await cdp.send('Browser.cancelDownload',{guid});
    } finally {
      try {await cdp.send('Browser.setDownloadBehavior',{behavior:'default',eventsEnabled:false});}
      finally {try {await cdp.detach();} finally {rmSync(dir,{recursive:true,force:true});}}
    }
  }
}
