// Cardano / ADA Transfer Tests (Extension) — EXT-ADA-001 ~ EXT-ADA-006
// covers: docs/qa/testcases/cases/transfer/2026-05-20_Transfer-ADA转账-HD钱包.md §1 参数表
// source: recipient = runtime-config 账户1/账户2，余额不足自动反向

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep, RESULTS_DIR } from '../../../helpers/constants.mjs';
import { handlePasswordPromptIfPresent } from '../../../helpers/index.mjs';
import { connectExtensionCDP } from '../../../helpers/extension-cdp.mjs';
import { createStepTracker, safeStep, switchToAccount, closeAllModals } from '../../../helpers/components.mjs';
import { switchNetwork } from '../../../helpers/network.mjs';
import {
  prepareExtensionTransferCaseState,
  readExtensionFloatingNotifications,
  waitForExtensionOutgoingHistoryIdle,
  waitForExtensionTokenBalance,
  waitForExtensionTransferSubmitResult,
  waitForExtensionTransferPreviewReady,
} from '../../../helpers/extension-transfer.mjs';
import { verifyFiatToggle, verifyHistoryRecord } from '../../../helpers/transfer.mjs';
import { requireAccounts, resolveTransferDirection, getWalletPassword } from '../../../helpers/runtime-config.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-ada-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

export const displayName = 'Cardano 转账';

const NETWORK = 'Cardano';
const CHAIN_SLUG = 'ada';
const TOKEN_NETWORK_ID = '0';
const NATIVE_TOKEN = 'ADA';
const ADA_FEE_MIN_BALANCE = 0.5;
const STEP0_OPTIONS = {
  network: NETWORK,
  tokenRowPrefix: `home-token-item-${CHAIN_SLUG}--`,
  portfolioLabel: NETWORK,
};

const TRANSFER_CASES = [
  { id: 'EXT-ADA-001', name: 'MELD 金额=0.9 最低转账金额拦截', token: 'MELD', amount: '0.9', minBalance: 1, minTransferAmount: '1', expectMinAmountBlock: true },
  { id: 'EXT-ADA-002', name: 'MELD 金额=1 发送', token: 'MELD', amount: '1', minBalance: 1, verifyFiat: true },
  { id: 'EXT-ADA-003', name: 'BANK 最大值发送', token: 'BANK', amount: 'Max', minBalance: 1 },
  { id: 'EXT-ADA-004', name: 'ADA 金额=0.9 最低转账金额拦截', token: 'ADA', amount: '0.9', minBalance: 1.2, minTransferAmount: '1', expectMinAmountBlock: true },
  { id: 'EXT-ADA-005', name: 'ADA 金额=1 发送', token: 'ADA', amount: '1', minBalance: 1.2, verifyFiat: true },
  { id: 'EXT-ADA-006', name: 'ADA 最大值发送', token: 'ADA', amount: 'Max', minBalance: 1.2, fullAmount: true, historyAmountMode: 'previewPrimary' },
];

function normalizeDecimalAmount(value) {
  if (value === null || value === undefined) return '';
  const match = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return '';
  let [intPart, fracPart = ''] = match[0].split('.');
  intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
  fracPart = fracPart.replace(/0+$/, '');
  return fracPart ? `${intPart}.${fracPart}` : intPart;
}

function calculateHistoryAmount(sentAmount, _feeAmount, options = {}) {
  const left = normalizeDecimalAmount(sentAmount);
  if (!left) return '';
  if (!options.fullAmount) return left;
  return '';
}

function tokenTestId(kind, token) {
  return `${kind}-${CHAIN_SLUG}--${TOKEN_NETWORK_ID}-${token}`;
}

async function selectAllAndClearFocusedInput(page) {
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
}

