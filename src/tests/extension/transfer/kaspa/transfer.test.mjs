// Kaspa Transfer Tests (Extension) — EXT-KASPA-001 ~ EXT-KASPA-006
// covers: docs/qa/testcases/cases/transfer/2026-05-20_Transfer-Kaspa转账-HD钱包.md §1 参数表
// source: recipient = runtime-config 账户1/账户2，余额不足自动反向

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../../helpers/constants.mjs';
import { dismissOverlays, unlockWalletIfNeeded, handlePasswordPromptIfPresent } from '../../../helpers/index.mjs';
import { connectExtensionCDP, getExtensionId } from '../../../helpers/extension-cdp.mjs';
import { createStepTracker, safeStep, switchToAccount, closeAllModals } from '../../../helpers/components.mjs';
import { switchNetwork } from '../../../helpers/network.mjs';
import { verifyHistoryRecord } from '../../../helpers/transfer.mjs';
import { loadAccounts, requireAccounts, resolveTransferDirection, getWalletPassword } from '../../../helpers/runtime-config.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-kaspa-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

export const displayName = 'Kaspa 转账';

const MIN_BALANCE = {
  SILVER_FIXED: 0.2,
  SILVER_MAX: 0.000001,
  KAS_FIXED: 0.2,
  KAS_MAX: 0.000001,
};

async function goToWallet(page) {
  const clicked = await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    for (const sp of sidebar.querySelectorAll('span, div')) {
      const txt = sp.textContent?.trim() || '';
      if ((txt === '钱包' || txt === 'Wallet') && sp.getBoundingClientRect().width > 0) {
        sp.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/main/TabHome`).catch(() => {});
    await sleep(1500);
  }
}

async function selectToken(page, token) {
  const sendBtn = page.locator('[data-testid="Wallet-Tab-Header"] button[data-testid="home-send-button"]').first();
  await sendBtn.waitFor({ state: 'visible', timeout: 8000 });
  await sendBtn.click();
  await sleep(1000);

  const selector = `[data-testid="asset-selector-token-item-kaspa--kaspa-${token}"]`;
  let last = null;
  for (let i = 0; i < 12; i++) {
    const target = await page.evaluate((sel) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]') || document.body;
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const candidates = Array.from(modal.querySelectorAll(sel))
        .filter(isVisible)
        .map((el) => {
          const r = el.getBoundingClientRect();
          return {
            text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          };
        });
      candidates.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
      return { target: candidates[0] || null, candidates };
    }, selector);
    last = target;
    if (target?.target) {
      await page.mouse.click(target.target.x, target.target.y);
      await sleep(700);
      return `selected ${token}: ${target.target.text}`;
    }
    await sleep(300);
  }
  throw new Error(`未找到可见的 Kaspa 资产行: ${token} | debug=${JSON.stringify(last || {})}`);
}

async function switchToConfiguredAccount(page, account) {
  if (!account?.accountName) throw new Error('Runtime config accountName missing');
  await switchToAccount(page, account.accountName);
  await switchNetwork(page, 'Kaspa');
}

async function readTokenBalance(page, token) {
  const result = await page.evaluate((targetToken) => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const row = document.querySelector(`[data-testid="home-token-item-kaspa--kaspa-${targetToken}"]`);
    if (!row) return { balance: 0, text: '', found: false };
    const text = normalize(row.textContent || '');
    const beforeFiat = text.split('$')[0] || text;
    const matches = Array.from(beforeFiat.matchAll(/([0-9][0-9,]*(?:\.[0-9]+)?)/g)).map((m) => m[1]);
    const raw = matches[matches.length - 1] || '0';
    return { balance: Number(raw.replace(/,/g, '')) || 0, text, found: true };
  }, token);
  if (!result.found) throw new Error(`未找到 ${token} 余额行`);
  return result.balance;
}

async function copyCurrentKaspaAddress(page) {
  const clicked = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="account-selector-copy-address-btn"]');
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    btn.click();
    return true;
  });
  if (!clicked) throw new Error('未找到复制当前账户 Kaspa 地址按钮');
  await sleep(500);

  for (let i = 0; i < 8; i++) {
    const text = await page.evaluate(async () => {
      try { return await navigator.clipboard.readText(); } catch { return ''; }
    });
    const address = (text || '').trim();
    if (/^kaspa:[a-z0-9]+$/i.test(address)) return address;
    await sleep(250);
  }
  throw new Error('复制 Kaspa 地址后未能从剪贴板读取有效 kaspa: 地址');
}

async function prepareKaspaTransferDirection(page, token, minBalance) {
  requireAccounts();
  const direction = await resolveTransferDirection({
    minBalance,
    getBalance: async (account) => {
      await switchToConfiguredAccount(page, account);
      return readTokenBalance(page, token);
    },
  });

  await switchToConfiguredAccount(page, direction.receiver);
  const recipientAddress = await copyCurrentKaspaAddress(page);

  await switchToConfiguredAccount(page, direction.sender);
  const senderBalance = await readTokenBalance(page, token);
  if (senderBalance < minBalance) {
    throw new Error(`发送账户余额不足: ${direction.sender.accountName} ${senderBalance} ${token} < ${minBalance}`);
  }

  return {
    ...direction,
    recipientAddress,
    senderBalance,
  };
}

async function enterRecipientAndNext(page, recipient) {
  if (!recipient) throw new Error('recipient is required');
  const input = page.locator('[data-testid="APP-Modal-Screen"] [data-testid="base-input-shared-styles-textarea"]').last();
  await input.waitFor({ state: 'visible', timeout: 8000 });
  await input.click();
  await input.evaluate((el) => el.select());
  await input.press('Backspace');
  await input.pressSequentially(recipient, { delay: 40 });

  let last = null;
  for (let i = 0; i < 12; i++) {
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
            disabled: btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled'),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          };
        });
      return {
        inputValue: textarea?.value || '',
        inputText: normalize(textarea?.textContent || ''),
        modalText: normalize(modal?.textContent || '').slice(0, 500),
        footerButtons,
      };
    });
    const hasNext = last.footerButtons?.some((btn) => btn.visible && !btn.disabled && btn.text.includes('下一步'));
    if (hasNext) break;
    await sleep(300);
  }

  if (!last?.inputValue?.trim()) {
    throw new Error(`收款地址未成功输入 | debug=${JSON.stringify(last || {})}`);
  }
  await clickFooterConfirmByText(page, '下一步', `收款方下一步按钮 | input=${last.inputValue.slice(0, 24)}...`);
}

async function enterAmount(page, amount) {
  const input = page.locator('[data-testid="send-amount-input"]').first();
  await input.click();
  await input.evaluate((el) => el.select());
  await input.press('Backspace');
  await input.pressSequentially(amount, { delay: 50 });
  await sleep(600);
  return input.inputValue().catch(() => '');
}

async function readAmountInputValue(page) {
  return page.locator('[data-testid="send-amount-input"]').first().inputValue({ timeout: 3000 }).catch(() => '');
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
    throw new Error(`金额非法时预览按钮仍可提交 | state=${JSON.stringify(state)}`);
  }
  return state.preview ? `preview disabled: ${state.preview.text}` : 'preview button hidden';
}

async function assertZeroAmountNotSubmittable(page) {
  await enterAmount(page, '0');
  const text = await page.evaluate(() => document.body.textContent || '');
  const hasMinHint = text.includes('0.2') || text.includes('最小');
  const previewState = await assertPreviewButtonDisabled(page);
  return `${hasMinHint ? 'min hint shown' : 'min hint absent allowed'}; ${previewState}`;
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

function extractTokenAmountFromText(text, token) {
  const normalized = String(text || '').replace(/,/g, ' ');
  const escapedToken = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (escapedToken) {
    const beforeToken = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${escapedToken}`, 'i').exec(normalized);
    if (beforeToken) return normalizeDecimalAmount(beforeToken[1]);
  }
  return normalizeDecimalAmount(normalized);
}

