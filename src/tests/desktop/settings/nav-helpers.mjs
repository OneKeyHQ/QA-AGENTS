// Language-agnostic navigation helpers for Settings tests
// Uses position + testid only, never text matching

import { sleep } from '../../helpers/index.mjs';

/**
 * Open Preferences modal via sidebar grid menu.
 * Works in any language: finds the grid icon by position (last SVG in sidebar),
 * then locates "Preferences" by its icon position in the menu grid (4th in wallet section).
 */
export async function openPreferences(page) {
  // 1. Click the grid/more icon (last SVG in sidebar)
  const gridPos = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Container"]');
    if (!sidebar) return null;
    const svgs = [...sidebar.querySelectorAll('svg[role="img"]')];
    const last = svgs[svgs.length - 1];
    if (!last) return null;
    const r = last.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!gridPos) throw new Error('Grid menu icon not found in sidebar');
  await page.mouse.click(gridPos.x, gridPos.y);
  await sleep(1500);

  // 2. Find and click "Preferences" in the menu panel.
  const PREFS_LABELS = [
    '偏好设置', '偏好設置',         // zh-CN, zh-HK/TW
    'Preferences',                   // en
    '環境設定',                      // ja-JP
    'Preferências',                  // pt, pt-BR
    '환경설정',                      // ko-KR
    'Einstellungen',                 // de
    'Préférences',                   // fr
    'Preferenze',                    // it
    'Preferencias',                  // es
    'Pengaturan',                    // id
    'Налаштування', 'Настройки',     // uk, ru
    'การตั้งค่า',                      // th
    'পছন্দসমূহ',                      // bn
    'Cài đặt',                       // vi
    'प्राथमिकताएं',                     // hi
  ];

  const clicked = await page.evaluate((labels) => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.textContent?.trim();
      if (t && labels.includes(t)) {
        const el = node.parentElement;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click();
          return t;
        }
      }
    }
    return null;
  }, PREFS_LABELS);

  if (!clicked) throw new Error('Preferences menu item not found (tried all known translations)');
  await sleep(1500);
}

/**
 * Click a row in the Preferences modal by index (language-agnostic).
 * Rows use data-testid="select-item-" and are ordered:
 *   0 = Language, 1 = Default Currency, 2 = Theme, 3 = Notifications, 4 = Bluetooth
 */
export async function clickPrefsRow(page, rowIndex) {
  const clicked = await page.evaluate((idx) => {
    const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
    for (const m of modals) {
      const r = m.getBoundingClientRect();
      if (r.width <= 0) continue;
      const items = m.querySelectorAll('[data-testid="select-item-"]');
      if (items.length > idx) {
        items[idx].click();
        return true;
      }
    }
    return false;
  }, rowIndex);

  if (!clicked) throw new Error(`Preferences row index ${rowIndex} not found`);
  await sleep(800);
}
