// Recording mode: listens to user clicks/inputs in OneKey, takes screenshots
// Saves steps.json incrementally (no data loss on force-quit)
// Includes live monitor web UI on port 3210 via SSE
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';
import { exec } from 'child_process';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const RECORDING_DIR = resolve(import.meta.dirname, '../../shared/results/recording');
mkdirSync(RECORDING_DIR, { recursive: true });

const browser = await chromium.connectOverCDP(CDP_URL);
const page = browser.contexts()[0]?.pages()[0];
if (!page) {
  console.error('No page found via CDP. Is OneKey running with --remote-debugging-port=9222?');
  process.exit(1);
}

let stepNum = 0;
const allSteps = [];
const sseClients = [];

function broadcast(step) {
  const data = `data: ${JSON.stringify(step)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}

function saveSteps() {
  writeFileSync(`${RECORDING_DIR}/steps.json`, JSON.stringify(allSteps, null, 2));
}

const MONITOR_PORT = 3210;

const MONITOR_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Recording Monitor</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0d1117; color: #c9d1d9; }
  header { position: sticky; top: 0; z-index: 10; background: #161b22; border-bottom: 1px solid #30363d; padding: 12px 24px; display: flex; align-items: center; gap: 16px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #3fb950; animation: pulse 1.5s infinite; }
  .dot.stopped { background: #f85149; animation: none; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .stats { display: flex; gap: 24px; font-size: 14px; color: #8b949e; }
  .stats span { color: #c9d1d9; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 60px; }
  thead { position: sticky; top: 49px; background: #161b22; z-index: 5; }
  th { text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #8b949e; border-bottom: 1px solid #30363d; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #21262d; vertical-align: top; }
  tr.new-row { animation: highlight 1.5s ease-out; }
  @keyframes highlight { from { background: rgba(56, 139, 253, 0.15); } to { background: transparent; } }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-click { background: #1f6feb33; color: #58a6ff; }
  .badge-input { background: #3fb95033; color: #3fb950; }
  .testid { color: #d2a8ff; font-family: monospace; font-size: 12px; }
  .no-testid { color: #484f58; font-style: italic; }
  .content { max-width: 400px; word-break: break-all; }
  .pos { color: #8b949e; font-family: monospace; font-size: 12px; }
  .time { color: #8b949e; font-size: 12px; }
  .del-btn { background: none; border: 1px solid #f8514933; color: #f85149; border-radius: 4px; padding: 2px 8px; cursor: pointer; font-size: 11px; }
  .del-btn:hover { background: #f8514922; }
  tr.deleting { opacity: 0.3; text-decoration: line-through; transition: opacity 0.3s; }
  footer { position: fixed; bottom: 0; left: 0; right: 0; background: #161b22; border-top: 1px solid #30363d; padding: 10px 24px; font-size: 12px; color: #8b949e; text-align: center; }
  #empty { text-align: center; padding: 60px 20px; color: #484f58; }
  #empty .icon { font-size: 48px; margin-bottom: 16px; }
  #empty p { font-size: 16px; }
</style>
</head>
<body>
<header>
  <div class="dot" id="statusDot"></div>
  <div style="font-size:16px;font-weight:600;">Recording Monitor</div>
  <div class="stats">
    Steps: <span id="stepCount">0</span>
    &nbsp;&nbsp;
    Elapsed: <span id="elapsed">00:00</span>
  </div>
</header>

<div id="empty">
  <div class="icon">&#9673;</div>
  <p>Waiting for interactions...</p>
  <p style="margin-top:8px;font-size:13px;">Click or type in OneKey app to see events here</p>
</div>

<table id="table" style="display:none;">
  <thead>
    <tr>
      <th style="width:50px">#</th>
      <th style="width:80px">Type</th>
      <th style="width:180px">Element</th>
      <th>Content</th>
      <th style="width:90px">Position</th>
      <th style="width:80px">Time</th>
      <th style="width:50px"></th>
    </tr>
  </thead>
  <tbody id="tbody"></tbody>
</table>

<footer>Press Ctrl+C in terminal to stop recording</footer>

<script>
const tbody = document.getElementById('tbody');
const table = document.getElementById('table');
const empty = document.getElementById('empty');
const stepCount = document.getElementById('stepCount');
const elapsed = document.getElementById('elapsed');
const statusDot = document.getElementById('statusDot');
let count = 0;
const startTime = Date.now();

setInterval(() => {
  const sec = Math.floor((Date.now() - startTime) / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  elapsed.textContent = m + ':' + s;
}, 1000);

const es = new EventSource('/events');
es.onmessage = (e) => {
  const step = JSON.parse(e.data);
  count++;
  stepCount.textContent = count;
  if (count === 1) { table.style.display = ''; empty.style.display = 'none'; }

  const tr = document.createElement('tr');
  tr.className = 'new-row';
  const isClick = step.type === 'click';
  const badgeClass = isClick ? 'badge-click' : 'badge-input';
  const label = isClick ? 'CLICK' : 'INPUT';
  const testid = step.testid
    ? '<span class="testid">' + escHtml(step.testid) + '</span>'
    : '<span class="no-testid">no testid</span>';
  const content = isClick
    ? escHtml((step.text || '').substring(0, 60))
    : 'value="' + escHtml((step.value || '').substring(0, 60)) + '"';
  const pos = isClick ? step.x + ', ' + step.y : '-';
  const time = new Date(step.time).toLocaleTimeString();

  tr.setAttribute('data-step', step.step);
  tr.innerHTML =
    '<td>' + step.step + '</td>' +
    '<td><span class="badge ' + badgeClass + '">' + label + '</span></td>' +
    '<td>' + escHtml(step.tag) + ' ' + testid + '</td>' +
    '<td class="content">' + content + '</td>' +
    '<td class="pos">' + pos + '</td>' +
    '<td class="time">' + time + '</td>' +
    '<td><button class="del-btn" onclick="delStep(' + step.step + ', this)">X</button></td>';
  tbody.appendChild(tr);
  tr.scrollIntoView({ behavior: 'smooth', block: 'end' });
};
es.onerror = () => { statusDot.classList.add('stopped'); };

function delStep(stepNum, btn) {
  const tr = btn.closest('tr');
  tr.classList.add('deleting');
  fetch('/delete?step=' + stepNum, { method: 'POST' }).then(r => {
    if (r.ok) {
      tr.remove();
      count--;
      stepCount.textContent = count;
      // Renumber all rows and update delete buttons
      const rows = tbody.querySelectorAll('tr');
      rows.forEach((row, i) => {
        const num = i + 1;
        row.children[0].textContent = num;
        row.querySelector('.del-btn').setAttribute('onclick', 'delStep(' + num + ', this)');
      });
    }
    else { tr.classList.remove('deleting'); }
  });
}

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;

// --- Monitor HTTP server ---
let monitorServer;

function startMonitorServer() {
  monitorServer = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${MONITOR_PORT}`);

    if (url.pathname === '/delete' && req.method === 'POST') {
      const delStep = parseInt(url.searchParams.get('step'));
      const idx = allSteps.findIndex(s => s.step === delStep);
      if (idx !== -1) {
        allSteps.splice(idx, 1);
        allSteps.forEach((s, i) => { s.step = i + 1; });
        stepNum = allSteps.length;
        saveSteps();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end('{"ok":true}');
      } else {
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        res.end('{"error":"not found"}');
      }
      return;
    }

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n');
      sseClients.push(res);
      req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
      });
      return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MONITOR_HTML);
  });

  monitorServer.listen(MONITOR_PORT, () => {
    console.log(`  Monitor UI: http://localhost:${MONITOR_PORT}`);
    exec(`open http://localhost:${MONITOR_PORT}`);
  });
}

