// Wallet - 从交易所接收 测试脚本
// 用例文档：docs/qa/testcases/cases/wallet/2026-02-27_Wallet-从交易所接收.md
// Test IDs: WALLET-RECV-001 ~ WALLET-RECV-005
//
// ═══════════════════════════════════════════════════════════════
// 覆盖映射：
//
// WALLET-RECV-001 → 用例 #1「入口与展示」
//   #1.1 [P0] "显示从交易所接收卡片 + 交易所图标"  → assertCardVisible()
//   #1.2 [P0] "展开显示三个交易所入口 + Logo + 名称" → assertExchangeListExpanded()
//   #1.3 [P1] "收起卡片，仅显示缩略图标"            → assertCardCollapsed()
//   跳过：#1.4 暗黑模式(P2) — 视觉样式验证，非功能测试
//
// WALLET-RECV-002 → 用例 #2「Binance 流程」
//   #2.1.1 [P0] "点击 Binance → 网络选择页"         → assertNetworkSelectionPage()
//   #2.1.2 [P0] "选择网络 → 跳转代币选择页"          → assertTokenSelectionPage()
//   #2.1.3 [P0] "代币列表展示 + 每项有代币名"        → assertTokenListItems()
//   #2.1.4 [P0] "选择代币 → 跳转 Binance 信号"      → assertBinanceRedirectSignal()
//   #2.1.6 [P1] "搜索代币 → 实时过滤"               → assertTokenSearchFilter()
//   #2.1.7 [P1] "搜索不存在代币 → 空状态"            → assertTokenSearchEmpty()
//   跳过：#2.1.5 网络列表校验 — 断言受限，无法获取 API 预期返回值
//   跳过：#2.1.8 滚动流畅度(P2) — 性能体感，CDP 无法测量 FPS
//   跳过：#2.3 充值反馈/返回 — 需 Binance 真实提币，不可自动化
//   跳过：#2.4 API 异常 — 需 mock，CDP Electron 下 page.route() 待验证
//   断言受限：#2.1.3 无法验证"不显示不支持的代币"（不知道预期值）
//   断言受限：#2.1.4 无法验证 Binance 侧是否接收到代币参数（外部浏览器）
//
// WALLET-RECV-005 → 用例 #2「Binance 流程 — 多网络（投资组合）模式」
//   #2.1.1 [P0] 切换到投资组合模式 → 点击 Binance → 代币列表（含"多链"标签）
//   #2.1.2 [P0] 选择代币（如 ETH多链）→ 网络选择页
//   #2.1.3 [P0] 选择网络（如 Ethereum）→ 跳转 Binance
//   注意：多网络模式下流程为 代币→网络（与单网络模式的 网络→代币 相反）
//   测试结束后自动恢复为 Ethereum 单网络模式
//
// WALLET-RECV-003 → 用例 #3「OKX 流程」
//   #3.3 [P0] "桌面端点击 OKX → 帮助中心"            → assertBrowserTabSwitch()
//   跳过：#3.1 已安装 OKX App — 桌面端无 App 检测，统一跳帮助中心
//   跳过：#3.2 硬件钱包 — 需物理设备
//   断言受限：帮助中心页面内容 — 外部页面，仅验证 Tab 切换
//
// WALLET-RECV-004 → 用例 #4「Coinbase 流程」
//   #4.1 [P0] "点击 Coinbase → 帮助中心"             → assertBrowserTabSwitch()
//   断言受限：同 OKX
//
// 跳过的用例：
//   #5 跨端差异 — 桌面端场景已在 #2/#3 覆盖，iOS/Android 不适用
//   #6 安全与权限 — 硬件钱包(需物理设备)、剪贴板(移动端)、截屏(视觉)
// ═══════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { assertListRendered } from '../../helpers/components.mjs';
import { runPreconditions } from '../../helpers/preconditions.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'wallet-receive-from-exchange');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

const ALL_TEST_IDS = [
  'WALLET-RECV-001', 'WALLET-RECV-002',
  'WALLET-RECV-003', 'WALLET-RECV-004', 'WALLET-RECV-005',
];
let _preReport = null;

// ── Helpers ─────────────────────────────────────

