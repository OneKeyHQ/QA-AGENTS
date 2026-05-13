// Mobile test helpers — thin facade over WebDriverIO + Appium.
// Same contract as src/tests/helpers (page → driver substitution).
//
// Element resolution always goes through lookupTestId so locator changes flow
// from shared/locators/*.json without touching test code.

import { lookupTestId } from '../../shared/lookup-testid.mjs';

const DEFAULT_WAIT = 8000;
const TAP_WAIT = 200;

/**
 * platformOf(driver) — extracts 'android' | 'ios' from a live WDIO session.
 */
export function platformOf(driver) {
  const caps = driver?.capabilities || {};
  const name = (caps.platformName || caps['appium:platformName'] || '').toLowerCase();
  if (name.includes('ios')) return 'ios';
  if (name.includes('android')) return 'android';
  throw new Error(`Cannot determine platform from capabilities: ${JSON.stringify(caps)}`);
}

/**
 * byTestId — primary element resolver. Tries every selector form the platform
 * supports (resource-id, content-desc, accessibility-id) in order.
 *
 * Throws MissingTestIdError if the element is not in shared/locators or the
 * testID index — caller should surface this so the user can either fix the
 * locator file or fall back to recording.
 */
export class MissingTestIdError extends Error {
  constructor(name, suggestions) {
    super(`No locator for "${name}". Suggestions: ${(suggestions || []).map(s => s.name).join(', ') || 'none'}`);
    this.name = 'MissingTestIdError';
    this.elementName = name;
    this.suggestions = suggestions;
  }
}

export async function byTestId(driver, name) {
  const platform = platformOf(driver);
  const r = lookupTestId(name, platform);
  if (!r.found) throw new MissingTestIdError(name, r.suggestions);

  const sel = r.selector;
  if (platform === 'android') {
    // Try each selector form, return the first match
    const attempts = [
      `//*[@resource-id="${sel.resourceId}"]`,
      `//*[substring(@resource-id, string-length(@resource-id) - string-length("${sel.resourceIdEndsWith}") + 1) = "${sel.resourceIdEndsWith}"]`,
      `~${sel.contentDesc}`,
    ];
    for (const xpath of attempts) {
      const el = await driver.$(xpath);
      if (await el.isExisting()) return el;
    }
    throw new Error(`Element "${name}" found in locator map but not on screen. testID=${r.source_testid}`);
  }
  if (platform === 'ios') {
    return await driver.$(`~${sel.accessibilityId}`);
  }
  throw new Error(`Unsupported platform for byTestId: ${platform}`);
}

/**
 * tap — wait + click. Mirrors desktop's page.locator().click() ergonomics.
 */
export async function tap(driver, nameOrElement) {
  const el = typeof nameOrElement === 'string' ? await byTestId(driver, nameOrElement) : await nameOrElement;
  await el.waitForDisplayed({ timeout: DEFAULT_WAIT });
  await driver.pause(TAP_WAIT);
  await el.click();
}

/**
 * setValue — focused input. RN inputs accept text via setValue.
 */
export async function setValue(driver, nameOrElement, value) {
  const el = typeof nameOrElement === 'string' ? await byTestId(driver, nameOrElement) : await nameOrElement;
  await el.waitForDisplayed({ timeout: DEFAULT_WAIT });
  await el.click();
  await el.setValue(value);
}

export async function waitFor(driver, name, opts = {}) {
  const el = await byTestId(driver, name);
  await el.waitForDisplayed({ timeout: opts.timeout || DEFAULT_WAIT });
  return el;
}

/**
 * byText — find an element by its visible label / accessibility text.
 * Use for elements that don't carry a testID, e.g. localized bottom-nav tabs.
 * Order: content-desc → text → hint (Android); accessibility-id → label (iOS).
 */
export async function byText(driver, text) {
  const platform = platformOf(driver);
  if (platform === 'android') {
    const attempts = [
      `//*[@content-desc="${text}"]`,
      `//*[@text="${text}"]`,
      `//*[@hint="${text}"]`,
    ];
    for (const xpath of attempts) {
      const el = await driver.$(xpath);
      if (await el.isExisting()) return el;
    }
    throw new Error(`byText: no element with content-desc/text/hint = "${text}"`);
  }
  if (platform === 'ios') {
    const el = await driver.$(`~${text}`);
    if (await el.isExisting()) return el;
    throw new Error(`byText: no element with accessibility-id = "${text}"`);
  }
  throw new Error(`byText not supported on platform: ${platform}`);
}

export async function isTextVisible(driver, text) {
  try {
    const el = await byText(driver, text);
    return await el.isDisplayed();
  } catch {
    return false;
  }
}

export async function isDisplayed(driver, name) {
  try {
    const el = await byTestId(driver, name);
    return await el.isDisplayed();
  } catch (e) {
    if (e instanceof MissingTestIdError) throw e;
    // Surface the underlying cause instead of silently returning false — past
    // bug: a platformOf() failure caused every step to report "not displayed"
    // when the real problem was driver.capabilities being undefined.
    if (/Cannot determine platform/.test(e.message)) throw e;
    return false;
  }
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