function extractFeeAmountFromPreviewText(text, token) {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  const feeLabels = ['预估网络费用', '网络费用', '网络费', 'Fee'];
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

  const escapedToken = String(token || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tokenPart = escapedToken ? `\\s*${escapedToken}` : '';
  const feePatterns = [
    new RegExp(`(?:预估网络费用|网络费用|Fee)[^\\d-]{0,80}(-?\\d+(?:\\.\\d+)?)${tokenPart}`, 'i'),
    new RegExp(`(-?\\d+(?:\\.\\d+)?)${tokenPart}[^\\d-]{0,80}(?:预估网络费用|网络费用|Fee)`, 'i'),
  ];
  for (const re of feePatterns) {
    const match = re.exec(normalized);
    if (match?.[1]) return normalizeDecimalAmount(match[1]);
  }
  return '';
}

function kaspaAddressParts(address) {
  const normalized = (address || '').trim();
  const body = normalized.replace(/^kaspa:/i, '');
  if (!body) return { full: normalized, prefix: '', suffix: '' };
  return { full: normalized, prefix: body.slice(0, 8), suffix: body.slice(-6) };
}

async function readPreviewFields(page, token, amount, direction = {}) {
  const expectedRecipient = kaspaAddressParts(direction.recipientAddress);
  const state = await page.evaluate((args) => {
    const { token: targetToken, amount: targetAmount, recipient, senderName, receiverName } = args;
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
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
    const kaspaAddressMatches = Array.from(text.matchAll(/kaspa:[a-z0-9]+|[a-z0-9]{4,12}\.{2,}[a-z0-9]{4,12}/gi))
      .map((m) => m[0])
      .slice(0, 12);
    const hasRecipientAddress = !!recipient.prefix && !!recipient.suffix
      && (text.includes(recipient.full) || (text.includes(recipient.prefix) && text.includes(recipient.suffix)));
    const hasSenderLabel = !!senderName && text.includes(senderName);
    const hasReceiverLabel = !!receiverName && text.includes(receiverName);
    const hasAddressRole = text.includes('发送') || text.includes('来自') || text.includes('From') || text.includes('收款') || text.includes('至') || text.includes('To');
    return {
      text: text.slice(0, 1600),
      hasToken: hasTokenText,
      hasTokenIcon,
      hasAmount: targetAmount ? text.includes(targetAmount) : /[0-9]/.test(text),
      hasNetwork: text.includes('Kaspa'),
      hasFee: text.includes('网络费用') || text.includes('预估网络费用') || text.includes('Fee') || !!feeTrigger,
      hasRecipientAddress,
      hasSenderLabel,
      hasReceiverLabel,
      hasAddressRole,
      feeText,
      previewText: text,
      actual: {
        tokenMatches: tokenMatches.map(({ haystack, ...node }) => node).slice(0, 10),
        tokenRows: tokenRows.map((row) => ({
          testid: row.getAttribute('data-testid') || '',
          text: normalize(row.textContent || '').slice(0, 120),
          hasVisualNode: !!row.querySelector('img, svg'),
        })).slice(0, 10),
        tokenNodeSamples: tokenNodes.slice(0, 20),
        kaspaAddressMatches,
      },
    };
  }, {
    token,
    amount,
    recipient: expectedRecipient,
    senderName: direction.sender?.accountName || '',
    receiverName: direction.receiver?.accountName || '',
  });

  state.feeAmount = extractTokenAmountFromText(state.feeText, token)
    || extractFeeAmountFromPreviewText(state.previewText, token);

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

async function clickFooterConfirmByText(page, expectedText, label) {
  let clicked = false;
  let clickedText = null;
  let debug = null;
  for (let i = 0; i < 3; i++) {
    const ret = await page.evaluate((text) => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
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
            textMatches: btnText.includes(text),
            topTextMatches: topText.includes(text),
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
    }, expectedText);
    debug = ret;
    if (ret?.target) {
      await page.mouse.click(ret.target.x, ret.target.y);
      clickedText = ret.target.text || ret.target.topText || expectedText;
      clicked = true;
      break;
    }
    await sleep(700);
  }
  if (!clicked) throw new Error(`未找到可点击的${label}: page-footer-confirm | debug=${JSON.stringify(debug || {})}`);
  await sleep(1200);
  return clickedText || expectedText;
}

async function clickPreview(page) {
  await clickFooterConfirmByText(page, '预览', '预览按钮');
}

async function clickConfirm(page) {
  await clickFooterConfirmByText(page, '确认', '确认按钮');
}

async function waitForPreviewConfirmPage(page, token = null, amount = null, direction = {}) {
  let last = null;
  for (let i = 0; i < 20; i++) {
    const state = await page.evaluate(() => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const footerButtons = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"]'))
        .filter(isVisible)
        .map((btn) => normalize(btn.textContent || ''));
      const body = normalize(document.body?.textContent || '');
      const hasConfirm = footerButtons.some((text) => text.includes('确认'));
      const hasPreview = footerButtons.some((text) => text.includes('预览'));
      const hasFeePreview = body.includes('预估网络费用') || body.includes('网络费用') || !!document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
      return { hasConfirm, hasPreview, hasFeePreview, footerButtons, body: body.slice(0, 500) };
    });
    last = state;
    if (state.hasConfirm && state.hasFeePreview) {
      if (token) return readPreviewFields(page, token, amount, direction);
      return state;
    }
    if (state.hasPreview && i % 3 === 0) {
      await clickFooterConfirmByText(page, '预览', '预览按钮');
    } else {
      await sleep(500);
    }
  }
  throw new Error(`点击预览后未进入预览确认页 | state=${JSON.stringify(last || {})}`);
}

