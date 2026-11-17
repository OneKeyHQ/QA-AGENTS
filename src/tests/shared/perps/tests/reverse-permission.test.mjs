import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectReverseConfirmation } from '../reverse-permission.mjs';

const ready = { confirmationCount: 1, guardCount: 0, enabled: true, ariaDisabled: 'false' };
test('反手确认的启用交易门禁是前置阻塞，不能误报为失效选择器或通过', () => {
  assert.deepEqual(inspectReverseConfirmation(ready), { ready: true });
  assert.deepEqual(inspectReverseConfirmation({ confirmationCount: 0, guardCount: 1, guardText: '启用交易' }), {
    ready: false, reason: '反手弹窗交易门禁：启用交易；确认按钮尚未渲染，不自动授权',
  });
  assert.equal(inspectReverseConfirmation({ confirmationCount: 0, guardCount: 1, guardText: '' }).ready, false);
});
test('缺按钮、冲突门禁和真正禁用的确认不得伪装成缺前置', () => {
  for (const patch of [
    { confirmationCount: 0 }, { confirmationCount: 2 }, { guardCount: 1 },
    { enabled: false }, { ariaDisabled: 'true' },
  ]) assert.throws(() => inspectReverseConfirmation({ ...ready, ...patch }));
});
