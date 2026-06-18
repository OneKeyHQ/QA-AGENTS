import { sleep } from './constants.mjs';
import { dismissOverlays, unlockWalletIfNeeded } from './navigation.mjs';
import { closeAllModals, switchToAccount } from './components.mjs';
import { switchNetwork } from './network.mjs';
import { getExtensionId } from './extension-cdp.mjs';
import { loadAccounts } from './runtime-config.mjs';

function normalizeText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export async function readExtensionTokenBalanceState(page, {
  token,
  exactTestId,
  tokenRowPrefix,
} = {}) {
  if (!token) throw new Error('readExtensionTokenBalanceState requires token');

  return page.evaluate((args) => {
    const { targetToken, exactTestId: exactId, tokenRowPrefix: prefix } = args;
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const uniq = (items) => {
      const seen = new Set();
      return items.filter((item) => {
        if (!item || seen.has(item)) return false;
        seen.add(item);
        return true;
      });
    };

    const tokenNeedle = String(targetToken || '').toLowerCase();
    const exactRows = exactId ? Array.from(document.querySelectorAll(`[data-testid="${exactId}"]`)) : [];
    const prefixRows = prefix
      ? Array.from(document.querySelectorAll(`[data-testid^="${prefix}"]`))
        .filter((row) => {
          const testid = String(row.getAttribute('data-testid') || '').toLowerCase();
          const text = normalize(row.textContent || '').toLowerCase();
          return testid.includes(tokenNeedle) || text.includes(tokenNeedle);
        })
      : [];
    const rows = uniq([...exactRows, ...prefixRows]).filter(isVisible);
    const row = rows[0];
    if (!row) {
      return { found: false, loaded: false, balance: 0, raw: '', text: '', testid: '', reason: 'row-not-found' };
    }

    const text = normalize(row.innerText || row.textContent || '');
    const beforeFiat = text.split(/[$¥￥€£]/)[0] || text;
    const matches = Array.from(beforeFiat.matchAll(/([0-9][0-9,]*(?:\.[0-9]+)?)/g)).map((m) => m[1]);
    const raw = matches[matches.length - 1] || '';
    const balance = raw ? Number(raw.replace(/,/g, '')) : 0;
    const loaded = !!raw && Number.isFinite(balance);

    return {
      found: true,
      loaded,
      balance: loaded ? balance : 0,
      raw,
      text,
      testid: row.getAttribute('data-testid') || '',
      reason: loaded ? '' : 'balance-not-rendered',
    };
  }, { targetToken: token, exactTestId, tokenRowPrefix });
}

export async function waitForExtensionTokenBalance(page, {
  token,
  exactTestId,
  tokenRowPrefix,
  label = token,
  timeoutMs = 25_000,
  intervalMs = 500,
} = {}) {
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;
  let last = null;

  while (Date.now() < deadline) {
    last = await readExtensionTokenBalanceState(page, { token, exactTestId, tokenRowPrefix });
    if (last.found && last.loaded) return last;
    await sleep(intervalMs);
  }

  if (!last?.found) {
    throw new Error(`未找到 ${label} 余额行 | debug=${JSON.stringify(last || {})}`);
  }
  throw new Error(`等待 ${label} 余额加载完成超时: ${last.reason || 'unknown'} | text=${last.text || '-'} | testid=${last.testid || '-'}`);
}

async function cleanExtensionSurface(page) {
  await closeAllModals(page).catch(() => {});
  await dismissOverlays(page).catch(() => {});
}

export async function goToExtensionWalletHome(page, { settleMs = 1500 } = {}) {
  const clicked = await page.evaluate(() => {
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (sidebar) {
      for (const sp of sidebar.querySelectorAll('span, div')) {
        const txt = sp.textContent?.trim() || '';
        if ((txt === '钱包' || txt === 'Wallet') && isVisible(sp)) {
          sp.click();
          return true;
        }
      }
    }

    const fallback = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Solid"]');
    if (fallback && isVisible(fallback)) {
      fallback.click();
      return true;
    }
    return false;
  });

  if (!clicked) {
    const extId = getExtensionId();
    await page.goto(`chrome-extension://${extId}/ui-expand-tab.html#/main/TabHome`).catch(() => {});
  }
  await sleep(settleMs);
}

