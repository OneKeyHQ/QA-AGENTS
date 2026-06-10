import test from 'node:test';
import assert from 'node:assert/strict';
import { runIosPreflightChecks, runPreflight } from './preflight-handler.js';

test('iOS preflight blocks when configured UDID is not visible to Xcode tools', () => {
  const result = runIosPreflightChecks({
    env: {
      APPIUM_IOS_UDID: '00008140-001A48E41E04801C',
      APPIUM_IOS_PLATFORMVERSION: '26.4.2',
      APPIUM_IOS_BUNDLEID: 'so.onekey.wallet',
    },
    runCommand: (cmd, args) => {
      if (cmd === 'appium' && args.join(' ') === 'driver list --installed') {
        return '- xcuitest@10.18.2 [installed (npm)]';
      }
      if (cmd === 'xcodebuild') return 'Xcode 26.5';
      if (cmd === 'xcrun' && args[0] === 'simctl') {
        return 'iPhone 17 (8904290D-245C-4326-A8E7-30485CF20ACC) (Shutdown)';
      }
      if (cmd === 'xcrun' && args[0] === 'devicectl') {
        return 'Name     Hostname     Identifier     State     Model';
      }
      return '';
    },
    exists: () => false,
    readText: () => '',
  });

  assert.equal(result.ready, false);
  assert.deepEqual(
    result.checks.find(check => check.name === 'ios_device')?.status,
    'block',
  );
});

test('iOS preflight accepts visible simulator and validates provided app path', () => {
  const result = runIosPreflightChecks({
    env: {
      APPIUM_IOS_UDID: '8904290D-245C-4326-A8E7-30485CF20ACC',
      APPIUM_IOS_PLATFORMVERSION: '26.4',
      APPIUM_IOS_BUNDLEID: 'so.onekey.wallet',
      APPIUM_IOS_APP: '/tmp/OneKeyWallet.app',
    },
    runCommand: (cmd, args) => {
      if (cmd === 'appium' && args.join(' ') === 'driver list --installed') {
        return '- xcuitest@10.18.2 [installed (npm)]';
      }
      if (cmd === 'xcodebuild') return 'Xcode 26.5';
      if (cmd === 'xcrun' && args[0] === 'simctl') {
        return 'iPhone 17 (8904290D-245C-4326-A8E7-30485CF20ACC) (Booted)';
      }
      if (cmd === 'xcrun' && args[0] === 'devicectl') return '';
      return '';
    },
    exists: path => path === '/tmp/OneKeyWallet.app',
    readText: () => '',
  });

  assert.equal(result.ready, true);
  assert.equal(result.target?.kind, 'simulator');
  assert.equal(result.checks.find(check => check.name === 'ios_app_path')?.status, 'ok');
});

test('preflight uses iOS-only checks when mobile target is iOS', async () => {
  const previousPlatform = process.env.MOBILE_TARGET_PLATFORM;
  process.env.MOBILE_TARGET_PLATFORM = 'ios';
  try {
    const result = await runPreflight([], true, {
      iosPreflight: () => ({
        ready: true,
        target: {
          kind: 'simulator',
          udid: '8904290D-245C-4326-A8E7-30485CF20ACC',
          state: 'Booted',
        },
        checks: [{ name: 'ios_device', status: 'ok' }],
        warnings: [],
      }),
    });

    assert.equal(result.ready, true);
    assert.equal(result.ios?.ready, true);
    assert.equal(result.checks.some(check => check.name === 'cdp_connection'), false);
    assert.equal(result.checks.find(check => check.name === 'ios_device')?.status, 'ok');
  } finally {
    if (previousPlatform === undefined) {
      delete process.env.MOBILE_TARGET_PLATFORM;
    } else {
      process.env.MOBILE_TARGET_PLATFORM = previousPlatform;
    }
  }
});