async function submitTransfer(page, token, amount = null, direction = {}, options = {}) {
  await clickPreview(page);
  const preview = await waitForPreviewConfirmPage(page, token, amount, direction);
  const summary = await finishSubmittedTransfer(page, token);
  const sentAmount = normalizeDecimalAmount(amount);
  const feeAmount = normalizeDecimalAmount(preview?.feeAmount);
  const historyAmount = calculateHistoryAmount(sentAmount, feeAmount, options);
  const totalAmount = options.fullAmount ? sentAmount : historyAmount;
  return {
    summary,
    sentAmount,
    feeAmount,
    historyAmount,
    totalAmount,
    historyAmountMode: options.fullAmount ? 'amountPlusFeeEquals' : 'primary',
    toString() {
      return `${summary}; sent=${sentAmount || '-'}; fee=${feeAmount || '-'}; historyAmount=${historyAmount || '-'}; totalAmount=${totalAmount || '-'}; mode=${options.fullAmount ? 'amount+fee' : 'primary'}`;
    },
  };
}

async function clickVisibleByTestId(page, testId, label = 'button') {
  const target = await page.evaluate((tid) => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
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
    const candidates = Array.from(document.querySelectorAll(`[data-testid="${tid}"]`))
      .filter(isVisible)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          text: normalize(el.textContent || ''),
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      });
    candidates.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
    return { target: candidates[0] || null, candidates: candidates.slice(0, 5) };
  }, testId);
  if (!target?.target) throw new Error(`未找到可点击的${label}: ${testId} | debug=${JSON.stringify(target || {})}`);
  await page.mouse.click(target.target.x, target.target.y);
  return target.target.text || testId;
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