export async function ensureExtensionPortfolioTab(page, {
  tokenRowPrefix,
  label = '插件端',
  attempts = 12,
  intervalMs = 400,
} = {}) {
  if (!tokenRowPrefix) throw new Error('ensureExtensionPortfolioTab requires tokenRowPrefix');

  let last = null;
  for (let i = 0; i < attempts; i++) {
    last = await page.evaluate((prefix) => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const isVisible = (el) => {
        const r = el.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };

      const portfolioTab = document.querySelector('[data-testid="home-tab-portfolio"]');
      const historyTab = document.querySelector('[data-testid="home-tab-history"]');
      const portfolioVisible = !!portfolioTab && isVisible(portfolioTab);
      if (portfolioVisible) portfolioTab.click();

      const rows = Array.from(document.querySelectorAll('[data-testid]'))
        .filter((row) => (row.getAttribute('data-testid') || '').startsWith(prefix))
        .filter(isVisible)
        .map((row) => ({
          testid: row.getAttribute('data-testid') || '',
          text: normalize(row.textContent || '').slice(0, 120),
        }))
        .slice(0, 8);

      return {
        portfolioVisible,
        historyVisible: !!historyTab && isVisible(historyTab),
        rows,
      };
    }, tokenRowPrefix);

    if (last?.rows?.length > 0) {
      const assets = last.rows.map((row) => row.testid.replace(/^home-token-item-/, '')).join(',');
      return `portfolio ready; assets=${assets}`;
    }
    await sleep(intervalMs);
  }

  throw new Error(`未切回 ${label} 现货资产列表 | debug=${JSON.stringify(last || {})}`);
}

async function readOutgoingHistoryState(page) {
  return page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };

    const historyTab = document.querySelector('[data-testid="home-tab-history"]');
    const historyVisible = !!historyTab && isVisible(historyTab);
    if (historyVisible) historyTab.click();

    const sendWords = ['发送', '發送', 'Send', 'Sent'];
    const pendingWords = [
      '发送中', '發送中', '提交中', '廣播中', '广播中',
      '处理中', '處理中', '待处理', '待處理',
      '确认中', '確認中', '待确认', '待確認',
      'Pending', 'Confirming', 'Processing', 'Submitting',
      'Sending', 'Broadcasting', 'Submitted',
    ];

    const rows = Array.from(document.querySelectorAll('[data-testid="tx-action-common-list-view"]'))
      .filter(isVisible)
      .map((row) => normalize(row.innerText || row.textContent || ''))
      .filter(Boolean);
    const sendRows = rows.filter((text) => sendWords.some((word) => text.includes(word)));
    const pendingRows = sendRows.filter((text) => pendingWords.some((word) => text.includes(word)));

    return {
      historyVisible,
      rows: rows.slice(0, 8),
      sendRows: sendRows.slice(0, 8),
      pendingRows: pendingRows.slice(0, 5),
      rowCount: rows.length,
      sendCount: sendRows.length,
      pendingCount: pendingRows.length,
    };
  });
}

export async function waitForExtensionOutgoingHistoryIdle(page, {
  tokenRowPrefix,
  label = '插件端',
  timeoutMs = 180_000,
  intervalMs = 5_000,
  minHistoryWaitMs = 15_000,
  stablePolls = 2,
} = {}) {
  if (!tokenRowPrefix) throw new Error('waitForExtensionOutgoingHistoryIdle requires tokenRowPrefix');

  const startedAt = Date.now();
  const deadline = Date.now() + timeoutMs;
  let last = null;
  let stableIdle = 0;

  while (Date.now() < deadline) {
    last = await readOutgoingHistoryState(page);
    const historyReady = last.rowCount > 0 || Date.now() - startedAt >= minHistoryWaitMs;
    const idle = last.historyVisible && historyReady && last.pendingCount === 0;
    stableIdle = idle ? stableIdle + 1 : 0;
    if (stableIdle >= stablePolls) {
      const portfolio = await ensureExtensionPortfolioTab(page, { tokenRowPrefix, label });
      return `history idle; sendRows=${last.sendCount}; rows=${last.rowCount}; ${portfolio}`;
    }
    await sleep(intervalMs);
  }

  throw new Error(
    `等待历史发送记录完成超时: pending=${last?.pendingCount ?? 'unknown'} ` +
    `sendRows=${last?.sendCount ?? 'unknown'} rows=${last?.rowCount ?? 'unknown'} ` +
    `latest=${JSON.stringify(last?.pendingRows?.[0] || last?.rows?.[0] || '')}`,
  );
}

