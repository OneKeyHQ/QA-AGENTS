// Generic page hook adapter for chart parity.
// Expected window hook contract:
//   window.__chartTest / window.__tvTest = {
//     ready?: boolean | () => boolean | Promise<boolean>,
//     getMeta?: () => object | Promise<object>,
//     setResolution?: (resolution) => any,
//     getBars?: ({ resolution, limit, closedOnly }) => Array<bar>,
//     getIndicatorSeries?: (name, opts) => object | Array,
//     moveCrosshairToIndex?: (index) => any,
//     getCrosshairSnapshot?: () => object,
//   }

import { sleep } from '../constants.mjs';

async function callHook(page, hookName, method, args = []) {
  return page.evaluate(async ({ hookName: name, method: fnName, args: fnArgs }) => {
    const hook = window[name];
    if (!hook) throw new Error(`window.${name} not found`);
    const fn = hook[fnName];
    if (typeof fn !== 'function') throw new Error(`window.${name}.${fnName} is not a function`);
    return await fn(...fnArgs);
  }, { hookName, method, args });
}

async function readHookMeta(page, hookName) {
  return page.evaluate(async (name) => {
    const hook = window[name];
    if (!hook) return null;
    let ready = true;
    if (typeof hook.ready === 'function') ready = await hook.ready();
    else if (typeof hook.ready === 'boolean') ready = hook.ready;
    const meta = typeof hook.getMeta === 'function' ? await hook.getMeta() : {};
    return { ready, meta };
  }, hookName);
}

export function createWindowHookChartAdapter(page, {
  hookName,
  label,
}) {
  return {
    label,
    hookName,

    async hasHook() {
      return page.evaluate((name) => !!window[name], hookName).catch(() => false);
    },

    async waitForReady(timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const state = await readHookMeta(page, hookName).catch(() => null);
        if (state?.ready) return state.meta || {};
        await sleep(250);
      }
      throw new Error(`${label} hook not ready within ${timeoutMs}ms`);
    },

    async getMeta() {
      const state = await readHookMeta(page, hookName);
      return state?.meta || {};
    },

    async setResolution(resolution) {
      return callHook(page, hookName, 'setResolution', [resolution]);
    },

    async getBars({ resolution, limit = 20, closedOnly = true } = {}) {
      return callHook(page, hookName, 'getBars', [{ resolution, limit, closedOnly }]);
    },

    async getIndicatorSeries(name, opts = {}) {
      return callHook(page, hookName, 'getIndicatorSeries', [name, opts]);
    },

    async moveCrosshairToIndex(index) {
      return callHook(page, hookName, 'moveCrosshairToIndex', [index]);
    },

    async getCrosshairSnapshot() {
      return callHook(page, hookName, 'getCrosshairSnapshot', []);
    },
  };
}