async function handleKaspaPasswordPrompt(page) {
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
  await input.evaluate((el) => el.select());
  await input.press('Backspace');
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

async function waitTransferCompletion(page, token) {
  const actions = [];
  for (let i = 0; i < 90; i++) {
    const state = await page.evaluate(() => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const body = normalize(document.body?.textContent || '');
      const modalTexts = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"], [role="dialog"]'))
        .filter(isVisible)
        .map((el) => normalize(el.textContent || ''));
      const doneText = ['发送成功', '交易已提交', '交易完成', '发送完成', 'Transaction submitted', 'Transaction completed', 'Send success', 'Sent successfully']
        .some((word) => body.includes(word));
      const submittingText = ['发送中', '提交中', '广播中', '处理中', 'Submitting', 'Sending']
        .some((word) => body.includes(word));
      const previewOpen = modalTexts.some((txt) => {
        const hasPreviewFee = txt.includes('预估网络费用') || txt.includes('sig-confirm-fee-selector-trigger');
        const hasPreviewFields = txt.includes('资产') && txt.includes('至') && txt.includes('确认');
        const hasInputPage = txt.includes('输入金额') && txt.includes('预览');
        return hasPreviewFee || hasPreviewFields || hasInputPage;
      });
      const anyBlockingModal = modalTexts.length > 0;
      return {
        doneText,
        submittingText,
        previewOpen,
        anyBlockingModal,
        modalTexts: modalTexts.map((txt) => txt.slice(0, 300)),
        body: body.slice(0, 500),
      };
    });

    const pwdResult = await handleKaspaPasswordPrompt(page);
    if (pwdResult?.handled) actions.push(`password:${pwdResult.type || 'handled'}`);

    // 用户要求：不看历史记录，预览发送页自动关闭即判定提交流程完成。
    if (state.doneText || (!state.previewOpen && !state.anyBlockingModal && i > 0)) {
      return { done: true, actions, state };
    }

    const clicked = await clickVisibleFinalAction(page);
    if (clicked) actions.push(clicked);
    await sleep(clicked ? 900 : (state.submittingText ? 1500 : 1000));
  }

  const finalState = await page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const modalTexts = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"], [role="dialog"]'))
      .map((el) => normalize(el.textContent || ''))
      .slice(0, 5);
    return { body: normalize(document.body?.textContent || '').slice(0, 800), modalTexts };
  });
  throw new Error(`提交后预览发送页未自动关闭: ${token} | actions=${actions.join('>')} | state=${JSON.stringify(finalState)}`);
}

async function finishSubmittedTransfer(page, token) {
  const feeState = await getFeeEditorState(page);
  if (feeState.open) await saveFeeEditorAndWaitClosed(page, token);
  const finalConfirm = await clickFooterConfirmByText(page, '确认', '预览页最终确认按钮');
  await sleep(1200);
  const completion = await waitTransferCompletion(page, token);
  const closed = completion.state?.previewOpen === false && completion.state?.anyBlockingModal === false;
  return `final=${finalConfirm}; actions=${completion.actions.join('>') || 'none'}; previewClosed=${closed}`;
}

async function getFeeEditorState(page) {
  return page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && style.pointerEvents !== 'none';
    };
    const roots = Array.from(document.querySelectorAll('[role="dialog"], [data-testid="APP-Modal-Screen"], body'))
      .filter(isVisible)
      .map((root) => normalize(root.textContent || ''));
    const bodyText = normalize(document.body?.textContent || '');
    const hasFeeText = roots.some((txt) => txt.includes('网络费用')) || bodyText.includes('网络费用');
    const hasSegmentText = roots.some((txt) => txt.includes('慢') && txt.includes('快速') && txt.includes('自定义'))
      || bodyText.includes('慢正常快速自定义')
      || (bodyText.includes('慢') && bodyText.includes('快速') && bodyText.includes('自定义'));
    const saveButtons = Array.from(document.querySelectorAll('[data-testid="signature-confirm-btn"]'))
      .filter(isVisible)
      .map((btn) => {
        const r = btn.getBoundingClientRect();
        return {
          text: normalize(btn.textContent || ''),
          x: r.left + r.width / 2,
          y: r.top + r.height / 2,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      })
      .filter((btn) => btn.text.includes('保存'));
    saveButtons.sort((a, b) => (b.rect.w * b.rect.h) - (a.rect.w * a.rect.h));
    // In this flow a visible signature-confirm-btn with text 保存 is the most reliable proof that the fee editor is open.
    // The title/segment text can be outside the dialog root or hidden during RN portal re-render.
    const open = saveButtons.length > 0;
    return { open, hasFeeText, hasSegmentText, saveTarget: saveButtons[0] || null, saveButtons: saveButtons.slice(0, 5) };
  });
}

async function openFeeEditorOnce(page) {
  const before = await getFeeEditorState(page);
  if (before.open) return 'already-open';

  const trigger = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return null;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return null;
    const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
    if (disabled) return null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    if (!top || !(top === el || el.contains(top) || top.contains(el))) return null;
    return { x: cx, y: cy, rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) } };
  });
  if (!trigger) throw new Error(`未找到可点击的网络费用编辑触发按钮 | state=${JSON.stringify(before)}`);
  await page.mouse.click(trigger.x, trigger.y);

  let last = null;
  for (let i = 0; i < 16; i++) {
    last = await getFeeEditorState(page);
    if (last.open) return 'opened';
    await sleep(250);
  }
  throw new Error(`网络费用弹窗未成功打开：未出现可见保存按钮 | state=${JSON.stringify(last || before)}`);
}

