import { createWindowHookChartAdapter } from './hook-base.mjs';

export function createBuiltInChartAdapter(page, opts = {}) {
  return createWindowHookChartAdapter(page, {
    hookName: opts.hookName || '__chartTest',
    label: 'BuiltInChart',
  });
}
