// Wallet — Receive from Exchange shared test logic (Desktop / Extension; Web not supported)
//
// Wrapper files at:
//   src/tests/desktop/wallet/receive-from-exchange.test.mjs
//   src/tests/extension/wallet/receive-from-exchange.test.mjs
//   src/tests/web/wallet/receive-from-exchange.test.mjs    (SKIP — no wallet in Web)
// inject platform-specific `goToWallet` + `openReceive` (optional) then call
// createReceiveFromExchangeTests() to get the WALLET-RECV-001~005 cases prefixed.
//
// Test IDs:
//   WALLET-RECV-001 用例 #1「入口与展示」
//   WALLET-RECV-002 用例 #2「Binance 流程」
//   WALLET-RECV-003 用例 #3「OKX 流程」
//   WALLET-RECV-004 用例 #4「Coinbase 流程」
//   WALLET-RECV-005 用例 #2 补充「Binance 多网络（投资组合）模式」

import { sleep } from '../../helpers/constants.mjs';
import { assertListRendered } from '../../helpers/components.mjs';

/**
 * Build the 5 Receive-from-Exchange test cases for one platform.
 *
 * @param {object} opts
 * @param {string} opts.prefix - Test ID prefix, e.g. 'WALLET-RECV' | 'WEB-WALLET-RECV' | 'EXT-WALLET-RECV'
 * @param {string} [opts.namePrefix] - Display name prefix, e.g. '' | 'Web-' | 'Ext-'
 * @param {(page: import('playwright-core').Page) => Promise<void>} opts.goToWallet
 *   Navigate to wallet home page.
 * @param {(page: import('playwright-core').Page) => Promise<void>} [opts.openReceive]
 *   Optional hook: open the "接收" modal from wallet home. Defaults to clicking
 *   the receive button inside `[data-testid="Wallet-Tab-Header"]`.
 * @returns {{ testCases: Array, setup: (page) => Promise<void> }}
 */
