# Recorder Live Monitor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a real-time web UI to listen.mjs that shows each recorded click/input as it happens via SSE.

**Architecture:** Embed an HTTP server (port 3210) inside listen.mjs. It serves an inline HTML page and an SSE `/events` endpoint. Each recorded step is broadcast to all connected browsers instantly. Browser auto-opens on start, server closes on exit.

**Tech Stack:** Node.js built-in `http` module, SSE (EventSource API), inline HTML/CSS/JS. Zero new dependencies.

---

### Task 1: Add imports and SSE infrastructure to listen.mjs

**Files:**
- Modify: `src/recorder/listen.mjs:1-5` (imports)
- Modify: `src/recorder/listen.mjs:18-19` (add SSE client list)

**Step 1: Add new imports at top of file**

Change lines 1-5 from:

```js
// Recording mode: listens to user clicks/inputs in OneKey, takes screenshots
// Saves steps.json incrementally (no data loss on force-quit)
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
```

To:

```js
// Recording mode: listens to user clicks/inputs in OneKey, takes screenshots
// Saves steps.json incrementally (no data loss on force-quit)
// Includes live monitor web UI on port 3210 via SSE
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';
import { exec } from 'child_process';
```

**Step 2: Add SSE client tracking after allSteps declaration (after line 19)**

```js
const sseClients = [];

function broadcast(step) {
  const data = `data: ${JSON.stringify(step)}\n\n`;
  for (const res of sseClients) {
    res.write(data);
  }
}
```

**Step 3: Verify no syntax errors**

Run: `node --check src/recorder/listen.mjs`
Expected: No output (clean parse)

**Step 4: Commit**

```bash
git add src/recorder/listen.mjs
git commit -m "feat(recorder): add imports and SSE infrastructure for live monitor"
```

---

### Task 2: Add the inline HTML monitor page

**Files:**
- Modify: `src/recorder/listen.mjs` (add MONITOR_HTML constant after the broadcast function)

**Step 1: Add MONITOR_HTML template string**

Insert after the `broadcast()` function:

```js
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
  header { position: sticky; top: 0; z-index: 10; background: #161b22; border-bottom: 1px solid #30363d; padding: 16px 24px; display: flex; align-items: center; gap: 16px; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: #3fb950; animation: pulse 1.5s infinite; }
  .dot.stopped { background: #f85149; animation: none; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .stats { display: flex; gap: 24px; font-size: 14px; color: #8b949e; }
  .stats span { color: #c9d1d9; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  thead { position: sticky; top: 65px; background: #161b22; z-index: 5; }
  th { text-align: left; padding: 10px 12px; font-size: 12px; text-transform: uppercase; color: #8b949e; border-bottom: 1px solid #30363d; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #21262d; vertical-align: top; }
  tr.new-row { animation: highlight 1.5s ease-out; }
  @keyframes highlight { from { background: rgba(56, 139, 253, 0.15); } to { background: transparent; } }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .badge-click { background: #1f6feb33; color: #58a6ff; }
  .badge-input { background: #3fb95033; color: #3fb950; }
  .testid { color: #d2a8ff; font-family: monospace; font-size: 12px; }
  .no-testid { color: #484f58; font-style: italic; }
  .content { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pos { color: #8b949e; font-family: monospace; font-size: 12px; }
  .time { color: #8b949e; font-size: 12px; }
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

  tr.innerHTML =
    '<td>' + step.step + '</td>' +
    '<td><span class="badge ' + badgeClass + '">' + label + '</span></td>' +
    '<td>' + escHtml(step.tag) + ' ' + testid + '</td>' +
    '<td class="content">' + content + '</td>' +
    '<td class="pos">' + pos + '</td>' +
    '<td class="time">' + time + '</td>';
  tbody.appendChild(tr);
  tr.scrollIntoView({ behavior: 'smooth', block: 'end' });
};
es.onerror = () => { statusDot.classList.add('stopped'); };

function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
</script>
</body>
</html>`;
```

**Step 2: Verify no syntax errors**

Run: `node --check src/recorder/listen.mjs`
Expected: No output (clean parse)

**Step 3: Commit**

```bash
git add src/recorder/listen.mjs
git commit -m "feat(recorder): add inline HTML template for live monitor UI"
```

---

### Task 3: Add HTTP server and wire SSE broadcasting

**Files:**
- Modify: `src/recorder/listen.mjs` — add server startup before CDP connection, add broadcast call in console handler

**Step 1: Add startMonitorServer function and call it**

Insert after the `MONITOR_HTML` constant (before the CDP connection on line 11):

```js
let monitorServer;