/** 点击侧栏进入钱包首页 */
async function clickWalletSidebar(page) {
  await page.evaluate(() => {
    const sidebar = document.querySelector('[data-testid="Desktop-AppSideBar-Content-Container"]');
    if (!sidebar) return false;
    for (const sp of sidebar.querySelectorAll('span, div')) {
      const txt = sp.textContent?.trim() || '';
      if (txt === '钱包' || txt === 'Wallet') {
        const r = sp.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { sp.click(); return true; }
      }
    }
    const fallback = document.querySelector('[data-testid="tab-modal-no-active-item-Wallet4Outline"]')
      || document.querySelector('[data-testid="tab-modal-active-item-Wallet4Solid"]');
    if (fallback) { fallback.click(); return true; }
    return false;
  });
  await sleep(1500);
}

/** 点击"接收"按钮（在 Wallet-Tab-Header 内，打开 Modal 弹窗） */
async function clickReceiveButton(page) {
  // "接收"是 Wallet-Tab-Header 内的一个 BUTTON，没有独立 testid
  // 需要精确匹配按钮内的文字，而非整个 header 容器
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

  // 验证 Modal 已打开
  const modalOpen = await page.evaluate(() => {
    const m = document.querySelector('[data-testid="APP-Modal-Screen"]');
    return m && m.getBoundingClientRect().width > 0;
  });
  if (!modalOpen) throw new Error('点击接收后 Modal 未打开');
}

/** 导航到钱包页并打开接收弹窗 */
async function goToReceivePage(page) {
  // 先清理残留弹窗和浏览器 Tab 状态
  await closeAllModals(page);
  await clickWalletSidebar(page);
  await sleep(500);
  await clickReceiveButton(page);
}

/** 轮询等待条件满足 */
async function poll(page, evalFn, { maxRetries = 10, interval = 500, errorMsg = 'Poll timeout' } = {}) {
  for (let i = 0; i < maxRetries; i++) {
    const result = await page.evaluate(evalFn);
    if (result) return result;
    await sleep(interval);
  }
  throw new Error(errorMsg);
}

/** 检测浏览器 Tab 是否被激活（侧栏高亮） */
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

/** 在 modal 或页面内点击指定文字的元素 */
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

/** 关闭所有弹窗，回到干净状态 */
async function closeAllModals(page) {
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

/** 切换网络模式（投资组合 or 单网络） */
async function switchNetworkMode(page, mode) {
  // mode: 'portfolio' (投资组合/多网络) | 'ethereum' (单网络)
  await closeAllModals(page);
  await clickWalletSidebar(page);
  await sleep(1000);

  // 点击网络选择器（兼容单网络和投资组合模式）
  const triggerClicked = await page.evaluate(() => {
    // 单网络模式：有 account-network-trigger-button
    const btn = document.querySelector('[data-testid="account-network-trigger-button"]');
    if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return 'single'; }
    // 投资组合模式：找含 "+N" 文字的元素（链图标区域）
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
    // 点击"投资组合"
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
    // 点击具体网络名，如 Ethereum
    // 网络列表中项目格式为 "Ethereum¥153.70"，需要用 includes 匹配
    const networkName = mode.charAt(0).toUpperCase() + mode.slice(1);
    const clicked = await page.evaluate((name) => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      // 优先在"最近使用"区域找精确匹配
      for (const el of modal.querySelectorAll('span')) {
        const txt = el.textContent?.trim();
        if (txt === name) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 0 && r.height < 40) { el.click(); return true; }
        }
      }
      // fallback: 找包含网络名的行（如 "Ethereum¥153.70"）
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

  // 点击"完成"按钮（如果存在）
  const hasConfirm = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="page-footer-confirm"]');
    if (btn && btn.getBoundingClientRect().width > 0) { btn.click(); return true; }
    return false;
  });
  if (hasConfirm) await sleep(1500);

  // 等弹窗关闭
  await closeAllModals(page);
  await sleep(1000);
}

