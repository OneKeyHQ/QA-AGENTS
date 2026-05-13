// Mobile step tracker — mirrors src/tests/helpers/components.mjs but operates
// on a WDIO driver instead of a Playwright page. Same SSE log format so the
// Dashboard frontend renders mobile results identically.

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

export function createStepTracker(testId) {
  const steps = [];
  const errors = [];
  return {
    testId, steps, errors,
    add(name, status, detail = '') {
      steps.push({ name, status, detail, time: new Date().toISOString() });
      const icon = status === 'passed' ? 'OK' : status === 'skipped' ? 'SKIP' : 'FAIL';
      console.log(`  [${icon}] ${name}${detail ? ` — ${detail}` : ''}`);
      if (status === 'failed') errors.push(`${name}: ${detail}`);
    },
    skip(name, reason) {
      this.add(name, 'skipped', reason);
    },
    result() {
      const passed = steps.filter(s => s.status === 'passed').length;
      const failed = steps.filter(s => s.status === 'failed').length;
      const skipped = steps.filter(s => s.status === 'skipped').length;
      return {
        status: errors.length === 0 ? 'passed' : 'failed',
        steps, errors,
        summary: { passed, failed, skipped, total: steps.length },
      };
    },
  };
}

/**
 * safeStep — same contract as desktop's, but takes a driver. Failures
 * trigger a screenshot via driver.saveScreenshot().
 */
export async function safeStep(driver, t, name, fn, screenshotDir) {
  try {
    const detail = await fn();
    t.add(name, 'passed', detail || '');
    return true;
  } catch (e) {
    t.add(name, 'failed', e.message || String(e));
    const failName = `${t.testId || 'unknown'}-${name.replace(/\s+/g, '-').slice(0, 40)}-fail`;
    if (screenshotDir) {
      try {
        mkdirSync(screenshotDir, { recursive: true });
        await driver.saveScreenshot(resolve(screenshotDir, `${failName}.png`));
      } catch {}
    }
    return false;
  }
}