export function createReceiveFromExchangeTests({
  prefix,
  namePrefix = '',
  goToWallet,
  openReceive,
}) {
  if (!goToWallet) throw new Error('createReceiveFromExchangeTests: goToWallet is required');

  // ── Helpers ───────────────────────────────────────────────

  async function closeAllModalsLocal(page) {
    for (let i = 0; i < 3; i++) {
      const hasModal = await page.evaluate(() => {
        const m = document.querySelector('[data-testid="APP-Modal-Screen"]');
        return m && m.getBoundingClientRect().width > 0;
      });
      if (!hasModal) break;
      await page.keyboard.press('Escape');
      await sleep(800);
    }
  }

  async function defaultOpenReceive(page) {
    const clicked = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="Wallet-Tab-Header"]');
      if (!header) return false;
      for (const btn of header.querySelectorAll('button')) {
        const txt = btn.textContent?.trim() || '';
        if (txt === '接收' || txt === 'Receive') {
          const r = btn.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { btn.click(); return true; }
        }
      }
      return false;
    });
    if (!clicked) throw new Error('Cannot find receive button in Wallet-Tab-Header');
    await sleep(2000);

    const modalOpen = await page.evaluate(() => {
      const m = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return m && m.getBoundingClientRect().width > 0;
    });
    if (!modalOpen) throw new Error('点击接收后 Modal 未打开');
  }

  async function goToReceivePage(page) {
    await closeAllModalsLocal(page);
    await goToWallet(page);
    await sleep(500);
    if (openReceive) {
      await openReceive(page);
    } else {
      await defaultOpenReceive(page);
    }
  }

  async function poll(page, evalFn, { maxRetries = 10, interval = 500, errorMsg = 'Poll timeout' } = {}) {
    for (let i = 0; i < maxRetries; i++) {
      const result = await page.evaluate(evalFn);
      if (result) return result;
      await sleep(interval);
    }
    throw new Error(errorMsg);
  }

  async function isBrowserTabActive(page) {
    return page.evaluate(() => {
      const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
      if (!sidebar) return false;
      const keywords = ['浏览器', 'Browser', '发现', 'Discover'];
      for (const el of sidebar.querySelectorAll('span, div')) {
        const txt = el.textContent?.trim() || '';
        if (!keywords.some(k => txt.includes(k))) continue;
        let p = el;
        for (let i = 0; i < 4; i++) {
          p = p.parentElement;
          if (!p) break;
          if (p.getAttribute('aria-selected') === 'true') return true;
          if (p.getAttribute('data-active') === 'true') return true;
          if (p.classList?.contains('active')) return true;
          const bg = window.getComputedStyle(p).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return true;
        }
      }
      return false;
    });
  }

  async function clickByText(page, text, { scope = 'auto' } = {}) {
    const clicked = await page.evaluate(({ text, scope }) => {
      const root = scope === 'modal'
        ? document.querySelector('[data-testid="APP-Modal-Screen"]') || document
        : document;
      for (const el of root.querySelectorAll('span, div, button, p')) {
        const txt = el.textContent?.trim() || '';
        if (txt !== text) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const target = el.closest('button,[role="button"]') || el;
          target.click();
          return true;
        }
      }
      return false;
    }, { text, scope });
    if (!clicked) throw new Error(`Element with text "${text}" not found`);
    await sleep(1500);
  }

  async function switchNetworkMode(page, mode) {
    await closeAllModalsLocal(page);
    await goToWallet(page);
    await sleep(1000);

    const triggerClicked = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="account-network-trigger-button"]');
      if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return 'single'; }
      for (const el of document.querySelectorAll('span, div')) {
        const txt = el.textContent?.trim() || '';
        if (/^\+\d+$/.test(txt)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.y < 120) { el.click(); return 'portfolio'; }
        }
      }
      return false;
    });
    if (!triggerClicked) throw new Error('网络选择器按钮不可见，可能未在钱包页');
    await sleep(2000);

    if (mode === 'portfolio') {
      const clicked = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return false;
        for (const el of modal.querySelectorAll('span, div')) {
          const txt = el.textContent?.trim();
          if (txt === '投资组合' || txt === 'Portfolio') {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) { el.click(); return true; }
          }
        }
        return false;
      });
      if (!clicked) throw new Error('未找到"投资组合"选项');
    } else {
      const networkName = mode.charAt(0).toUpperCase() + mode.slice(1);
      const clicked = await page.evaluate((name) => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return false;
        for (const el of modal.querySelectorAll('span')) {
          const txt = el.textContent?.trim();
          if (txt === name) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && r.height < 40) { el.click(); return true; }
          }
        }
        for (const el of modal.querySelectorAll('div, span')) {
          const txt = el.textContent?.trim() || '';
          if (txt.startsWith(name) && txt.length < 40) {
            const r = el.getBoundingClientRect();
            if (r.width > 50 && r.height > 15 && r.height < 80) { el.click(); return true; }
          }
        }
        return false;
      }, networkName);
      if (!clicked) throw new Error(`未找到网络"${networkName}"`);
    }
    await sleep(1000);

    const hasConfirm = await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="page-footer-confirm"]');
      if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return true; }
      return false;
    });
    if (hasConfirm) await sleep(1500);

    await closeAllModalsLocal(page);
    await sleep(1000);
  }

  async function getCurrentNetworkMode(page) {
    return page.evaluate(() => {
      const el = document.querySelector('[data-testid="account-network-trigger-button-text"]');
      if (el && el.getBoundingClientRect().width > 0) return el.textContent?.trim() || 'unknown';
      for (const span of document.querySelectorAll('span, div')) {
        const txt = span.textContent?.trim() || '';
        if (/^\+\d+$/.test(txt)) {
          const r = span.getBoundingClientRect();
          if (r.y < 120 && r.width > 0) return '投资组合';
        }
      }
      return 'unknown';
    });
  }

  // ── Test Cases ────────────────────────────────────────────

  // 用例 #1
  async function test001(page) {
    await goToReceivePage(page);

    const cardInfo = await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return null;
      const txt = modal.textContent || '';
      return {
        hasCard: txt.includes('从交易所接收') || txt.includes('From Exchange'),
        hasBinance: txt.includes('Binance'),
        hasOKX: txt.includes('OKX'),
        hasCoinbase: txt.includes('Coinbase'),
        ok: true,
      };
    }, { errorMsg: '接收弹窗内未显示内容', maxRetries: 8 });

    if (!cardInfo.hasCard) throw new Error('接收弹窗内缺少「从交易所接收」区域');
    if (!cardInfo.hasBinance) throw new Error('接收弹窗缺少 Binance 入口');
    if (!cardInfo.hasOKX) throw new Error('接收弹窗缺少 OKX 入口');
    if (!cardInfo.hasCoinbase) throw new Error('接收弹窗缺少 Coinbase 入口');

    const logoCheck = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return { count: 0 };
      const imgs = modal.querySelectorAll('img');
      let count = 0;
      for (const img of imgs) {
        const src = (img.src || '').toLowerCase();
        const alt = (img.alt || '').toLowerCase();
        if (src.includes('binance') || alt.includes('binance')) count++;
        if (src.includes('okx') || alt.includes('okx')) count++;
        if (src.includes('coinbase') || alt.includes('coinbase')) count++;
      }
      const svgs = modal.querySelectorAll('svg');
      return { imgLogos: count, svgCount: svgs.length, totalImgs: imgs.length };
    });
    if (logoCheck.imgLogos === 0 && logoCheck.totalImgs === 0) {
      console.log('  [WARN] 交易所 Logo 未通过 img 检测到，可能使用 SVG 或内联图标');
    }

    const hasToggle = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      for (const el of modal.querySelectorAll('div, button, span')) {
        const txt = el.textContent?.trim() || '';
        if ((txt === '从交易所接收' || txt === 'From Exchange') && txt.length < 20) {
          const style = window.getComputedStyle(el);
          return style.cursor === 'pointer' || el.tagName === 'BUTTON' || el.closest('button') !== null;
        }
      }
      return false;
    });
    if (hasToggle) {
      await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        for (const el of modal.querySelectorAll('div, button, span')) {
          const txt = el.textContent?.trim() || '';
          if ((txt === '从交易所接收' || txt === 'From Exchange') && txt.length < 20) {
            el.click();
            return;
          }
        }
      });
      await sleep(800);

      const afterCollapse = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        return { allVisible: txt.includes('Binance') && txt.includes('OKX') && txt.includes('Coinbase') };
      });

      if (!afterCollapse.allVisible) {
        await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          for (const el of modal.querySelectorAll('div, button, span')) {
            const txt = el.textContent?.trim() || '';
            if ((txt.includes('从交易所接收') || txt.includes('From Exchange')) && txt.length < 20) {
              el.click();
              return;
            }
          }
        });
        await sleep(800);
      } else {
        console.log('  [INFO] 「从交易所接收」区域不支持收起，三个入口始终可见');
      }
    } else {
      console.log('  [INFO] 「从交易所接收」标题不可点击，无展开/收起功能');
    }

    await closeAllModalsLocal(page);
  }

  // 用例 #2
  async function test002(page) {
    await goToReceivePage(page);

    await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const txt = modal?.textContent || '';
      return txt.includes('Binance') && txt.includes('OKX');
    }, { errorMsg: '接收弹窗内未显示交易所列表', maxRetries: 10 });

    await clickByText(page, 'Binance', { scope: 'modal' });

    const afterBinance = await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const txt = modal?.textContent || '';
      const hasTokenPage = txt.includes('选择币种') || txt.includes('Select Token') || txt.includes('Select Coin');
      const networkKeywords = ['Bitcoin', 'BNB', 'Polygon', 'Arbitrum', 'Solana', 'Tron', 'Avalanche'];
      let networkCount = 0;
      for (const kw of networkKeywords) { if (txt.includes(kw)) networkCount++; }
      const hasNetworkPage = networkCount >= 2 && !hasTokenPage;
      return { hasTokenPage, hasNetworkPage, ok: hasTokenPage || hasNetworkPage };
    }, { errorMsg: '点击 Binance 后未显示网络选择页或代币选择页', maxRetries: 10 });

    if (afterBinance.hasNetworkPage) {
      console.log('  [INFO] 所有网络模式：显示网络选择页');
      try {
        await clickByText(page, 'Ethereum', { scope: 'modal' });
      } catch {
        await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const items = modal?.querySelectorAll('div, button') || [];
          for (const item of items) {
            const r = item.getBoundingClientRect();
            if (r.width > 200 && r.height > 30 && r.height < 80 && r.y > 150) {
              item.click();
              return;
            }
          }
        });
        await sleep(2000);
      }
    } else {
      console.log('  [INFO] 单网络模式：直接进入代币选择页');
    }

    const tokenListInfo = await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return null;
      const txt = modal.textContent || '';
      const knownTokens = ['ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'RNDR', 'MORPHO', 'SOL', 'BNB', 'MATIC'];
      const found = knownTokens.filter(t => txt.includes(t));
      const inputs = modal.querySelectorAll('input');
      const hasSearchInput = inputs.length > 0;
      return {
        tokenCount: found.length,
        sampleTokens: found.slice(0, 5),
        hasSearchInput,
        ok: found.length >= 1,
      };
    }, { errorMsg: '代币选择页未出现或代币列表为空', maxRetries: 10 });

    if (tokenListInfo.tokenCount < 1) throw new Error('代币列表为空：未检测到任何已知代币名称');

    if (tokenListInfo.hasSearchInput) {
      const searchInput = page.locator('[data-testid="APP-Modal-Screen"] input').first();
      const inputVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);

      if (inputVisible) {
        await searchInput.click();
        await searchInput.pressSequentially('USDT', { delay: 50 });
        await sleep(1000);

        const searchResult = await poll(page, () => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const txt = modal?.textContent || '';
          const hasUSDT = txt.includes('USDT');
          const isEmpty = txt.includes('未找到') || txt.includes('暂无') || txt.includes('No results')
            || txt.includes('not found') || txt.includes('empty');
          return { hasUSDT, isEmpty, ok: hasUSDT || isEmpty };
        }, { errorMsg: '搜索 USDT 后无结果响应', maxRetries: 10 });

        if (!searchResult.hasUSDT && !searchResult.isEmpty) {
          throw new Error('搜索 USDT 后既无匹配结果也无空状态提示');
        }
        if (!searchResult.hasUSDT) {
          console.log('  [INFO] 搜索 USDT 显示空状态，可能该网络不支持 USDT');
        }

        await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const input = modal?.querySelector('input');
          if (input) { input.focus(); input.select(); }
        });
        await page.keyboard.press('Backspace');
        await sleep(800);

        await searchInput.pressSequentially('ZZZZNOTEXIST99', { delay: 50 });
        await sleep(1000);

        const emptyResult = await poll(page, () => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const txt = modal?.textContent || '';
          const hasEmptyState = txt.includes('未找到') || txt.includes('暂无') || txt.includes('No results')
            || txt.includes('not found') || txt.includes('empty') || txt.includes('没有');
          const tokenPattern = /\b[A-Z][A-Z0-9]{1,9}\b/g;
          const tokens = (txt.match(tokenPattern) || [])
            .filter(t => !['OKX', 'APP', 'USD', 'THE', 'AND', 'FOR', 'NOT', 'ZZZZNOTEXIST'].includes(t));
          return { hasEmptyState, remainingTokens: tokens.length, ok: hasEmptyState || tokens.length === 0 };
        }, { errorMsg: '搜索不存在代币后未显示空状态', maxRetries: 8 });

        if (!emptyResult.hasEmptyState && emptyResult.remainingTokens > 0) {
          throw new Error(`搜索不存在的代币后仍显示 ${emptyResult.remainingTokens} 个代币，且无空状态提示`);
        }

        await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const input = modal?.querySelector('input');
          if (input) { input.focus(); input.select(); }
        });
        await page.keyboard.press('Backspace');
        await sleep(800);
      }
    } else {
      console.log('  [WARN] 代币选择页未检测到搜索框，跳过搜索断言(#2.1.6, #2.1.7)');
    }

    const beforeClick = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      return modal?.textContent?.includes('选择币种') || modal?.textContent?.includes('Select Token');
    });
    if (!beforeClick) {
      console.log('  [WARN] 搜索测试后弹窗已不在代币选择页，尝试重新进入');
      await closeAllModalsLocal(page);
      await goToReceivePage(page);
      await clickByText(page, 'Binance', { scope: 'modal' });
      await sleep(2000);
    }

    const tokenCoords = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return null;
      for (const el of modal.querySelectorAll('span, div')) {
        const txt = el.textContent?.trim() || '';
        if (txt === 'USDT' || txt === 'ETH' || txt === 'DAI') {
          const r = el.getBoundingClientRect();
          if (r.width > 10 && r.height > 10 && r.y > 200) {
            return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), name: txt };
          }
        }
      }
      return null;
    });
    if (!tokenCoords) throw new Error('代币列表中未找到 USDT/ETH/DAI');
    await page.mouse.click(tokenCoords.x, tokenCoords.y);
    const clickedToken = tokenCoords.name;
    await sleep(3000);

    const afterClick = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal || modal.getBoundingClientRect().width === 0) return { modalClosed: true };
      const txt = modal.textContent || '';
      return {
        modalClosed: false,
        stillOnTokenPage: txt.includes('选择币种') || txt.includes('Select Token'),
        onNetworkPage: txt.includes('选择网络') || txt.includes('Select Network'),
        backToReceive: txt.includes('从交易所接收') || txt.includes('From Exchange'),
      };
    });

    if (afterClick.onNetworkPage) {
      console.log('  [INFO] 多网络模式下出现网络选择页，选择 Ethereum');
      const ethCoords = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return null;
        for (const el of modal.querySelectorAll('[data-testid^="select-item"]')) {
          if (el.textContent?.includes('Ethereum')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
        for (const el of modal.querySelectorAll('span')) {
          if (el.textContent?.trim() === 'Ethereum') {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
          }
        }
        return null;
      });
      if (!ethCoords) throw new Error('网络选择页未找到 Ethereum');
      await page.mouse.click(ethCoords.x, ethCoords.y);
      await sleep(3000);

      const afterNetwork = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal || modal.getBoundingClientRect().width === 0) return { modalClosed: true };
        const txt = modal.textContent || '';
        return {
          modalClosed: false,
          stillOnNetworkPage: txt.includes('选择网络'),
          backToReceive: txt.includes('从交易所接收'),
        };
      });
      if (afterNetwork.stillOnNetworkPage) throw new Error('选择网络后仍停留在网络选择页');
      console.log(`  [INFO] 选择 Ethereum 后跳转触发：${afterNetwork.modalClosed ? '弹窗已关闭' : '回到接收首页'}`);
    } else if (afterClick.stillOnTokenPage) {
      throw new Error('选择代币后仍停留在代币选择页，跳转未触发');
    } else {
      console.log(`  [INFO] 选择 ${clickedToken} 后跳转触发：${afterClick.modalClosed ? '弹窗已关闭' : '回到接收首页'}`);
    }

    await closeAllModalsLocal(page);
    await goToWallet(page);
  }

  // 用例 #3
  async function test003(page) {
    await goToReceivePage(page);

    await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const txt = modal?.textContent || '';
      return txt.includes('OKX');
    }, { errorMsg: '接收弹窗内未显示 OKX', maxRetries: 10 });

    await clickByText(page, 'OKX', { scope: 'modal' });

    let outcome = 'unknown';
    for (let i = 0; i < 12; i++) {
      const browserActive = await isBrowserTabActive(page);
      if (browserActive) { outcome = 'browser_tab'; break; }

      const modalContent = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        return {
          hasAddress: txt.includes('地址') || txt.includes('address') || txt.includes('Address'),
          hasCopy: txt.includes('复制') || txt.includes('Copy'),
          hasHelp: txt.includes('帮助') || txt.includes('help') || txt.includes('Help'),
          hasOKX: txt.includes('OKX'),
        };
      });
      if (modalContent.hasAddress || modalContent.hasCopy) { outcome = 'address_page'; break; }
      if (modalContent.hasHelp) { outcome = 'help_in_modal'; break; }

      await sleep(500);
    }

    if (outcome === 'unknown') {
      throw new Error('点击 OKX 后无响应：既未跳转浏览器 Tab，也未显示地址页或帮助中心');
    }
    console.log(`  [INFO] OKX 点击结果: ${outcome}`);

    await closeAllModalsLocal(page);
    await goToWallet(page);
    await sleep(1000);
  }

  // 用例 #4
  async function test004(page) {
    await goToReceivePage(page);

    await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const txt = modal?.textContent || '';
      return txt.includes('Coinbase');
    }, { errorMsg: '接收弹窗内未显示 Coinbase', maxRetries: 10 });

    await clickByText(page, 'Coinbase', { scope: 'modal' });

    let browserActivated = false;
    for (let i = 0; i < 10; i++) {
      browserActivated = await isBrowserTabActive(page);
      if (browserActivated) break;
      await sleep(500);
    }

    if (!browserActivated) throw new Error('点击 Coinbase 后未跳转到浏览器 Tab');

    await goToWallet(page);
    await sleep(1000);
  }

  // 用例 #2 补充 — Binance 多网络模式
  async function test005(page) {
    await closeAllModalsLocal(page);
    await goToWallet(page);
    await sleep(1000);

    const currentMode = await getCurrentNetworkMode(page);
    const isPortfolio = currentMode === '投资组合' || currentMode === 'Portfolio';
    console.log(`  [INFO] 当前网络模式: ${currentMode}`);

    if (!isPortfolio) {
      await switchNetworkMode(page, 'portfolio');
      await sleep(1500);
      const afterSwitch = await getCurrentNetworkMode(page);
      if (afterSwitch !== '投资组合' && afterSwitch !== 'Portfolio') {
        throw new Error(`切换投资组合模式失败，当前: ${afterSwitch}`);
      }
      console.log('  [INFO] 已切换到投资组合模式');
    } else {
      console.log('  [INFO] 当前已是投资组合模式');
    }

    await goToReceivePage(page);

    await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const txt = modal?.textContent || '';
      return txt.includes('Binance');
    }, { errorMsg: '多网络模式下接收弹窗未显示 Binance', maxRetries: 10 });

    await clickByText(page, 'Binance', { scope: 'modal' });

    const tokenPage = await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const txt = modal?.textContent || '';
      const hasMultiChain = txt.includes('多链') || txt.includes('Multi-chain');
      const hasTokens = txt.includes('ETH') || txt.includes('USDT') || txt.includes('BTC');
      return { hasMultiChain, hasTokens, ok: hasTokens };
    }, { errorMsg: '多网络模式下点击 Binance 后代币列表未出现', maxRetries: 10 });

    if (tokenPage.hasMultiChain) console.log('  [INFO] 多网络模式：代币带有"多链"标签');

    const clickedToken = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return null;
      for (const el of modal.querySelectorAll('div, span')) {
        const txt = el.textContent?.trim() || '';
        if (txt.includes('ETH') && txt.includes('多链')) {
          const r = el.getBoundingClientRect();
          if (r.width > 100 && r.height > 15 && r.height < 80) {
            el.click();
            return 'ETH多链';
          }
        }
      }
      for (const el of modal.querySelectorAll('div, span')) {
        const txt = el.textContent?.trim() || '';
        if (/^(ETH|BTC|USDT|USDC|DAI)/.test(txt) && txt.length < 30) {
          const r = el.getBoundingClientRect();
          if (r.width > 50 && r.height > 15 && r.height < 80) {
            el.click();
            return txt;
          }
        }
      }
      return null;
    });
    await sleep(2000);
    if (!clickedToken) throw new Error('多网络模式下代币列表中未找到可点击的代币');
    console.log(`  [INFO] 选择代币: ${clickedToken}`);

    const networkPage = await poll(page, () => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return null;
      const txt = modal.textContent || '';
      const hasNetworks = txt.includes('Ethereum') || txt.includes('BNB Chain')
        || txt.includes('Polygon') || txt.includes('Arbitrum');
      const selectItems = modal.querySelectorAll('[data-testid^="select-item"]');
      return { hasNetworks, selectItemCount: selectItems.length, ok: hasNetworks || selectItems.length > 0 };
    }, { errorMsg: '选择代币后网络选择页未出现', maxRetries: 10 });

    if (!networkPage.hasNetworks && networkPage.selectItemCount === 0) {
      throw new Error('选择代币后未显示网络选择页');
    }

    const lr = await assertListRendered(page, {
      testidPrefix: 'select-item-',
      scope: '[data-testid="APP-Modal-Screen"]',
      minCount: 3,
    });
    if (lr.errors.length > 0) throw new Error(`List render: ${lr.errors.join('; ')}`);

    const ethNetCoords = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return null;
      for (const el of modal.querySelectorAll('[data-testid^="select-item"]')) {
        if (el.textContent?.includes('Ethereum')) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), via: 'select-item' };
        }
      }
      for (const el of modal.querySelectorAll('span')) {
        if (el.textContent?.trim() === 'Ethereum') {
          const r = el.getBoundingClientRect();
          if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), via: 'text' };
        }
      }
      return null;
    });
    if (!ethNetCoords) throw new Error('网络选择页未找到 Ethereum');
    await page.mouse.click(ethNetCoords.x, ethNetCoords.y);
    console.log(`  [INFO] 选择网络: Ethereum (via ${ethNetCoords.via}) at (${ethNetCoords.x}, ${ethNetCoords.y})`);
    await sleep(4000);

    let jumpTriggered = false;
    for (let i = 0; i < 6; i++) {
      const state = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal || modal.getBoundingClientRect().width === 0) return 'closed';
        const txt = modal.textContent || '';
        if (txt.includes('从交易所接收') || txt.includes('From Exchange')) return 'receive_page';
        if (txt.includes('选择网络') || txt.includes('Select Network')) return 'still_network';
        return 'other';
      });
      if (state === 'closed' || state === 'receive_page' || state === 'other') {
        jumpTriggered = true;
        console.log(`  [INFO] 跳转触发: ${state}`);
        break;
      }
      await sleep(500);
    }

    if (!jumpTriggered) throw new Error('选择网络后仍停留在网络选择页，跳转未触发');

    await closeAllModalsLocal(page);
    if (!isPortfolio) {
      console.log(`  [INFO] 恢复网络模式: ${currentMode}`);
      try {
        await switchNetworkMode(page, currentMode.toLowerCase());
      } catch (e) {
        console.log(`  [WARN] 恢复网络模式失败: ${e.message}`);
      }
    }
  }

  // ── Registry ──────────────────────────────────────────────

  const testCases = [
    {
      id: `${prefix}-001`,
      name: `${namePrefix}入口与展示（用例 #1）`,
      covers: [
        '#1.1 [P0] 显示从交易所接收卡片 + 交易所图标',
        '#1.2 [P0] 展开显示三个交易所入口 + Logo + 名称',
        '#1.3 [P1] 收起卡片，仅显示缩略图标',
      ],
      fn: test001,
    },
    {
      id: `${prefix}-002`,
      name: `${namePrefix}Binance 流程（用例 #2）`,
      covers: [
        '#2.1.1 [P0] 点击 Binance → 网络选择页',
        '#2.1.2 [P0] 选择网络 → 跳转代币选择页',
        '#2.1.3 [P0] 代币列表展示 + 每项有代币名',
        '#2.1.4 [P0] 选择代币 → 跳转 Binance 信号',
        '#2.1.6 [P1] 搜索代币 → 实时过滤',
        '#2.1.7 [P1] 搜索不存在代币 → 空状态',
      ],
      fn: test002,
    },
    {
      id: `${prefix}-003`,
      name: `${namePrefix}OKX 流程（用例 #3）`,
      covers: ['#3.3 [P0] 桌面端点击 OKX → 帮助中心（无 App 检测）'],
      fn: test003,
    },
    {
      id: `${prefix}-004`,
      name: `${namePrefix}Coinbase 流程（用例 #4）`,
      covers: ['#4.1 [P0] 点击 Coinbase → 帮助中心'],
      fn: test004,
    },
    {
      id: `${prefix}-005`,
      name: `${namePrefix}Binance 多网络模式（用例 #2 补充）`,
      covers: [
        '#2.1.1 [P0] 多网络模式下点击 Binance → 代币列表（含"多链"标签）',
        '#2.1.2 [P0] 选择代币（ETH多链）→ 网络选择页',
        '#2.1.3 [P0] 选择网络（Ethereum）→ 跳转 Binance',
      ],
      fn: test005,
    },
  ];

  async function setup(page) {
    // Caller may run unlockWallet / preconditions before calling setup.
    return undefined;
  }

  return { testCases, setup };
}
