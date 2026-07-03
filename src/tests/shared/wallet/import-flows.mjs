// Wallet — Import flows shared test logic (Desktop TF)
//
// Covers two real flows:
//   1. Import a fixed mnemonic.
//   2. Export a private key from the current account, keep it in memory only,
//      then import that private key through the onboarding private-key path.

import { sleep } from '../../helpers/constants.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

export const DEFAULT_IMPORT_MNEMONIC =
  process.env.DESKTOP_IMPORT_MNEMONIC ||
  process.env.PHRASE ||
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

const WALLET_HOME_SELECTOR = '[data-testid="AccountSelectorTriggerBase"]';
const ADD_WALLET_SELECTOR = '[data-testid="add-wallet"]';
const IMPORT_WALLET_BUTTON = '[data-testid="onboarding-import-wallet-button"]';
const PHRASE_OR_PRIVATE_KEY_BUTTON =
  '[data-testid="onboarding-create-or-import-wallet-option-phraseOrPrivateKey-btn"]';
const IMPORT_PAGE_SELECTOR = '[data-testid="onboarding-import-phrase-page"]';
const IMPORT_CONFIRM_SELECTOR =
  '[data-testid="onboarding-import-phrase-confirm-btn"]';
const PRIVATE_KEY_NETWORK_PAGE_SELECTOR =
  '[data-testid="onboarding-select-private-key-network-page"]';
const PRIVATE_KEY_NETWORK_CONFIRM_SELECTOR =
  '[data-testid="onboarding-select-private-key-network-submit-btn"]';
const EXPORTED_KEY_INPUT = '[data-testid="account-key-input"]';
const EXPORTED_KEY_SHOW_BUTTON = '[data-testid="account-key-show-btn"]';
const EXPORTED_KEY_COPY_BUTTON = '[data-testid="account-key-copy-btn"]';

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function redactSecret(value) {
  if (!value) return '<empty>';
  return `<redacted:${String(value).length}>`;
}

function mnemonicWords(mnemonic) {
  return normalizeText(mnemonic).split(/\s+/).filter(Boolean);
}

async function visibleText(page, limit = 360) {
  return page.evaluate((limitValue) => {
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    return Array.from(document.querySelectorAll('button, [role="button"], input, textarea, span, div'))
      .filter(isVisible)
      .map((el) => el.innerText || el.textContent || el.getAttribute('placeholder') || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, limitValue);
  }, limit);
}

async function isVisible(page, selector, timeout = 700) {
  return page.locator(selector).first().isVisible({ timeout }).catch(() => false);
}

