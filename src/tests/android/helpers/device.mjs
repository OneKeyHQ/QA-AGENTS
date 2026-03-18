// UIAutomator + AI Vision hybrid module for Android testing
// UIAutomator for fast element location (~1s), AI as fallback (~5s)
//
// Uses raw adb shell (execFile) to avoid Midscene screenshot overhead.
// agent.runAdbShell() triggers screenshots on every call (~3-5s overhead).

import { execFile } from 'node:child_process';
import { resolve } from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Fast ADB Shell ───────────────────────────────────────────

const ADB_PATH = resolve(
  process.env.ANDROID_HOME || `${process.env.HOME}/Library/Android/sdk`,
  'platform-tools/adb',
);

let _deviceId = null;

/**
 * Initialize with device ID. Call once after device.connect().
 */
export function initDevice(udid) {
  _deviceId = udid;
}

/**
 * Fast adb shell — bypasses Midscene agent overhead.
 * ~200-500ms vs ~3-6s through agent.runAdbShell().
 */
export function adbShell(command) {
  return new Promise((res, rej) => {
    const args = _deviceId
      ? ['-s', _deviceId, 'shell', command]
      : ['shell', command];
    execFile(ADB_PATH, args, { maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) rej(new Error(`adb shell failed: ${stderr || err.message}`));
      else res(stdout);
    });
  });
}

// ── UI Dump Cache ────────────────────────────────────────────

let _cachedElements = null;
let _cacheTime = 0;
const CACHE_TTL = 2000; // 2s

export function invalidateCache() {
  _cachedElements = null;
  _cacheTime = 0;
}

/**
 * Dump UI hierarchy via UIAutomator (fast path via raw adb).
 * Returns raw XML string.
 */
export async function dumpUI() {
  const dumpPath = '/data/local/tmp/ui_dump.xml';
  await adbShell(`uiautomator dump ${dumpPath}`);
  const xml = await adbShell(`cat ${dumpPath}`);
  return xml;
}

/**
 * Parse UIAutomator XML dump into element list.
 * Each element: { text, resourceId, contentDesc, className, bounds, center }
 */
export function parseUIElements(xml) {
  const elements = [];
  const nodeRegex = /<node\s+([^>]+)\/?>/g;
  let match;

  while ((match = nodeRegex.exec(xml)) !== null) {
    const attrs = match[1];

    const get = (name) => {
      const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : '';
    };

    const boundsStr = get('bounds');
    const bm = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!bm) continue;

    const bounds = {
      left: +bm[1],
      top: +bm[2],
      right: +bm[3],
      bottom: +bm[4],
    };

    if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) continue;

    const center = {
      x: Math.round((bounds.left + bounds.right) / 2),
      y: Math.round((bounds.top + bounds.bottom) / 2),
    };

    elements.push({
      text: get('text'),
      resourceId: get('resource-id'),
      contentDesc: get('content-desc'),
      className: get('class'),
      bounds,
      center,
      clickable: get('clickable') === 'true',
      enabled: get('enabled') === 'true',
    });
  }

  return elements;
}

/**
 * Get parsed UI elements with 2s TTL cache.
 * No agent needed — uses fast adb shell directly.
 */
export async function getElements() {
  const now = Date.now();
  if (_cachedElements && now - _cacheTime < CACHE_TTL) {
    return _cachedElements;
  }

  const xml = await dumpUI();
  _cachedElements = parseUIElements(xml);
  _cacheTime = Date.now();
  return _cachedElements;
}

// ── Element Finders ──────────────────────────────────────────

/**
 * Find element by visible text.
 * @param {string|RegExp} text - Text to match
 * @param {{ exact?: boolean }} opts
 */
export async function findElementByText(text, opts = {}) {
  const elements = await getElements();
  const { exact = false } = opts;

  return elements.find((el) => {
    if (!el.text) return false;
    if (text instanceof RegExp) return text.test(el.text);
    if (exact) return el.text === text;
    return el.text.includes(text);
  });
}

/**
 * Find element by content-desc attribute.
 */
export async function findElementByContentDesc(desc) {
  const elements = await getElements();
  return elements.find((el) => el.contentDesc && el.contentDesc.includes(desc));
}

/**
 * Find element by resource-id.
 */
export async function findElementByResourceId(id) {
  const elements = await getElements();
  return elements.find((el) => el.resourceId && el.resourceId.includes(id));
}

/**
 * Find all elements matching text.
 */
export async function findAllByText(text) {
  const elements = await getElements();
  return elements.filter((el) => {
    if (!el.text) return false;
    if (text instanceof RegExp) return text.test(el.text);
    return el.text.includes(text);
  });
}

// ── Quick Tap Methods ────────────────────────────────────────

/**
 * Tap element found by text using UIAutomator coordinates.
 * Returns true if successful, false if element not found.
 */
export async function tapByText(device, text, opts = {}) {
  const el = await findElementByText(text, opts);
  if (!el) return false;
  await device.mouseClick(el.center.x, el.center.y);
  invalidateCache();
  return true;
}

/**
 * Tap element found by content-desc.
 */
export async function tapByContentDesc(device, desc) {
  const el = await findElementByContentDesc(desc);
  if (!el) return false;
  await device.mouseClick(el.center.x, el.center.y);
  invalidateCache();
  return true;
}

