// src/cli/preflight-handler.ts
// CLI wrapper for precondition checks.
// Connects CDP, runs probes, returns structured JSON.

import 'dotenv/config';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync } from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';

const TESTS_DIR = join(import.meta.dirname, '..', 'tests');
const PROJECT_ROOT = join(import.meta.dirname, '..', '..');
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
  ios?: IosPreflightOutput;
  checks: PreflightCheck[];
  skippedCases: string[];
  warnings: Array<{ check: string; level: string; message: string }>;
  timestamp: string;
}

interface IosTarget {
  kind: 'simulator' | 'real-device';
  udid: string;
  state?: string;
}

interface IosPreflightOutput {
  ready: boolean;
  target?: IosTarget;
  checks: PreflightCheck[];
  warnings: Array<{ check: string; level: string; message: string }>;
}

interface IosPreflightDeps {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  runCommand?: (cmd: string, args: string[]) => string;
  exists?: (path: string) => boolean;
  readText?: (path: string) => string;
}

interface PreflightDeps {
  iosPreflight?: () => IosPreflightOutput;
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

function defaultRunCommand(cmd: string, args: string[]): string {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) throw result.error;
  if (result.status && result.status !== 0) {
    throw new Error(output.trim() || `${cmd} ${args.join(' ')} exited with ${result.status}`);
  }
  return output;
}

function pushIosCheck(output: IosPreflightOutput, check: PreflightCheck) {
  output.checks.push(check);
  if (check.status === 'block') output.ready = false;
}

function findSimulator(simctlOutput: string, udid: string): IosTarget | undefined {
  const line = simctlOutput.split(/\r?\n/).find(l => l.includes(`(${udid})`));
  if (!line) return undefined;
  const state = line.match(/\((Booted|Shutdown)\)/)?.[1];
  return { kind: 'simulator', udid, ...(state ? { state } : {}) };
}

function findRealDevice(devicectlOutput: string, udid: string): IosTarget | undefined {
  if (!devicectlOutput.includes(udid)) return undefined;
  return { kind: 'real-device', udid };
}