startMonitorServer();

// Inject click + input listeners
// Uses version counter so old handlers from previous injects become no-ops
async function injectListeners() {
  await page.evaluate(() => {
    window.__recorderVersion = (window.__recorderVersion || 0) + 1;
    const V = window.__recorderVersion;
    window.__recordedSteps = [];

    // --- Click: debounce 300ms (handles double-click), ignore INPUT/TEXTAREA ---
    let _clickTimer = null;
    let _pendingClick = null;

    document.addEventListener('click', (e) => {
      if (window.__recorderVersion !== V) return;
      const target = e.target;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const closest = target.closest('[data-testid]');
      const r = target.getBoundingClientRect();
      _pendingClick = {
        time: new Date().toISOString(),
        type: 'click',
        tag,
        testid: target.getAttribute('data-testid') || (closest ? closest.getAttribute('data-testid') : ''),
        text: (target.textContent || '').substring(0, 80).trim(),
        placeholder: target.getAttribute('placeholder') || '',
        x: Math.round(e.clientX),
        y: Math.round(e.clientY),
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
      };
      clearTimeout(_clickTimer);
      _clickTimer = setTimeout(() => {
        if (_pendingClick) {
          window.__recordedSteps.push(_pendingClick);
          console.log('STEP:' + JSON.stringify(_pendingClick));
          _pendingClick = null;
        }
      }, 300);
    }, true);

    // --- Input: debounce 800ms (handles typing + IME + delete) ---
    const _inputTimers = new Map();

    document.addEventListener('input', (e) => {
      if (window.__recorderVersion !== V) return;
      const target = e.target;
      const key = target.getAttribute('data-testid')
        || target.getAttribute('placeholder')
        || target.tagName + '_' + (target.getAttribute('name') || Array.from(target.parentNode?.children || []).indexOf(target));
      clearTimeout(_inputTimers.get(key));
      _inputTimers.set(key, setTimeout(() => {
        _inputTimers.delete(key);
        const step = {
          time: new Date().toISOString(),
          type: 'input',
          tag: target.tagName,
          testid: target.getAttribute('data-testid') || '',
          placeholder: target.getAttribute('placeholder') || '',
          value: (target.value || '').substring(0, 100),
          x: 0,
          y: 0
        };
        window.__recordedSteps.push(step);
        console.log('STEP:' + JSON.stringify(step));
      }, 800));
    }, true);
  });
  console.log('  [listeners injected]');
}

