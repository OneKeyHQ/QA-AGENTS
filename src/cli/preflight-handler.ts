// src/cli/preflight-handler.ts
// CLI wrapper for precondition checks.
// Connects CDP, runs probes, returns structured JSON.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');
const ONEKEY_BIN = process.env.ONEKEY_BIN ?? '/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey';
const CDP_URL = process.env.CDP_URL ?? 'http://127.0.0.1:9222';

interface PreflightCheck {
  name: string;
  status: 'ok' | 'warn' | 'block';
  message?: string;
}

interface PreflightOutput {
  ready: boolean;
  cdp: { connected: boolean; url: string };
  wallet: { unlocked: boolean };
  network: { reachable: boolean };
  checks: PreflightCheck[];
  skippedCases: string[];
  warnings: Array<{ check: string; level: string; message: string }>;
  timestamp: string;
}

async function ensureCDP(): Promise<boolean> {
  try {
    const resp = await fetch(`${CDP_URL}/json/version`, { signal: AbortSignal.timeout(3000) });
    return resp.ok;
  } catch {
    return false;
  }
}

async function launchOneKey(): Promise<void> {
  if (!existsSync(ONEKEY_BIN)) {
    throw new Error(`OneKey binary not found: ${ONEKEY_BIN}`);
  }
  // Kill existing
  try { execSync('pkill -f "OneKey"', { stdio: 'ignore' }); } catch {}
  // Wait for cleanup
  await new Promise(r => setTimeout(r, 1000));
  // Launch
  const { spawn } = await import('node:child_process');
  const child = spawn(ONEKEY_BIN, ['--remote-debugging-port=9222'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  // Wait for CDP to be ready
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 1000));
    if (await ensureCDP()) return;
  }
  throw new Error('OneKey launched but CDP did not become ready within 10s');
}

export async function runPreflight(caseIds: string[], json: boolean): Promise<PreflightOutput> {
  const checks: PreflightCheck[] = [];
  const output: PreflightOutput = {
    ready: true,
    cdp: { connected: false, url: CDP_URL },
    wallet: { unlocked: false },
    network: { reachable: false },
    checks,
    skippedCases: [],
    warnings: [],
    timestamp: new Date().toISOString(),
  };

  // Suppress console in json mode
  const origLog = console.log;
  const origError = console.error;
  if (json) {
    console.log = () => {};
    console.error = () => {};
  }

  try {
    // 1. CDP connection
    let cdpOk = await ensureCDP();
    if (!cdpOk) {
      if (!json) origLog('  CDP not ready, launching OneKey...');
      try {
        await launchOneKey();
        cdpOk = await ensureCDP();
      } catch (e: any) {
        checks.push({ name: 'cdp_connection', status: 'block', message: e.message });
        output.ready = false;
        output.cdp.connected = false;
        return output;
      }
    }

    output.cdp.connected = cdpOk;
    checks.push({ name: 'cdp_connection', status: cdpOk ? 'ok' : 'block', message: cdpOk ? undefined : 'Cannot connect to CDP' });
    if (!cdpOk) {
      output.ready = false;
      return output;
    }

    // 2. Connect via Playwright and run preconditions
    const helpers = await import(pathToFileURL(join(TESTS_DIR, 'helpers', 'index.mjs')).href);
    const { connectCDP, unlockWalletIfNeeded } = helpers;

    let page: any;
    try {
      const cdp = await connectCDP();
      page = cdp.page;
    } catch (e: any) {
      checks.push({ name: 'cdp_playwright', status: 'block', message: e.message });
      output.ready = false;
      return output;
    }

    // 3. Wallet unlock
    try {
      await unlockWalletIfNeeded(page);
      output.wallet.unlocked = true;
      checks.push({ name: 'wallet_unlock', status: 'ok' });
    } catch (e: any) {
      output.wallet.unlocked = false;
      checks.push({ name: 'wallet_unlock', status: 'block', message: e.message });
      output.ready = false;
      return output;
    }

    // 4. Network check
    try {
      const netOk = await page.evaluate(async () => {
        try {
          await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', signal: AbortSignal.timeout(5000) });
          return true;
        } catch { return false; }
      });
      output.network.reachable = netOk;
      checks.push({
        name: 'network',
        status: netOk ? 'ok' : 'warn',
        message: netOk ? undefined : '网络不通，部分用例可能失败',
      });
      if (!netOk) {
        output.warnings.push({ check: 'network', level: 'warn', message: '网络不通' });
      }
    } catch {
      output.network.reachable = false;
      checks.push({ name: 'network', status: 'warn', message: '网络检查失败' });
    }

    // 5. Run full preconditions if IDs provided and preconditions.mjs exists
    if (caseIds.length > 0) {
      try {
        const precondMod = await import(pathToFileURL(join(TESTS_DIR, 'helpers', 'preconditions.mjs')).href);
        const preReport = await precondMod.runPreconditions(page, caseIds);
        if (!preReport.canRun) {
          output.ready = false;
          checks.push({ name: 'preconditions', status: 'block', message: 'Precondition checks failed' });
        } else {
          checks.push({ name: 'preconditions', status: 'ok' });
        }
        output.skippedCases = preReport.skipped ?? [];
        output.warnings.push(...(preReport.warnings ?? []));
      } catch (e: any) {
        checks.push({ name: 'preconditions', status: 'warn', message: `Preconditions module error: ${e.message}` });
      }
    }
  } finally {
    if (json) {
      console.log = origLog;
      console.error = origError;
    }
  }

  return output;
}
