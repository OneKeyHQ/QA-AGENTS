// Android operation recorder — monitors touch events + screenshots + UI element detection
// Usage: npx tsx src/tests/android-recorder.mjs [device_id]
// Live monitor at http://localhost:3210 (auto-opens in browser)
// Press Ctrl+C to stop

import 'dotenv/config';

// Ensure adb is in PATH for child processes
if (process.env.ANDROID_HOME && !process.env.PATH?.includes('platform-tools')) {
  process.env.PATH = `${process.env.ANDROID_HOME}/platform-tools:${process.env.PATH}`;
}

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { exec } from 'node:child_process';
import OpenAI from 'openai';
import sharp from 'sharp';

const ADB = resolve(process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`, 'platform-tools/adb');
const MONITOR_PORT = 3210;

// ── Auto-detect device parameters ────────────────────────────

function adbExecWith(deviceId, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ADB, ['-s', deviceId, ...args]);
    let out = '';
    proc.stdout.on('data', (d) => (out += d));
    proc.stderr.on('data', (d) => (out += d));
    proc.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out))));
  });
}

async function detectDeviceId() {
  const explicit = process.argv[2];
  if (explicit) return explicit;

  const out = await new Promise((resolve, reject) => {
    const proc = spawn(ADB, ['devices']);
    let o = '';
    proc.stdout.on('data', (d) => (o += d));
    proc.on('close', (code) => (code === 0 ? resolve(o) : reject(new Error(o))));
  });

  const lines = out.split('\n').filter((l) => l.includes('\tdevice'));
  if (lines.length === 0) throw new Error('No Android devices connected');
  return lines[0].split('\t')[0];
}

async function detectScreenSize(deviceId) {
  const out = await adbExecWith(deviceId, ['shell', 'wm', 'size']);
  const m = out.match(/(\d+)x(\d+)/);
  if (!m) throw new Error(`Cannot parse screen size: ${out}`);
  return { width: +m[1], height: +m[2] };
}

async function detectTouchDevices(deviceId) {
  const out = await adbExecWith(deviceId, ['shell', 'getevent', '-p']);

  // Parse ALL input devices with ABS_MT_POSITION_X/Y (not pen)
  const blocks = out.split('add device');
  const touchDevices = [];

  for (const block of blocks) {
    if (!block.trim()) continue;
    const pathMatch = block.match(/\d+:\s*(\/dev\/input\/event\d+)/);
    const nameMatch = block.match(/name:\s*"([^"]+)"/);
    if (!pathMatch) continue;
    const path = pathMatch[1];
    const name = nameMatch ? nameMatch[1] : '';

    if (name.includes('pen')) continue;

    const xMatch = block.match(/0035\s*:\s*value\s+\d+,\s*min\s+\d+,\s*max\s+(\d+)/);
    const yMatch = block.match(/0036\s*:\s*value\s+\d+,\s*min\s+\d+,\s*max\s+(\d+)/);

    if (xMatch && yMatch) {
      touchDevices.push({ path, name, maxX: +xMatch[1], maxY: +yMatch[1] });
    }
  }

  if (touchDevices.length === 0) throw new Error('Cannot find any touch input device');
  return touchDevices;
}

// ── Main init ────────────────────────────────────────────────

const DEVICE_ID = await detectDeviceId();
console.log(`\n  Device: ${DEVICE_ID}`);

const screenSize = await detectScreenSize(DEVICE_ID);
console.log(`  Screen: ${screenSize.width}x${screenSize.height}`);

const touchDevices = await detectTouchDevices(DEVICE_ID);
// Build path→device lookup for coordinate mapping
const touchDeviceMap = {};
for (const td of touchDevices) {
  touchDeviceMap[td.path] = td;
  console.log(`  Touch:  ${td.path} (${td.name}) maxX=${td.maxX} maxY=${td.maxY}`);
}

const SCREEN_W = screenSize.width;
const SCREEN_H = screenSize.height;

const RECORDINGS_DIR = resolve('midscene_run/recordings');
const SESSION_NAME = `session-${Date.now()}`;
const SESSION_DIR = resolve(RECORDINGS_DIR, SESSION_NAME);
mkdirSync(SESSION_DIR, { recursive: true });

const events = [];
const sseClients = [];
let screenshotIndex = 0;
let capturing = false;
const startTime = new Date().toISOString();

// ── AI Vision (qwen-vl) for element identification ──────────

const ai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});
const AI_MODEL = process.env.MIDSCENE_MODEL_NAME || 'qwen-vl-max-latest';

// Pre-tap screenshot: taken on finger DOWN so we capture BEFORE the UI changes
let preTapScreenshotPromise = null;

function triggerPreTapScreenshot() {
  if (capturing) return;
  preTapScreenshotPromise = takeScreenshot('pre-tap');
}

async function annotateScreenshot(screenshotPath, screenX, screenY) {
  // Draw a red crosshair + circle at the tap point
  const r = 30; // circle radius
  const stroke = 4;
  const svg = `<svg width="${SCREEN_W}" height="${SCREEN_H}">
    <circle cx="${screenX}" cy="${screenY}" r="${r}" fill="none" stroke="red" stroke-width="${stroke}"/>
    <line x1="${screenX - r - 10}" y1="${screenY}" x2="${screenX + r + 10}" y2="${screenY}" stroke="red" stroke-width="${stroke}"/>
    <line x1="${screenX}" y1="${screenY - r - 10}" x2="${screenX}" y2="${screenY + r + 10}" stroke="red" stroke-width="${stroke}"/>
  </svg>`;
  return sharp(screenshotPath)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function identifyWithAI(screenshotPath, screenX, screenY) {
  try {
    // Annotate screenshot with red crosshair at tap point
    const annotated = await annotateScreenshot(screenshotPath, screenX, screenY);
    const imgBase64 = annotated.toString('base64');

    const resp = await ai.chat.completions.create({
      model: AI_MODEL,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: `data:image/png;base64,${imgBase64}` },
          },
          {
            type: 'text',
            text: `This is an Android app screenshot. A red crosshair marks exactly where the user tapped.
Identify the UI element at the red crosshair. Return ONLY a JSON object:
{
  "elementType": "button|input|text|icon|tab|card|list-item|image|link|toggle|other",
  "label": "the visible text or icon name at the crosshair",
  "section": "screen area (e.g. header, tab-bar, token-list, modal, form)",
  "action": "what this tap likely does (e.g. open-token-selector, navigate-back, submit)",
  "confidence": 0.0-1.0
}
No markdown, no explanation, just the JSON.`,
          },
        ],
      }],
      max_tokens: 200,
    });

    const text = resp.choices?.[0]?.message?.content?.trim();
    if (!text) return null;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    console.error(`    AI identify failed: ${e.message}`);
    return null;
  }
}

function mapToScreen(rawX, rawY, maxX, maxY) {
  return {
    x: Math.round((rawX / maxX) * SCREEN_W),
    y: Math.round((rawY / maxY) * SCREEN_H),
  };
}

function broadcast(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

function flushSession() {
  const data = {
    sessionName: SESSION_NAME,
    deviceId: DEVICE_ID,
    screenSize: { width: SCREEN_W, height: SCREEN_H },
    touchDevices: touchDevices.map(td => ({ path: td.path, name: td.name, maxX: td.maxX, maxY: td.maxY })),
    startTime,
    lastUpdate: new Date().toISOString(),
    recording: true,
    eventCount: events.length,
    events,
  };
  writeFileSync(resolve(SESSION_DIR, 'session.json'), JSON.stringify(data, null, 2));
}

function adbExec(args) {
  return adbExecWith(DEVICE_ID, args);
}

async function takeScreenshot(label) {
  if (capturing) return null;
  capturing = true;
  const idx = String(screenshotIndex++).padStart(3, '0');
  const filename = `${idx}-${label}.png`;
  const remotePath = `/data/local/tmp/ms_rec_${idx}.png`;
  const localPath = resolve(SESSION_DIR, filename);
  try {
    await adbExec(['shell', `screencap -p ${remotePath}`]);
    await adbExec(['pull', remotePath, localPath]);
    await adbExec(['shell', `rm ${remotePath}`]);
    return { filename, localPath };
  } catch (e) {
    console.error(`    Screenshot failed: ${e.message}`);
    return null;
  } finally {
    capturing = false;
  }
}

function describeElement(el) {
  if (!el) return 'unknown';
  // AI vision element
  if (el.label) {
    const parts = [`"${el.label}"`];
    if (el.elementType && el.elementType !== 'other') parts.push(`[${el.elementType}]`);
    if (el.section) parts.push(`in ${el.section}`);
    return parts.join(' ');
  }
  return el.className || 'unknown';
}

// ── Monitor Web UI ──────────────────────────────────────────

const MONITOR_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Android Recording Monitor</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0d1117; color: #c9d1d9; }
  header { position: sticky; top: 0; z-index: 10; background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #3fb950; animation: pulse 1.5s infinite; }
  .dot.stopped { background: #f85149; animation: none; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .stats { display: flex; gap: 24px; font-size: 14px; color: #8b949e; }
  .stats span { color: #c9d1d9; font-weight: 600; }
  .device-badge { background: #1f6feb33; color: #58a6ff; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
  .screen-badge { background: #3fb95033; color: #3fb950; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 60px; }
  thead { position: sticky; top: 49px; background: #161b22; z-index: 5; }
  th { text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #8b949e; border-bottom: 1px solid #30363d; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #21262d; vertical-align: top; }
  tr.new-row { animation: highlight 1.5s ease-out; }
  @keyframes highlight { from { background: rgba(56, 139, 253, 0.15); } to { background: transparent; } }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-tap { background: #1f6feb33; color: #58a6ff; }
  .badge-updating { background: #d2a8ff22; color: #d2a8ff; }
  .rid { color: #d2a8ff; font-family: monospace; font-size: 12px; }
  .no-rid { color: #484f58; font-style: italic; }
  .desc { max-width: 350px; word-break: break-all; }
  .pos { color: #8b949e; font-family: monospace; font-size: 12px; }
  .time { color: #8b949e; font-size: 12px; }
  .screenshot-thumb { max-height: 60px; border-radius: 4px; border: 1px solid #30363d; cursor: pointer; }
  .screenshot-thumb:hover { border-color: #58a6ff; }
  .del-btn { background: none; border: 1px solid #f8514933; color: #f85149; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; }
  .del-btn:hover { background: #f8514922; }
  tr.deleting { opacity: 0.3; text-decoration: line-through; transition: opacity 0.3s; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; background: #161b22; border-top: 1px solid #30363d; padding: 10px 24px; font-size: 12px; color: #8b949e; text-align: center; }
  #empty { text-align: center; padding: 60px 20px; color: #484f58; }
  #empty .icon { font-size: 48px; margin-bottom: 16px; }
  #empty p { font-size: 16px; }
  .lightbox { display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:100; justify-content:center; align-items:center; cursor:zoom-out; }
  .lightbox.active { display:flex; }
  .lightbox img { max-width:90vw; max-height:90vh; border-radius:8px; }
</style>
</head>
<body>
<header>
  <div class="dot" id="statusDot"></div>
  <div style="font-size:16px;font-weight:600;">Android Recording</div>
  <span class="device-badge" id="deviceId"></span>
  <span class="screen-badge" id="screenInfo"></span>
  <div class="stats">
    Taps: <span id="tapCount">0</span>
    &nbsp;&nbsp;
    Elapsed: <span id="elapsed">00:00</span>
  </div>
</header>

<div id="empty">
  <div class="icon">&#128241;</div>
  <p>Waiting for taps on device...</p>
  <p style="margin-top:8px;font-size:13px;">Tap on your Android phone to see events here in real time</p>
</div>

<table id="table" style="display:none;">
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th style="width:70px">Type</th>
      <th style="width:90px">Position</th>
      <th style="width:200px">Element</th>
      <th>Description</th>
      <th style="width:80px">Screenshot</th>
      <th style="width:70px">Time</th>
      <th style="width:40px"></th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>

<div class="lightbox" id="lightbox" onclick="this.classList.remove('active')">
  <img id="lightboxImg" src="">
</div>

<footer>Press Ctrl+C in terminal to stop recording</footer>

<script>
const tbody = document.getElementById('tbody');
const table = document.getElementById('table');
const empty = document.getElementById('empty');
const tapCount = document.getElementById('tapCount');
const elapsed = document.getElementById('elapsed');
const statusDot = document.getElementById('statusDot');
const deviceId = document.getElementById('deviceId');
const screenInfo = document.getElementById('screenInfo');
let count = 0;
const startTime = Date.now();
const rowMap = {};

setInterval(() => {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  elapsed.textContent = m + ':' + s;
}, 1000);

const es = new EventSource('/events');
es.onmessage = (e) => {
  const ev = JSON.parse(e.data);

  if (ev.type === 'init') {
    deviceId.textContent = ev.deviceId;
    screenInfo.textContent = ev.screen;
    return;
  }

  if (ev.type === 'update') {
    const tr = rowMap[ev.index];
    if (!tr) return;
    const ridCell = tr.querySelector('.el-cell');
    const descCell = tr.querySelector('.desc-cell');
    const imgCell = tr.querySelector('.img-cell');
    if (ev.element) {
      const el = ev.element;
      const label = el.label || el.resourceId || '';
      const type = el.elementType || el.className || '';
      ridCell.innerHTML = label
        ? '<span class="rid">' + escHtml(label) + '</span>' + (type ? ' <span style="color:#8b949e;font-size:11px">[' + escHtml(type) + ']</span>' : '')
        : '<span class="no-rid">unknown</span>';
      const desc = el.action ? el.action : (ev.description || '');
      const section = el.section ? '<span style="color:#58a6ff;font-size:11px">' + escHtml(el.section) + '</span> ' : '';
      descCell.innerHTML = section + escHtml(desc);
    }
    if (ev.screenshot) {
      imgCell.innerHTML = '<img class="screenshot-thumb" src="/screenshot/' + escHtml(ev.screenshot) + '" onclick="showImg(this.src)">';
    }
    const badge = tr.querySelector('.badge');
    if (badge) { badge.textContent = 'TAP'; badge.className = 'badge badge-tap'; }
    return;
  }

  // New tap event
  count++;
  tapCount.textContent = count;
  if (count === 1) { table.style.display = ''; empty.style.display = 'none'; }

  const tr = document.createElement('tr');
  tr.className = 'new-row';
  tr.setAttribute('data-index', ev.index);
  rowMap[ev.index] = tr;

  const pos = ev.screenX + ', ' + ev.screenY;
  const time = new Date(ev.time).toLocaleTimeString();

  tr.innerHTML =
    '<td>' + (ev.index + 1) + '</td>' +
    '<td><span class="badge badge-updating">...</span></td>' +
    '<td class="pos">' + pos + '</td>' +
    '<td class="el-cell"><span class="no-rid">identifying...</span></td>' +
    '<td class="desc-cell desc"></td>' +
    '<td class="img-cell"></td>' +
    '<td class="time">' + time + '</td>' +
    '<td><button class="del-btn" onclick="delStep(' + ev.index + ', this)">X</button></td>';

  tbody.appendChild(tr);
  tr.scrollIntoView({ behavior: 'smooth', block: 'end' });
};
es.onerror = () => { statusDot.classList.add('stopped'); };

function showImg(src) {
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightbox').classList.add('active');
}

function delStep(idx, btn) {
  const tr = btn.closest('tr');
  tr.classList.add('deleting');
  fetch('/delete?index=' + idx, { method: 'POST' }).then(r => {
    if (r.ok) { tr.remove(); count--; tapCount.textContent = count; }
    else { tr.classList.remove('deleting'); }
  });
}

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;

// ── HTTP Server ─────────────────────────────────────────────

let monitorServer;

function startMonitorServer() {
  monitorServer = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${MONITOR_PORT}`);

    // SSE endpoint
    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n');
      res.write(`data: ${JSON.stringify({
        type: 'init',
        deviceId: DEVICE_ID,
        screen: `${SCREEN_W}x${SCREEN_H}`,
      })}\n\n`);
      sseClients.push(res);
      req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
      });
      return;
    }

    // Screenshot serving
    if (url.pathname.startsWith('/screenshot/')) {
      const filename = url.pathname.replace('/screenshot/', '');
      const filePath = resolve(SESSION_DIR, filename);
      try {
        const data = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
      return;
    }

    // Delete endpoint
    if (url.pathname === '/delete' && req.method === 'POST') {
      const delIdx = parseInt(url.searchParams.get('index'));
      const idx = events.findIndex(e => e.index === delIdx);
      if (idx !== -1) {
        events.splice(idx, 1);
        flushSession();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } else {
        res.writeHead(404);
        res.end('{"error":"not found"}');
      }
      return;
    }

    // Main page
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MONITOR_HTML);
  });

  monitorServer.listen(MONITOR_PORT, () => {
    console.log(`  Monitor UI: http://localhost:${MONITOR_PORT}`);
    exec(`open http://localhost:${MONITOR_PORT}`);
  });
}