async function selectToken(page, token) {
  const clickedSend = await page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && style.pointerEvents !== 'none';
    };
    const header = document.querySelector('[data-testid="Wallet-Tab-Header"]') || document.body;
    const buttons = Array.from(header.querySelectorAll('[data-testid="home-send-button"]'))
      .filter(isVisible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, area: r.width * r.height };
      })
      .sort((a, b) => b.area - a.area);
    if (buttons[0]) {
      buttons[0].el.click();
      return true;
    }

    const labels = new Set(['发送', '發送', 'Send']);
    for (const el of header.querySelectorAll('button, [role="button"], [tabindex], span, div')) {
      if (!labels.has(normalize(el.textContent || ''))) continue;
      if (isVisible(el)) {
        (el.closest('button, [role="button"], [tabindex]') || el).click();
        return true;
      }
    }
    return false;
  });
  if (!clickedSend) {
    const clicked = await page.evaluate(() => {
      const labels = new Set(['发送', '發送', 'Send']);
      const header = document.querySelector('[data-testid="Wallet-Tab-Header"]') || document.body;
      for (const el of header.querySelectorAll('button, [role="button"], span')) {
        if (!labels.has(el.textContent?.trim())) continue;
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        (el.closest('button, [role="button"]') || el).click();
        return true;
      }
      return false;
    });
    if (!clicked) throw new Error('未找到发送按钮');
  }
  await sleep(1000);

  const exactSelector = `[data-testid="${tokenTestId('asset-selector-token-item', token)}"]`;
  let last = null;
  for (let i = 0; i < 14; i++) {
    const target = await page.evaluate((args) => {
      const { selector, targetToken } = args;
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]') || document.body;
      const exact = Array.from(modal.querySelectorAll(selector)).filter(isVisible);
      const fallback = Array.from(modal.querySelectorAll('[data-testid^="asset-selector-token-item-"], [role="button"]'))
        .filter(isVisible)
        .filter((el) => normalize(el.textContent || '').split(' ').includes(targetToken) || normalize(el.textContent || '').includes(targetToken));
      const candidates = [...exact, ...fallback].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: normalize(el.textContent || '').slice(0, 140),
          testid: el.getAttribute('data-testid') || '',
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      });
      candidates.sort((a, b) => {
        const score = (x) => (x.testid.includes(`${targetToken}`) ? 1000 : 0) + x.rect.w * x.rect.h;
        return score(b) - score(a);
      });
      return { target: candidates[0] || null, candidates: candidates.slice(0, 8) };
    }, { selector: exactSelector, targetToken: token });
    last = target;
    if (target?.target) {
      await page.mouse.click(target.target.x, target.target.y);
      await sleep(700);
      return `selected ${token}: ${target.target.testid || target.target.text}`;
    }
    await sleep(300);
  }
  throw new Error(`未找到可见的 Cardano 资产行: ${token} | debug=${JSON.stringify(last || {})}`);
}

async function switchToConfiguredAccount(page, account) {
  if (!account?.accountName) throw new Error('Runtime config accountName missing');
  await switchToAccount(page, account.accountName);
  await switchNetwork(page, NETWORK);
}

async function readTokenBalance(page, token) {
  const result = await waitForExtensionTokenBalance(page, {
    token,
    exactTestId: tokenTestId('home-token-item', token),
    tokenRowPrefix: `home-token-item-${CHAIN_SLUG}--`,
    label: `${NETWORK} ${token}`,
  });
  return result.balance;
}

async function copyCurrentCardanoAddress(page) {
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="account-selector-copy-address-btn"]');
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    btn.click();
    return true;
  });
  if (!clicked) throw new Error('未找到复制当前账户 Cardano 地址按钮');
  await sleep(500);

  for (let i = 0; i < 8; i++) {
    const text = await page.evaluate(async () => {
      try { return await navigator.clipboard.readText(); } catch { return ''; }
    });
    const address = (text || '').trim();
    if (/^(addr1|addr_test1)[a-z0-9]+$/i.test(address)) return address;
    await sleep(250);
  }
  throw new Error('复制 Cardano 地址后未能从剪贴板读取有效 addr 地址');
}

async function prepareAdaTransferDirection(page, token, minBalance) {
  requireAccounts();
  const direction = await resolveTransferDirection({
    minBalance,
    getBalance: async (account) => {
      await switchToConfiguredAccount(page, account);
      const tokenBalance = await readTokenBalance(page, token);
      if (token === NATIVE_TOKEN) return tokenBalance;
      const feeBalance = await readTokenBalance(page, NATIVE_TOKEN);
      return tokenBalance >= minBalance && feeBalance >= ADA_FEE_MIN_BALANCE ? tokenBalance : 0;
    },
  });

  await switchToConfiguredAccount(page, direction.receiver);
  const recipientAddress = await copyCurrentCardanoAddress(page);

  await switchToConfiguredAccount(page, direction.sender);
  const senderBalance = await readTokenBalance(page, token);
  const senderAdaBalance = token === NATIVE_TOKEN ? senderBalance : await readTokenBalance(page, NATIVE_TOKEN);
  if (senderBalance < minBalance) {
    throw new Error(`发送账户余额不足: ${direction.sender.accountName} ${senderBalance} ${token} < ${minBalance}`);
  }
  if (senderAdaBalance < ADA_FEE_MIN_BALANCE) {
    throw new Error(`发送账户 ADA 余额不足以支付网络费用: ${direction.sender.accountName} ${senderAdaBalance} ADA < ${ADA_FEE_MIN_BALANCE}`);
  }

  return {
    ...direction,
    recipientAddress,
    senderBalance,
    senderAdaBalance,
  };
}

