// src/dashboard/test-executor.ts
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');

type EventType = 'queue' | 'start' | 'pass' | 'fail' | 'skip' | 'stopped' | 'done';

export interface RunEvent {
  event: EventType;
  id?: string;
  name?: string;
  duration?: number;
  error?: string;
  passed?: number;
  failed?: number;
  skipped?: number;
  total?: number;
  timestamp: string;
}

type EventCallback = (event: RunEvent) => void;

interface QueueItem {
  id: string;
  name: string;
  file: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
}

interface TestGroup {
  file: string;
  group: string;
  platform: string;
  cases: { id: string; name: string }[];
}

let queue: QueueItem[] = [];
let running = false;
let stopRequested = false;
let currentIndex = 0;
let listeners: EventCallback[] = [];

function emit(event: RunEvent) {
  for (const cb of listeners) {
    try { cb(event); } catch {}
  }
}

export function onEvent(cb: EventCallback) {
  listeners.push(cb);
  return () => { listeners = listeners.filter(l => l !== cb); };
}

export function getState() {
  return {
    running,
    stopRequested,
    currentIndex,
    queue: queue.map(q => ({ ...q })),
  };
}

export async function startRun(caseIds: string[], registry: TestGroup[]) {
  if (running) throw new Error('Already running');

  // Build queue from registry
  queue = [];
  for (const id of caseIds) {
    for (const group of registry) {
      const c = group.cases.find(c => c.id === id);
      if (c) {
        queue.push({ id: c.id, name: c.name, file: group.file, status: 'pending' });
        break;
      }
    }
  }

  for (const item of queue) {
    emit({ event: 'queue', id: item.id, name: item.name, timestamp: new Date().toISOString() });
  }

  running = true;
  stopRequested = false;
  currentIndex = 0;

  // Run async — don't await so the API call returns immediately
  executeQueue().catch(err => {
    console.error('[executor] Fatal:', err);
    running = false;
    emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
  });
}

export function stopRun() {
  if (!running) return;
  stopRequested = true;
}

export function resumeRun() {
  if (running) return;
  if (currentIndex >= queue.length) return;
  running = true;
  stopRequested = false;
  executeQueue().catch(err => {
    console.error('[executor] Fatal:', err);
    running = false;
    emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
  });
}

export function restartRun() {
  if (running) return;
  for (const item of queue) {
    item.status = 'pending';
    item.duration = undefined;
    item.error = undefined;
  }
  currentIndex = 0;
  running = true;
  stopRequested = false;

  for (const item of queue) {
    emit({ event: 'queue', id: item.id, name: item.name, timestamp: new Date().toISOString() });
  }
  executeQueue().catch(err => {
    console.error('[executor] Fatal:', err);
    running = false;
    emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
  });
}

async function executeQueue() {
  // Dynamic import helpers (ESM .mjs)
  const helpers = await import(pathToFileURL(join(TESTS_DIR, 'helpers', 'index.mjs')).href);
  const { connectCDP, sleep, dismissOverlays, unlockWalletIfNeeded } = helpers;

  let page: any;
  try {
    const cdp = await connectCDP();
    page = cdp.page;
    await unlockWalletIfNeeded(page);
  } catch (e: any) {
    // Fail all remaining
    for (let i = currentIndex; i < queue.length; i++) {
      queue[i].status = 'failed';
      queue[i].error = 'CDP connection failed: ' + e.message;
      emit({ event: 'fail', id: queue[i].id, error: queue[i].error, timestamp: new Date().toISOString() });
    }
    running = false;
    emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
    return;
  }

  // Track which file module is loaded and its setup state
  let lastFile = '';
  const moduleCache = new Map<string, any>();

  while (currentIndex < queue.length) {
    if (stopRequested) {
      running = false;
      emit({ event: 'stopped', timestamp: new Date().toISOString() });
      return;
    }

    const item = queue[currentIndex];
    item.status = 'running';
    emit({ event: 'start', id: item.id, name: item.name, timestamp: new Date().toISOString() });

    const startTime = Date.now();
    try {
      const filePath = join(TESTS_DIR, item.file);
      const fileUrl = pathToFileURL(filePath).href;
      if (!moduleCache.has(item.file)) {
        moduleCache.set(item.file, await import(fileUrl));
      }
      const mod = moduleCache.get(item.file)!;

      // Strategy 1: testCases has fn property (e.g. perps)
      const tc = mod.testCases?.find((c: any) => c.id === item.id);

      if (tc?.fn) {
        // If file changed, run setup (navigate to correct page)
        if (item.file !== lastFile && mod.setup) {
          await mod.setup(page);
        }
        const result = await tc.fn(page);
        item.duration = Date.now() - startTime;
        if (result?.status === 'failed') {
          item.status = 'failed';
          item.error = result.error || result.errors?.join('; ') || 'Test returned failed';
        } else if (result?.status === 'skipped') {
          item.status = 'skipped';
        } else {
          item.status = 'passed';
        }
      } else if (mod.run) {
        // Strategy 2: call run() — file-level execution
        const result = await mod.run();
        item.duration = Date.now() - startTime;
        item.status = result?.status === 'passed' ? 'passed' : 'failed';
        if (result?.error) item.error = result.error;
      } else {
        item.status = 'failed';
        item.error = 'No executable function found';
        item.duration = Date.now() - startTime;
      }

      lastFile = item.file;
    } catch (e: any) {
      item.duration = Date.now() - startTime;
      item.status = 'failed';
      item.error = e.message;
    }

    emit({
      event: item.status === 'passed' ? 'pass' : item.status === 'skipped' ? 'skip' : 'fail',
      id: item.id,
      duration: item.duration,
      error: item.error,
      timestamp: new Date().toISOString(),
    });

    currentIndex++;
  }

  running = false;
  emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
}

function getSummary() {
  const passed = queue.filter(q => q.status === 'passed').length;
  const failed = queue.filter(q => q.status === 'failed').length;
  const skipped = queue.filter(q => q.status === 'pending' || q.status === 'skipped').length;
  return { passed, failed, skipped, total: queue.length };
}