async function saveFeeEditorAndWaitClosed(page, level) {
  let last = null;
  for (let i = 0; i < 12; i++) {
    last = await getFeeEditorState(page);
    if (last.open && last.saveTarget) {
      await page.mouse.click(last.saveTarget.x, last.saveTarget.y);
      break;
    }
    await sleep(250);
  }
  if (!last?.open || !last.saveTarget) {
    throw new Error(`档位已点击但未找到应用按钮: ${level} | debug=${JSON.stringify(last || {})}`);
  }

  for (let i = 0; i < 20; i++) {
    const state = await getFeeEditorState(page);
    if (!state.open) return 'saved-and-closed';
    await sleep(250);
  }
  const state = await getFeeEditorState(page);
  throw new Error(`费用档位保存后弹窗未关闭: ${level} | debug=${JSON.stringify(state || {})}`);
}

async function resetKaspaCaseState(page) {
  await page.bringToFront().catch(() => {});
  await closeAllModals(page).catch(() => {});
  await dismissOverlays(page).catch(() => {});
  await goToWallet(page);
  await unlockWalletIfNeeded(page);
  await closeAllModals(page).catch(() => {});
  await dismissOverlays(page).catch(() => {});

  const accounts = loadAccounts();
  const resetAccount = accounts.primary?.accountName || accounts.secondary?.accountName || '';
  if (resetAccount) {
    await switchToAccount(page, resetAccount);
    await dismissOverlays(page).catch(() => {});
  }

  await switchNetwork(page, 'Kaspa');
  await goToWallet(page);
  return resetAccount ? `wallet ready; account reset=${resetAccount}; network=Kaspa` : 'wallet ready; network=Kaspa';
}

async function runCase(page, id, name, fn) {
  const t = createStepTracker(id);
  const ready = await safeStep(page, t, 'Step 0: 清理状态并重置账户', async () => {
    return resetKaspaCaseState(page);
  }, SCREENSHOT_DIR);
  if (!ready) return t.result();
  await fn(t);
  return t.result();
}

