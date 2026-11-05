import assert from 'node:assert/strict';

// TradingGuardWrapper replaces its children when agent readiness is lost.
// Missing/disabled confirmation without that exact guard remains a failure.
export function inspectReverseConfirmation(state) {
  assert.ok(Number.isInteger(state.guardCount) && state.guardCount >= 0);
  assert.ok(Number.isInteger(state.confirmationCount) && state.confirmationCount >= 0);
  if (state.guardCount === 1 && state.confirmationCount === 0) {
    return { ready: false, reason: `反手弹窗交易门禁：${state.guardText?.trim() || '账户加载或权限状态未就绪'}；确认按钮尚未渲染，不自动授权` };
  }
  assert.equal(state.guardCount, 0, 'Unexpected concurrent reverse permission guard');
  assert.equal(state.confirmationCount, 1, 'Exactly one reverse confirmation required');
  assert.equal(state.enabled, true, 'Reverse confirmation disabled');
  assert.notEqual(state.ariaDisabled, 'true', 'Reverse confirmation aria-disabled');
  return { ready: true };
}