async function readExtensionTransferPreviewShell(page, {
  previewButtonTexts = ['预览', 'Preview'],
  confirmButtonTexts = ['确认', 'Confirm'],
} = {}) {
  return page.evaluate((args) => {
    const { previewTexts, confirmTexts } = args;
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const includesAny = (value, words) => words.some((word) => normalize(value).includes(word));
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const isDisabledLike = (el) => {
      if (!el) return true;
      const style = window.getComputedStyle(el);
      const opacity = Number.parseFloat(style.opacity || '1');
      const className = String(el.getAttribute('class') || '').toLowerCase();
      const ariaBusy = el.getAttribute('aria-busy') === 'true';
      return el.hasAttribute('disabled')
        || el.getAttribute('aria-disabled') === 'true'
        || ariaBusy
        || style.pointerEvents === 'none'
        || Number.isFinite(opacity) && opacity > 0 && opacity < 0.65
        || /\b(disabled|loading|is-loading)\b/.test(className);
    };

    const root = document.querySelector('[data-testid="APP-Modal-Screen"]') || document.body;
    const body = normalize(root?.textContent || document.body?.textContent || '');
    const feeTrigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
    const feeTriggerVisible = !!feeTrigger && isVisible(feeTrigger);
    const footerButtons = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="signature-confirm-btn"], button, [role="button"]'))
      .filter(isVisible)
      .map((btn) => {
        const r = btn.getBoundingClientRect();
        const text = normalize(btn.textContent || btn.getAttribute('aria-label') || '');
        const testid = btn.getAttribute('data-testid') || '';
        const disabled = isDisabledLike(btn);
        const hasSpinner = !!btn.querySelector('[class*="spinner" i], [class*="loading" i], [aria-busy="true"]');
        return {
          text,
          testid,
          disabled,
          hasSpinner,
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        };
      });
    const confirmButtons = footerButtons.filter((btn) => includesAny(btn.text, confirmTexts)
      || btn.testid === 'signature-confirm-btn');
    const previewButtons = footerButtons.filter((btn) => includesAny(btn.text, previewTexts));
    const readyConfirm = confirmButtons.find((btn) => !btn.disabled && !btn.hasSpinner) || null;
    const busyConfirm = confirmButtons.find((btn) => btn.disabled || btn.hasSpinner) || null;
    const hasFeePreview = body.includes('预估网络费用')
      || body.includes('网络费用')
      || body.includes('Fee')
      || feeTriggerVisible;

    return {
      hasConfirm: confirmButtons.length > 0,
      hasReadyConfirm: !!readyConfirm,
      hasBusyConfirm: !!busyConfirm,
      hasPreview: previewButtons.length > 0,
      hasFeePreview,
      footerButtons: footerButtons.slice(0, 10),
      confirmButtons: confirmButtons.slice(0, 5),
      previewButtons: previewButtons.slice(0, 5),
      body: body.slice(0, 800),
    };
  }, { previewTexts: previewButtonTexts, confirmTexts: confirmButtonTexts });
}

