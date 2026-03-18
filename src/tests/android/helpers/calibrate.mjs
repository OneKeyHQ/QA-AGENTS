// Calibration test for UIAutomator hybrid approach
// Tests: dump UI → parse elements → find by text → click coordinates
//
// Usage: ANDROID_HOME=~/Library/Android/sdk npx tsx src/tests/android/helpers/calibrate.mjs

import 'dotenv/config';

if (!process.env.ANDROID_HOME) {
  process.env.ANDROID_HOME = `${process.env.HOME}/Library/Android/sdk`;
}
if (!process.env.PATH?.includes('platform-tools')) {
  process.env.PATH = `${process.env.ANDROID_HOME}/platform-tools:${process.env.PATH}`;
}

import { AndroidDevice, getConnectedDevices } from '@midscene/android';
import {
  initDevice,
  dumpUI,
  parseUIElements,
  getElements,
  findElementByText,
  findElementByContentDesc,
  debugDumpTexts,
  tapByText,
  invalidateCache,
  UI_TEXT,
} from './device.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function calibrate() {
  console.log('\n  === UIAutomator Calibration Test ===\n');

  // ── Connect ──
  const devices = await getConnectedDevices();
  if (devices.length === 0) {
    console.error('  No Android devices found.');
    process.exit(1);
  }

  const udid = devices[0].udid;
  const device = new AndroidDevice(udid);
  console.log(`  Connecting to ${udid}...`);
  await device.connect();
  initDevice(udid); // Init fast adb shell with device ID
  console.log('  Connected.\n');

  // ── Test 1: UI Dump (fast path) ──
  console.log('  [Test 1] UI Dump via fast adb shell');
  const t1 = Date.now();
  const xml = await dumpUI();
  const dumpTime = Date.now() - t1;
  console.log(`    Dump time: ${dumpTime}ms`);
  console.log(`    XML length: ${xml.length} chars`);

  if (xml.length < 100) {
    console.error('    ERROR: XML dump too short');
    console.error('    Raw:', xml.substring(0, 200));
    process.exit(1);
  }
  console.log('    ✓ Dump succeeded\n');

  // ── Test 2: Parse Elements ──
  console.log('  [Test 2] Parse UI Elements');
  const elements = parseUIElements(xml);
  console.log(`    Total elements: ${elements.length}`);

  const withText = elements.filter((e) => e.text);
  const withDesc = elements.filter((e) => e.contentDesc);
  const withId = elements.filter((e) => e.resourceId);
  console.log(`    With text: ${withText.length}`);
  console.log(`    With content-desc: ${withDesc.length}`);
  console.log(`    With resource-id: ${withId.length}`);
  console.log('    ✓ Parse succeeded\n');

  // ── Test 3: Debug Dump ──
  console.log('  [Test 3] All visible text/desc elements:');
  const texts = await debugDumpTexts();
  for (const t of texts.slice(0, 30)) {
    const label = t.text || `[desc: ${t.desc}]`;
    console.log(`    "${label}" ${t.id ? `(${t.id})` : ''} ${t.bounds}`);
  }
  if (texts.length > 30) console.log(`    ... and ${texts.length - 30} more`);
  console.log('');

  // ── Test 4: Find specific elements ──
  console.log('  [Test 4] Find elements by text/desc');

  const targets = [
    { type: 'text', value: UI_TEXT.TAB_CONTRACT },
    { type: 'text', value: UI_TEXT.TAB_WALLET },
    { type: 'text', value: UI_TEXT.TAB_TRADE },
    { type: 'text', value: UI_TEXT.TAB_DISCOVER },
    { type: 'desc', value: '合約' },
  ];

  for (const target of targets) {
    const t = Date.now();
    const el =
      target.type === 'text'
        ? await findElementByText(target.value)
        : await findElementByContentDesc(target.value);
    const elapsed = Date.now() - t;

    if (el) {
      console.log(
        `    ✓ Found "${target.value}" (${target.type}) → center=(${el.center.x}, ${el.center.y}) [${elapsed}ms]`,
      );
    } else {
      console.log(`    ✗ NOT found "${target.value}" (${target.type}) [${elapsed}ms]`);
    }
  }
  console.log('');

  // ── Test 5: Coordinate click test ──
  console.log('  [Test 5] Coordinate click calibration');
  invalidateCache();

  const contractEl = await findElementByText(UI_TEXT.TAB_CONTRACT)
    || await findElementByContentDesc('合約');

  if (!contractEl) {
    console.log('    Cannot find 合約 tab — make sure OneKey app is open');
    console.log('    Trying to find ANY clickable element to test coordinates...');

    // Find any element with text to click as a basic test
    const anyEl = (await getElements()).find((e) => e.text && e.clickable);
    if (anyEl) {
      console.log(`    Found "${anyEl.text}" at (${anyEl.center.x}, ${anyEl.center.y})`);
      console.log('    Clicking...');
      const t = Date.now();
      await device.mouseClick(anyEl.center.x, anyEl.center.y);
      console.log(`    Click time: ${Date.now() - t}ms`);
      console.log('    ✓ Click sent (verify on device)\n');
    } else {
      console.log('    No clickable elements found\n');
    }
  } else {
    console.log(`    Found 合約: center=(${contractEl.center.x}, ${contractEl.center.y})`);
    console.log('    Clicking...');
    const t = Date.now();
    await device.mouseClick(contractEl.center.x, contractEl.center.y);
    console.log(`    Click time: ${Date.now() - t}ms`);
    await sleep(2000);

    invalidateCache();
    const usdc = await findElementByText('USDC');
    if (usdc) {
      console.log('    ✓ Calibration PASSED — navigated to contract page (found USDC)');
    } else {
      console.log('    ? Click sent but USDC not found — checking current screen:');
      const currentTexts = await debugDumpTexts();
      for (const t of currentTexts.slice(0, 10)) {
        console.log(`      "${t.text || t.desc}"`);
      }
    }
  }

  // ── Test 6: Cache performance ──
  console.log('\n  [Test 6] Cache performance');
  invalidateCache();
  const t6a = Date.now();
  await getElements(); // cold
  const cold = Date.now() - t6a;

  const t6b = Date.now();
  await getElements(); // cached
  const hot = Date.now() - t6b;

  console.log(`    Cold (with dump): ${cold}ms`);
  console.log(`    Hot (cached):     ${hot}ms`);
  console.log(`    Speedup:          ${(cold / Math.max(hot, 1)).toFixed(0)}x\n`);

  console.log('  === Calibration Complete ===\n');
}

calibrate().catch((err) => {
  console.error(`\n  Failed: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