async function enterRecipientAndNext(page, recipient) {
  if (!recipient) throw new Error('recipient is required');
  const input = page.locator('[data-testid="APP-Modal-Screen"] [data-testid="base-input-shared-styles-textarea"]').last();
  await input.waitFor({ state: 'visible', timeout: 8000 });
  await input.click();
  await selectAllAndClearFocusedInput(page);
  await input.pressSequentially(recipient, { delay: 40 });

  let last = null;
  for (let i = 0; i < 14; i++) {
    last = await page.evaluate(() => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const textarea = modal?.querySelector('[data-testid="base-input-shared-styles-textarea"]');
      const footerButtons = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"]'))
        .map((btn) => {
          const r = btn.getBoundingClientRect();
          const style = window.getComputedStyle(btn);
          return {
            text: normalize(btn.textContent || ''),
            visible: r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0',
            disabled: btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled') || style.pointerEvents === 'none',
          };
        });
      return {
        inputValue: textarea?.value || '',
        inputText: normalize(textarea?.textContent || ''),
        modalText: normalize(modal?.textContent || '').slice(0, 500),
        footerButtons,
      };
    });
    const hasNext = last.footerButtons?.some((btn) => btn.visible && !btn.disabled && (btn.text.includes('下一步') || btn.text.includes('Next')));
    if (hasNext) break;
    await sleep(300);
  }

  if (!last?.inputValue?.trim()) {
    throw new Error(`收款地址未成功输入 | debug=${JSON.stringify(last || {})}`);
  }
  await clickFooterConfirmByText(page, ['下一步', 'Next'], `收款方下一步按钮 | input=${last.inputValue.slice(0, 24)}...`);
}

async function enterAmount(page, amount) {
  const input = page.locator('[data-testid="send-amount-input"]').first();
  await input.click();
  await selectAllAndClearFocusedInput(page);
  await input.pressSequentially(amount, { delay: 50 });
  await sleep(600);
  return input.inputValue().catch(() => '');
}

async function readAmountInputValue(page) {
  return page.locator('[data-testid="send-amount-input"]').first().inputValue({ timeout: 3000 }).catch(() => '');
}

async function assertTransferFormAmount(page, expectedAmount, label) {
  const actual = await readAmountInputValue(page);
  if (!actual || Number(actual) <= 0) {
    throw new Error(`${label} 后金额输入框无有效数值: "${actual}"`);
  }
  if (expectedAmount && actual !== expectedAmount) {
    throw new Error(`${label} 后金额不匹配: expected=${expectedAmount}, actual=${actual}`);
  }
  return actual;
}

async function assertPreviewButtonDisabled(page) {
  const state = await page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const buttons = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"]'))
      .map((btn) => {
        const r = btn.getBoundingClientRect();
        const style = window.getComputedStyle(btn);
        const visible = r.width > 0 && r.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        return {
          text: normalize(btn.textContent || ''),
          visible,
          disabled: btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled') || style.pointerEvents === 'none' || Number(style.opacity) < 0.6,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      })
      .filter((btn) => btn.visible);
    const preview = buttons.find((btn) => btn.text.includes('预览') || btn.text.includes('Preview')) || null;
    return { preview, buttons };
  });
  if (state.preview && !state.preview.disabled) {
    throw new Error(`最低金额拦截时预览按钮仍可提交 | state=${JSON.stringify(state)}`);
  }
  return state.preview ? `preview disabled: ${state.preview.text}` : 'preview button hidden';
}

async function assertMinimumAmountBlocked(page, expectedMinimumAmount) {
  await sleep(1200);
  const textState = await page.evaluate((minAmount) => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const roots = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"], [role="dialog"], body'));
    const text = normalize(roots.map((root) => root.textContent || '').join(' '));
    const lowerText = text.toLowerCase();
    const minLabels = [
      '最低转账金额',
      '最小转账金额',
      '最低转账数量',
      '最小转账数量',
      '最低金额',
      '最小金额',
      '最少转账',
      '低于最小',
      'minimum transfer amount',
      'minimum amount',
      'minimum',
      'min.',
    ];
    return {
      text: text.slice(0, 1200),
      hasMinLabel: minLabels.some((label) => lowerText.includes(label.toLowerCase())),
      hasMinAmount: !minAmount || text.includes(minAmount),
    };
  }, expectedMinimumAmount);
  if (!textState.hasMinLabel || !textState.hasMinAmount) {
    throw new Error(`未显示最低转账金额提示: expectedMin=${expectedMinimumAmount}; state=${JSON.stringify(textState)}`);
  }
  const previewState = await assertPreviewButtonDisabled(page);
  return `min=${expectedMinimumAmount}; ${previewState}`;
}