export async function readExtensionFloatingNotifications(page) {
  return page.evaluate(() => {
    const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
    const isVisible = (el) => {
      const r = el?.getBoundingClientRect?.();
      if (!r || r.width <= 0 || r.height <= 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    };
    const isModal = (el) => !!el.closest?.('[data-testid="APP-Modal-Screen"], [role="dialog"]');
    const viewportW = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    const selector = [
      '[role="alert"]',
      '[role="status"]',
      '[aria-live]',
      '[data-testid*="toast" i]',
      '[data-testid*="notification" i]',
      '[data-testid*="snackbar" i]',
      '[class*="toast" i]',
      '[class*="notification" i]',
      '[class*="snackbar" i]',
      'div',
      'section',
    ].join(',');

    const candidates = [];
    const seen = new Set();
    for (const el of document.querySelectorAll(selector)) {
      if (seen.has(el) || !isVisible(el) || isModal(el)) continue;
      seen.add(el);

      const text = normalize(el.innerText || el.textContent || '');
      if (text.length < 2 || text.length > 500) continue;

      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      const zIndex = Number.parseInt(style.zIndex || '0', 10);
      const testid = el.getAttribute('data-testid') || '';
      const className = String(el.getAttribute('class') || '');
      const role = el.getAttribute('role') || '';
      const ariaLive = el.getAttribute('aria-live') || '';
      if (/^(gridcell|row|table|list|listitem|menuitem)$/i.test(role)) continue;
      const fixedLike = ['fixed', 'sticky'].includes(style.position);
      const highLayer = Number.isFinite(zIndex) && zIndex >= 10;
      const edgeOverlay = r.right > viewportW * 0.55 && r.bottom > viewportH * 0.45;
      const alertLike = /^(alert|status)$/i.test(role) || !!ariaLive || /toast|notification|snackbar|message|notice|alert/i.test(`${testid} ${className}`);
      const hasControls = el.querySelectorAll('button, [role="button"], [aria-label], svg').length > 0;
      const plausibleSize = r.width >= 180 && r.height >= 32 && r.width <= Math.max(900, viewportW) && r.height <= Math.max(320, viewportH * 0.55);
      const edgeToastLike = edgeOverlay && hasControls && r.width <= 760 && r.height <= 280;
      const layeredToastLike = (fixedLike || highLayer) && r.width <= 760 && r.height <= 280;
      if (!plausibleSize) continue;
      if (!alertLike && !edgeToastLike && !layeredToastLike) continue;

      const signature = `${text}|${Math.round(r.x)}|${Math.round(r.y)}|${Math.round(r.width)}|${Math.round(r.height)}`;
      const score = (alertLike ? 100 : 0)
        + (layeredToastLike ? 60 : 0)
        + (edgeOverlay ? 40 : 0)
        + (hasControls ? 15 : 0)
        - Math.min(40, Math.floor(text.length / 20));
      candidates.push({
        text,
        signature,
        role,
        testid,
        fixedLike,
        edgeOverlay,
        hasControls,
        score,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      });
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.rect.w * a.rect.h) - (b.rect.w * b.rect.h);
    });
    return candidates.slice(0, 8);
  });
}

