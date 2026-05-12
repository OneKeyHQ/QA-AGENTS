// Element picker — interactive CLI to build a test case by selecting elements
// from the live UI dump, instead of recording user taps.
//
// Workflow:
//   1. start on the OneKey screen you want to script
//   2. `node src/tests/android/pick.mjs`
//   3. for each screen: pick element # to tap (auto-advances UI),
//      or type `r` to redump after manual swipe,
//      or `done` to save.
//   4. YAML lands at midscene_run/picks/pick-<timestamp>.yaml
//
// Run later with: `node src/tests/android/runner.mjs <path>.yaml`

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { stringify as yamlStringify } from 'yaml';
import {
  initDevice,
  getElements,
  invalidateCache,
} from './helpers/device.mjs';
import { smartTap } from './helpers/smart-tap.mjs';

const ADB_PATH = resolve(
  process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`,
  'platform-tools/adb',
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectDevice() {
  return new Promise((res, rej) => {
    execFile(ADB_PATH, ['devices'], (err, stdout) => {
      if (err) return rej(err);
      const m = stdout.match(/^([^\s*]+)\s+device$/m);
      if (!m) return rej(new Error('No Android device connected'));
      res(m[1]);
    });
  });
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((r) => rl.question(q, r));

function describe(el, i) {
  const rid = el.resourceId ? el.resourceId.split(':id/').pop() : '';
  const cls = (el.className || '').split('.').pop();
  const parts = [`#${String(i + 1).padStart(2)}`];
  if (rid) parts.push(`rid=${rid}`);
  if (el.contentDesc) parts.push(`desc="${el.contentDesc.slice(0, 50)}"`);
  if (el.text) parts.push(`text="${el.text.slice(0, 40)}"`);
  if (cls) parts.push(`<${cls}>`);
  if (el.clickable) parts.push('•');
  return parts.join(' ');
}

function suggestedName(el) {
  if (el.text) return `Tap "${el.text}"`;
  if (el.contentDesc) return `Tap "${el.contentDesc.slice(0, 40)}"`;
  if (el.resourceId) return `Tap ${el.resourceId.split(':id/').pop()}`;
  return 'Tap element';
}

async function main() {
  console.log('\n🤖 Element Picker — interactive test case builder\n');

  const udid = await detectDevice();
  initDevice(udid);
  console.log(`Device: ${udid}`);

  const title = (await ask('Test case title (Enter for default): ')).trim()
    || `Pick session ${new Date().toISOString().slice(0, 16)}`;

  const steps = [];

  for (let screen = 1; ; screen++) {
    invalidateCache();
    let elements;
    try {
      elements = await getElements();
    } catch (e) {
      console.log(`\n  UI dump failed: ${e.message}`);
      const r = (await ask('Retry? (y/n): ')).trim().toLowerCase();
      if (r === 'y') continue;
      break;
    }

    // Filter to elements that are useful (have any identifier OR are clickable)
    const list = elements.filter(
      (el) =>
        el.clickable
        || (el.resourceId && el.resourceId !== '')
        || (el.contentDesc && el.contentDesc !== '')
        || (el.text && el.text !== ''),
    );

    console.log(`\n═══ Screen ${screen} • ${list.length} interactive elements ═══`);
    list.forEach((el, i) => console.log('  ' + describe(el, i)));

    console.log('\n  N      tap element #N (auto-advances UI)');
    console.log('  rN     redump and tap #N (use if UI changed since dump)');
    console.log('  r      redump current screen only');
    console.log('  done   save and exit');
    const ans = (await ask('> ')).trim();

    if (!ans) continue;
    if (ans === 'done') break;
    if (ans === 'r') continue; // loop redumps automatically

    let idx;
    let needRedump = false;
    if (ans.startsWith('r')) {
      needRedump = true;
      idx = parseInt(ans.slice(1)) - 1;
    } else {
      idx = parseInt(ans) - 1;
    }
    if (!Number.isFinite(idx) || idx < 0 || idx >= list.length) {
      console.log('  invalid selection');
      continue;
    }

    if (needRedump) {
      invalidateCache();
      const fresh = await getElements();
      const refreshed = fresh.filter(
        (el) =>
          el.clickable
          || (el.resourceId && el.resourceId !== '')
          || (el.contentDesc && el.contentDesc !== '')
          || (el.text && el.text !== ''),
      );
      // Best effort: re-pick by matching old element to refreshed (by content)
      // For simplicity, fall back to old element if no match
      const old = list[idx];
      idx = refreshed.findIndex(
        (e) =>
          (e.resourceId && e.resourceId === old.resourceId)
          || (e.contentDesc && e.contentDesc === old.contentDesc)
          || (e.text && e.text === old.text),
      );
      if (idx === -1) {
        console.log('  element not found after redump, aborting this pick');
        continue;
      }
      list.length = 0;
      list.push(...refreshed);
    }

    const el = list[idx];
    const defaultName = suggestedName(el);
    const nameAns = (await ask(`name (Enter for "${defaultName}"): `)).trim();
    const name = nameAns || defaultName;

    const selectors = {};
    if (el.resourceId) selectors.resourceId = el.resourceId;
    if (el.contentDesc) selectors.contentDesc = el.contentDesc;
    if (el.text) selectors.text = el.text;

    const step = {
      name,
      selectors,
      coords: [el.center.x, el.center.y],
      wait_after: 1000,
    };
    steps.push(step);

    // Auto-tap to advance UI
    try {
      const r = await smartTap({ ...selectors, coords: step.coords, name });
      console.log(`  ✓ tapped via ${r.method} → (${r.x},${r.y})`);
    } catch (e) {
      console.log(`  ✗ tap failed: ${e.message}`);
    }

    await sleep(800); // wait for UI transition
  }

  rl.close();

  if (!steps.length) {
    console.log('\nNo steps recorded.');
    return;
  }

  const out = {
    title,
    device: udid,
    recordedAt: new Date().toISOString(),
    steps,
  };
  const outDir = resolve('midscene_run/picks');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, `pick-${Date.now()}.yaml`);
  writeFileSync(outPath, yamlStringify(out));
  console.log(`\n📝 Saved ${steps.length} steps → ${outPath}`);
  console.log(`Replay: node src/tests/android/runner.mjs ${outPath}`);
}

main().catch((e) => {
  console.error('\nPicker failed:', e.message);
  process.exit(1);
});