async function clickVisibleTestIdByMouse(page, testid, delay = 800) {
  const target = await page.evaluate((id) => {
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    const el = Array.from(document.querySelectorAll(`[data-testid="${id}"]`)).find(isVisible);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, testid);
  if (!target) throw new Error(`visible testid not found: ${testid}`);
  await page.mouse.click(Math.round(target.x), Math.round(target.y));
  await sleep(delay);
}

async function clickSelector(page, selector, delay = 800) {
  const locator = page.locator(selector).first();
  await locator.waitFor({ state: 'visible', timeout: 8000 });
  await locator.click({ timeout: 5000 }).catch(async (error) => {
    if (!/intercepts pointer events|Timeout|not receive pointer events/i.test(error.message || '')) {
      throw error;
    }
    const testid = selector.match(/\[data-testid="([^"]+)"\]/)?.[1];
    if (testid) return clickVisibleTestIdByMouse(page, testid, delay);
    throw error;
  });
  await sleep(delay);
}

async function clickText(page, labels, {
  delay = 800,
  minWidth = 20,
  minHeight = 16,
  maxWidth = 520,
  maxHeight = 160,
} = {}) {
  const target = await page.evaluate(({ labels: rawLabels, minWidth: mw, minHeight: mh, maxWidth: xw, maxHeight: xh }) => {
    const labelsSet = rawLabels.map((label) => String(label));
    const normalize = (value) => String(value || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    const clickableAncestor = (el, label) => {
      let node = el;
      const choices = [];
      for (let i = 0; i < 9 && node; i += 1) {
        const r = node.getBoundingClientRect?.();
        const text = normalize(node.innerText || node.textContent);
        if (r && r.width >= mw && r.height >= mh && r.width <= xw && r.height <= xh && text.includes(label)) {
          choices.push({
            text,
            area: r.width * r.height,
            exact: text === label,
            x: r.x + r.width / 2,
            y: r.y + r.height / 2,
          });
        }
        node = node.parentElement;
      }
      choices.sort((a, b) => Number(b.exact) - Number(a.exact) || a.area - b.area);
      return choices[0] || null;
    };
    for (const label of labelsSet) {
      const el = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
        .filter(isVisible)
        .find((candidate) => normalize(candidate.innerText || candidate.textContent) === label);
      if (!el) continue;
      const target = clickableAncestor(el, label);
      if (target) return { label, ...target };
    }
    return null;
  }, { labels, minWidth, minHeight, maxWidth, maxHeight });
  if (!target) throw new Error(`visible text not found: ${labels.join(' / ')}`);
  await page.mouse.click(Math.round(target.x), Math.round(target.y));
  await sleep(delay);
  return target.label;
}

async function waitForAny(page, predicates, timeout = 20000) {
  const start = Date.now();
  let lastState = null;
  while (Date.now() - start < timeout) {
    lastState = await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0 &&
          r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      };
      const text = Array.from(document.querySelectorAll('button, [role="button"], input, textarea, span, div'))
        .filter(isVisible)
        .map((el) => el.innerText || el.textContent || el.getAttribute('placeholder') || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return {
        text: text.slice(0, 800),
        walletHome: isVisible(document.querySelector('[data-testid="AccountSelectorTriggerBase"]')),
        importPage: isVisible(document.querySelector('[data-testid="onboarding-import-phrase-page"]')),
        privateKeyNetworkPage: isVisible(document.querySelector('[data-testid="onboarding-select-private-key-network-page"]')),
        finalizePage: isVisible(document.querySelector('[data-testid="onboarding-finalize-setup-page"]')) ||
          /钱包已准备就绪|Your wallet is ready|进入钱包|Enter Wallet/i.test(text),
        passwordPrompt: isVisible(document.querySelector('[data-testid="password-input"]')) ||
          /欢迎回来|忘记密码|Password|密码/.test(text),
      };
    });
    for (const [name, predicate] of Object.entries(predicates)) {
      if (predicate(lastState)) return { name, state: lastState };
    }
    await sleep(500);
  }
  throw new Error(`timed out waiting for state; last=${JSON.stringify(lastState)}`);
}

async function leaveOnboardingIfNeeded(page) {
  for (let i = 0; i < 6; i += 1) {
    const state = await page.evaluate(() => {
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      return {
        hasOnboarding: visible(document.querySelector('[data-testid="APP-OnBoarding-Screen"]')),
        hasHome: visible(document.querySelector('[data-testid="AccountSelectorTriggerBase"]')),
      };
    }).catch(() => ({ hasOnboarding: false, hasHome: false }));
    if (!state.hasOnboarding) break;
    const clickedBack = await page.evaluate(() => {
      const visible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const buttons = Array.from(document.querySelectorAll('[data-testid="onboarding-layout-header-back-btn"], button'))
        .filter(visible);
      const back = buttons.find((el) => /返回|Back/i.test(el.innerText || el.textContent || '')) || buttons[0];
      if (!back) return false;
      back.click();
      return true;
    }).catch(() => false);
    if (!clickedBack) await page.keyboard.press('Escape').catch(() => {});
    await sleep(800);
  }
}