async function readExtensionSubmitState(page, {
  confirmButtonTexts = ['确认', 'Confirm'],
} = {}) {
  const [state, notifications] = await Promise.all([
    page.evaluate((confirmTexts) => {
      const normalize = (str) => (str || '').replace(/\s+/g, ' ').trim();
      const includesAny = (value, words) => words.some((word) => normalize(value).includes(word));
      const isVisible = (el) => {
        const r = el?.getBoundingClientRect?.();
        if (!r || r.width <= 0 || r.height <= 0) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      };
      const isDisabledLike = (el) => {
        if (!el) return true;
        const style = window.getComputedStyle(el);
        const opacity = Number.parseFloat(style.opacity || '1');
        const className = String(el.getAttribute('class') || '').toLowerCase();
        return el.hasAttribute('disabled')
          || el.getAttribute('aria-disabled') === 'true'
          || el.getAttribute('aria-busy') === 'true'
          || style.pointerEvents === 'none'
          || Number.isFinite(opacity) && opacity > 0 && opacity < 0.65
          || /\b(disabled|loading|is-loading)\b/.test(className);
      };

      const body = normalize(document.body?.textContent || '');
      const modalTexts = Array.from(document.querySelectorAll('[data-testid="APP-Modal-Screen"], [role="dialog"]'))
        .filter(isVisible)
        .map((el) => normalize(el.innerText || el.textContent || ''));
      const footerButtons = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="signature-confirm-btn"], button, [role="button"]'))
        .filter(isVisible)
        .map((btn) => {
          const r = btn.getBoundingClientRect();
          const text = normalize(btn.innerText || btn.textContent || btn.getAttribute('aria-label') || '');
          const testid = btn.getAttribute('data-testid') || '';
          const disabled = isDisabledLike(btn);
          const hasSpinner = !!btn.querySelector('[class*="spinner" i], [class*="loading" i], [aria-busy="true"]');
          return {
            text,
            testid,
            disabled,
            hasSpinner,
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          };
        });
      const confirmButtons = footerButtons.filter((btn) => includesAny(btn.text, confirmTexts)
        || btn.testid === 'signature-confirm-btn');
      const readyConfirm = confirmButtons.find((btn) => !btn.disabled && !btn.hasSpinner) || null;
      const busyConfirm = confirmButtons.find((btn) => btn.disabled || btn.hasSpinner) || null;
      const doneText = [
        '发送成功', '交易已提交', '交易完成', '发送完成',
        'Transaction submitted', 'Transaction completed', 'Send success', 'Sent successfully',
      ].some((word) => body.includes(word));
      const submittingText = [
        '发送中', '提交中', '广播中', '处理中',
        'Submitting', 'Sending', 'Broadcasting', 'Processing',
      ].some((word) => body.includes(word));
      const previewOpen = modalTexts.some((txt) => {
        const hasPreviewFee = txt.includes('预估网络费用') || txt.includes('网络费用') || txt.includes('Fee');
        const hasPreviewFields = txt.includes('资产') && (txt.includes('至') || txt.includes('To')) && (txt.includes('确认') || txt.includes('Confirm'));
        const hasInputPage = txt.includes('输入金额') && (txt.includes('预览') || txt.includes('Preview'));
        return hasPreviewFee || hasPreviewFields || hasInputPage;
      });

      return {
        doneText,
        submittingText,
        previewOpen,
        anyBlockingModal: modalTexts.length > 0,
        hasReadyConfirm: !!readyConfirm,
        hasBusyConfirm: !!busyConfirm,
        readyConfirm,
        busyConfirm,
        modalTexts: modalTexts.map((txt) => txt.slice(0, 300)),
        body: body.slice(0, 500),
      };
    }, confirmButtonTexts),
    readExtensionFloatingNotifications(page),
  ]);
  return { ...state, notifications };
}

export async function waitForExtensionTransferSubmitResult(page, {
  token,
  baselineNotifications = [],
  handlePasswordPrompt,
  clickFinalAction,
  confirmButtonTexts = ['确认', 'Confirm'],
  submitAttempted = false,
  timeoutMs = 90_000,
  intervalMs = 250,
} = {}) {
  const actions = [];
  const startedAt = Date.now();
  const baseline = new Set((baselineNotifications || []).map((item) => item.signature || item.text).filter(Boolean));
  let attemptedSubmit = !!submitAttempted;
  let seenBusyConfirm = false;
  let lastState = null;
  let lastRetryClickAt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    lastState = await readExtensionSubmitState(page, { confirmButtonTexts });
    if (lastState.hasBusyConfirm || lastState.submittingText) seenBusyConfirm = true;

    const newNotification = (lastState.notifications || [])
      .find((item) => !baseline.has(item.signature) && !baseline.has(item.text));
    if (seenBusyConfirm && lastState.previewOpen && lastState.hasReadyConfirm && newNotification) {
      throw new Error(
        `提交后出现失败提示: ${newNotification.text || '<empty>'} | ` +
        `token=${token || '-'} busySeen=${seenBusyConfirm ? 'true' : 'false'} submitAttempted=${attemptedSubmit ? 'true' : 'false'} buttonReady=true rect=${JSON.stringify(newNotification.rect || {})}`,
      );
    }

    if (typeof handlePasswordPrompt === 'function') {
      const pwdResult = await handlePasswordPrompt(page).catch(() => ({ handled: false }));
      if (pwdResult?.handled) actions.push(`password:${pwdResult.type || 'handled'}`);
    }

    if (lastState.doneText || (!lastState.previewOpen && !lastState.anyBlockingModal && Date.now() > startedAt + intervalMs)) {
      return { done: true, actions, state: lastState, busySeen: seenBusyConfirm };
    }

    if (
      typeof clickFinalAction === 'function'
      && !seenBusyConfirm
      && lastState.previewOpen
      && lastState.hasReadyConfirm
      && Date.now() - startedAt > 3_000
      && Date.now() - lastRetryClickAt > 2_500
    ) {
      const clicked = await clickFinalAction(page).catch(() => null);
      if (clicked) {
        actions.push(clicked);
        attemptedSubmit = true;
        lastRetryClickAt = Date.now();
      }
    }

    await sleep(lastState.submittingText || lastState.hasBusyConfirm ? Math.max(intervalMs, 700) : intervalMs);
  }

  throw new Error(
    `提交后预览发送页未自动关闭: ${token || '-'} | actions=${actions.join('>')} ` +
    `busySeen=${seenBusyConfirm ? 'true' : 'false'} submitAttempted=${attemptedSubmit ? 'true' : 'false'} | state=${JSON.stringify(lastState || {})}`,
  );
}

