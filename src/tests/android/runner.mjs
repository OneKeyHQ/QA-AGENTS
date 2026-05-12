// YAML test case runner — replays a `pick.mjs`-generated YAML file step by step.
//
// Usage:
//   node src/tests/android/runner.mjs midscene_run/picks/pick-<ts>.yaml
//
// Each step is dispatched to smartTap (UIAutomator selector → coords fallback).
// Stops on first failure. Writes a run report next to the source YAML.

import 'dotenv/config';
import { execFile } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { initDevice } from './helpers/device.mjs';
import { smartTap, smartType, smartSwipe } from './helpers/smart-tap.mjs';
import { assertScreenHas, describeMissing } from './helpers/screen-assert.mjs';

const ADB_PATH = resolve(
  process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`,
  'platform-tools/adb',
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function detectDevice() {
  return new Promise((res, rej) => {
    execFile(ADB_PATH, ['devices'], (err, stdout) => {
      if (err) return rej(err);
      const m = stdout.match(/^([^\s*]+)\s+device$/m);
      if (!m) return rej(new Error('No Android device connected'));
      res(m[1]);
    });
  });
}

async function runStep(step) {
  const start = Date.now();
  const selectors = step.selectors || {};
  const action = step.action || 'tap';

  let result;
  if (action === 'type' && step.text !== undefined) {
    result = await smartType({ ...selectors, coords: step.coords, name: step.name }, step.text);
  } else if (action === 'swipe') {
    result = await smartSwipe({ swipe: step.swipe, name: step.name });
  } else {
    result = await smartTap({ ...selectors, coords: step.coords, name: step.name });
  }
  return { ...result, durationMs: Date.now() - start };
}

async function main() {
  const yamlPath = process.argv[2];
  if (!yamlPath) {
    console.error('Usage: node src/tests/android/runner.mjs <path/to/test.yaml>');
    process.exit(1);
  }

  const spec = yamlParse(readFileSync(yamlPath, 'utf8'));
  if (!spec || !Array.isArray(spec.steps)) {
    console.error('Invalid YAML: missing `steps` array');
    process.exit(1);
  }
  console.log(`\n▶ ${spec.title || basename(yamlPath)}`);
  console.log(`  Steps: ${spec.steps.length}\n`);

  const udid = await detectDevice();
  initDevice(udid);
  console.log(`Device: ${udid}\n`);

  // Preflight — abort BEFORE any tap if the starting screen isn't what the
  // YAML expects. Past failures (Reset dialog near-miss) came from coord taps
  // firing on wrong screens; preflight prevents that class of bug.
  if (spec.preflight?.require) {
    const pf = await assertScreenHas(spec.preflight.require);
    if (!pf.ok) {
      console.error(`✗ Preflight failed: ${spec.preflight.message || 'starting state mismatch'}`);
      console.error(`  Missing: ${describeMissing(pf.missing)}`);
      console.error(`  Aborting before any taps. Navigate to the expected screen and re-run.`);
      process.exit(2);
    }
    console.log(`✓ Preflight OK\n`);
  }

  const results = [];
  let passed = 0;
  let failed = 0;

  for (let i = 0; i < spec.steps.length; i++) {
    const step = spec.steps[i];
    const label = `[${String(i + 1).padStart(2)}/${spec.steps.length}] ${step.name || 'unnamed'}`;
    process.stdout.write(label.padEnd(60));

    // assert_before — refuse to execute coord taps in wrong state
    if (step.assert_before?.require) {
      const ab = await assertScreenHas(step.assert_before.require);
      if (!ab.ok) {
        console.log(`✗ assert_before failed: missing ${describeMissing(ab.missing)}`);
        failed++;
        results.push({ idx: i + 1, name: step.name, status: 'fail', error: `assert_before: ${describeMissing(ab.missing)}` });
        break;
      }
    }

    let attempts = 0;
    const maxRetry = step.assert_after?.retry ?? 0;
    let r;
    let lastError;

    while (attempts <= maxRetry) {
      try {
        r = await runStep(step);
        lastError = null;
      } catch (e) {
        lastError = e;
      }

      // assert_after — verify the step actually produced the expected outcome.
      // If not, retry (up to retry count).
      if (!lastError && step.assert_after?.require) {
        await sleep(400); // brief settle before assertion
        const aa = await assertScreenHas(step.assert_after.require);
        if (aa.ok) break;
        if (attempts < maxRetry) {
          process.stdout.write(`↻ `);
          await sleep(600);
          attempts++;
          continue;
        }
        lastError = new Error(`assert_after failed: missing ${describeMissing(aa.missing)}`);
      }
      break;
    }

    if (lastError) {
      console.log(`✗ ${lastError.message}`);
      failed++;
      results.push({ idx: i + 1, name: step.name, status: 'fail', error: lastError.message });
      break;
    }
    console.log(`✓ ${r.method} • ${r.durationMs}ms${attempts ? ` (retry ×${attempts})` : ''}`);
    passed++;
    results.push({ idx: i + 1, name: step.name, status: 'pass', ...r, retries: attempts });

    if (step.wait_after) await sleep(step.wait_after);
  }

  const summary = {
    yaml: yamlPath,
    title: spec.title,
    runAt: new Date().toISOString(),
    device: udid,
    total: spec.steps.length,
    passed,
    failed,
    skipped: spec.steps.length - passed - failed,
    results,
  };

  const reportPath = resolve(
    dirname(yamlPath),
    basename(yamlPath, '.yaml') + `-run-${Date.now()}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(summary, null, 2));

  console.log(`\n═══ ${passed}/${spec.steps.length} passed${failed ? `, ${failed} failed` : ''} ═══`);
  console.log(`📄 ${reportPath}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('\nRunner crashed:', e.message);
  process.exit(1);
});