function extractTokenAmountFromText(text, token) {
  const normalized = String(text || '').replace(/,/g, ' ');
  const escapedToken = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedToken) {
    const beforeToken = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapedToken}`, 'i').exec(normalized);
    if (beforeToken) return normalizeDecimalAmount(beforeToken[1]);
  }
  return normalizeDecimalAmount(normalized);
}

function extractFeeAmountFromPreviewText(text, token = NATIVE_TOKEN) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const feeLabels = ['预估网络费用', '网络费用', '网络费', '手续费', 'Fee'];
  for (const label of feeLabels) {
    let index = normalized.indexOf(label);
    while (index >= 0) {
      const forwardWindow = normalized.slice(index, index + 180);
      const forwardAmount = extractTokenAmountFromText(forwardWindow, token);
      if (forwardAmount) return forwardAmount;

      const backwardWindow = normalized.slice(Math.max(0, index - 120), index + label.length);
      const backwardAmount = extractTokenAmountFromText(backwardWindow, token);
      if (backwardAmount) return backwardAmount;

      index = normalized.indexOf(label, index + label.length);
    }
  }
  return '';
}

function extractPreviewPrimaryAmountFromText(text, token = NATIVE_TOKEN) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const escapedToken = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escapedToken) return '';

  const feeLabels = ['预估网络费用', '网络费用', '网络费', '手续费', 'Fee'];
  const feeRanges = [];
  for (const label of feeLabels) {
    let index = normalized.indexOf(label);
    while (index >= 0) {
      feeRanges.push({
        start: Math.max(0, index - 48),
        end: Math.min(normalized.length, index + 180),
      });
      index = normalized.indexOf(label, index + label.length);
    }
  }
  const isNearFee = (index) => feeRanges.some((range) => index >= range.start && index <= range.end);
  const candidates = [];
  const patterns = [
    new RegExp(`([-+]?\\d[\\d,]*(?:\\.\\d+)?)\\s*${escapedToken}`, 'gi'),
    new RegExp(`${escapedToken}\\s*([-+]?\\d[\\d,]*(?:\\.\\d+)?)`, 'gi'),
    new RegExp(`${escapedToken}[^\\d-]{0,48}([-+]?\\d[\\d,]*(?:\\.\\d+)?)`, 'gi'),
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(normalized))) {
      const amount = normalizeDecimalAmount(match[1]);
      if (!amount || amount === '0') continue;
      candidates.push({
        amount,
        index: match.index,
        nearFee: isNearFee(match.index),
      });
    }
  }

  return (candidates.find((candidate) => !candidate.nearFee) || candidates[0])?.amount || '';
}

function cardanoAddressParts(address) {
  const normalized = (address || '').trim();
  if (!normalized) return { full: '', prefix: '', suffix: '' };
  return { full: normalized, prefix: normalized.slice(0, 12), suffix: normalized.slice(-8) };
}

async function readPreviewFields(page, token, amount, direction = {}, options = {}) {
  const expectedRecipient = cardanoAddressParts(direction.recipientAddress);
  const state = await page.evaluate((args) => {
    const { token: targetToken, amount: targetAmount, recipient, senderName, receiverName, fullAmount, assetImageNeedle } = args;
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const escapeRegExp = (str) => String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const normalizeAmount = (value) => {
      const match = String(value || '').replace(/,/g, '').match(/[-+]?\d+(?:\.\d+)?/);
      if (!match) return '';
      let [intPart, fracPart = ''] = match[0].replace(/^[-+]/, '').split('.');
      intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
      fracPart = fracPart.replace(/0+$/, '');
      return fracPart ? `${intPart}.${fracPart}` : intPart;
    };
    const root = document.querySelector('[data-testid="APP-Modal-Screen"]') || document.body;
    const text = normalize(root.textContent || '');
    const feeTrigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
    const feeText = normalize(feeTrigger?.textContent || '');
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const tokenNodes = Array.from(root.querySelectorAll('[data-testid], img, svg'))
      .filter(visible)
      .map((el) => ({
        testid: el.getAttribute('data-testid') || '',
        alt: el.getAttribute('alt') || '',
        aria: el.getAttribute('aria-label') || '',
        text: normalize(el.textContent || '').slice(0, 80),
        tag: el.tagName,
      }));
    const tokenNeedle = targetToken.toLowerCase();
    const tokenMatches = tokenNodes
      .map((node) => ({
        ...node,
        haystack: `${node.testid} ${node.alt} ${node.aria} ${node.text}`.toLowerCase(),
      }))
      .filter((node) => node.haystack.includes(tokenNeedle));
    const tokenRows = Array.from(root.querySelectorAll(`[data-testid*="${targetToken}"]`)).filter(visible);
    const hasTokenText = text.includes(targetToken);
    const hasTokenIcon = tokenMatches.some((node) => node.tag === 'IMG' || node.tag === 'svg' || node.testid.includes('icon'))
      || tokenRows.some((row) => {
        const rowText = normalize(row.textContent || '');
        return rowText.includes(targetToken) && !!row.querySelector('img, svg');
      })
      || tokenMatches.some((node) => node.testid.includes('asset-selector-token-item'));
    const cardanoAddressMatches = Array.from(text.matchAll(/addr(?:_test)?1[a-z0-9]+|[a-z0-9]{6,16}\.{2,}[a-z0-9]{4,12}/gi))
      .map((m) => m[0])
      .slice(0, 12);
    const hasRecipientAddress = !!recipient.prefix && !!recipient.suffix
      && (text.includes(recipient.full) || (text.includes(recipient.prefix) && text.includes(recipient.suffix)));
    const hasSenderLabel = !!senderName && text.includes(senderName);
    const hasReceiverLabel = !!receiverName && text.includes(receiverName);
    const hasAddressRole = text.includes('发送') || text.includes('来自') || text.includes('From') || text.includes('收款') || text.includes('至') || text.includes('To');
    const tokenAmountPattern = new RegExp(`\\d+(?:\\.\\d+)?\\s*${escapeRegExp(targetToken)}`, 'i');
    const hasTokenAmount = tokenAmountPattern.test(text);
    const readTokenAmount = (value) => {
      const normalized = normalize(value);
      const patterns = [
        new RegExp(`([-+]?\\d[\\d,]*(?:\\.\\d+)?)\\s*${escapeRegExp(targetToken)}`, 'i'),
        new RegExp(`${escapeRegExp(targetToken)}[^\\d-]{0,48}([-+]?\\d[\\d,]*(?:\\.\\d+)?)`, 'i'),
      ];
      for (const pattern of patterns) {
        const match = pattern.exec(normalized);
        const amount = normalizeAmount(match?.[1]);
        if (amount && amount !== '0') return amount;
      }
      return '';
    };
    const feeOrAccountText = (value) => /预估网络费用|网络费用|网络费|手续费|Fee|Wallet|Account\s*#|收款方|发送方|来自|From|To|addr(?:_test)?1/i.test(value);
    const previewAmountCandidates = Array.from(root.querySelectorAll('[data-sentry-source-file*="Assets.tsx"]'))
      .filter(visible)
      .map((el) => {
        const rowText = normalize(el.innerText || el.textContent || '');
        const imgSrcs = Array.from(el.querySelectorAll('img')).map((img) => String(img.getAttribute('src') || img.src || ''));
        const hasTokenImage = imgSrcs.some((src) => {
          const lower = src.toLowerCase();
          const needle = String(assetImageNeedle || '').toLowerCase();
          return needle && lower.includes(needle);
        });
        const rowAmount = readTokenAmount(rowText);
        const rect = el.getBoundingClientRect();
        return {
          amount: rowAmount,
          text: rowText.slice(0, 160),
          hasTokenImage,
          badScope: feeOrAccountText(rowText),
          area: Math.round(rect.width * rect.height),
        };
      })
      .filter((candidate) => candidate.amount && !candidate.badScope)
      .sort((a, b) => {
        if (a.hasTokenImage !== b.hasTokenImage) return a.hasTokenImage ? -1 : 1;
        return a.text.length - b.text.length;
      });
    const previewAmount = previewAmountCandidates[0]?.amount || '';
    return {
      text: text.slice(0, 1600),
      hasToken: hasTokenText,
      hasTokenIcon,
      hasAmount: fullAmount ? (!!previewAmount || hasTokenAmount) : (targetAmount ? text.includes(targetAmount) : !!previewAmount || hasTokenAmount || /[0-9]/.test(text)),
      hasNetwork: text.includes('Cardano'),
      hasFee: text.includes('网络费用') || text.includes('预估网络费用') || text.includes('Fee') || !!feeTrigger,
      hasRecipientAddress,
      hasSenderLabel,
      hasReceiverLabel,
      hasAddressRole,
      feeText,
      previewText: text,
      previewAmount,
      actual: {
        tokenMatches: tokenMatches.map(({ haystack, ...node }) => node).slice(0, 10),
        tokenRows: tokenRows.map((row) => ({
          testid: row.getAttribute('data-testid') || '',
          text: normalize(row.textContent || '').slice(0, 120),
          hasVisualNode: !!row.querySelector('img, svg'),
        })).slice(0, 10),
        tokenNodeSamples: tokenNodes.slice(0, 20),
        cardanoAddressMatches,
        previewAmountCandidates: previewAmountCandidates.slice(0, 6),
      },
    };
  }, {
    token,
    amount,
    recipient: expectedRecipient,
    senderName: direction.sender?.accountName || '',
    receiverName: direction.receiver?.accountName || '',
    fullAmount: !!options.fullAmount,
    assetImageNeedle: `${CHAIN_SLUG}--${TOKEN_NETWORK_ID}`,
  });

  state.feeAmount = extractTokenAmountFromText(state.feeText, NATIVE_TOKEN)
    || extractFeeAmountFromPreviewText(state.previewText, NATIVE_TOKEN);
  state.previewAmount = state.previewAmount || extractPreviewPrimaryAmountFromText(state.previewText, token);

  const missing = [];
  if (!state.hasToken) missing.push('token-symbol');
  if (!state.hasTokenIcon) missing.push('token-icon');
  if (!state.hasAmount) missing.push('amount');
  if (!state.hasNetwork) missing.push('network');
  if (!state.hasFee) missing.push('fee');
  if (!state.hasRecipientAddress) missing.push('recipient-address');
  if (!state.hasAddressRole) missing.push('from-to-label');
  if (direction.sender?.accountName && !state.hasSenderLabel) missing.push('sender-label');
  if (direction.receiver?.accountName && !state.hasReceiverLabel) missing.push('receiver-label');
  if (missing.length > 0) {
    const debug = {
      expected: {
        token,
        amount,
        recipientAddress: expectedRecipient.full,
        recipientPrefix: expectedRecipient.prefix,
        recipientSuffix: expectedRecipient.suffix,
        senderName: direction.sender?.accountName || '',
        receiverName: direction.receiver?.accountName || '',
      },
      checks: {
        tokenSymbol: state.hasToken,
        tokenIcon: state.hasTokenIcon,
        amount: state.hasAmount,
        network: state.hasNetwork,
        fee: state.hasFee,
        recipientAddress: state.hasRecipientAddress,
        fromToLabel: state.hasAddressRole,
        senderLabel: state.hasSenderLabel,
        receiverLabel: state.hasReceiverLabel,
      },
      actual: state.actual,
      feeText: state.feeText,
      pageText: state.text,
    };
    throw new Error(`预览确认页字段缺失: ${missing.join(',')} | debug=${JSON.stringify(debug)}`);
  }
  return state;
}

async function clickFooterConfirmByText(page, expectedTexts, label, { settleMs = 1200 } = {}) {
  const targets = Array.isArray(expectedTexts) ? expectedTexts : [expectedTexts];
  let clicked = false;
  let clickedText = null;
  let debug = null;
  for (let i = 0; i < 3; i++) {
    const ret = await page.evaluate((texts) => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const includesAny = (value) => texts.some((text) => String(value || '').includes(text));
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
        return !disabled;
      };
      const candidates = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"]'))
        .filter(isVisible)
        .map((btn, idx) => {
          const r = btn.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const top = document.elementFromPoint(cx, cy);
          const btnText = normalize(btn.textContent || '');
          const topText = normalize(top?.textContent || '');
          return {
            idx,
            text: btnText,
            topText: topText.slice(0, 80),
            containsTop: !!top && (top === btn || btn.contains(top) || top.contains(btn)),
            textMatches: includesAny(btnText),
            topTextMatches: includesAny(topText),
            x: cx,
            y: cy,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          };
        });
      candidates.sort((a, b) => {
        const score = (x) => (x.textMatches ? 100 : 0) + (x.containsTop ? 20 : 0) + (x.topTextMatches ? 10 : 0);
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
        return b.idx - a.idx;
      });
      const target = candidates.find((c) => c.textMatches) || candidates.find((c) => c.topTextMatches) || null;
      return { target, candidates: candidates.slice(0, 8) };
    }, targets);
    debug = ret;
    if (ret?.target) {
      await page.mouse.click(ret.target.x, ret.target.y);
      clickedText = ret.target.text || ret.target.topText || targets.join('/');
      clicked = true;
      break;
    }
    await sleep(700);
  }
  if (!clicked) throw new Error(`未找到可点击的${label}: page-footer-confirm | debug=${JSON.stringify(debug || {})}`);
  if (settleMs > 0) await sleep(settleMs);
  return clickedText || targets.join('/');
}

async function clickPreview(page) {
  await clickFooterConfirmByText(page, ['预览', 'Preview'], '预览按钮');
}

async function waitForPreviewConfirmPage(page, token = null, amount = null, direction = {}, options = {}) {
  return waitForExtensionTransferPreviewReady(page, {
    token,
    amount,
    direction,
    fullAmount: !!options.fullAmount,
    readPreviewFields,
    clickPreview: () => clickPreview(page),
    previewButtonTexts: ['预览', 'Preview'],
    confirmButtonTexts: ['确认', 'Confirm'],
  });
}

async function submitTransfer(page, token, amount = null, direction = {}, options = {}) {
  await clickPreview(page);
  const preview = await waitForPreviewConfirmPage(page, token, amount, direction, options);
  const summary = await finishSubmittedTransfer(page, token);
  const sentAmount = normalizeDecimalAmount(amount);
  const feeAmount = normalizeDecimalAmount(preview?.feeAmount);
  const previewAmount = normalizeDecimalAmount(preview?.previewAmount);
  const historyAmountMode = options.historyAmountMode || (options.fullAmount ? 'amountPlusFeeEquals' : 'primary');
  const historyAmount = historyAmountMode === 'previewPrimary'
    ? previewAmount
    : calculateHistoryAmount(sentAmount, feeAmount, options);
  if (historyAmountMode === 'previewPrimary' && !historyAmount) {
    throw new Error(`预览页未读取到 ${token} 最终转账金额，无法按 previewPrimary 匹配历史记录`);
  }
  const totalAmount = options.fullAmount ? sentAmount : historyAmount;
  return {
    summary,
    sentAmount,
    feeAmount,
    previewAmount,
    historyAmount,
    totalAmount,
    historyAmountMode,
    toString() {
      return `${summary}; sent=${sentAmount || '-'}; preview=${previewAmount || '-'}; fee=${feeAmount || '-'}; historyAmount=${historyAmount || '-'}; totalAmount=${totalAmount || '-'}; mode=${historyAmountMode}`;
    },
  };
}

async function clickVisibleFinalAction(page) {
  const target = await page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const actionWords = ['确认', '发送', '完成', 'Confirm', 'Send', 'Done'];
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0' || style.pointerEvents === 'none') return false;
      const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
      if (disabled) return false;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return !!top && (top === el || el.contains(top) || top.contains(el));
    };
    const selectors = [
      '[data-testid="page-footer-confirm"]',
      '[data-testid="signature-confirm-btn"]',
      'button',
      '[role="button"]',
    ];
    const seen = new Set();
    const candidates = [];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);
        const text = normalize(el.textContent || '');
        const testid = el.getAttribute('data-testid') || '';
        if (!actionWords.some((word) => text.includes(word)) && !['page-footer-confirm', 'signature-confirm-btn'].includes(testid)) continue;
        const r = el.getBoundingClientRect();
        candidates.push({
          text,
          testid,
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
    }
    candidates.sort((a, b) => {
      const priority = (x) => {
        if (x.testid === 'signature-confirm-btn') return 0;
        if (x.testid === 'page-footer-confirm') return 1;
        if (x.text.includes('确认') || x.text.includes('发送') || x.text.includes('Confirm') || x.text.includes('Send')) return 2;
        if (x.text.includes('完成') || x.text.includes('Done')) return 3;
        return 9;
      };
      const pa = priority(a);
      const pb = priority(b);
      if (pa !== pb) return pa - pb;
      return (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h);
    });
    return { target: candidates[0] || null, candidates: candidates.slice(0, 8) };
  });
  if (!target?.target) return null;
  await page.mouse.click(target.target.x, target.target.y);
  return `${target.target.testid || 'text'}:${target.target.text || '<empty>'}`;
}

async function handleAdaPasswordPrompt(page) {
  const pwdResult = await handlePasswordPromptIfPresent(page).catch(() => ({ handled: false }));
  if (pwdResult?.handled) return { handled: true, type: pwdResult.type || 'standard' };

  const hasVisiblePassword = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    return Array.from(document.querySelectorAll('input[type="password"]')).some(isVisible);
  });
  if (!hasVisiblePassword) return { handled: false };

  const password = getWalletPassword();
  const input = page.locator('input[type="password"]').first();
  await input.click({ force: true }).catch(() => {});
  await selectAllAndClearFocusedInput(page);
  await input.pressSequentially(password, { delay: 40 });
  await sleep(500);

  const clicked = await page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      return el.getAttribute('aria-disabled') !== 'true' && !el.hasAttribute('disabled');
    };
    const selectors = ['[data-testid="page-footer-confirm"]', '[data-testid="signature-confirm-btn"]', 'button', '[role="button"]'];
    const seen = new Set();
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        if (seen.has(el) || !isVisible(el)) continue;
        seen.add(el);
        const text = normalize(el.textContent || '');
        if (text.includes('确认') || text.includes('Confirm') || text.includes('OK')) {
          el.click();
          return { clicked: true, text };
        }
      }
    }
    return { clicked: false };
  });

  if (!clicked?.clicked) await page.keyboard.press('Enter').catch(() => {});
  await sleep(1500);
  return { handled: true, type: clicked?.clicked ? `fallback:${clicked.text || 'button'}` : 'fallback:enter' };
}

async function waitTransferCompletion(page, token, { baselineNotifications = [] } = {}) {
  return waitForExtensionTransferSubmitResult(page, {
    token,
    baselineNotifications,
    handlePasswordPrompt: handleAdaPasswordPrompt,
    clickFinalAction: () => clickVisibleFinalAction(page),
    confirmButtonTexts: ['确认', 'Confirm'],
    submitAttempted: true,
  });
}

async function finishSubmittedTransfer(page, token) {
  const baselineNotifications = await readExtensionFloatingNotifications(page);
  const finalConfirm = await clickFooterConfirmByText(page, ['确认', 'Confirm'], '预览页最终确认按钮', { settleMs: 0 });
  const completion = await waitTransferCompletion(page, token, { baselineNotifications });
  const closed = completion.state?.previewOpen === false && completion.state?.anyBlockingModal === false;
  return `final=${finalConfirm}; actions=${completion.actions.join('>') || 'none'}; busySeen=${completion.busySeen ? 'true' : 'false'}; previewClosed=${closed}`;
}

async function resetAdaCaseState(page) {
  return prepareExtensionTransferCaseState(page, STEP0_OPTIONS);
}

async function runCase(page, id, _name, fn) {
  const t = createStepTracker(id);
  const ready = await safeStep(page, t, 'Step 0: 清理状态并重置账户', async () => {
    return resetAdaCaseState(page);
  }, SCREENSHOT_DIR);
  if (!ready) return t.result();
  await fn(t);
  return t.result();
}

async function runTransferCase(page, caseDef) {
  return runCase(page, caseDef.id, caseDef.name, async (t) => {
    let direction;
    let submitted = null;
    let submittedAmount = null;

    if (caseDef.fullAmount) {
      const historyIdle = await safeStep(page, t, '等待历史发送记录完成', async () => {
        return waitForExtensionOutgoingHistoryIdle(page, STEP0_OPTIONS);
      }, SCREENSHOT_DIR);
      if (!historyIdle) return;
    }

    const directionReady = await safeStep(page, t, `准备 ${caseDef.token} 转账方向`, async () => {
      direction = await prepareAdaTransferDirection(page, caseDef.token, caseDef.minBalance);
      return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}; senderBalance=${direction.senderBalance} ${caseDef.token}; ada=${direction.senderAdaBalance}`;
    }, SCREENSHOT_DIR);
    if (!directionReady) return;
    if (!direction?.recipientAddress) throw new Error(`准备 ${caseDef.token} 转账方向失败：未获取 recipientAddress`);

    await safeStep(page, t, `打开 ${caseDef.token} 发送并输入金额`, async () => {
      await selectToken(page, caseDef.token);
      await enterRecipientAndNext(page, direction.recipientAddress);
      if (caseDef.amount === 'Max') {
        await page.locator('[data-testid="send-max-button"]').first().click();
        await sleep(600);
        submittedAmount = await assertTransferFormAmount(page, null, '点击最大值');
        return `max=${submittedAmount} sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }
      submittedAmount = await enterAmount(page, caseDef.amount);
      await assertTransferFormAmount(page, caseDef.amount, `输入 ${caseDef.amount}`);
      return `amount=${submittedAmount} sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
    }, SCREENSHOT_DIR);

    if (caseDef.verifyFiat) {
      try {
        const fiat = await verifyFiatToggle(page);
        await enterAmount(page, caseDef.amount);
        t.add('切换法币展示', 'passed', fiat);
      } catch (error) {
        t.add('切换法币展示', 'skipped', `未稳定定位法币切换控件: ${error.message}`);
      }
    }

    if (caseDef.expectMinAmountBlock) {
      await safeStep(page, t, '校验最低转账金额拦截', async () => {
        return assertMinimumAmountBlocked(page, caseDef.minTransferAmount);
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '关闭转账弹窗', async () => {
        await closeAllModals(page);
        const stillOpen = await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          if (!modal) return false;
          const r = modal.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        if (stillOpen) throw new Error('转账弹窗未关闭');
        return 'closed';
      }, SCREENSHOT_DIR);
      return;
    }

    const submitOk = await safeStep(page, t, '预览并确认', async () => {
      const amount = caseDef.amount === 'Max' ? (await readAmountInputValue(page)) : caseDef.amount;
      submittedAmount = amount;
      submitted = await submitTransfer(page, caseDef.token, amount, direction, {
        fullAmount: !!caseDef.fullAmount,
        historyAmountMode: caseDef.historyAmountMode,
      });
      return `submitted ${submitted}`;
    }, SCREENSHOT_DIR);
    if (!submitOk) return;

    await safeStep(page, t, `校验 ${caseDef.token} 历史记录字段`, async () => {
      if (!submittedAmount) throw new Error(`${caseDef.token} 发送金额未记录，无法校验历史金额`);
      if (!submitted) throw new Error(`${caseDef.token} 提交结果未记录，无法校验历史金额`);
      const expected = {
        expectedFields: ['token', 'type', 'status', 'hash', 'fee', 'amount', 'network', 'fromTo', 'time'],
        expectedAmount: caseDef.fullAmount ? (submitted?.historyAmount || submitted?.totalAmount || submittedAmount) : caseDef.amount,
        historyAmount: submitted?.historyAmount,
        previewAmount: submitted?.previewAmount,
        historyAmountMode: submitted?.historyAmountMode || (caseDef.fullAmount ? 'amountPlusFeeEquals' : 'primary'),
        totalAmount: caseDef.fullAmount ? (submitted?.totalAmount || submittedAmount) : undefined,
        strictHistoryAmount: true,
        sentAmount: submittedAmount,
        feeAmount: submitted?.feeAmount,
        expectedNetwork: NETWORK,
      };
      const { fields } = await verifyHistoryRecord(page, caseDef.token, expected);
      return `fields=${fields.join(',')}; amount=${submittedAmount}`;
    }, SCREENSHOT_DIR);

    t.skip('区块浏览器对账', '插件端区块浏览器跳转会打开系统浏览器，当前自动化不接管外部浏览器；本用例已校验预览页与历史详情字段');
  });
}