await injectListeners();

// Re-inject listeners when app reloads (e.g. language change)
page.on('load', async () => {
  console.log('  [page reloaded, re-injecting listeners...]');
  await injectListeners().catch(() => {});
});

// Listen to console
page.on('console', async (msg) => {
  const text = msg.text();
  if (!text.startsWith('STEP:')) return;

  stepNum++;
  const data = JSON.parse(text.substring(5));
  data.step = stepNum;
  allSteps.push(data);

  // Save incrementally — no data loss on crash
  saveSteps();

  // Push to live monitor
  broadcast(data);

  // Terminal output
  const icon = data.type === 'click' ? 'CLICK' : 'INPUT';
  const testid = data.testid ? `testid="${data.testid}"` : 'no-testid';
  const detail = data.type === 'input' ? `value="${data.value}"` : `text="${(data.text || '').substring(0, 40)}"`;
  console.log(`  [${stepNum}] ${icon}  ${data.tag}  ${testid}  ${detail}  @(${data.x},${data.y})`);

  // Screenshot after UI settles
  await new Promise(r => setTimeout(r, 1500));
  const screenshotPath = `${RECORDING_DIR}/step-${String(stepNum).padStart(2, '0')}.png`;
  await page.screenshot({ path: screenshotPath }).catch(() => {});
  data.screenshot = screenshotPath;
  saveSteps(); // Update with screenshot path
});

console.log('');
console.log('  ┌─────────────────────────────────────────────┐');
console.log('  │           RECORDING MODE ACTIVE              │');
console.log('  │  请在 OneKey 上操作，每次点击/输入自动记录    │');
console.log('  │  按 Ctrl+C 结束录制                          │');
console.log('  │  录制结果: shared/results/recording/          │');
console.log(`  │  实时监控: http://localhost:${MONITOR_PORT}            │`);
console.log('  └─────────────────────────────────────────────┘');
console.log('');

// Keep alive 10 min
const timer = setTimeout(async () => {
  saveSteps();
  console.log(`\n  Recording timeout. Saved ${allSteps.length} steps.`);
  monitorServer?.close();
  await browser.close();
}, 600000);

process.on('SIGINT', async () => {
  clearTimeout(timer);
  saveSteps();
  for (const res of sseClients) res.end();
  monitorServer?.close();
  console.log(`\n  Recording saved: ${allSteps.length} steps → ${RECORDING_DIR}/steps.json`);
  console.log(`  Run "node src/recorder/review.mjs" to review.`);
  await browser.close();
  process.exit(0);
});