// ── Touch event monitor ─────────────────────────────────────

function startTouchMonitor() {
  // Listen to ALL input devices at once (no device path = all devices)
  const getevent = spawn(ADB, ['-s', DEVICE_ID, 'shell', 'getevent', '-lt']);

  // Per-device tracking: { currentX, currentY, maxX, maxY }
  const deviceState = {};
  let activeDevicePath = null;

  getevent.stdout.on('data', (data) => {
    for (const line of data.toString().split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('add device')) continue;

      // Lines from getevent -lt (all devices) are prefixed with device path:
      // /dev/input/event10: EV_ABS ABS_MT_POSITION_X 00001234
      const devMatch = trimmed.match(/^(\/dev\/input\/event\d+):\s*(.+)/);
      let devPath, rest;
      if (devMatch) {
        devPath = devMatch[1];
        rest = devMatch[2];
      } else {
        // Continuation line (same device) or timestamp line
        devPath = activeDevicePath;
        rest = trimmed;
      }

      if (!devPath) continue;
      activeDevicePath = devPath;

      // Only process known touch devices
      const td = touchDeviceMap[devPath];
      if (!td) continue;

      // Init per-device state
      if (!deviceState[devPath]) {
        deviceState[devPath] = { currentX: 0, currentY: 0 };
      }
      const state = deviceState[devPath];

      const matchX = rest.match(/ABS_MT_POSITION_X\s+(\w+)/);
      if (matchX) { state.currentX = parseInt(matchX[1], 16); continue; }

      const matchY = rest.match(/ABS_MT_POSITION_Y\s+(\w+)/);
      if (matchY) { state.currentY = parseInt(matchY[1], 16); continue; }

      if (rest.includes('BTN_TOUCH') && rest.includes('DOWN')) {
        triggerPreTapScreenshot();
        continue;
      }

      if (!rest.includes('BTN_TOUCH') || !rest.includes('UP')) continue;

      // Tap detected on this device — use its coordinate range
      parseTouchEvent(state.currentX, state.currentY, td.maxX, td.maxY, devPath);
    }
  });

  getevent.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.error(`  getevent stderr: ${msg}`);
  });

  return getevent;
}