async function ensureWalletHome(page, goToWallet) {
  await leaveOnboardingIfNeeded(page);
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(200);
  await goToWallet(page);
  await waitForAny(page, {
    walletHome: (state) => state.walletHome,
  }, 12000);
}

async function openAddWalletPage(page, goToWallet) {
  await ensureWalletHome(page, goToWallet);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await isVisible(page, ADD_WALLET_SELECTOR, 700)) break;
    const clicked = await page.evaluate(() => {
      const isVisibleEl = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0 &&
          r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      };
      const el = Array.from(document.querySelectorAll('[data-testid="AccountSelectorTriggerBase"]')).find(isVisibleEl);
      if (!el) return false;
      el.click();
      return true;
    }).catch(() => false);
    if (!clicked) {
      await clickVisibleTestIdByMouse(page, 'AccountSelectorTriggerBase', 700).catch(() => {});
    }
    await sleep(900);
  }
  if (!await isVisible(page, ADD_WALLET_SELECTOR, 3000)) {
    throw new Error(`account selector did not expose add-wallet: ${await visibleText(page, 700)}`);
  }
  let enteredGetStarted = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await clickVisibleTestIdByMouse(page, 'add-wallet', 1200);
    enteredGetStarted = await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const text = Array.from(document.querySelectorAll('button, [role="button"], span, div'))
        .filter(isVisible)
        .map((el) => el.innerText || el.textContent || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      return isVisible(document.querySelector('[data-testid="onboarding-get-started-page"]')) ||
        (/创建新钱包|Create New Wallet/.test(text) &&
          /添加已有钱包|Add Existing Wallet|Import Wallet/.test(text));
    }).catch(() => false);
    if (enteredGetStarted) break;
    await sleep(500);
  }
  if (!enteredGetStarted) {
    throw new Error(`add-wallet click did not enter get-started page: ${await visibleText(page, 700)}`);
  }
}

async function openPhraseOrPrivateKeyImportPage(page, goToWallet) {
  await openAddWalletPage(page, goToWallet);
  if (await isVisible(page, IMPORT_WALLET_BUTTON, 1200)) {
    await clickSelector(page, IMPORT_WALLET_BUTTON, 1200);
  } else {
    await clickText(page, ['添加已有钱包', 'Add Existing Wallet', 'Import Wallet'], {
      delay: 1200,
      minWidth: 100,
      minHeight: 40,
      maxWidth: 320,
      maxHeight: 220,
    });
  }
  await waitForAny(page, {
    addExistingWallet: (state) =>
      /添加已有钱包|Add Existing Wallet|导入助记词或私钥|Import Recovery Phrase/i.test(state.text),
  }, 12000);
  await clickSelector(page, PHRASE_OR_PRIVATE_KEY_BUTTON, 1400);
  await waitForAny(page, {
    importPage: (state) => state.importPage && /助记词|Recovery Phrase|私钥|Private Key/i.test(state.text),
  }, 12000);
}

async function fillMnemonic(page, mnemonic) {
  const words = mnemonicWords(mnemonic);
  if (![12, 18, 24].includes(words.length)) {
    throw new Error(`expected 12/18/24 mnemonic words, got ${words.length}`);
  }
  for (let i = 0; i < words.length; i += 1) {
    const input = page.locator(`[data-testid="phrase-input-index${i}"]`).first();
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.fill(words[i]);
  }
  await sleep(500);
}

async function clickImportConfirmUntilProgress(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="onboarding-import-phrase-confirm-btn"]');
      return btn && btn.getBoundingClientRect().width > 0 &&
        btn.getAttribute('aria-disabled') !== 'true' &&
        !btn.disabled;
    }, null, { timeout: 8000 }).catch(() => {});
    await clickVisibleTestIdByMouse(page, 'onboarding-import-phrase-confirm-btn', 1600);
    const progressed = await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0;
      };
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      return isVisible(document.querySelector('[data-testid="onboarding-finalize-setup-page"]')) ||
        isVisible(document.querySelector('[data-testid="onboarding-select-private-key-network-page"]')) ||
        /创建您的钱包|Create your wallet|输入密码|Enter password|钱包已准备就绪|进入钱包|该钱包已存在|already exists/i.test(text);
    }).catch(() => false);
    if (progressed) return;
  }
  throw new Error(`import confirm did not progress: ${await visibleText(page, 700)}`);
}

