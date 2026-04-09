import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { getTestRegistry } from './test-registry.ts';
import { startRun, stopRun, resumeRun, restartRun, resetRun, getState, onEvent, type RunEvent } from './test-executor.ts';

const PORT = 5050;
const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');
const SHARED_DIR = join(PROJECT_ROOT, 'shared');
const RECORDINGS_DIR = join(PROJECT_ROOT, 'midscene_run', 'recordings');
const HTML_PATH = join(import.meta.dirname, 'index.html');
const RECORDER_HTML_PATH = join(import.meta.dirname, 'recorder.html');

function readJSONSafe(path: string): unknown {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch { return null; }
}

function getResultFiles(): unknown[] {
  const dir = join(SHARED_DIR, 'results');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .map(f => readJSONSafe(join(dir, f)))
    .filter(Boolean);
}

function getSummaryFiles(): { filename: string; content: string }[] {
  const dir = join(SHARED_DIR, 'results');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.includes('snapshot'))
    .map(f => ({ filename: f, content: readFileSync(join(dir, f), 'utf-8') }));
}

function getRecordingSessions(): { name: string; session: unknown }[] {
  if (!existsSync(RECORDINGS_DIR)) return [];
  return readdirSync(RECORDINGS_DIR)
    .filter(d => {
      const p = join(RECORDINGS_DIR, d);
      return statSync(p).isDirectory() && existsSync(join(p, 'session.json'));
    })
    .sort().reverse()
    .map(d => ({
      name: d,
      session: readJSONSafe(join(RECORDINGS_DIR, d, 'session.json')),
    }));
}

function buildAPIResponse() {
  return {
    timestamp: new Date().toISOString(),
    tasks: readJSONSafe(join(SHARED_DIR, 'tasks.json')),
    mailbox: readJSONSafe(join(SHARED_DIR, 'mailbox.json')),
    knowledge: readJSONSafe(join(SHARED_DIR, 'knowledge.json')),
    testCases: readJSONSafe(join(SHARED_DIR, 'test_cases.json')),
    results: getResultFiles(),
    summaries: getSummaryFiles(),
  };
}

// Registry cache — null means needs refresh. Reset on each server start.
let registryCache: Awaited<ReturnType<typeof getTestRegistry>> | null = null;

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.json': 'application/json',
  '.html': 'text/html; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const cors = { 'Access-Control-Allow-Origin': '*' };

  // ── Test Execution APIs ──

  if (url.pathname === '/api/cdp-status') {
    const cdpPorts = { desktop: 9222, web: 9223, extension: 9224 };
    const results: Record<string, { ok: boolean; browser?: string }> = {};
    await Promise.all(
      Object.entries(cdpPorts).map(async ([name, port]) => {
        try {
          const resp = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2000) });
          if (resp.ok) {
            const info = await resp.json() as { Browser?: string };
            results[name] = { ok: true, browser: info.Browser };
          } else {
            results[name] = { ok: false };
          }
        } catch {
          results[name] = { ok: false };
        }
      }),
    );
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(results));
    return;
  }

  if (url.pathname === '/api/tests') {
    // Always re-scan to pick up code changes (skipSteps etc.)
    registryCache = await getTestRegistry();
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(registryCache));
    return;
  }

  if (url.pathname === '/api/run-state') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(getState()));
    return;
  }

  if (url.pathname === '/api/run' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const { cases } = JSON.parse(body);
        if (!registryCache) registryCache = await getTestRegistry();
        await startRun(cases, registryCache);
        res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ ok: true }));
      } catch (e: any) {
        res.writeHead(400, { 'Content-Type': 'application/json', ...cors });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/api/stop' && req.method === 'POST') {
    stopRun();
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/resume' && req.method === 'POST') {
    resumeRun();
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/restart' && req.method === 'POST') {
    restartRun();
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/reset' && req.method === 'POST') {
    resetRun();
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (url.pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      ...cors,
    });
    res.write(':\n\n');

    // Send periodic keepalive to maintain connection
    const keepalive = setInterval(() => { res.write(':\n\n'); }, 15000);

    const unsubscribe = onEvent((event: RunEvent) => {
      res.write(`event: ${event.event}\ndata: ${JSON.stringify(event)}\n\n`);
    });

    req.on('close', () => { unsubscribe(); clearInterval(keepalive); });
    return;
  }

  // ── Existing APIs ──

  if (url.pathname === '/api/state') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(buildAPIResponse()));
    return;
  }

  if (url.pathname === '/api/file' && url.searchParams.get('path')) {
    const relPath = url.searchParams.get('path')!;
    const absPath = join(PROJECT_ROOT, relPath);
    if (!absPath.startsWith(PROJECT_ROOT) || !existsSync(absPath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const content = readFileSync(absPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(content);
    return;
  }

  // ── Recording APIs ──

  if (url.pathname === '/api/recordings') {
    const sessions = getRecordingSessions();
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(sessions));
    return;
  }

  if (url.pathname === '/api/recording' && url.searchParams.get('session')) {
    const sessionName = url.searchParams.get('session')!;
    const sessionDir = join(RECORDINGS_DIR, sessionName);
    const sessionFile = join(sessionDir, 'session.json');
    if (!sessionDir.startsWith(RECORDINGS_DIR) || !existsSync(sessionFile)) {
      res.writeHead(404); res.end('Session not found'); return;
    }
    const session = readJSONSafe(sessionFile);
    res.writeHead(200, { 'Content-Type': 'application/json', ...cors });
    res.end(JSON.stringify(session));
    return;
  }

  // Serve recording screenshots: /recordings/{session}/{filename}.png
  if (url.pathname.startsWith('/recordings/')) {
    const relPath = url.pathname.replace('/recordings/', '');
    const absPath = join(RECORDINGS_DIR, relPath);
    if (!absPath.startsWith(RECORDINGS_DIR) || !existsSync(absPath)) {
      res.writeHead(404); res.end('Not found'); return;
    }
    const ext = extname(absPath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, ...cors, 'Cache-Control': 'no-cache' });
    res.end(readFileSync(absPath));
    return;
  }

  // ── Pages ──

  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(readFileSync(HTML_PATH, 'utf-8'));
    return;
  }

  if (url.pathname === '/recorder') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(readFileSync(RECORDER_HTML_PATH, 'utf-8'));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n  OneKey Agent Dashboard: http://localhost:${PORT}`);
  console.log(`  Recorder Monitor:      http://localhost:${PORT}/recorder`);
  console.log(`  Press Ctrl+C to stop\n`);
});