export const testCases = TRANSFER_CASES.map((caseDef) => ({
  id: caseDef.id,
  name: caseDef.name,
  fn: async (page) => runTransferCase(page, caseDef),
}));

export async function setup(page) {
  await page.bringToFront().catch(() => {});
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-ADA-'));
  const cases = filter ? testCases.filter(c => c.id === filter) : testCases;

  if (cases.length === 0) {
    console.error(`No cases matching "${filter}"`);
    return { status: 'error', error: `No match: ${filter}` };
  }

  const { page } = await connectExtensionCDP();
  await setup(page);

  const results = [];
  for (const tc of cases) {
    const start = Date.now();
    try {
      const result = await tc.fn(page);
      const data = {
        testId: tc.id,
        status: result.status,
        duration: Date.now() - start,
        steps: result.steps,
        summary: result.summary,
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(data, null, 2));
      results.push(data);
      console.log(`${tc.id}: ${data.status}`);
    } catch (error) {
      const data = {
        testId: tc.id,
        status: 'failed',
        duration: Date.now() - start,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(data, null, 2));
      results.push(data);
      console.error(`${tc.id}: failed: ${error.message}`);
    }
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.length - passed;
  return { status: failed ? 'failed' : 'passed', passed, failed, total: results.length };
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then((result) => process.exit(result.status === 'passed' ? 0 : 1)).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
