// Step helper — minimize boilerplate for autonomous picker session.
// Usage: node scripts/step-helper.mjs '<JSON-spec>'
//   spec: { action: 'tap'|'type', selectors?, coords?, text?, name, wait_after? }
// Reads /tmp/onekey-session/steps.json, appends step, executes via smartTap/smartType,
// then screenshots + dumps elements list to stdout.

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initDevice, getElements, invalidateCache, adbShell } from '../src/tests/android/helpers/device.mjs';
import { smartTap, smartType } from '../src/tests/android/helpers/smart-tap.mjs';

const ADB = resolve(process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`, 'platform-tools/adb');
const SESS_DIR = '/tmp/onekey-session';
const SESS_FILE = `${SESS_DIR}/steps.json`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const argv = process.argv.slice(2);
const cmd = argv[0];

async function detectDevice() {
  return new Promise((res, rej) => {
    execFile(ADB, ['devices'], (e, o) => {
      if (e) return rej(e);
      const m = o.match(/^(\S+)\s+device$/m);
      if (!m) return rej(new Error('no device'));
      res(m[1]);
    });
  });
}

async function screenshot(out = '/tmp/onekey-now.png') {
  return new Promise((res, rej) => {
    execFile(ADB, ['shell', 'screencap', '-p', '/sdcard/_now.png'], (e) => {
      if (e) return rej(e);
      execFile(ADB, ['pull', '/sdcard/_now.png', out], (e2) => {
        if (e2) return rej(e2);
        execFile(ADB, ['shell', 'rm', '/sdcard/_now.png'], () => res(out));
      });
    });
  });
}

async function dumpElements() {
  invalidateCache();
  try {
    const els = await getElements();
    return els.filter((e) =>
      e.clickable
      || (e.resourceId && e.resourceId !== '')
      || (e.contentDesc && e.contentDesc !== '')
      || (e.text && e.text !== '')
    );
  } catch (e) {
    return null;
  }
}

function printElement(e, i) {
  const rid = e.resourceId ? e.resourceId.split(':id/').pop() : '';
  const cls = (e.className || '').split('.').pop();
  const parts = [`#${String(i + 1).padStart(2)}`];
  if (rid) parts.push(`rid=${rid}`);
  if (e.contentDesc) parts.push(`desc="${e.contentDesc.slice(0, 55)}"`);
  if (e.text) parts.push(`text="${e.text.slice(0, 55)}"`);
  parts.push(`<${cls}>`);
  if (e.clickable) parts.push('•');
  return '  ' + parts.join(' ');
}

function loadSession() {
  if (!existsSync(SESS_DIR)) mkdirSync(SESS_DIR, { recursive: true });
  if (existsSync(SESS_FILE)) return JSON.parse(readFileSync(SESS_FILE, 'utf8'));
  return { title: 'Autonomous picker session', steps: [] };
}
function saveSession(s) { writeFileSync(SESS_FILE, JSON.stringify(s, null, 2)); }

async function main() {
  const udid = await detectDevice();
  initDevice(udid);

  if (cmd === 'dump') {
    await screenshot();
    const els = await dumpElements();
    if (!els) { console.log('DUMP FAILED (busy)'); return; }
    console.log(`Useful: ${els.length}`);
    els.forEach((e, i) => console.log(printElement(e, i)));
    return;
  }

  if (cmd === 'step') {
    const spec = JSON.parse(argv[1]);
    const sess = loadSession();
    let result;
    if (spec.action === 'type') {
      result = await smartType({ ...spec.selectors, coords: spec.coords, name: spec.name }, spec.text);
    } else {
      result = await smartTap({ ...spec.selectors, coords: spec.coords, name: spec.name });
    }
    console.log(`✓ ${result.method} → ${result.x ?? '-'},${result.y ?? '-'}`);
    sess.steps.push({
      name: spec.name,
      action: spec.action || 'tap',
      selectors: spec.selectors || {},
      coords: spec.coords || (result.x ? [result.x, result.y] : undefined),
      ...(spec.text !== undefined ? { text: spec.text } : {}),
      wait_after: spec.wait_after ?? 1500,
      ...(spec.note ? { note: spec.note } : {}),
    });
    saveSession(sess);
    await sleep(spec.wait_after ?? 1500);
    await screenshot();
    const els = await dumpElements();
    if (!els) { console.log('\n[next screen] DUMP FAILED (busy/animating)'); return; }
    console.log(`\n[next screen] ${els.length} elements:`);
    els.forEach((e, i) => console.log(printElement(e, i)));
    return;
  }

  if (cmd === 'back') {
    await adbShell('input keyevent KEYCODE_BACK');
    console.log('✓ back key sent');
    await sleep(1000);
    await screenshot();
    const els = await dumpElements();
    if (els) { console.log(`\n${els.length} elements:`); els.forEach((e, i) => console.log(printElement(e, i))); }
    return;
  }

  console.error('Usage: step-helper.mjs {dump|step JSON|back}');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
