import http from 'http';
import { exec } from 'child_process';
import { getState } from './testRunStatusStore.js';
import logger from './logger.js';

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>E2E 测试执行看板</title>
  <style>
    :root {
      --bg: #0f0f12;
      --card: #1a1a1f;
      --border: #2a2a32;
      --text: #e4e4e7;
      --muted: #71717a;
      --pending: #a1a1aa;
      --running: #3b82f6;
      --passed: #22c55e;
      --failed: #ef4444;
    }
    * { box-sizing: border-box; }
    body {
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 24px;
      min-height: 100vh;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 20px;
      letter-spacing: -0.02em;
    }
    .summary {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
    }
    .summary-item {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .summary-item .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }
    .summary-item .dot.pending { background: var(--pending); }
    .summary-item .dot.running { background: var(--running); }
    .summary-item .dot.passed { background: var(--passed); }
    .summary-item .dot.failed { background: var(--failed); }
    .summary-item span { color: var(--muted); font-size: 0.9rem; }
    .summary-item strong { font-size: 1.25rem; }
    .table-wrap {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    th {
      font-weight: 600;
      color: var(--muted);
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    tr:last-child td { border-bottom: none; }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .status.pending { background: rgba(161,161,170,0.2); color: var(--pending); }
    .status.running { background: rgba(59,130,246,0.2); color: var(--running); }
    .status.passed { background: rgba(34,197,94,0.2); color: var(--passed); }
    .status.failed { background: rgba(239,68,68,0.2); color: var(--failed); }
    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .status.running .status-dot { animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }
    .device-id { font-size: 0.9rem; color: var(--muted); }
    .last-update { margin-top: 16px; font-size: 0.8rem; color: var(--muted); }
  </style>
</head>
<body>
  <h1>E2E 测试执行看板</h1>
  <div class="summary">
    <div class="summary-item"><span class="dot pending"></span><span>未执行</span><strong id="cnt-pending">0</strong></div>
    <div class="summary-item"><span class="dot running"></span><span>执行中</span><strong id="cnt-running">0</strong></div>
    <div class="summary-item"><span class="dot passed"></span><span>通过</span><strong id="cnt-passed">0</strong></div>
    <div class="summary-item"><span class="dot failed"></span><span>失败</span><strong id="cnt-failed">0</strong></div>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>设备</th>
          <th>用例</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody id="tbody"></tbody>
    </table>
  </div>
  <div class="last-update" id="last-update">—</div>
  <script>
    const tbody = document.getElementById('tbody');
    const statusLabels = { pending: '未执行', running: '执行中', passed: '通过', failed: '失败' };
    function render(data) {
      document.getElementById('cnt-pending').textContent = data.summary.pending;
      document.getElementById('cnt-running').textContent = data.summary.running;
      document.getElementById('cnt-passed').textContent = data.summary.passed;
      document.getElementById('cnt-failed').textContent = data.summary.failed;
      tbody.innerHTML = data.testCases.map(tc => 
        '<tr><td class="device-id">' + (tc.deviceId || '—') + '</td><td>' + escapeHtml(tc.fileName) + '</td><td><span class="status ' + tc.status + '"><span class="status-dot"></span>' + statusLabels[tc.status] + '</span></td></tr>'
      ).join('');
      document.getElementById('last-update').textContent = '最后更新: ' + new Date().toLocaleTimeString('zh-CN');
    }
    function escapeHtml(s) { const div = document.createElement('div'); div.textContent = s; return div.innerHTML; }
    function fetchStatus() {
      fetch('/api/status').then(r => r.json()).then(render).catch(() => {});
    }
    fetchStatus();
    setInterval(fetchStatus, 2000);
  </script>
</body>
</html>
`;

let server = null;

/**
 * 启动实时看板 HTTP 服务
 * @param {number} port 端口，默认 5051
 * @param {boolean} openBrowser 是否自动打开浏览器
 * @returns {Promise<{ url: string, server: import('http').Server }>}
 */
export function startLiveReportServer(port = 5051, openBrowser = true) {
  return new Promise((resolve, reject) => {
    if (server) {
      try {
        server.close();
      } catch (_) {}
      server = null;
    }

    server = http.createServer((req, res) => {
      const url = req.url?.split('?')[0] || '/';

      if (url === '/api/status') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(JSON.stringify(getState()));
        return;
      }

      if (url === '/' || url === '/index.html') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(DASHBOARD_HTML);
        return;
      }

      res.statusCode = 404;
      res.end('Not Found');
    });

    server.on('error', err => {
      logger.warn('Live report server error:', err.message);
      reject(err);
    });

    server.listen(port, '127.0.0.1', () => {
      const url = `http://127.0.0.1:${port}`;
      logger.info(`Live report dashboard: ${url}`);
      if (openBrowser) {
        try {
          const open = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
          exec(`${open} "${url}"`, () => {});
        } catch (_) {}
      }
      resolve({ url, server });
    });
  });
}

/**
 * 停止实时看板服务
 */
export function stopLiveReportServer() {
  if (server) {
    server.close();
    server = null;
    logger.info('Live report server stopped');
  }
}
