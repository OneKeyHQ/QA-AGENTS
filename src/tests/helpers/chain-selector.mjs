import { sleep } from './constants.mjs';

export const CHAIN_SEARCH_SELECTORS = [
  '[data-testid="nav-header-search-chain-selector-search-bar"]',
  '[data-testid="nav-header-search-chain-selector"]',
  '[data-testid="chain-selector-search-bar"]',
  '[data-testid="chain-selector-list-view-search-bar"]',
  '[data-testid="chain-selector-section-list-search-bar"]',
  '[data-testid="chain-selector-search-bar"] input',
  '[data-testid="chain-selector-list-view-search-bar"] input',
  '[data-testid="chain-selector-section-list-search-bar"] input',
  'input[data-testid*="chain-selector"]',
];

export function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export async function isChainSelectorSearchVisible(page, timeout = 800) {
  return page.locator(CHAIN_SEARCH_SELECTORS.map((selector) => `${selector}:visible`).join(', ')).first()
    .isVisible({ timeout })
    .catch(() => false);
}

export async function fillChainSelectorSearch(page, searchKey, { timeout = 10000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    for (const selector of CHAIN_SEARCH_SELECTORS) {
      const locator = page.locator(`${selector}:visible`).first();
      if (!(await locator.isVisible({ timeout: 300 }).catch(() => false))) continue;
      await locator.click().catch(() => {});
      await sleep(100);
      await locator.fill(searchKey, { timeout: 2000 });
      await sleep(500);
      return { selector, value: await locator.inputValue().catch(() => '') };
    }
    await sleep(300);
  }
  throw new Error(`Chain selector search input not found for "${searchKey}"`);
}

export async function clickChainSelectorResult(page, searchKey, { timeout = 10000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await page.evaluate((key) => {
      const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const modal = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"]')).filter(visible).at(-1) || document;
      const keyLower = key.toLowerCase();

      const asCandidate = (el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          text: normalize(el.innerText || el.textContent),
          rect: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
          area: r.width * r.height,
        };
      };

      const rowSelectors = [
        'div[data-testid^="select-item-"]',
        '[data-testid][tabindex="0"]',
        '[data-testid][role="button"]',
        'button[data-testid]',
        '[data-testid="chain-selector-handle-press-btn"]',
      ];
      const candidates = rowSelectors
        .flatMap((selector) => Array.from(modal.querySelectorAll(selector)))
        .filter(visible)
        .map(asCandidate)
        .filter((row) => row.text && row.area > 200);

      const textCandidates = Array.from(modal.querySelectorAll('span, div, button, [role="button"]'))
        .filter(visible)
        .map((el) => {
          let target = el;
          while (target?.parentElement && target.parentElement !== modal) {
            const testid = target.getAttribute?.('data-testid') || '';
            const role = target.getAttribute?.('role') || '';
            const tag = target.tagName?.toLowerCase();
            const r = target.getBoundingClientRect?.();
            if (
              tag === 'button' ||
              role === 'button' ||
              target.getAttribute?.('tabindex') === '0' ||
              (testid && r && r.width >= 100 && r.height >= 32 && r.height <= 90)
            ) break;
            target = target.parentElement;
          }
          return asCandidate(target || el);
        })
        .filter((row) => row.text && row.area > 200);

      const allRows = [...candidates, ...textCandidates];
      const exact = allRows
        .filter((row) => row.text.toLowerCase() === keyLower)
        .sort((a, b) => a.area - b.area)[0];
      const startsWith = allRows
        .filter((row) => row.text.toLowerCase().startsWith(keyLower))
        .sort((a, b) => a.area - b.area)[0];
      const includes = allRows
        .filter((row) => row.text.toLowerCase().includes(keyLower))
        .sort((a, b) => a.area - b.area)[0];
      const target = exact || startsWith || includes;

      if (!target) {
        return {
          clicked: false,
          visibleText: normalize(modal.innerText || modal.textContent).slice(0, 500),
        };
      }
      target.el.click();
      return {
        clicked: true,
        text: target.text,
        x: Math.round(target.rect.x),
        y: Math.round(target.rect.y),
      };
    }, searchKey);

    if (result.clicked) {
      await sleep(800);
      return result;
    }
    await sleep(500);
  }

  throw new Error(`Network "${searchKey}" not found in chain selector`);
}

export async function searchAndSelectChain(page, searchKey, opts = {}) {
  await fillChainSelectorSearch(page, searchKey, opts);
  return clickChainSelectorResult(page, searchKey, opts);
}
