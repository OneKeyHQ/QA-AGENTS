// src/dashboard/test-executor.ts
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');

type EventType = 'queue' | 'start' | 'pass' | 'fail' | 'skip' | 'stopped' | 'done' | 'step' | 'log' | 'reset';

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
  // step event fields
  stepName?: string;
  stepStatus?: 'passed' | 'failed' | 'skipped';
  stepDetail?: string;
  stepIndex?: number;
  stepTotal?: number;
  // result summary (sent with pass/fail)
  steps?: { name: string; status: string; detail: string }[];
  summary?: { passed: number; failed: number; skipped: number; total: number };
}

type EventCallback = (event: RunEvent) => void;

interface QueueItem {
  id: string;
  name: string;
  file: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  error?: string;
  // Step-level results — accumulated during execution for SSE and state recovery
  steps?: { name: string; status: string; detail: string; time?: string }[];
  summary?: { passed: number; failed: number; skipped: number; total: number };
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
  const hasQueue = queue.length > 0;
  const allDone = hasQueue && currentIndex >= queue.length && !running;
  return {
    running,
    stopRequested,
    currentIndex,
    queue: queue.map(q => ({ ...q })),
    // Frontend-compatible fields
    state: running ? 'running' : allDone ? 'finished' : hasQueue ? 'stopped' : 'idle',
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

export function resetRun() {
  if (running) return;
  queue = [];
  currentIndex = 0;
  stopRequested = false;
  emit({ event: 'reset', timestamp: new Date().toISOString() });
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

function isMobileFile(filePath: string): boolean {
  // Registry passes paths relative to src/tests/ (e.g. "mobile/wallet/x.test.mjs"),
  // so we match on the "mobile/" segment without requiring a leading slash.
  return /(^|[\\/])mobile[\\/]/.test(filePath);
}

let noEvalModulePromise: Promise<any> | null = null;

async function getNoEvalModule() {
  if (!noEvalModulePromise) {
    const helperUrl = pathToFileURL(join(TESTS_DIR, 'helpers', 'no-eval-cdp.mjs')).href;
    noEvalModulePromise = import(`${helperUrl}?t=${Date.now()}`).catch((error) => {
      noEvalModulePromise = null;
      throw error;
    });
  }
  return noEvalModulePromise;
}

async function ensureNoEvalSafeEvaluate(page: any) {
  if (!page || typeof page.url !== 'function') return false;
  const url = page.url();
  if (!url.startsWith('chrome-extension://')) return false;
  const noEval = await getNoEvalModule();
  return noEval.installNoEvalSafeEvaluate(page);
}

async function executeQueue() {
  // Lazy session handles — only the platforms actually used get initialized.
  let desktopPage: any = null;
  let mobileDriver: any = null;
  let appiumModule: any = null;

  // Pre-decide which platforms appear in this run so connection failures fail
  // only the cases that need them, not the whole queue.
  const hasDesktop = queue.some(q => !isMobileFile(q.file));
  const hasMobile = queue.some(q => isMobileFile(q.file));

  if (hasDesktop) {
    try {
      const helpers = await import(`${pathToFileURL(join(TESTS_DIR, 'helpers', 'index.mjs')).href}?t=${Date.now()}`);
      const cdp = await helpers.connectCDP();
      desktopPage = cdp.page;
      await ensureNoEvalSafeEvaluate(desktopPage);
      await helpers.unlockWalletIfNeeded(desktopPage);
    } catch (e: any) {
      for (const item of queue) {
        if (!isMobileFile(item.file) && item.status === 'pending') {
          item.status = 'failed';
          item.error = 'CDP connection failed: ' + e.message;
          emit({ event: 'fail', id: item.id, error: item.error, timestamp: new Date().toISOString() });
        }
      }
    }
  }

  if (hasMobile) {
    try {
      appiumModule = await import(`${pathToFileURL(join(TESTS_DIR, 'mobile', '_appium.mjs')).href}?t=${Date.now()}`);
      // Platform comes from MOBILE_TARGET_PLATFORM env (set by the Dashboard
      // mobile-target picker via /api/mobile-target). Defaults to 'android'.
      mobileDriver = await appiumModule.connectDriver();
    } catch (e: any) {
      for (const item of queue) {
        if (isMobileFile(item.file) && item.status === 'pending') {
          item.status = 'failed';
          item.error = 'Appium connection failed: ' + e.message;
          emit({ event: 'fail', id: item.id, error: item.error, timestamp: new Date().toISOString() });
        }
      }
    }
  }

  if (!desktopPage && !mobileDriver) {
    running = false;
    emit({ event: 'done', ...getSummary(), timestamp: new Date().toISOString() });
    return;
  }

  // Track which file module is loaded — cache cleared each run for fresh code
  let lastFile = '';
  const moduleCache = new Map<string, any>();
  // Note: moduleCache is local to each executeQueue() call, so each run gets fresh imports

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
      // Bust ESM cache with timestamp query param — ensures latest code is loaded after edits
      if (!moduleCache.has(item.file)) {
        moduleCache.set(item.file, await import(`${fileUrl}?t=${Date.now()}`));
      }
      const mod = moduleCache.get(item.file)!;

      // Strategy 1: testCases has fn property (e.g. perps)
      const tc = mod.testCases?.find((c: any) => c.id === item.id);

      const sessionHandle = isMobileFile(item.file) ? mobileDriver : desktopPage;
      if (isMobileFile(item.file) && !mobileDriver) {
        item.status = 'failed';
        item.error = 'Mobile driver not available';
        item.duration = Date.now() - startTime;
        emit({ event: 'fail', id: item.id, error: item.error, timestamp: new Date().toISOString() });
        currentIndex++;
        continue;
      }
      if (!isMobileFile(item.file) && !desktopPage) {
        item.status = 'failed';
        item.error = 'Desktop page not available';
        item.duration = Date.now() - startTime;
        emit({ event: 'fail', id: item.id, error: item.error, timestamp: new Date().toISOString() });
        currentIndex++;
        continue;
      }

      if (tc?.fn) {
        // If file changed, run setup (navigate to correct page)
        if (item.file !== lastFile && mod.setup) {
          if (!isMobileFile(item.file)) await ensureNoEvalSafeEvaluate(sessionHandle);
          await mod.setup(sessionHandle);
        }

        // Intercept console.log to capture step-level output and emit as events
        const origLog = console.log;
        const stepRegex = /^\s*\[(OK|FAIL|SKIP)\]\s+(.+?)(?:\s+—\s+(.*))?$/;
        console.log = (...args: any[]) => {
          origLog.apply(console, args);
          const msg = args.map(String).join(' ');
          const match = msg.match(stepRegex);
          if (match) {
            const [, status, stepName, detail] = match;
            const stepStatus = status === 'OK' ? 'passed' : status === 'FAIL' ? 'failed' : 'skipped';
            // Persist step into queue item so getState() can return them on reconnect
            if (!item.steps) item.steps = [];
            item.steps.push({ name: stepName, status: stepStatus, detail: detail || '' });
            emit({
              event: 'step',
              id: item.id,
              stepName,
              stepStatus,
              stepDetail: detail || '',
              timestamp: new Date().toISOString(),
            });
          } else if (msg.includes('[ui]') || msg.startsWith('  ')) {
            // Emit other log lines as generic log events
            emit({
              event: 'log',
              id: item.id,
              stepDetail: msg.trim(),
              timestamp: new Date().toISOString(),
            });
          }
        };

        try {
          // Race between test execution and stop signal (poll every 2s)
          let clearStopChecker: (() => void) | undefined;
          const stopChecker = new Promise<never>((_, reject) => {
            const iv = setInterval(() => {
              if (stopRequested) { clearInterval(iv); reject(new Error('__STOP_REQUESTED__')); }
            }, 2000);
            clearStopChecker = () => clearInterval(iv);
          });
          let result: any;
          try {
            if (!isMobileFile(item.file)) await ensureNoEvalSafeEvaluate(sessionHandle);
            result = await Promise.race([tc.fn(sessionHandle), stopChecker]);
          } finally {
            clearStopChecker?.();
          }
          item.duration = Date.now() - startTime;
          if (result?.status === 'failed') {
            item.status = 'failed';
            item.error = result.error || result.errors?.join('; ') || 'Test returned failed';
          } else if (result?.status === 'skipped') {
            item.status = 'skipped';
          } else {
            item.status = 'passed';
          }

          // Persist step details and summary into queue item
          if (result?.steps) item.steps = result.steps;
          if (result?.summary) item.summary = result.summary;
        } finally {
          console.log = origLog;
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
      if (e.message === '__STOP_REQUESTED__') {
        item.status = 'failed';
        item.error = 'Stopped by user';
        // Skip remaining items
        for (let i = currentIndex + 1; i < queue.length; i++) {
          queue[i].status = 'skipped';
        }
        running = false;
        emit({ event: 'stopped', timestamp: new Date().toISOString() });
        return;
      }
      item.status = 'failed';
      item.error = e.message;
    }

    emit({
      event: item.status === 'passed' ? 'pass' : item.status === 'skipped' ? 'skip' : 'fail',
      id: item.id,
      name: item.name,
      duration: item.duration,
      error: item.error,
      steps: item.steps,
      summary: item.summary,
      timestamp: new Date().toISOString(),
    });

    currentIndex++;
  }

  // Tear down mobile session (desktop CDP belongs to the user — leave open).
  if (mobileDriver && appiumModule) {
    try { await appiumModule.disconnectDriver(mobileDriver); } catch {}
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