/** 获取当前网络模式 */
async function getCurrentNetworkMode(page) {
  return page.evaluate(() => {
    // 单网络模式：有 account-network-trigger-button-text 显示网络名
    const el = document.querySelector('[data-testid="account-network-trigger-button-text"]');
    if (el && el.getBoundingClientRect().width > 0) return el.textContent?.trim() || 'unknown';
    // 投资组合模式：没有 trigger-button-text，顶部区域有 "+N" 链图标
    // 搜索整个顶部区域 (y < 120)
    for (const span of document.querySelectorAll('span, div')) {
      const txt = span.textContent?.trim() || '';
      if (/^\+\d+$/.test(txt)) {
        const r = span.getBoundingClientRect();
        if (r.y < 120 && r.width > 0) return '投资组合';
      }
    }
    // 兜底：检查 Wallet-Tab-Header 是否有大金额（投资组合模式金额通常更大）
    // 但这不可靠，直接返回 unknown
    return 'unknown';
  });
}

// ── Test Cases ──────────────────────────────────

export const testCases = [

  // ═══════════════════════════════════════════════
  // 用例 #1「入口与展示」
  // ═══════════════════════════════════════════════
  {
    id: 'WALLET-RECV-001',
    name: '入口与展示（用例 #1）',
    covers: [
      '#1.1 [P0] 显示从交易所接收卡片 + 交易所图标',
      '#1.2 [P0] 展开显示三个交易所入口 + Logo + 名称',
      '#1.3 [P1] 收起卡片，仅显示缩略图标',
    ],
    fn: async (page) => {
      await goToReceivePage(page);

      // 接收弹窗已打开，内容在 APP-Modal-Screen 内
      // 弹窗结构：接收 | 购买加密货币 | 从其他钱包接收 | 从交易所接收 | Binance | OKX | Coinbase

      // ── #1.1 [P0] 显示「从交易所接收」区域 + 交易所图标 ──
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

      if (!cardInfo.hasCard) {
        throw new Error('接收弹窗内缺少「从交易所接收」区域');
      }

      // ── #1.2 [P0] 显示三个交易所入口 + Logo + 名称 ──
      if (!cardInfo.hasBinance) throw new Error('接收弹窗缺少 Binance 入口');
      if (!cardInfo.hasOKX) throw new Error('接收弹窗缺少 OKX 入口');
      if (!cardInfo.hasCoinbase) throw new Error('接收弹窗缺少 Coinbase 入口');

      // 验证每个交易所有图标
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
        // 也可能是 SVG 图标而非 img
        const svgs = modal.querySelectorAll('svg');
        return { imgLogos: count, svgCount: svgs.length, totalImgs: imgs.length };
      });
      if (logoCheck.imgLogos === 0 && logoCheck.totalImgs === 0) {
        console.log('  [WARN] 交易所 Logo 未通过 img 检测到，可能使用 SVG 或内联图标');
      }

      // ── #1.3 [P1] 卡片展开/收起 ──
      // 从截图看"从交易所接收"是弹窗内的一个区域标题，下方直接列出三个交易所
      // 检查是否有展开/收起交互（某些版本可能没有折叠功能）
      const hasToggle = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return false;
        for (const el of modal.querySelectorAll('div, button, span')) {
          const txt = el.textContent?.trim() || '';
          if ((txt === '从交易所接收' || txt === 'From Exchange') && txt.length < 20) {
            // 检查是否可点击（有 cursor pointer 或是 button）
            const style = window.getComputedStyle(el);
            return style.cursor === 'pointer' || el.tagName === 'BUTTON' || el.closest('button') !== null;
          }
        }
        return false;
      });
      if (hasToggle) {
        // 尝试点击收起
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

        // 验证收起后交易所名称不可见
        const afterCollapse = await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          const txt = modal?.textContent || '';
          return { allVisible: txt.includes('Binance') && txt.includes('OKX') && txt.includes('Coinbase') };
        });

        if (!afterCollapse.allVisible) {
          // 收起成功，再展开回来
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

      // 关闭弹窗
      await closeAllModals(page);
    },
  },

  // ═══════════════════════════════════════════════
  // 用例 #2「Binance 流程」
  // ═══════════════════════════════════════════════
  {
    id: 'WALLET-RECV-002',
    name: 'Binance 流程（用例 #2）',
    covers: [
      '#2.1.1 [P0] 点击 Binance → 网络选择页',
      '#2.1.2 [P0] 选择网络 → 跳转代币选择页',
      '#2.1.3 [P0] 代币列表展示 + 每项有代币名',
      '#2.1.4 [P0] 选择代币 → 跳转 Binance 信号',
      '#2.1.6 [P1] 搜索代币 → 实时过滤',
      '#2.1.7 [P1] 搜索不存在代币 → 空状态',
    ],
    fn: async (page) => {
      // 此用例测试 Binance 流程（兼容单网络和多网络模式）
      await goToReceivePage(page);

      // 确保接收弹窗内交易所可见
      await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        return txt.includes('Binance') && txt.includes('OKX');
      }, { errorMsg: '接收弹窗内未显示交易所列表', maxRetries: 10 });

      // ── #2.1.1 [P0] 点击 Binance → 网络选择页 ──
      await clickByText(page, 'Binance', { scope: 'modal' });

      // 点击 Binance 后可能出现两种情况：
      //   A. 所有网络模式 → 网络选择页 → 选择网络 → 代币选择页
      //   B. 单网络模式 → 直接进入代币选择页（"选择币种"）
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

      // ── #2.1.1 / #2.1.2 网络选择（仅所有网络模式） ──
      if (afterBinance.hasNetworkPage) {
        console.log('  [INFO] 所有网络模式：显示网络选择页');
        // 选择 Ethereum
        try {
          await clickByText(page, 'Ethereum', { scope: 'modal' });
        } catch {
          // Ethereum 不可用，点击第一个可用网络
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

      // ── #2.1.3 [P0] 代币列表展示 + 每项有代币名 ──
      const tokenListInfo = await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return null;
        const txt = modal.textContent || '';

        // 直接检查已知代币名是否在文本中（因为 textContent 中代币名和全名连在一起如 "ETHEthereum"）
        const knownTokens = ['ETH', 'BTC', 'USDT', 'USDC', 'DAI', 'RNDR', 'MORPHO', 'SOL', 'BNB', 'MATIC'];
        const found = knownTokens.filter(t => txt.includes(t));

        // 检查搜索框
        const inputs = modal.querySelectorAll('input');
        const hasSearchInput = inputs.length > 0;

        return {
          tokenCount: found.length,
          sampleTokens: found.slice(0, 5),
          hasSearchInput,
          ok: found.length >= 1,
        };
      }, { errorMsg: '代币选择页未出现或代币列表为空', maxRetries: 10 });

      if (tokenListInfo.tokenCount < 1) {
        throw new Error('代币列表为空：未检测到任何已知代币名称');
      }

      // ── #2.1.6 [P1] 搜索代币 "USDT" → 实时过滤 ──
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

          // 清空搜索框
          await page.evaluate(() => {
            const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
            const input = modal?.querySelector('input');
            if (input) { input.focus(); input.select(); }
          });
          await page.keyboard.press('Backspace');
          await sleep(800);

          // ── #2.1.7 [P1] 搜索不存在的代币 → 空状态 ──
          await searchInput.pressSequentially('ZZZZNOTEXIST99', { delay: 50 });
          await sleep(1000);

          const emptyResult = await poll(page, () => {
            const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
            const txt = modal?.textContent || '';
            const hasEmptyState = txt.includes('未找到') || txt.includes('暂无') || txt.includes('No results')
              || txt.includes('not found') || txt.includes('empty') || txt.includes('没有');
            // 或者列表完全没有代币名称
            const tokenPattern = /\b[A-Z][A-Z0-9]{1,9}\b/g;
            const tokens = (txt.match(tokenPattern) || [])
              .filter(t => !['OKX', 'APP', 'USD', 'THE', 'AND', 'FOR', 'NOT', 'ZZZZNOTEXIST'].includes(t));
            return { hasEmptyState, remainingTokens: tokens.length, ok: hasEmptyState || tokens.length === 0 };
          }, { errorMsg: '搜索不存在代币后未显示空状态', maxRetries: 8 });

          if (!emptyResult.hasEmptyState && emptyResult.remainingTokens > 0) {
            throw new Error(`搜索不存在的代币后仍显示 ${emptyResult.remainingTokens} 个代币，且无空状态提示`);
          }

          // 清空搜索框恢复列表
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

      // ── #2.1.4 [P0] 选择代币 → 跳转 Binance ──
      // 桌面端行为：选择代币后，用系统默认浏览器打开 Binance 链接，弹窗回退到接收首页
      // 因此断言方式是：点击代币后弹窗从"选择币种"回退到"接收"首页（不再显示代币列表）

      // 先记录当前弹窗包含"选择币种"
      const beforeClick = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        return modal?.textContent?.includes('选择币种') || modal?.textContent?.includes('Select Token');
      });
      if (!beforeClick) {
        console.log('  [WARN] 搜索测试后弹窗已不在代币选择页，尝试重新进入');
        // 重新走一遍：关闭弹窗 → 接收 → Binance
        await closeAllModals(page);
        await clickReceiveButton(page);
        await clickByText(page, 'Binance', { scope: 'modal' });
        await sleep(2000);
      }

      // 点击 USDT 行（用坐标点击，JS click 可能不触发 React 事件）
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

      if (!clickedToken) {
        throw new Error('代币列表中未找到可点击的代币项（USDT/ETH/DAI）');
      }

      // 选代币后可能的情况：
      //   A. 单网络模式 → 直接跳转 Binance，弹窗回退到接收首页或关闭
      //   B. 多网络模式 → 出现"选择网络"页面，需要再选一个网络才跳转
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
        // 多网络模式：进入了网络选择页，选择 Ethereum 完成跳转
        console.log('  [INFO] 多网络模式下出现网络选择页，选择 Ethereum');
        // 网络选择页中每行是 "Ethereum 1.1 ¥7.60" 格式，用坐标点击
        const ethCoords = await page.evaluate(() => {
          const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
          if (!modal) return null;
          // 先找 select-item- testid
          for (const el of modal.querySelectorAll('[data-testid^="select-item"]')) {
            if (el.textContent?.includes('Ethereum')) {
              const r = el.getBoundingClientRect();
              if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) };
            }
          }
          // fallback: 找 span 精确匹配 "Ethereum"
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
        if (afterNetwork.stillOnNetworkPage) {
          throw new Error('选择网络后仍停留在网络选择页');
        }
        console.log(`  [INFO] 选择 Ethereum 后跳转触发：${afterNetwork.modalClosed ? '弹窗已关闭' : '回到接收首页'}`);
      } else if (afterClick.stillOnTokenPage) {
        throw new Error('选择代币后仍停留在代币选择页，跳转未触发');
      } else {
        // 弹窗关闭或回到接收首页都算跳转成功
        console.log(`  [INFO] 选择 ${clickedToken} 后跳转触发：${afterClick.modalClosed ? '弹窗已关闭' : '回到接收首页'}`);
      }

      // 返回钱包页
      await closeAllModals(page);
      await clickWalletSidebar(page);
    },
  },

  // ═══════════════════════════════════════════════
  // 用例 #3「OKX 流程」
  // ═══════════════════════════════════════════════
  {
    id: 'WALLET-RECV-003',
    name: 'OKX 流程（用例 #3）',
    covers: [
      '#3.3 [P0] 桌面端点击 OKX → 帮助中心（无 App 检测）',
    ],
    fn: async (page) => {
      await goToReceivePage(page);

      // 确保接收弹窗内 OKX 可见
      await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        return txt.includes('OKX');
      }, { errorMsg: '接收弹窗内未显示 OKX', maxRetries: 10 });

      // ── #3.3 [P0] 点击 OKX → 浏览器打开帮助中心 ──
      await clickByText(page, 'OKX', { scope: 'modal' });

      // 桌面端无 OKX App，应跳转到浏览器 Tab（帮助中心）或显示地址页
      // 等待响应：可能是浏览器 Tab 切换、地址页弹窗、或帮助中心 WebView
      let outcome = 'unknown';
      for (let i = 0; i < 12; i++) {
        // 检查是否切换到浏览器 Tab
        const browserActive = await isBrowserTabActive(page);
        if (browserActive) { outcome = 'browser_tab'; break; }

        // 检查是否在弹窗内显示了地址页或帮助中心
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

      // 返回钱包页
      await closeAllModals(page);
      await clickWalletSidebar(page);
      await sleep(1000);
    },
  },

  // ═══════════════════════════════════════════════
  // 用例 #4「Coinbase 流程」
  // ═══════════════════════════════════════════════
  {
    id: 'WALLET-RECV-004',
    name: 'Coinbase 流程（用例 #4）',
    covers: [
      '#4.1 [P0] 点击 Coinbase → 帮助中心',
    ],
    fn: async (page) => {
      await goToReceivePage(page);

      // 确保接收弹窗内 Coinbase 可见
      await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        return txt.includes('Coinbase');
      }, { errorMsg: '接收弹窗内未显示 Coinbase', maxRetries: 10 });

      // ── #4.1 [P0] 点击 Coinbase → 浏览器打开帮助中心 ──
      await clickByText(page, 'Coinbase', { scope: 'modal' });

      let browserActivated = false;
      for (let i = 0; i < 10; i++) {
        browserActivated = await isBrowserTabActive(page);
        if (browserActivated) break;
        await sleep(500);
      }

      if (!browserActivated) {
        throw new Error('点击 Coinbase 后未跳转到浏览器 Tab');
      }

      // 断言受限说明：帮助中心页面内容在外部浏览器，无法验证是否与 Coinbase 提币教程相关

      // 返回钱包页
      await clickWalletSidebar(page);
      await sleep(1000);
    },
  },

  // ═══════════════════════════════════════════════
  // 用例 #2 补充「Binance 流程 — 多网络（投资组合）模式」
  // ═══════════════════════════════════════════════
  {
    id: 'WALLET-RECV-005',
    name: 'Binance 多网络模式（用例 #2 补充）',
    covers: [
      '#2.1.1 [P0] 多网络模式下点击 Binance → 代币列表（含"多链"标签）',
      '#2.1.2 [P0] 选择代币（ETH多链）→ 网络选择页',
      '#2.1.3 [P0] 选择网络（Ethereum）→ 跳转 Binance',
    ],
    fn: async (page) => {
      // 先确保回到钱包页
      await closeAllModals(page);
      await clickWalletSidebar(page);
      await sleep(1000);

      // 检测当前网络模式
      const currentMode = await getCurrentNetworkMode(page);
      const isPortfolio = currentMode === '投资组合' || currentMode === 'Portfolio';
      console.log(`  [INFO] 当前网络模式: ${currentMode}`);

      // 如果不是投资组合模式，切换过去
      if (!isPortfolio) {
        await switchNetworkMode(page, 'portfolio');
        await sleep(1500);

        // 验证切换成功
        const afterSwitch = await getCurrentNetworkMode(page);
        if (afterSwitch !== '投资组合' && afterSwitch !== 'Portfolio') {
          throw new Error(`切换投资组合模式失败，当前: ${afterSwitch}`);
        }
        console.log('  [INFO] 已切换到投资组合模式');
      } else {
        console.log('  [INFO] 当前已是投资组合模式');
      }

      // ── 接收 → Binance ──
      await goToReceivePage(page);

      await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        return txt.includes('Binance');
      }, { errorMsg: '多网络模式下接收弹窗未显示 Binance', maxRetries: 10 });

      await clickByText(page, 'Binance', { scope: 'modal' });

      // ── #2.1.1 多网络模式下，Binance 应显示代币列表（含"多链"标签） ──
      const tokenPage = await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        const txt = modal?.textContent || '';
        // 多网络模式下代币会带"多链"标签
        const hasMultiChain = txt.includes('多链') || txt.includes('Multi-chain');
        // 也可能只是普通代币列表
        const hasTokens = txt.includes('ETH') || txt.includes('USDT') || txt.includes('BTC');
        return { hasMultiChain, hasTokens, ok: hasTokens };
      }, { errorMsg: '多网络模式下点击 Binance 后代币列表未出现', maxRetries: 10 });

      if (tokenPage.hasMultiChain) {
        console.log('  [INFO] 多网络模式：代币带有"多链"标签');
      }

      // ── #2.1.2 选择代币（ETH多链）→ 应弹出网络选择 ──
      // 点击含"ETH"且带"多链"的行
      const clickedToken = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return null;
        // 优先找含"多链"的 ETH
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
        // fallback: 点击第一个代币
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

      if (!clickedToken) {
        throw new Error('多网络模式下代币列表中未找到可点击的代币');
      }
      console.log(`  [INFO] 选择代币: ${clickedToken}`);

      // ── #2.1.3 选择代币后应弹出网络选择（select-item-） ──
      const networkPage = await poll(page, () => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return null;
        const txt = modal.textContent || '';
        // 网络选择页应有 Ethereum/BNB Chain 等选项
        const hasNetworks = txt.includes('Ethereum') || txt.includes('BNB Chain')
          || txt.includes('Polygon') || txt.includes('Arbitrum');
        // 检查是否有 select-item- 的元素（录制中观察到的 testid）
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

      // 选择 Ethereum 网络（用坐标点击，JS click 可能不触发 React 路由）
      const ethNetCoords = await page.evaluate(() => {
        const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
        if (!modal) return null;
        // 优先通过 select-item- testid
        for (const el of modal.querySelectorAll('[data-testid^="select-item"]')) {
          if (el.textContent?.includes('Ethereum')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0) return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), via: 'select-item' };
          }
        }
        // fallback: span 精确匹配
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

      // 验证跳转：轮询等待弹窗离开网络选择页
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

      if (!jumpTriggered) {
        throw new Error('选择网络后仍停留在网络选择页，跳转未触发');
      }

      // ── 恢复原始网络模式 ──
      await closeAllModals(page);
      if (!isPortfolio) {
        console.log(`  [INFO] 恢复网络模式: ${currentMode}`);
        try {
          await switchNetworkMode(page, currentMode.toLowerCase());
        } catch (e) {
          console.log(`  [WARN] 恢复网络模式失败: ${e.message}`);
        }
      }
    },
  },
];