export const testCases = [
  {
    id: 'EXT-KASPA-001',
    name: 'SILVER 金额=0 拦截',
    fn: async (page) => runCase(page, 'EXT-KASPA-001', 'SILVER 金额=0 拦截', async (t) => {
      let direction;
      await safeStep(page, t, '准备 SILVER 转账方向', async () => {
        direction = await prepareKaspaTransferDirection(page, 'SILVER', MIN_BALANCE.SILVER_MAX);
        return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      if (!direction?.recipientAddress) throw new Error('准备 SILVER 转账方向失败：未获取 recipientAddress');
      await safeStep(page, t, '打开 SILVER 发送', async () => {
        await selectToken(page, 'SILVER');
        await enterRecipientAndNext(page, direction.recipientAddress);
        return `opened sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '输入金额 0 并检查预览不可提交', async () => {
        return assertZeroAmountNotSubmittable(page);
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
    }),
  },
  {
    id: 'EXT-KASPA-002',
    name: 'SILVER 金额=0.2 + 费用四档',
    fn: async (page) => runCase(page, 'EXT-KASPA-002', 'SILVER 金额=0.2 + 费用四档', async (t) => {
      let direction;
      let submitted = null;
      await safeStep(page, t, '准备 SILVER 转账方向', async () => {
        direction = await prepareKaspaTransferDirection(page, 'SILVER', MIN_BALANCE.SILVER_FIXED);
        return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      if (!direction?.recipientAddress) throw new Error('准备 SILVER 转账方向失败：未获取 recipientAddress');
      await safeStep(page, t, '打开 SILVER 发送并输入 0.2', async () => {
        await selectToken(page, 'SILVER');
        await enterRecipientAndNext(page, direction.recipientAddress);
        const actualAmount = await enterAmount(page, '0.2');
        await assertTransferFormAmount(page, '0.2', '输入 0.2');
        return `amount=${actualAmount} sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览页切换费用档并确认', async () => {
        // EXT-KASPA-002 专用：预览按钮偶发可见但不可点，局部重试避免影响其他用例
        let previewClicked = false;
        for (let i = 0; i < 3; i++) {
          previewClicked = await page.evaluate(() => {
            const btn = document.querySelector('[data-testid="page-footer-confirm"]');
            if (!btn) return false;
            const r = btn.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            if (!top) return false;
            const clickable = top === btn || btn.contains(top) || top.contains(btn);
            if (!clickable) return false;
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            return true;
          });
          if (previewClicked) break;
          await sleep(700);
        }
        if (!previewClicked) {
          // EXT-KASPA-002 专用兜底：改为坐标点击，避免 locator actionability 超时
          const box = await page.locator('[data-testid="page-footer-confirm"]').first().boundingBox();
          if (!box) throw new Error('预览按钮不可见，无法执行坐标点击');
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }
        await sleep(1200);

        // EXT-KASPA-002 专用：点击预览后，先等待预览页元素出现再继续
        let previewReady = false;
        for (let i = 0; i < 20; i++) {
          previewReady = await page.evaluate(() => {
            const feeTrigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
            if (feeTrigger) {
              const r = feeTrigger.getBoundingClientRect();
              if (r.width > 0 && r.height > 0) return true;
            }

            const body = document.body?.textContent || '';
            if (body.includes('网络费') || body.includes('手续费') || body.includes('Gas Fee') || body.includes('Fee')) {
              return true;
            }
            return false;
          });
          if (previewReady) break;
          await sleep(300);
        }
        if (!previewReady) {
          throw new Error('点击预览后未等到预览页渲染完成（未出现费用相关元素）');
        }

        // EXT-KASPA-002 专用：预览页出现后，继续等待“网络费用编辑”变为可用
        let feeEditorReady = false;
        for (let i = 0; i < 20; i++) {
          feeEditorReady = await page.evaluate(() => {
            const trigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
            if (!trigger) return false;
            const r = trigger.getBoundingClientRect();
            if (r.width <= 0 || r.height <= 0) return false;
            const style = window.getComputedStyle(trigger);
            if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
            const disabled = trigger.getAttribute('aria-disabled') === 'true' || trigger.hasAttribute('disabled');
            if (disabled) return false;
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const top = document.elementFromPoint(cx, cy);
            if (!top) return false;
            return top === trigger || trigger.contains(top) || top.contains(trigger);
          });
          if (feeEditorReady) break;
          await sleep(300);
        }
        if (!feeEditorReady) {
          throw new Error('预览页已弹出，但网络费用编辑仍不可用');
        }

        // EXT-KASPA-002 专用：费率必须“选择 + 应用”才算切换成功
        const clickedLevels = [];
        const levels = ['慢', '正常', '快速', '自定义', '正常'];
        for (const level of levels) {
          // 1) 打开网络费用编辑弹窗：已开则复用，不重复点击触发器，避免把弹窗留在上层或反复切换。
          await openFeeEditorOnce(page);

          // 3) SegmentControl 可能以 portal 挂在弹窗外层，先全页面定位，再用真实鼠标坐标点击。
          const ret = await page.evaluate((label) => {
            const labels = ['慢', '正常', '快速', '自定义'];
            const index = labels.indexOf(label);
            const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
            const isVisible = (el) => {
              const r = el.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) return false;
              const style = window.getComputedStyle(el);
              return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && style.pointerEvents !== 'none';
            };
            const candidates = [];
            for (const el of document.querySelectorAll('div, [data-sentry-component="SegmentControlFrame"]')) {
              if (!isVisible(el)) continue;
              const text = normalize(el.textContent || '');
              const r = el.getBoundingClientRect();
              const isSegmentText = text === '慢正常快速自定义' || labels.every(x => text.includes(x));
              const isReasonableSize = r.width >= 280 && r.width <= 480 && r.height >= 24 && r.height <= 80;
              const isFeeArea = normalize(el.closest('[role="dialog"], [data-testid="APP-Modal-Screen"], body')?.textContent || '').includes('网络费用');
              const isFrame = el.getAttribute('data-sentry-component') === 'SegmentControlFrame';
              if ((isFrame || isSegmentText) && isReasonableSize && isFeeArea) {
                candidates.push({ text, r, isFrame });
              }
            }
            candidates.sort((a, b) => {
              if (a.isFrame !== b.isFrame) return a.isFrame ? -1 : 1;
              return (a.r.width * a.r.height) - (b.r.width * b.r.height);
            });
            const target = candidates[0];
            if (!target || index < 0) {
              return {
                clicked: false,
                label,
                reason: 'segment-not-found',
                candidates: candidates.map(c => ({
                  text: c.text,
                  isFrame: c.isFrame,
                  rect: { x: Math.round(c.r.x), y: Math.round(c.r.y), w: Math.round(c.r.width), h: Math.round(c.r.height) },
                })).slice(0, 10),
                visibleFeeTexts: Array.from(document.querySelectorAll('div'))
                  .filter(isVisible)
                  .map(el => normalize(el.textContent || ''))
                  .filter(t => t.includes('慢') || t.includes('正常') || t.includes('快速') || t.includes('自定义'))
                  .slice(0, 20),
              };
            }
            const x = target.r.left + target.r.width * ((index + 0.5) / labels.length);
            const y = target.r.top + target.r.height / 2;
            const top = document.elementFromPoint(x, y);
            return {
              clicked: true,
              label,
              index,
              segmentText: target.text,
              rect: { x: Math.round(target.r.x), y: Math.round(target.r.y), w: Math.round(target.r.width), h: Math.round(target.r.height) },
              clickPoint: { x: Math.round(x), y: Math.round(y) },
              topTextBeforeClick: normalize(top?.textContent || '').slice(0, 120),
            };
          }, level);
          if (!ret?.clicked) {
            throw new Error(`网络费用弹窗内未找到或无法点击档位: ${level} | debug=${JSON.stringify(ret || {})}`);
          }
          await page.mouse.click(ret.clickPoint.x, ret.clickPoint.y);

          // 4) 保存费用弹窗，并强制等待费用编辑层关闭后再进入下一档或最终确认。
          await saveFeeEditorAndWaitClosed(page, level);

          // 5) 校验触发器文案已切到目标档位
          let levelApplied = false;
          for (let i = 0; i < 12; i++) {
            levelApplied = await page.evaluate((target) => {
              const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
              const trigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
              const t = normalize(trigger?.textContent || '');
              if (!t) return false;
              if (t.includes(target)) return true;
              return false;
            }, level);
            if (levelApplied) break;
            await sleep(250);
          }
          if (!levelApplied) {
            throw new Error(`费用档位应用后未生效(触发器文案未切到目标): ${level}`);
          }

          clickedLevels.push(level);
          await sleep(350);
        }

        const switchedSummary = clickedLevels.join('>');
        const preview = await readPreviewFields(page, 'SILVER', '0.2', direction);
        const finishSummary = await finishSubmittedTransfer(page, 'SILVER');
        const feeAmount = normalizeDecimalAmount(preview?.feeAmount);
        submitted = {
          sentAmount: '0.2',
          feeAmount,
          historyAmount: calculateHistoryAmount('0.2', feeAmount),
        };
        return `submitted fee-switch=${switchedSummary}; ${finishSummary}; fee=${submitted.feeAmount || '-'}; historyAmount=${submitted.historyAmount || '-'}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '校验 SILVER 历史记录字段', async () => {
        const { fields } = await verifyHistoryRecord(page, 'SILVER', {
          expectedFields: ['token', 'type', 'status', 'hash', 'fee', 'amount', 'network', 'fromTo', 'time'],
          expectedAmount: '0.2',
          historyAmount: submitted?.historyAmount,
          strictHistoryAmount: true,
          sentAmount: '0.2',
          feeAmount: submitted?.feeAmount,
          expectedNetwork: 'Kaspa',
        });
        return `fields=${fields.join(',')}`;
      }, SCREENSHOT_DIR);
      t.skip('区块浏览器对账', '插件端区块浏览器跳转会打开系统浏览器，当前自动化不接管外部浏览器；本用例已校验预览页与历史详情字段');
    }),
  },
  {
    id: 'EXT-KASPA-003',
    name: 'SILVER 最大值发送',
    fn: async (page) => runCase(page, 'EXT-KASPA-003', 'SILVER 最大值发送', async (t) => {
      let direction;
      let submittedMaxAmount = null;
      let submitted = null;
      await safeStep(page, t, '准备 SILVER 转账方向', async () => {
        direction = await prepareKaspaTransferDirection(page, 'SILVER', MIN_BALANCE.SILVER_MAX);
        return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      if (!direction?.recipientAddress) throw new Error('准备 SILVER 转账方向失败：未获取 recipientAddress');
      await safeStep(page, t, '打开 SILVER 发送并点最大', async () => {
        await selectToken(page, 'SILVER');
        await enterRecipientAndNext(page, direction.recipientAddress);
        await page.locator('[data-testid="send-max-button"]').first().click();
        await sleep(500);
        const maxAmount = await assertTransferFormAmount(page, null, '点击最大值');
        return `max=${maxAmount} sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览并确认', async () => {
        const maxAmount = await readAmountInputValue(page);
        submittedMaxAmount = maxAmount;
        submitted = await submitTransfer(page, 'SILVER', maxAmount, direction, { fullAmount: true });
        return `submitted ${submitted}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '校验 SILVER 历史记录字段', async () => {
        if (!submittedMaxAmount) throw new Error('SILVER 最大值发送金额未记录，无法校验历史金额');
        const { fields } = await verifyHistoryRecord(page, 'SILVER', {
          expectedFields: ['token', 'type', 'status', 'hash', 'fee', 'amount', 'network', 'fromTo', 'time'],
          expectedAmount: submitted?.totalAmount || submittedMaxAmount,
          totalAmount: submitted?.totalAmount || submittedMaxAmount,
          historyAmountMode: submitted?.historyAmountMode || 'amountPlusFeeEquals',
          strictHistoryAmount: true,
          sentAmount: submittedMaxAmount,
          feeAmount: submitted?.feeAmount,
          expectedNetwork: 'Kaspa',
        });
        return `fields=${fields.join(',')}; amount=${submittedMaxAmount}`;
      }, SCREENSHOT_DIR);
      t.skip('区块浏览器对账', '插件端区块浏览器跳转会打开系统浏览器，当前自动化不接管外部浏览器；本用例已校验预览页与历史详情字段');
    }),
  },
  {
    id: 'EXT-KASPA-004',
    name: 'KAS 金额=0 拦截',
    fn: async (page) => runCase(page, 'EXT-KASPA-004', 'KAS 金额=0 拦截', async (t) => {
      let direction;
      await safeStep(page, t, '准备 KAS 转账方向', async () => {
        direction = await prepareKaspaTransferDirection(page, 'KAS', MIN_BALANCE.KAS_MAX);
        return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      if (!direction?.recipientAddress) throw new Error('准备 KAS 转账方向失败：未获取 recipientAddress');
      await safeStep(page, t, '打开 KAS 发送', async () => {
        await selectToken(page, 'KAS');
        await enterRecipientAndNext(page, direction.recipientAddress);
        return `opened sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '输入金额 0 并检查预览不可提交', async () => {
        return assertZeroAmountNotSubmittable(page);
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
    }),
  },
  {
    id: 'EXT-KASPA-005',
    name: 'KAS 金额=0.2 发送',
    fn: async (page) => runCase(page, 'EXT-KASPA-005', 'KAS 金额=0.2 发送', async (t) => {
      let direction;
      let submitted = null;
      await safeStep(page, t, '准备 KAS 转账方向', async () => {
        direction = await prepareKaspaTransferDirection(page, 'KAS', MIN_BALANCE.KAS_FIXED);
        return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      if (!direction?.recipientAddress) throw new Error('准备 KAS 转账方向失败：未获取 recipientAddress');
      await safeStep(page, t, '打开 KAS 发送并输入 0.2', async () => {
        await selectToken(page, 'KAS');
        await enterRecipientAndNext(page, direction.recipientAddress);
        const actualAmount = await enterAmount(page, '0.2');
        await assertTransferFormAmount(page, '0.2', '输入 0.2');
        return `amount=${actualAmount} sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览并确认', async () => {
        submitted = await submitTransfer(page, 'KAS', '0.2', direction);
        return `submitted ${submitted}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '校验 KAS 历史记录字段', async () => {
        const { fields } = await verifyHistoryRecord(page, 'KAS', {
          expectedFields: ['token', 'type', 'status', 'hash', 'fee', 'amount', 'network', 'fromTo', 'time'],
          expectedAmount: '0.2',
          historyAmount: submitted?.historyAmount,
          strictHistoryAmount: true,
          sentAmount: '0.2',
          feeAmount: submitted?.feeAmount,
          expectedNetwork: 'Kaspa',
        });
        return `fields=${fields.join(',')}`;
      }, SCREENSHOT_DIR);
      t.skip('区块浏览器对账', '插件端区块浏览器跳转会打开系统浏览器，当前自动化不接管外部浏览器；本用例已校验预览页与历史详情字段');
    }),
  },
  {
    id: 'EXT-KASPA-006',
    name: 'KAS 最大值发送',
    fn: async (page) => runCase(page, 'EXT-KASPA-006', 'KAS 最大值发送', async (t) => {
      let direction;
      let submittedMaxAmount = null;
      let submitted = null;
      await safeStep(page, t, '准备 KAS 转账方向', async () => {
        direction = await prepareKaspaTransferDirection(page, 'KAS', MIN_BALANCE.KAS_MAX);
        return `sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      if (!direction?.recipientAddress) throw new Error('准备 KAS 转账方向失败：未获取 recipientAddress');
      await safeStep(page, t, '打开 KAS 发送并点最大', async () => {
        await selectToken(page, 'KAS');
        await enterRecipientAndNext(page, direction.recipientAddress);
        await page.locator('[data-testid="send-max-button"]').first().click();
        await sleep(500);
        const maxAmount = await assertTransferFormAmount(page, null, '点击最大值');
        return `max=${maxAmount} sender=${direction.sender.accountName} receiver=${direction.receiver.accountName}${direction.flipped ? ' flipped' : ''}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览并确认', async () => {
        const maxAmount = await readAmountInputValue(page);
        submittedMaxAmount = maxAmount;
        submitted = await submitTransfer(page, 'KAS', maxAmount, direction, { fullAmount: true });
        return `submitted ${submitted}`;
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '校验 KAS 历史记录字段', async () => {
        if (!submittedMaxAmount) throw new Error('KAS 最大值发送金额未记录，无法校验历史金额');
        const { fields } = await verifyHistoryRecord(page, 'KAS', {
          expectedFields: ['token', 'type', 'status', 'hash', 'fee', 'amount', 'network', 'fromTo', 'time'],
          expectedAmount: submitted?.totalAmount || submittedMaxAmount,
          totalAmount: submitted?.totalAmount || submittedMaxAmount,
          historyAmountMode: submitted?.historyAmountMode || 'amountPlusFeeEquals',
          strictHistoryAmount: true,
          sentAmount: submittedMaxAmount,
          feeAmount: submitted?.feeAmount,
          expectedNetwork: 'Kaspa',
        });
        return `fields=${fields.join(',')}; amount=${submittedMaxAmount}`;
      }, SCREENSHOT_DIR);
      t.skip('区块浏览器对账', '插件端区块浏览器跳转会打开系统浏览器，当前自动化不接管外部浏览器；本用例已校验预览页与历史详情字段');
    }),
  },
];

export async function setup(page) {
  await dismissOverlays(page);
  await unlockWalletIfNeeded(page);
  await goToWallet(page);
  await switchNetwork(page, 'Kaspa');
}

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('EXT-KASPA-'));
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
    }
    await sleep(800);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

const isMain = process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) run().catch(e => { console.error(e); process.exit(1); });