function startMonitorServer() {
  monitorServer = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${MONITOR_PORT}`);

    if (url.pathname === '/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n'); // SSE keepalive comment
      sseClients.push(res);
      req.on('close', () => {
        const idx = sseClients.indexOf(res);
        if (idx !== -1) sseClients.splice(idx, 1);
      });
      return;
    }

    // Serve HTML monitor page
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(MONITOR_HTML);
  });

  monitorServer.listen(MONITOR_PORT, () => {
    console.log(`  Monitor UI: http://localhost:${MONITOR_PORT}`);
    exec(`open http://localhost:${MONITOR_PORT}`);
  });
}

startMonitorServer();
```

**Step 2: Add broadcast call in the console handler**

In the `page.on('console', ...)` handler, after `allSteps.push(data);` and `saveSteps();`, add:

```js
  broadcast(data);
```

This goes right after line 76 (`saveSteps();`), before the terminal output.

**Step 3: Verify no syntax errors**

Run: `node --check src/recorder/listen.mjs`
Expected: No output (clean parse)

**Step 4: Commit**

```bash
git add src/recorder/listen.mjs
git commit -m "feat(recorder): add HTTP server with SSE broadcasting for live monitor"
```

---

### Task 4: Add server cleanup on exit

**Files:**
- Modify: `src/recorder/listen.mjs` — update SIGINT handler and timeout handler

**Step 1: Update the timeout handler (line 102-106)**

Change from:

```js
const timer = setTimeout(async () => {
  saveSteps();
  console.log(`\n  Recording timeout. Saved ${allSteps.length} steps.`);
  await browser.close();
}, 600000);
```

To:

```js
const timer = setTimeout(async () => {
  saveSteps();
  console.log(`\n  Recording timeout. Saved ${allSteps.length} steps.`);
  monitorServer?.close();
  await browser.close();
}, 600000);
```

**Step 2: Update the SIGINT handler (line 108-115)**

Change from:

```js
process.on('SIGINT', async () => {
  clearTimeout(timer);
  saveSteps();
  console.log(`\n  Recording saved: ${allSteps.length} steps → ${RECORDING_DIR}/steps.json`);
  console.log(`  Run "node src/recorder/review.mjs" to review.`);
  await browser.close();
  process.exit(0);
});
```

To:

```js
process.on('SIGINT', async () => {
  clearTimeout(timer);
  saveSteps();
  // Close SSE connections and monitor server
  for (const res of sseClients) res.end();
  monitorServer?.close();
  console.log(`\n  Recording saved: ${allSteps.length} steps → ${RECORDING_DIR}/steps.json`);
  console.log(`  Run "node src/recorder/review.mjs" to review.`);
  await browser.close();
  process.exit(0);
});
```

**Step 3: Update the banner to mention monitor URL**

Change from:

```js
console.log('  ┌─────────────────────────────────────────────┐');
console.log('  │           RECORDING MODE ACTIVE              │');
console.log('  │  请在 OneKey 上操作，每次点击/输入自动记录    │');
console.log('  │  按 Ctrl+C 结束录制                          │');
console.log('  │  录制结果: shared/results/recording/          │');
console.log('  └─────────────────────────────────────────────┘');
```

To:

```js
console.log('  ┌─────────────────────────────────────────────┐');
console.log('  │           RECORDING MODE ACTIVE              │');
console.log('  │  请在 OneKey 上操作，每次点击/输入自动记录    │');
console.log('  │  按 Ctrl+C 结束录制                          │');
console.log('  │  录制结果: shared/results/recording/          │');
console.log(`  │  实时监控: http://localhost:${MONITOR_PORT}            │`);
console.log('  └─────────────────────────────────────────────┘');
```

**Step 4: Verify no syntax errors**

Run: `node --check src/recorder/listen.mjs`
Expected: No output (clean parse)

**Step 5: Commit**

```bash
git add src/recorder/listen.mjs
git commit -m "feat(recorder): add server cleanup on exit and update banner"
```

---

### Task 5: Manual smoke test

**Step 1: Launch OneKey with CDP**

```bash
/Applications/OneKey-3.localized/Contents/MacOS/OneKey --remote-debugging-port=9222 &
sleep 5
```

**Step 2: Run the recorder**

```bash
node src/recorder/listen.mjs
```

Expected:
- Terminal shows "RECORDING MODE ACTIVE" banner with monitor URL
- Browser auto-opens `http://localhost:3210`
- Monitor page shows "Waiting for interactions..." with pulsing green dot

**Step 3: Perform test interactions in OneKey**

- Click a few buttons
- Type in an input field

Expected:
- Each action appears in the monitor table instantly
- Table shows step number, type badge, element info, content, position, time
- New rows have highlight flash animation
- Step count increments in header

**Step 4: Stop recording**

Press Ctrl+C in terminal.

Expected:
- Terminal shows "Recording saved: N steps"
- Monitor page dot turns red (SSE connection closed)
- Server stops (page no longer accessible after refresh)
