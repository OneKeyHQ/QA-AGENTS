// Android wallet creation + KeyTag backup + bind referral code
// Generated from pick-1778570153936.yaml at 2026-05-12T07:41:35.110Z
//
// Run: node src/tests/android/wallet/create-keytag-referral.test.mjs
// Or:  node src/tests/android/runner.mjs midscene_run/picks/<source>.yaml

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { resolve } from 'node:path';
import { initDevice } from '../helpers/device.mjs';
import { smartTap, smartType, smartSwipe } from '../helpers/smart-tap.mjs';

const ADB = resolve(
  process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`,
  'platform-tools/adb',
);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function detectDevice() {
  return new Promise((res, rej) => {
    execFile(ADB, ['devices'], (err, stdout) => {
      if (err) return rej(err);
      const m = stdout.match(/^(\S+)\s+device$/m);
      if (!m) return rej(new Error('No Android device connected'));
      res(m[1]);
    });
  });
}

export const TEST_ID = 'WALLET-CREATE-KEYTAG-REFERRAL-001';
export const displayName = '创建钱包 + KeyTag 备份 + 邀请码';

export async function run() {
  const udid = await detectDevice();
  initDevice(udid);
  console.log(`Device: ${udid}`);
  console.log('');

  const steps = [
    { idx: 1, action: 'tap', spec: { resourceId: 'AccountSelectorTriggerBase', contentDesc: 'Account #1', coords: [259, 378], name: 'Open account selector' }, wait: 1500 },
    { idx: 2, action: 'tap', spec: { resourceId: 'add-wallet', coords: [140, 2392], name: 'Open add wallet dialog' }, wait: 1500 },
    { idx: 3, action: 'tap', spec: { text: 'Create new wallet', coords: [570, 2093], name: 'Tap Create new wallet button' }, wait: 2000 },
    { idx: 4, action: 'tap', spec: { contentDesc: 'Create seed phrase wallet', text: 'Create seed phrase wallet', coords: [570, 2438], name: 'Choose seed phrase wallet type' }, wait: 3000 },
    { idx: 5, action: 'tap', spec: { contentDesc: 'Enter wallet', coords: [570, 2438], name: 'Enter wallet after creation' }, wait: 2000 },
    { idx: 6, action: 'tap', spec: { coords: [610, 1468], name: 'Open backup methods (3-dot on Backup card)' }, wait: 1500 },
    { idx: 7, action: 'tap', spec: { contentDesc: 'OneKey KeyTag', coords: [570, 2412], name: 'Choose OneKey KeyTag in backup popover' }, wait: 2000 },
    { idx: 8, action: 'type', spec: { resourceId: 'pass-code-input', name: 'Enter passcode for KeyTag' }, text: '111111', wait: 2500 },
    { idx: 9, action: 'tap', spec: { coords: [105, 2305], name: 'Confirm I have backed up checkbox' }, wait: 800 },
    { idx: 10, action: 'tap', spec: { contentDesc: 'I got it', coords: [570, 2438], name: 'Confirm KeyTag backup completion' }, wait: 2000 },
    { idx: 11, action: 'swipe', spec: { name: 'Scroll wallet home to reveal Referral card' }, swipe: { from: [570, 2000], to: [570, 800], duration: 300 }, wait: 800 },
    { idx: 12, action: 'type', spec: { text: 'Referral code', name: 'Enter referral code VIP999' }, text: 'VIP999', wait: 1000 },
    { idx: 13, action: 'tap', spec: { contentDesc: 'Join', coords: [931, 1395], name: 'Bind referral code VIP999' }, wait: 3000 },
  ];

  let passed = 0, failed = 0;
  for (const step of steps) {
    const start = Date.now();
    process.stdout.write(`[${String(step.idx).padStart(2)}/13] ${step.spec.name}... `);
    try {
      if (step.action === 'type') {
        await smartType(step.spec, step.text);
      } else if (step.action === 'swipe') {
        await smartSwipe({ swipe: step.swipe, name: step.spec.name });
      } else {
        await smartTap(step.spec);
      }
      console.log(`✓ ${Date.now() - start}ms`);
      passed++;
    } catch (e) {
      console.log(`✗ ${e.message}`);
      failed++;
      break;
    }
    await sleep(step.wait);
  }

  console.log('');
  console.log(`═══ ${passed} passed${failed ? `, ${failed} failed` : ''} ═══`);
  return { passed, failed, total: steps.length };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().then(r => process.exit(r.failed > 0 ? 1 : 0)).catch(e => { console.error(e); process.exit(1); });