/**
 * Tap element found by resource-id.
 */
export async function tapByResourceId(device, id) {
  const el = await findElementByResourceId(id);
  if (!el) return false;
  await device.mouseClick(el.center.x, el.center.y);
  invalidateCache();
  return true;
}

// ── Hybrid Methods (Core) ────────────────────────────────────

/**
 * Hybrid tap: UIAutomator first, AI fallback.
 *
 * @param {object} device - AndroidDevice
 * @param {object} agent - AndroidAgent (only used for AI fallback)
 * @param {object} opts
 * @param {string|RegExp} [opts.text] - Text to find via UIAutomator
 * @param {string} [opts.contentDesc] - content-desc to find
 * @param {string} [opts.resourceId] - resource-id to find
 * @param {string} [opts.aiAction] - AI action fallback instruction
 * @returns {{ method: 'uiautomator'|'ai', ... }}
 */
export async function hybridTap(device, agent, opts) {
  const { text, contentDesc, resourceId, aiAction } = opts;

  // Tier 1: UIAutomator
  try {
    if (text) {
      const ok = await tapByText(device, text);
      if (ok) return { method: 'uiautomator', text };
    }
    if (contentDesc) {
      const ok = await tapByContentDesc(device, contentDesc);
      if (ok) return { method: 'uiautomator', contentDesc };
    }
    if (resourceId) {
      const ok = await tapByResourceId(device, resourceId);
      if (ok) return { method: 'uiautomator', resourceId };
    }
  } catch (e) {
    console.log(`    [hybrid] UIAutomator failed: ${e.message}`);
  }

  // Tier 2: AI fallback
  if (aiAction) {
    console.log(`    [hybrid] Falling back to AI: ${aiAction}`);
    await agent.aiAction(aiAction);
    invalidateCache();
    return { method: 'ai', aiAction };
  }

  throw new Error(`hybridTap: element not found (text=${text}, desc=${contentDesc}, id=${resourceId})`);
}

/**
 * Hybrid query: UIAutomator text check first, AI query fallback.
 *
 * @param {object} device - AndroidDevice (unused but kept for API consistency)
 * @param {object} agent - AndroidAgent (only used for AI fallback)
 * @param {object} opts
 * @param {function} [opts.uiCheck] - (elements) => result, returns truthy if check passes
 * @param {string} [opts.aiQuery] - AI query fallback
 * @returns {{ method: 'uiautomator'|'ai', result: any }}
 */
export async function hybridQuery(device, agent, opts) {
  const { uiCheck, aiQuery } = opts;

  // Tier 1: UIAutomator element check
  if (uiCheck) {
    try {
      const elements = await getElements();
      const result = uiCheck(elements);
      if (result) return { method: 'uiautomator', result };
    } catch (e) {
      console.log(`    [hybrid] UIAutomator check failed: ${e.message}`);
    }
  }

  // Tier 2: AI query fallback
  if (aiQuery) {
    console.log(`    [hybrid] Falling back to AI query`);
    const result = await agent.aiQuery(aiQuery);
    return { method: 'ai', result };
  }

  throw new Error('hybridQuery: no check method succeeded');
}

// ── Utility Functions ────────────────────────────────────────

/**
 * Check if text exists on screen (fast UIAutomator check).
 */
export async function hasText(text) {
  const el = await findElementByText(text);
  return !!el;
}

/**
 * Wait for an element matching predicate to appear.
 * Polls every 500ms, up to timeoutMs.
 */
export async function waitForElement(predicate, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    invalidateCache();
    const elements = await getElements();
    const found = elements.find(predicate);
    if (found) return found;
    await sleep(500);
  }
  return null;
}

/**
 * Wait for specific text to appear on screen.
 */
export async function waitForText(text, timeoutMs = 10000) {
  return waitForElement(
    (el) => {
      if (!el.text) return false;
      if (text instanceof RegExp) return text.test(el.text);
      return el.text.includes(text);
    },
    timeoutMs,
  );
}

/**
 * Dump all visible text elements (for debugging).
 */
export async function debugDumpTexts() {
  const elements = await getElements();
  return elements
    .filter((el) => el.text || el.contentDesc)
    .map((el) => ({
      text: el.text || '',
      desc: el.contentDesc || '',
      id: el.resourceId || '',
      bounds: `[${el.bounds.left},${el.bounds.top}][${el.bounds.right},${el.bounds.bottom}]`,
    }));
}

// ── Known UI Text Constants ──────────────────────────────────

export const UI_TEXT = {
  // Bottom tabs
  TAB_WALLET: '錢包',
  TAB_TRADE: '交易',
  TAB_CONTRACT: '合約',
  TAB_DISCOVER: '發現',

  // Contract trading
  ORDER_MARKET: '市價單',
  ORDER_LIMIT: '限價单',
  MODE_ISOLATED: '逐倉',
  MODE_CROSS: '全倉',

  // Token selector
  TAB_CRYPTO: '加密貨幣',
  TAB_STOCKS: '股票',
  TAB_METALS: '贵金属',
  TAB_INDEX: '指數',
  TAB_COMMODITY: '大宗商品',
  TAB_FOREX: '外匯',

  // Common
  CLOSE: '×',
};