async function clickEnterWalletUntilHome(page) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await clickText(page, ['进入钱包', '进入钱包 →', 'Enter Wallet'], {
      delay: 1600,
      minWidth: 40,
      minHeight: 20,
      maxWidth: 360,
      maxHeight: 120,
    }).catch(async () => {
      await page.evaluate(() => {
        const isVisible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0 &&
            r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
        };
        const btn = Array.from(document.querySelectorAll('button, [role="button"]'))
          .filter(isVisible)
          .find((el) => /进入钱包|Enter Wallet/i.test(el.innerText || el.textContent || ''));
        btn?.click();
      }).catch(() => {});
      await sleep(1200);
    });
    const done = await page.evaluate(() => {
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        return !!r && r.width > 0 && r.height > 0 &&
          r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
      };
      const text = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      return isVisible(document.querySelector('[data-testid="AccountSelectorTriggerBase"]')) &&
        !/您的钱包已准备就绪|钱包已准备就绪|Your wallet is ready|进入钱包|Enter Wallet/i.test(text);
    }).catch(() => false);
    if (done) return;
  }
}

async function switchToPrivateKeyTab(page) {
  await page.waitForFunction(() => {
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    return Array.from(document.querySelectorAll('span, div, button, [role="button"]'))
      .some((el) => isVisible(el) && /^(私钥|Private Key)$/.test((el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim()));
  }, null, { timeout: 8000 });
  const target = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    const el = Array.from(document.querySelectorAll('span, div, button, [role="button"]'))
      .find((node) => isVisible(node) && /^(私钥|Private Key)$/.test((node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim()));
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  if (!target) throw new Error(`private key tab not found: ${await visibleText(page, 700)}`);
  await page.mouse.click(Math.round(target.x), Math.round(target.y));
  await sleep(1000);
  const hasPrivateKeyInput = await page.locator('textarea[placeholder*="私钥"], textarea[placeholder*="Private"]').first()
    .isVisible({ timeout: 5000 })
    .catch(() => false);
  if (!hasPrivateKeyInput) {
    throw new Error(`private key textarea not visible: ${await visibleText(page)}`);
  }
}

async function completeImportAfterConfirm(page, password) {
  const reached = await waitForAny(page, {
    walletHome: (state) => state.walletHome && !state.importPage,
    privateKeyNetworkPage: (state) => state.privateKeyNetworkPage,
    duplicate: (state) => /该钱包已存在|钱包已存在|already exists|Existing wallet/i.test(state.text),
    passwordPrompt: (state) => state.passwordPrompt,
    finalizePage: (state) => state.finalizePage,
  }, 30000);

  if (reached.name === 'duplicate') {
    return 'existing wallet detected';
  }

  if (reached.name === 'passwordPrompt') {
    await page.locator('[data-testid="password-input"]').first().waitFor({ state: 'visible', timeout: 8000 }).catch(() => {});
    await page.locator('[data-testid="password-input"]').first().fill(password).catch(async () => {
      await page.keyboard.type(password);
    });
    if (await isVisible(page, '[data-testid="verifying-password"]', 1500)) {
      await clickVisibleTestIdByMouse(page, 'verifying-password', 2200);
    } else {
      await page.keyboard.press('Enter').catch(() => {});
      await sleep(2200);
    }
    await sleep(2000);
  }

  if (reached.name === 'privateKeyNetworkPage') {
    if (await isVisible(page, PRIVATE_KEY_NETWORK_CONFIRM_SELECTOR, 5000)) {
      await clickSelector(page, PRIVATE_KEY_NETWORK_CONFIRM_SELECTOR, 1500);
    } else {
      await clickText(page, ['确认', 'Confirm'], { delay: 1500, maxWidth: 520, maxHeight: 100 });
    }
  }

  if (reached.name === 'finalizePage' || await visibleText(page, 600).then((text) => /进入钱包|Enter Wallet/.test(text))) {
    await clickEnterWalletUntilHome(page);
  }

  await waitForAny(page, {
    walletHome: (state) => state.walletHome && !state.importPage && !state.privateKeyNetworkPage,
    duplicate: (state) => /该钱包已存在|钱包已存在|already exists|Existing wallet/i.test(state.text),
  }, 30000);
  return 'wallet home reachable';
}

async function importFixedMnemonic(page, { goToWallet, password, mnemonic }) {
  await openPhraseOrPrivateKeyImportPage(page, goToWallet);
  await fillMnemonic(page, mnemonic);
  await clickImportConfirmUntilProgress(page);
  return completeImportAfterConfirm(page, password);
}

async function findCurrentAccountEditTestId(page) {
  await clickSelector(page, WALLET_HOME_SELECTOR, 1000);
  const target = await page.evaluate(() => {
    const visible = (el) => {
      const r = el?.getBoundingClientRect?.();
      return !!r && r.width > 0 && r.height > 0 &&
        r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    };
    const btn = Array.from(document.querySelectorAll('[data-testid^="account-item-edit-button-"]')).find(visible);
    return btn?.getAttribute('data-testid') || null;
  });
  if (!target) throw new Error(`account edit button not found: ${await visibleText(page)}`);
  return target;
}

async function clickAccountEditButton(page, testid) {
  const locator = page.locator(`[data-testid="${testid}"]`).first();
  await locator.hover({ timeout: 4000 }).catch(() => {});
  await locator.click({ timeout: 5000 }).catch(async () => clickVisibleTestIdByMouse(page, testid, 300));
  const exportTestId = testid.replace(/^account-item-edit-button-/, 'popover-export-private-key-');
  await page.locator(`[data-testid="${exportTestId}"]`).first().waitFor({ state: 'visible', timeout: 8000 }).catch(async () => {
    const sample = await visibleText(page, 700);
    throw new Error(`export private key menu not visible for ${testid}: ${sample}`);
  });
  return exportTestId;
}

async function openExportPrivateKeyPage(page, goToWallet) {
  await ensureWalletHome(page, goToWallet);
  const editTestId = await findCurrentAccountEditTestId(page);
  const exportTestId = await clickAccountEditButton(page, editTestId);
  await clickSelector(page, `[data-testid="${exportTestId}"]`, 1800);
  await page.locator(EXPORTED_KEY_INPUT).first().waitFor({ state: 'visible', timeout: 15000 });
  return { editTestId, exportTestId };
}

async function submitVisiblePasswordPrompt(page, password) {
  if (!await isVisible(page, '[data-testid="password-input"]', 1200)) return false;
  await page.locator('[data-testid="password-input"]').first().fill(password);
  if (await isVisible(page, '[data-testid="verifying-password"]', 1000)) {
    await clickVisibleTestIdByMouse(page, 'verifying-password', 2200);
  } else {
    await page.keyboard.press('Enter').catch(() => {});
    await sleep(2200);
  }
  return true;
}

async function readExportedPrivateKey(page, password) {
  await clickSelector(page, EXPORTED_KEY_SHOW_BUTTON, 2200);
  await submitVisiblePasswordPrompt(page, password);
  await sleep(1500);
  const value = await page.locator(EXPORTED_KEY_INPUT).first().inputValue({ timeout: 8000 }).catch(() => '');
  if (!value || /^•+$/.test(value)) {
    throw new Error('private key export did not reveal key content');
  }
  return value;
}

async function copyExportedPrivateKey(page) {
  if (await isVisible(page, EXPORTED_KEY_COPY_BUTTON, 2000)) {
    await clickSelector(page, EXPORTED_KEY_COPY_BUTTON, 800);
    const hasConfirm = await page.evaluate(() => /复制私钥|copy private key|风险|risk/i.test(document.body.innerText || ''))
      .catch(() => false);
    if (hasConfirm) {
      await page.evaluate(() => {
        const visible = (el) => {
          const r = el?.getBoundingClientRect?.();
          return !!r && r.width > 0 && r.height > 0;
        };
        const box = Array.from(document.querySelectorAll('input[type="checkbox"], [role="checkbox"]')).find(visible);
        box?.click();
      }).catch(() => {});
      await clickText(page, ['复制', 'Copy', '确认', 'Confirm'], { delay: 900, maxWidth: 360, maxHeight: 120 }).catch(() => {});
    }
  }
}

async function importPrivateKey(page, { goToWallet, password, privateKey }) {
  await openPhraseOrPrivateKeyImportPage(page, goToWallet);
  await switchToPrivateKeyTab(page);
  const input = page.locator('textarea[placeholder*="私钥"], textarea[placeholder*="Private"]').first();
  await input.fill(privateKey);
  await sleep(800);
  await clickImportConfirmUntilProgress(page);
  return completeImportAfterConfirm(page, password);
}

async function exportThenImportPrivateKey(page, { goToWallet, password }) {
  const opened = await openExportPrivateKeyPage(page, goToWallet);
  const privateKey = await readExportedPrivateKey(page, password);
  await copyExportedPrivateKey(page).catch(() => {});
  await clickText(page, ['完成', 'Done'], { delay: 1000, maxWidth: 240, maxHeight: 100 }).catch(async () => {
    await page.keyboard.press('Escape').catch(() => {});
  });
  await ensureWalletHome(page, goToWallet);
  const importResult = await importPrivateKey(page, { goToWallet, password, privateKey });
  return `${opened.exportTestId}; key=${redactSecret(privateKey)}; ${importResult}`;
}

export function createWalletImportTests({
  prefix,
  namePrefix = '',
  password,
  goToWallet,
  screenshotDir,
  mnemonic = DEFAULT_IMPORT_MNEMONIC,
}) {
  if (!prefix) throw new Error('createWalletImportTests: prefix is required');
  if (!goToWallet) throw new Error('createWalletImportTests: goToWallet is required');
  if (!password) throw new Error('createWalletImportTests: password is required');

  const words = mnemonicWords(mnemonic);
  if (words.length !== 12) {
    throw new Error(`DEFAULT_IMPORT_MNEMONIC must contain 12 words for nightly smoke, got ${words.length}`);
  }

  const _ss = (page, t, name, fn) => safeStep(page, t, name, fn, screenshotDir);

  async function testImportMnemonic(page) {
    const t = createStepTracker(`${prefix}-001`);
    await _ss(page, t, '固定助记词导入钱包', async () => {
      const result = await importFixedMnemonic(page, { goToWallet, password, mnemonic });
      return `${words.length} words; ${result}`;
    });
    return t.result();
  }

  async function testExportThenImportPrivateKey(page) {
    const t = createStepTracker(`${prefix}-002`);
    await safeStep(page, t, '导出私钥后导入私钥账户', async () => {
      const result = await exportThenImportPrivateKey(page, { goToWallet, password });
      return result;
    });
    return t.result();
  }

  const testCases = [
    {
      id: `${prefix}-001`,
      name: `${namePrefix}钱包-固定助记词导入`,
      fn: testImportMnemonic,
    },
    {
      id: `${prefix}-002`,
      name: `${namePrefix}钱包-导出私钥后导入私钥`,
      fn: testExportThenImportPrivateKey,
    },
  ];

  async function setup() {
    return undefined;
  }

  return { testCases, setup };
}
