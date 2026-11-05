import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStep } from '../../../helpers/components.mjs';
import { screenshot } from '../../../helpers/index.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

for (const mode of ['inline', 'helper']) test(`失败截图有超时且保留原失败结果 ${mode}`, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'perps-shot-'));
  const steps = [];
  let captured;
  const page = { screenshot: async options => { captured = options; throw Error('screenshot unavailable'); } };
  try {
    if (mode === 'inline') {
      const result = await safeStep(page, { testId: 'AUDIT', add: (...args) => steps.push(args) }, '高度不一致', async () => { throw Error('44px'); }, dir);
      assert.equal(result, false);
      assert.deepEqual(steps, [['高度不一致', 'failed', '44px']]);
    } else assert.equal(await screenshot(page, dir, 'failed'), join(dir, 'failed.png'));
    assert.equal(captured.timeout, 5000);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