function parseTouchEvent(rawX, rawY, maxX, maxY, devPath) {
  const screen = mapToScreen(rawX, rawY, maxX, maxY);
  const event = {
    index: events.length,
    type: 'tap',
    screenX: screen.x,
    screenY: screen.y,
    time: new Date().toISOString(),
    element: null,
    description: 'identifying...',
    screenshot: null,
  };

  events.push(event);
  flushSession();

  // Broadcast new tap immediately (element/screenshot come later as update)
  broadcast(event);

  // Use pre-tap screenshot for AI identification + take post-tap screenshot for display
  (async () => {
    // Wait for pre-tap screenshot (taken on finger DOWN)
    const preTapShot = preTapScreenshotPromise ? await preTapScreenshotPromise : null;
    preTapScreenshotPromise = null;

    // Take post-tap screenshot (for visual reference in the UI)
    await new Promise((r) => setTimeout(r, 400));
    const postTapShot = await takeScreenshot(`tap-${events.length}`);

    // Use pre-tap screenshot for AI identification (shows what was on screen BEFORE tap)
    const identifyShot = preTapShot || postTapShot;
    const element = identifyShot ? await identifyWithAI(identifyShot.localPath, screen.x, screen.y) : null;

    event.element = element;
    event.description = describeElement(element);
    event.screenshot = postTapShot?.filename || preTapShot?.filename || null;
    flushSession();

    // Broadcast update with element + screenshot info
    broadcast({
      type: 'update',
      index: event.index,
      element,
      description: event.description,
      screenshot: event.screenshot,
    });

    console.log(`  [${event.index + 1}] Tap (${screen.x}, ${screen.y}) -> ${event.description}`);
    if (event.screenshot) console.log(`       ${event.screenshot}`);
  })();
}