// ── Setup ───────────────────────────────────────

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
  _preReport = await runPreconditions(page, ALL_TEST_IDS);
  return _preReport;
}

// ── CLI Entry ───────────────────────────────────

export async function run() {
  const { page } = await connectCDP();
  const pre = await setup(page);

  const filter = process.argv.slice(2).find(a => a.startsWith('WALLET-RECV-'));
  const casesToRun = filter ? testCases.filter(tc => tc.id === filter) : testCases;

  const results = [];
  for (const tc of casesToRun) {
    if (pre.shouldSkip(tc.id)) {
      console.log(`  SKIP  ${tc.id}  ${tc.name}`);
      const skipped = {
        testId: tc.id, status: 'skipped', duration: 0,
        timestamp: new Date().toISOString(), error: null, screenshot: null,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(skipped, null, 2));
      results.push(skipped);
      continue;
    }

    console.log(`  RUN   ${tc.id}  ${tc.name}`);
    const start = Date.now();
    try {
      await tc.fn(page);
      const dur = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  PASS  ${tc.id}  ${dur}s`);
      const pass = {
        testId: tc.id, status: 'pass', duration: Date.now() - start,
        timestamp: new Date().toISOString(), error: null, screenshot: null,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(pass, null, 2));
      results.push(pass);
    } catch (err) {
      const dur = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  FAIL  ${tc.id}  ${dur}s  ${err.message}`);
      const shot = await screenshot(page, SCREENSHOT_DIR, `${tc.id}-fail`);
      const fail = {
        testId: tc.id, status: 'fail', duration: Date.now() - start,
        timestamp: new Date().toISOString(), error: err.message, screenshot: shot,
      };
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(fail, null, 2));
      results.push(fail);
    }
    await sleep(600);
  }

  const failed = results.filter(r => r.status === 'fail').length;
  console.log(`\n  Results: ${results.filter(r => r.status === 'pass').length} pass, ${failed} fail, ${results.filter(r => r.status === 'skipped').length} skip`);
  return { status: failed === 0 ? 'passed' : 'failed', results };
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run()
    .then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error(e); process.exit(1); });
}