function readSourceBundleId(readText: (path: string) => string): string | undefined {
  const pbxprojPath = join(PROJECT_ROOT, '..', 'app-monorepo', 'apps', 'mobile', 'ios', 'OneKeyWallet.xcodeproj', 'project.pbxproj');
  try {
    const text = readText(pbxprojPath);
    const match = text.match(/PRODUCT_BUNDLE_IDENTIFIER = ([^;\s]+);/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export function runIosPreflightChecks(deps: IosPreflightDeps = {}): IosPreflightOutput {
  const env = deps.env ?? process.env;
  const runCommand = deps.runCommand ?? defaultRunCommand;
  const exists = deps.exists ?? existsSync;
  const readText = deps.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const output: IosPreflightOutput = { ready: true, checks: [], warnings: [] };

  try {
    const driverList = runCommand('appium', ['driver', 'list', '--installed']);
    pushIosCheck(output, {
      name: 'ios_appium_xcuitest_driver',
      status: driverList.includes('xcuitest') ? 'ok' : 'block',
      message: driverList.includes('xcuitest') ? undefined : 'Appium XCUITest driver is not installed',
    });
  } catch (e: any) {
    pushIosCheck(output, {
      name: 'ios_appium_xcuitest_driver',
      status: 'block',
      message: `Cannot run appium driver list --installed: ${e.message}`,
    });
  }

  try {
    const xcodeVersion = runCommand('xcodebuild', ['-version']).split(/\r?\n/)[0]?.trim();
    pushIosCheck(output, { name: 'ios_xcode', status: 'ok', message: xcodeVersion || undefined });
  } catch (e: any) {
    pushIosCheck(output, {
      name: 'ios_xcode',
      status: 'block',
      message: `Cannot run xcodebuild -version: ${e.message}`,
    });
  }

  const udid = env.APPIUM_IOS_UDID?.trim();
  if (!udid) {
    pushIosCheck(output, { name: 'ios_device', status: 'block', message: 'APPIUM_IOS_UDID is not set' });
  } else {
    let simctlOutput = '';
    let devicectlOutput = '';
    try { simctlOutput = runCommand('xcrun', ['simctl', 'list', 'devices', 'available']); } catch {}
    try { devicectlOutput = runCommand('xcrun', ['devicectl', 'list', 'devices']); } catch {}

    const simulator = findSimulator(simctlOutput, udid);
    const realDevice = findRealDevice(devicectlOutput, udid);
    const target = simulator ?? realDevice;
    if (target) {
      output.target = target;
      pushIosCheck(output, {
        name: 'ios_device',
        status: 'ok',
        message: `${target.kind} ${target.udid}${target.state ? ` (${target.state})` : ''}`,
      });
      if (target.kind === 'simulator' && target.state !== 'Booted') {
        const warning = 'Simulator is visible but not booted; Appium may boot it, but pre-booting is more reliable';
        output.warnings.push({ check: 'ios_device', level: 'warn', message: warning });
        output.checks.push({ name: 'ios_simulator_booted', status: 'warn', message: warning });
      }
    } else {
      pushIosCheck(output, {
        name: 'ios_device',
        status: 'block',
        message: `Unknown device or simulator UDID: ${udid}`,
      });
    }
  }

  const platformVersion = env.APPIUM_IOS_PLATFORMVERSION?.trim();
  if (platformVersion) {
    pushIosCheck(output, { name: 'ios_platform_version', status: 'ok', message: platformVersion });
  } else {
    const message = 'APPIUM_IOS_PLATFORMVERSION is not set';
    output.warnings.push({ check: 'ios_platform_version', level: 'warn', message });
    output.checks.push({ name: 'ios_platform_version', status: 'warn', message });
  }

  const bundleId = env.APPIUM_IOS_BUNDLEID?.trim();
  if (!bundleId) {
    pushIosCheck(output, { name: 'ios_bundle_id', status: 'block', message: 'APPIUM_IOS_BUNDLEID is not set' });
  } else {
    pushIosCheck(output, { name: 'ios_bundle_id', status: 'ok', message: bundleId });
    const sourceBundleId = readSourceBundleId(readText);
    if (sourceBundleId && sourceBundleId !== bundleId) {
      const message = `APPIUM_IOS_BUNDLEID=${bundleId} differs from source bundle id ${sourceBundleId}`;
      output.warnings.push({ check: 'ios_bundle_id_source_match', level: 'warn', message });
      output.checks.push({ name: 'ios_bundle_id_source_match', status: 'warn', message });
    }
  }

  const appPath = env.APPIUM_IOS_APP?.trim();
  if (appPath) {
    pushIosCheck(output, {
      name: 'ios_app_path',
      status: exists(appPath) ? 'ok' : 'block',
      message: exists(appPath) ? appPath : `APPIUM_IOS_APP does not exist: ${appPath}`,
    });
  } else {
    const message = 'APPIUM_IOS_APP is not set; Appium will launch an already-installed bundleId and will not install the app';
    output.warnings.push({ check: 'ios_app_path', level: 'warn', message });
    output.checks.push({ name: 'ios_app_path', status: 'warn', message });
  }

  return output;
}

function shouldRunIosPreflight() {
  return process.env.MOBILE_TARGET_PLATFORM === 'ios'
    || Object.keys(process.env).some(key => key.startsWith('APPIUM_IOS_'));
}

export async function runPreflight(caseIds: string[], json: boolean, deps: PreflightDeps = {}): Promise<PreflightOutput> {
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
    if (process.env.MOBILE_TARGET_PLATFORM === 'ios') {
      const ios = deps.iosPreflight ? deps.iosPreflight() : runIosPreflightChecks();
      output.ios = ios;
      output.ready = ios.ready;
      checks.push(...ios.checks);
      output.warnings.push(...ios.warnings);
      return output;
    }

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

    if (shouldRunIosPreflight()) {
      const ios = runIosPreflightChecks();
      output.ios = ios;
      checks.push(...ios.checks);
      output.warnings.push(...ios.warnings);
      if (!ios.ready) output.ready = false;
    }
  } finally {
    if (json) {
      console.log = origLog;
      console.error = origError;
    }
  }

  return output;
}
