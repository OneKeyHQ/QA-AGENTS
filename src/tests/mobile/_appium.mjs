// Appium server + WDIO session lifecycle.
//
// Reads device config from .env (APPIUM_PLATFORMNAME, APPIUM_DEVICENAME,
// APPIUM_APP, APPIUM_PORT). Spawns an Appium server on demand and tears it
// down at the end. Returns a WDIO browser handle that test files use as
// their `driver`.

import 'dotenv/config';
import { spawn } from 'node:child_process';
import { remote } from 'webdriverio';

// Appium needs ANDROID_HOME in its own env. Fall back to the default macOS
// SDK location so a fresh checkout works without manual env setup.
if (!process.env.ANDROID_HOME) {
  process.env.ANDROID_HOME = `${process.env.HOME}/Library/Android/sdk`;
}

const APPIUM_PORT = parseInt(process.env.APPIUM_PORT || '4728', 10);
const APPIUM_HOST = '127.0.0.1';
let _appiumProc = null;

async function waitForAppiumReady(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`http://${APPIUM_HOST}:${APPIUM_PORT}/status`);
      if (r.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`Appium did not become ready within ${timeoutMs}ms on port ${APPIUM_PORT}`);
}

export async function startAppium() {
  if (_appiumProc) return;
  // Check if something's already on the port
  try {
    const r = await fetch(`http://${APPIUM_HOST}:${APPIUM_PORT}/status`);
    if (r.ok) {
      console.log(`[appium] reusing existing server on :${APPIUM_PORT}`);
      return;
    }
  } catch {}

  console.log(`[appium] starting server on :${APPIUM_PORT}`);
  _appiumProc = spawn('appium', ['-p', String(APPIUM_PORT)], { stdio: 'pipe' });
  _appiumProc.stdout.on('data', (d) => process.env.APPIUM_VERBOSE && process.stdout.write(`[appium] ${d}`));
  _appiumProc.stderr.on('data', (d) => process.stderr.write(`[appium err] ${d}`));
  _appiumProc.on('exit', (code) => console.log(`[appium] exited code=${code}`));
  await waitForAppiumReady();
  console.log('[appium] ready');
}

export async function stopAppium() {
  if (!_appiumProc) return;
  _appiumProc.kill('SIGTERM');
  _appiumProc = null;
}

/**
 * connectDriver — start Appium (if needed) and open a WDIO session.
 * Returns a driver handle that mobile .test.mjs files use.
 *
 * Platform precedence: explicit arg > MOBILE_TARGET_PLATFORM env > 'android'.
 */
export async function connectDriver({ platform } = {}) {
  platform = platform || process.env.MOBILE_TARGET_PLATFORM || 'android';
  if (!['android', 'ios'].includes(platform)) {
    throw new Error(`Unsupported mobile platform: ${platform}. Set MOBILE_TARGET_PLATFORM=android|ios`);
  }
  await startAppium();

  const caps = platform === 'android'
    ? {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        'appium:deviceName': process.env.APPIUM_DEVICENAME || 'Android Device',
        'appium:appPackage': process.env.APPIUM_APPPACKAGE,
        'appium:appActivity': process.env.APPIUM_APPACTIVITY,
        'appium:app': process.env.APPIUM_APP,
        'appium:noReset': true,
        'appium:fullReset': false,
      }
    : {
        platformName: 'iOS',
        'appium:automationName': 'XCUITest',
        'appium:platformVersion': process.env.APPIUM_PLATFORMVERSION,
        'appium:deviceName': process.env.APPIUM_DEVICENAME,
        'appium:udid': process.env.APPIUM_UDID,
        'appium:bundleId': process.env.APPIUM_BUNDLEID,
        'appium:app': process.env.APPIUM_APP,
        'appium:xcodeOrgId': process.env.APPIUM_XCODEORGID,
      };

  const driver = await remote({
    hostname: APPIUM_HOST,
    port: APPIUM_PORT,
    path: '/',
    logLevel: 'error',
    capabilities: caps,
  });

  console.log(`[appium] session ready (${platform})`);
  return driver;
}

export async function disconnectDriver(driver) {
  if (!driver) return;
  try { await driver.deleteSession(); } catch (e) { console.warn('[appium] session close failed:', e.message); }
}