// ── Start ───────────────────────────────────────────────────

console.log('');
console.log('  +---------------------------------------------+');
console.log('  |       ANDROID RECORDING MODE ACTIVE          |');
console.log('  |  Tap on your phone, events appear in browser |');
console.log('  |  Press Ctrl+C to stop                        |');
console.log('  +---------------------------------------------+');
console.log(`  Session: ${SESSION_DIR}`);

startMonitorServer();

// Initial screenshot
(async () => {
  const f = await takeScreenshot('initial');
  if (f) console.log(`  Initial: ${f.filename}\n`);
  flushSession();
})();

const monitor = startTouchMonitor();

process.on('SIGINT', () => {
  monitor.kill();
  setTimeout(() => {
    const data = {
      sessionName: SESSION_NAME,
      deviceId: DEVICE_ID,
      screenSize: { width: SCREEN_W, height: SCREEN_H },
      touchDevices: touchDevices.map(td => ({ path: td.path, name: td.name, maxX: td.maxX, maxY: td.maxY })),
      startTime,
      endTime: new Date().toISOString(),
      recording: false,
      eventCount: events.length,
      events,
    };
    writeFileSync(resolve(SESSION_DIR, 'session.json'), JSON.stringify(data, null, 2));
    console.log(`\n  Done - ${events.length} taps recorded`);
    console.log(`  Session: ${SESSION_DIR}/session.json\n`);
    for (const res of sseClients) res.end();
    monitorServer?.close();
    process.exit(0);
  }, 2000);
});
