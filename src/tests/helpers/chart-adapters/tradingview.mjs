import { createWindowHookChartAdapter } from './hook-base.mjs';

export function createTradingViewHookAdapter(page, opts = {}) {
  return createWindowHookChartAdapter(page, {
    hookName: opts.hookName || '__tvTest',
    label: 'TradingView',
  });
}