export async function waitForExtensionTransferPreviewReady(page, {
  token,
  amount,
  direction = {},
  fullAmount = false,
  readPreviewFields,
  clickPreview,
  previewButtonTexts = ['预览', 'Preview'],
  confirmButtonTexts = ['确认', 'Confirm'],
  timeoutMs = 30_000,
  intervalMs = 700,
} = {}) {
  if (typeof readPreviewFields !== 'function') {
    throw new Error('waitForExtensionTransferPreviewReady requires readPreviewFields');
  }

  const deadline = Date.now() + timeoutMs;
  let lastShell = null;
  let lastError = null;
  let lastPreviewClickAt = 0;

  while (Date.now() < deadline) {
    lastShell = await readExtensionTransferPreviewShell(page, {
      previewButtonTexts,
      confirmButtonTexts,
    });

    if (lastShell.hasReadyConfirm && lastShell.hasFeePreview) {
      try {
        return await readPreviewFields(page, token, fullAmount ? null : amount, direction, { fullAmount });
      } catch (error) {
        lastError = error;
      }
    }

    if (lastShell.hasPreview && !lastShell.hasConfirm && typeof clickPreview === 'function' && Date.now() - lastPreviewClickAt > 2_000) {
      await clickPreview();
      lastPreviewClickAt = Date.now();
    }

    await sleep(intervalMs);
  }

  const detail = [
    `token=${token || '-'}`,
    `amount=${amount || '-'}`,
    `fullAmount=${!!fullAmount}`,
    `shell=${JSON.stringify(lastShell || {})}`,
    `lastError=${normalizeText(lastError?.message || lastError || '').slice(0, 1200)}`,
  ].join('; ');
  throw new Error(`预览确认页未渲染完成: ${detail}`);
}

export async function prepareExtensionTransferCaseState(page, {
  network,
  tokenRowPrefix,
  portfolioLabel = network,
  resetAccount,
} = {}) {
  if (!network) throw new Error('prepareExtensionTransferCaseState requires network');

  await page.bringToFront().catch(() => {});

  await cleanExtensionSurface(page);
  await goToExtensionWalletHome(page);
  await unlockWalletIfNeeded(page);

  await cleanExtensionSurface(page);

  const accounts = loadAccounts();
  const accountName = resetAccount || accounts.primary?.accountName || accounts.secondary?.accountName || '';
  if (accountName) {
    await switchToAccount(page, accountName);
    await dismissOverlays(page).catch(() => {});
  }

  await switchNetwork(page, network);
  await cleanExtensionSurface(page);
  await goToExtensionWalletHome(page);

  const portfolio = await ensureExtensionPortfolioTab(page, {
    tokenRowPrefix,
    label: portfolioLabel,
  });

  return accountName
    ? `wallet ready; account reset=${accountName}; network=${network}; ${portfolio}`
    : `wallet ready; network=${network}; ${portfolio}`;
}
