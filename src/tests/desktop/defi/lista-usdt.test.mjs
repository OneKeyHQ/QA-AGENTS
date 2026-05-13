// DeFi Lista USDT 质押 + 赎回测试 (Desktop)
// Test IDs: DEFI-LISTA-001 ~ DEFI-LISTA-006
// 用例文档：docs/qa/testcases/cases/defi/2026-05-13_DeFi-Lista-USDT-质押赎回.md
// 录制 session：2026-05-13

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, unlockWalletIfNeeded,
} from '../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../helpers/components.mjs';

const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'defi-lista-usdt');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Dashboard 显示
export const displayName = 'Lista USDT 质押赎回';
export const categoryTitle = 'DeFi';

// 模块级缓存
let _ctx = {
  /** 进入 Lista USDT 详情页前记录的 USDT 余额 */
  initialUsdtBalance: null,
  /** 质押前余额 */
  beforeStakeBalance: null,
  /** 赎回前余额 */
  beforeRedeemBalance: null,
  /** APY 弹窗中读到的拆分 */
  apyBreakdown: null,
};

// 测试金额
const STAKE_AMOUNT = '100';
const REDEEM_AMOUNT = '100';

// ── DOM 工具 ───────────────────────────────────────────────

const sStep = (page, t, name, fn) => safeStep(page, t, name, fn, SCREENSHOT_DIR);

/** 点击指定文本的可见元素 */
async function clickText(page, text, opts = {}) {
  const { tag = 'span,div,button', scrollIntoView = true } = opts;
  const clicked = await page.evaluate(({ text, tag, scrollIntoView }) => {
    for (const el of document.querySelectorAll(tag)) {
      if (el.textContent?.trim() === text && el.children.length === 0) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          if (scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'instant' });
          el.click();
          return true;
        }
      }
    }
    return false;
  }, { text, tag, scrollIntoView });
  if (!clicked) throw new Error(`Cannot click text "${text}"`);
  await sleep(800);
}

/** 在所有 testid 元素中找包含某文本的可见元素并点击 */
async function clickByTestid(page, testid) {
  const clicked = await page.evaluate((testid) => {
    const el = document.querySelector(`[data-testid="${testid}"]`);
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    el.click();
    return true;
  }, testid);
  if (!clicked) throw new Error(`Cannot click testid="${testid}"`);
  await sleep(800);
}

/** 关 popover 遮罩 */
async function dismissOverlayPopover(page) {
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="ovelay-popover"]');
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 0) el.click();
    }
  });
  await sleep(500);
}

/** 用 pressSequentially 输入金额到当前可见的认购/赎回输入框 */
async function fillAmount(page, amount) {
  const inputHandle = await page.evaluateHandle(() => {
    for (const inp of document.querySelectorAll('input[placeholder="0"]')) {
      const r = inp.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return inp;
    }
    return null;
  });
  const inp = inputHandle.asElement();
  if (!inp) throw new Error('Amount input not found');
  // 先清空
  await inp.click({ clickCount: 3 }).catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await sleep(200);
  const loc = page.locator('input[placeholder="0"]').first();
  await loc.pressSequentially(amount, { delay: 50 });
  await sleep(800);
}

/** 读取「预估年收益」两行（USDT 部分 + LISTA 部分），返回 { usdt: { tokenAmt, usdAmt }, lista: { tokenAmt, usdAmt } } */
async function readEstimatedYield(page) {
  return page.evaluate(() => {
    const result = { usdt: null, lista: null };
    // 找包含「预估年收益」label 的容器
    let container = null;
    for (const el of document.querySelectorAll('span, div')) {
      if (el.textContent?.trim() === '预估年收益' && el.children.length === 0) {
        container = el.closest('div')?.parentElement;
        if (container) break;
      }
    }
    if (!container) return result;
    // 在容器中找形如 `0.0XXX USDT ($0.XX)` 与 `XX.XXXX LISTA ($X.XX)` 的文本
    const re = /([\d.]+)\s*(USDT|LISTA)\s*\(\$([\d.]+)\)/g;
    const text = container.textContent || '';
    let m;
    while ((m = re.exec(text)) !== null) {
      const [, amtStr, symbol, usdStr] = m;
      const entry = { tokenAmt: parseFloat(amtStr), usdAmt: parseFloat(usdStr) };
      if (symbol === 'USDT') result.usdt = entry;
      else if (symbol === 'LISTA') result.lista = entry;
    }
    // 另兼容 `0.0₅2849 USDT` 这种带下标的格式（subscript = 后面有 N 个 0）
    if (!result.usdt || !result.lista) {
      const reSub = /0\.0(\d)([\d.]+)\s*(USDT|LISTA)\s*\(\$([\d.]+)\)/g;
      while ((m = reSub.exec(text)) !== null) {
        const [, zeros, digits, symbol, usdStr] = m;
        const tokenAmt = parseFloat(`0.${'0'.repeat(parseInt(zeros))}${digits.replace('.', '')}`);
        const entry = { tokenAmt, usdAmt: parseFloat(usdStr) };
        if (symbol === 'USDT' && !result.usdt) result.usdt = entry;
        else if (symbol === 'LISTA' && !result.lista) result.lista = entry;
      }
    }
    return result;
  });
}

/** 读取认购页面的认购价值 USD（如 $99.97） */
async function readSubscriptionValueUsd(page) {
  return page.evaluate(() => {
    // 在认购卡片下方寻找 `$XX.XX` 格式的小字
    for (const el of document.querySelectorAll('span, div')) {
      const text = el.textContent?.trim();
      if (!text || el.children.length !== 0) continue;
      const m = text.match(/^\$([\d.]+)$/);
      if (m) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.width < 150 && r.height > 0 && r.height < 30) {
          return parseFloat(m[1]);
        }
      }
    }
    return null;
  });
}

/** 读取顶部 APY 数值（如 1.79） */
async function readApyPercent(page) {
  return page.evaluate(() => {
    for (const el of document.querySelectorAll('span, div, h1, h2, h3')) {
      const text = el.textContent?.trim();
      if (!text || el.children.length !== 0) continue;
      const m = text.match(/^([\d.]+)%\s*APY$/);
      if (m) return parseFloat(m[1]);
    }
    return null;
  });
}

/** 从 APY 弹窗读取细分：原生 APY / LISTA / 业绩费 / 综合 */
async function readApyBreakdown(page) {
  return page.evaluate(() => {
    const result = { native: null, lista: null, performanceFee: null };
    // 弹窗内容定位：找包含「原生 APY」label 的 span，沿 DOM 向上找到 row 容器，取 row 文本里的百分比
    const findValueByLabel = (labelText) => {
      for (const el of document.querySelectorAll('span, div')) {
        const t = el.textContent?.trim();
        if (t !== labelText || el.children.length !== 0) continue;
        // 向上查 3 层找包含 + / -% 数值的容器
        let p = el.parentElement;
        for (let depth = 0; depth < 5 && p; depth++) {
          const rowText = p.textContent || '';
          // 在 row 内查找 +X.XX% 或 -X.XX% 模式（不在 label 文本里出现）
          const m = rowText.match(/([+-])\s*([\d.]+)\s*%/);
          if (m) {
            const sign = m[1] === '-' ? -1 : 1;
            return sign * parseFloat(m[2]);
          }
          p = p.parentElement;
        }
      }
      return null;
    };
    result.native = findValueByLabel('原生 APY');
    result.lista = findValueByLabel('LISTA');
    result.performanceFee = findValueByLabel('业绩费');
    return result;
  });
}

/** 在历史列表中是否能找到 Lista 条目（按文本匹配 "Lista" + 金额） */
async function findListaHistoryEntry(page, expectedAmount) {
  return page.evaluate((amt) => {
    const containers = document.querySelectorAll('[data-testid^="select-item-"], [role="listitem"]');
    for (const el of containers) {
      const text = el.textContent || '';
      if (text.includes('Lista') && text.includes(amt)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return true;
      }
    }
    // Fallback: 检查所有可见 row
    for (const el of document.querySelectorAll('div, li')) {
      const t = el.textContent?.trim() || '';
      if (t.startsWith('Lista') && t.includes(amt)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height < 200) return true;
      }
    }
    return false;
  }, expectedAmount);
}

/** 滚动到包含某文本的元素 */
async function scrollToText(page, text) {
  await page.evaluate((text) => {
    for (const el of document.querySelectorAll('span, div, h1, h2, h3, p, button')) {
      if (el.textContent?.trim() === text && el.children.length === 0) {
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
        return;
      }
    }
  }, text);
  await sleep(500);
}

/** 进入 Lista USDT 详情页（从任意位置） */
async function goToListaUsdtDetail(page) {
  // 先回到所有资产 / DeFi 入口
  // 尝试点 nav-header-close（关掉可能开着的子页面）
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-testid="nav-header-close"]')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) { el.click(); return; }
    }
  });
  await sleep(800);

  // 切到 DeFi/Trade tab（侧栏）
  await page.evaluate(() => {
    // 尝试 testid=tab-modal-no-active-item-TradeOutline
    const tabs = document.querySelectorAll('[data-testid^="tab-modal-"]');
    for (const t of tabs) {
      const id = t.getAttribute('data-testid') || '';
      if (id.includes('TradeOutline') || id.includes('CoinsOutline')) {
        const r = t.getBoundingClientRect();
        if (r.width > 0) { t.click(); return; }
      }
    }
  });
  await sleep(1500);

  // 点 USDT 卡片
  await clickText(page, 'USDT最新', { tag: 'div,span', scrollIntoView: true }).catch(async () => {
    // fallback: 模糊匹配 USDT 开头
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('div, span')) {
        const t = el.textContent?.trim() || '';
        if (t.startsWith('USDT') && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 30 && r.height < 120) {
            el.click(); return;
          }
        }
      }
    });
    await sleep(1500);
  });
  await sleep(1500);

  // 点 Lista 渠道
  await clickText(page, 'Lista最新Pangolins USDT', { tag: 'div,span' }).catch(async () => {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('div, span')) {
        const t = el.textContent?.trim() || '';
        if (t.startsWith('Lista') && t.includes('USDT') && el.children.length === 0) {
          const r = el.getBoundingClientRect();
          if (r.width > 0 && r.height > 30 && r.height < 150) { el.click(); return; }
        }
      }
    });
    await sleep(2000);
  });
  await sleep(2000);
}

// ── 测试用例 ───────────────────────────────────────────────

/**
 * DEFI-LISTA-001: 入口与导航 + APY 数据展示
 */
async function testDefiLista001(page) {
  const t = createStepTracker('DEFI-LISTA-001');

  await sStep(page, t, '导航到 Lista USDT 详情页', async () => {
    await goToListaUsdtDetail(page);
    return 'arrived';
  });

  await sStep(page, t, '验证综合 APY 显示', async () => {
    const apy = await readApyPercent(page);
    if (apy === null || !(apy > 0 && apy < 200)) throw new Error(`无法读取合理的 APY 值: ${apy}`);
    return `APY = ${apy}%`;
  });

  await sStep(page, t, '点击 APY 数值旁的 icon 展开收益组成弹窗', async () => {
    // svg/icon next to APY text — 用 page.mouse.click，因为 SVG 元素没有 HTMLElement.click()
    const pos = await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div, h1, h2, h3')) {
        const text = el.textContent?.trim();
        if (text && /^[\d.]+%\s*APY$/.test(text) && el.children.length === 0) {
          const parent = el.parentElement;
          if (parent) {
            for (const svg of parent.querySelectorAll('svg')) {
              const r = svg.getBoundingClientRect();
              if (r.width > 0 && r.width < 40 && r.height > 0 && r.height < 40) {
                return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
              }
            }
          }
        }
      }
      return null;
    });
    if (!pos) throw new Error('找不到 APY icon');
    await page.mouse.click(pos.x, pos.y);
    await sleep(1500);
    return `icon clicked at (${Math.round(pos.x)}, ${Math.round(pos.y)})`;
  });

  await sStep(page, t, '验证 APY 拆分（原生 + LISTA + 业绩费）', async () => {
    const bd = await readApyBreakdown(page);
    if (bd.native === null) throw new Error('未读到「原生 APY」');
    if (bd.lista === null) throw new Error('未读到 LISTA 奖励 APY');
    if (bd.performanceFee === null) throw new Error('未读到业绩费');
    // 业绩费必须为负
    if (bd.performanceFee > 0) throw new Error(`业绩费应该为负，实际 ${bd.performanceFee}`);
    _ctx.apyBreakdown = bd;
    const computed = bd.native + bd.lista + bd.performanceFee;
    return `native=${bd.native}%, LISTA=${bd.lista}%, perfFee=${bd.performanceFee}%, computed sum=${computed.toFixed(2)}%`;
  });

  await sStep(page, t, '关闭 APY 弹窗', async () => {
    await dismissOverlayPopover(page);
    return 'dismissed';
  });

  return t.result();
}

/**
 * DEFI-LISTA-002: 详情页内容（介绍 + 常见问题）
 */
async function testDefiLista002(page) {
  const t = createStepTracker('DEFI-LISTA-002');

  await sStep(page, t, '滚动到「常见问题」', async () => {
    await scrollToText(page, '常见问题');
    return 'scrolled';
  });

  const expectedFaqs = [
    'Lista USDT 在 OneKey 上是如何运作的？',
    '什么是 Lista？',
    '收益如何计算？',
    '什么是业绩费？',
    '条款和免责声明',
  ];

  await sStep(page, t, '验证常见问题 5 条目存在', async () => {
    const present = await page.evaluate((faqs) => {
      const text = document.body.textContent || '';
      return faqs.filter(q => text.includes(q));
    }, expectedFaqs);
    const missing = expectedFaqs.filter(q => !present.includes(q));
    if (missing.length > 0) throw new Error(`缺少常见问题：${missing.join(' / ')}`);
    return `5/5 present`;
  });

  await sStep(page, t, '展开/收起「收益如何计算？」', async () => {
    await clickText(page, '收益如何计算？');
    await sleep(800);
    await clickText(page, '收益如何计算？'); // 再点一次收起
    return 'toggle ok';
  });

  return t.result();
}

/**
 * DEFI-LISTA-003: 输入认购金额 + 预估年收益断言（核心公式验证）
 */
async function testDefiLista003(page) {
  const t = createStepTracker('DEFI-LISTA-003');

  // 滚回顶部认购卡片
  await sStep(page, t, '滚动到认购输入区', async () => {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('span, div')) {
        if (el.textContent?.trim() === '认购' && el.children.length === 0) {
          el.scrollIntoView({ block: 'center', behavior: 'instant' });
          return;
        }
      }
    });
    await sleep(500);
    return 'scrolled';
  });

  await sStep(page, t, `输入认购金额 ${STAKE_AMOUNT}`, async () => {
    await fillAmount(page, STAKE_AMOUNT);
    return `input=${STAKE_AMOUNT}`;
  });

  let inputValueUsd = null;
  await sStep(page, t, '读取认购价值（USD）', async () => {
    inputValueUsd = await readSubscriptionValueUsd(page);
    if (inputValueUsd === null || inputValueUsd <= 0) {
      throw new Error(`无法读取认购 USD 价值，得到 ${inputValueUsd}`);
    }
    return `认购价值 ≈ $${inputValueUsd}`;
  });

  let yieldResult = null;
  await sStep(page, t, '读取预估年收益（USDT + LISTA 双代币）', async () => {
    yieldResult = await readEstimatedYield(page);
    if (!yieldResult.usdt) throw new Error('未读到 USDT 部分年收益');
    if (!yieldResult.lista) throw new Error('未读到 LISTA 部分年收益');
    return `USDT=${yieldResult.usdt.tokenAmt} ($${yieldResult.usdt.usdAmt}), LISTA=${yieldResult.lista.tokenAmt} ($${yieldResult.lista.usdAmt})`;
  });

  await sStep(page, t, '验证 USDT 年收益公式：(原生 − 业绩费) × 认购价值', async () => {
    const bd = _ctx.apyBreakdown;
    if (!bd) throw new Error('APY 拆分未读取（依赖 001）');
    // bd.native 和 bd.performanceFee 已是百分比数值（如 0.32, -0.03）
    // 业绩费已带负号，因此 (原生 + 业绩费) 等同 (原生 − |业绩费|)
    const effectiveUsdtApyPct = bd.native + bd.performanceFee;
    const expectedUsdAmt = inputValueUsd * effectiveUsdtApyPct / 100;
    const actualUsdAmt = yieldResult.usdt.usdAmt;
    const diff = Math.abs(actualUsdAmt - expectedUsdAmt);
    // 允许误差 ±$0.01 + 5% relative（处理 < $0.01 的极小值显示）
    const tolerance = Math.max(0.01, expectedUsdAmt * 0.05);
    if (diff > tolerance) {
      throw new Error(`USDT 年收益公式不符：预期 $${expectedUsdAmt.toFixed(6)}，实际 $${actualUsdAmt}, diff $${diff.toFixed(6)} > tol $${tolerance.toFixed(6)}`);
    }
    return `(${bd.native}% + ${bd.performanceFee}%) × $${inputValueUsd} = $${expectedUsdAmt.toFixed(6)} ≈ $${actualUsdAmt} ✓`;
  });

  await sStep(page, t, '验证 LISTA 年收益公式：LISTA APY × 认购价值（不扣业绩费）', async () => {
    const bd = _ctx.apyBreakdown;
    if (!bd) throw new Error('APY 拆分未读取');
    const expectedUsdAmt = inputValueUsd * bd.lista / 100;
    const actualUsdAmt = yieldResult.lista.usdAmt;
    const diff = Math.abs(actualUsdAmt - expectedUsdAmt);
    const tolerance = Math.max(0.01, expectedUsdAmt * 0.05);
    if (diff > tolerance) {
      throw new Error(`LISTA 年收益公式不符：预期 $${expectedUsdAmt.toFixed(6)}，实际 $${actualUsdAmt}, diff $${diff.toFixed(6)} > tol $${tolerance.toFixed(6)}`);
    }
    return `${bd.lista}% × $${inputValueUsd} = $${expectedUsdAmt.toFixed(6)} ≈ $${actualUsdAmt} ✓`;
  });

  return t.result();
}

/**
 * DEFI-LISTA-004: 完整质押流程（授权 → 确认 ×2）
 */
async function testDefiLista004(page) {
  const t = createStepTracker('DEFI-LISTA-004');

  await sStep(page, t, '点击「授权」按钮', async () => {
    await clickByTestid(page, 'page-footer-confirm');
    await sleep(2000);
    return 'authorize clicked';
  });

  await sStep(page, t, '签名弹窗 → 点击「确认」（授权交易）', async () => {
    // 等待确认按钮出现
    let confirmed = false;
    for (let i = 0; i < 10; i++) {
      try {
        await clickByTestid(page, 'page-footer-confirm');
        confirmed = true;
        break;
      } catch {}
      await sleep(500);
    }
    if (!confirmed) throw new Error('未找到授权交易的确认按钮');
    await sleep(3000);
    return 'authorize confirmed';
  });

  await sStep(page, t, '认购交易 → 点击「确认」（提交认购）', async () => {
    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      try {
        await clickByTestid(page, 'page-footer-confirm');
        confirmed = true;
        break;
      } catch {}
      await sleep(500);
    }
    if (!confirmed) throw new Error('未找到认购交易的确认按钮');
    await sleep(3000);
    return 'subscribe confirmed';
  });

  await sStep(page, t, '验证：交易立即提交成功（无错误提示）', async () => {
    // 检查页面没有错误 toast
    const hasError = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return /失败|Failed|Error/.test(text) && !/失败原因|可能失败/.test(text);
    });
    if (hasError) throw new Error('页面显示交易失败');
    return 'no failure toast';
  });

  return t.result();
}

/**
 * DEFI-LISTA-005: 历史记录验证（轮询最多 60 秒）
 */
async function testDefiLista005(page) {
  const t = createStepTracker('DEFI-LISTA-005');

  await sStep(page, t, '点击「历史记录」入口', async () => {
    await clickText(page, '历史记录');
    await sleep(1500);
    return 'opened';
  });

  await sStep(page, t, `轮询最多 60 秒等待 Lista ${STAKE_AMOUNT} USDT 认购记录出现`, async () => {
    const start = Date.now();
    let found = false;
    while (Date.now() - start < 60_000) {
      found = await findListaHistoryEntry(page, STAKE_AMOUNT);
      if (found) break;
      await sleep(2000);
    }
    if (!found) throw new Error(`60 秒内未在历史列表找到 Lista ${STAKE_AMOUNT} 条目`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    return `found after ${elapsed}s`;
  });

  await sStep(page, t, '关闭历史记录返回详情', async () => {
    // 点 nav-header-back 或 nav-header-close
    await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-back"]', '[data-testid="nav-header-close"]']) {
        const el = document.querySelector(sel);
        if (el) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) { el.click(); return; }
        }
      }
    });
    await sleep(1500);
    return 'closed';
  });

  return t.result();
}

/**
 * DEFI-LISTA-006: 持仓列表 + 赎回流程
 */
async function testDefiLista006(page) {
  const t = createStepTracker('DEFI-LISTA-006');

  await sStep(page, t, '关闭详情回到持仓首页', async () => {
    await page.evaluate(() => {
      for (const sel of ['[data-testid="nav-header-close"]', '[data-testid="nav-header-back"]']) {
        for (const el of document.querySelectorAll(sel)) {
          const r = el.getBoundingClientRect();
          if (r.width > 0) { el.click(); return; }
        }
      }
    });
    await sleep(2000);
    return 'navigated home';
  });

  await sStep(page, t, '滚动找到 Lista 持仓', async () => {
    await page.evaluate(() => {
      // 滚动整个页面看看能否找到 Lista
      const scroll = (steps = 0) => {
        if (steps > 10) return;
        const found = Array.from(document.querySelectorAll('span, div')).some(el =>
          el.textContent?.trim() === 'Lista' && el.children.length === 0
        );
        if (found) return;
        window.scrollBy(0, 300);
        setTimeout(() => scroll(steps + 1), 200);
      };
      scroll();
    });
    await sleep(3000);
    return 'scrolled';
  });

  await sStep(page, t, '点击 Lista 持仓的「管理」按钮', async () => {
    // 找 "管理" 按钮的 click target
    await clickText(page, '管理');
    await sleep(1500);
    return 'manage opened';
  });

  await sStep(page, t, '切换到「赎回」tab', async () => {
    // testid=APP-Modal-Screen 内的「赎回」span
    const clicked = await page.evaluate(() => {
      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      if (!modal) return false;
      for (const sp of modal.querySelectorAll('span')) {
        if (sp.textContent?.trim() === '赎回' && sp.children.length === 0) {
          const r = sp.getBoundingClientRect();
          if (r.width > 0) { sp.click(); return true; }
        }
      }
      return false;
    });
    if (!clicked) throw new Error('找不到赎回 tab');
    await sleep(1500);
    return 'switched';
  });

  await sStep(page, t, `输入赎回金额 ${REDEEM_AMOUNT}`, async () => {
    await fillAmount(page, REDEEM_AMOUNT);
    return `input=${REDEEM_AMOUNT}`;
  });

  await sStep(page, t, '点击「赎回」按钮', async () => {
    await clickByTestid(page, 'page-footer-confirm');
    await sleep(2000);
    return 'redeem clicked';
  });

  await sStep(page, t, '签名 / 确认赎回交易', async () => {
    let confirmed = false;
    for (let i = 0; i < 20; i++) {
      try {
        await clickByTestid(page, 'page-footer-confirm');
        confirmed = true;
        break;
      } catch {}
      await sleep(500);
    }
    if (!confirmed) throw new Error('未找到赎回确认按钮');
    await sleep(3000);
    return 'redeem confirmed';
  });

  await sStep(page, t, '验证赎回交易立即提交成功（无失败提示）', async () => {
    const hasError = await page.evaluate(() => {
      const text = document.body.textContent || '';
      return /失败|Failed|Error/.test(text) && !/失败原因|可能失败/.test(text);
    });
    if (hasError) throw new Error('页面显示赎回失败');
    return 'no failure toast';
  });

  return t.result();
}

// ── Registry ──────────────────────────────────────────────

export const testCases = [
  { id: 'DEFI-LISTA-001', name: 'DeFi-Lista-入口与APY数据展示', fn: testDefiLista001 },
  { id: 'DEFI-LISTA-002', name: 'DeFi-Lista-详情页常见问题验证', fn: testDefiLista002 },
  { id: 'DEFI-LISTA-003', name: 'DeFi-Lista-认购金额输入与年收益公式验证', fn: testDefiLista003 },
  { id: 'DEFI-LISTA-004', name: 'DeFi-Lista-质押授权与认购流程', fn: testDefiLista004 },
  { id: 'DEFI-LISTA-005', name: 'DeFi-Lista-历史记录验证', fn: testDefiLista005 },
  { id: 'DEFI-LISTA-006', name: 'DeFi-Lista-持仓查找与赎回流程', fn: testDefiLista006 },
];

export async function setup(page) {
  await unlockWalletIfNeeded(page);
  await dismissOverlays(page);
}

// ── CLI Entry ─────────────────────────────────────────────

export async function run() {
  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log('  DeFi Lista USDT 质押 + 赎回测试');
  console.log('='.repeat(60));

  await setup(page);

  const results = [];
  for (const tc of testCases) {
    const start = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`[${tc.id}] ${tc.name}`);
    console.log('─'.repeat(60));
    try {
      const result = await tc.fn(page);
      const duration = Date.now() - start;
      const r = {
        testId: tc.id, status: result.status, duration,
        steps: result.steps, errors: result.errors,
        timestamp: new Date().toISOString(),
      };
      console.log(`>> ${tc.id}: ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    } catch (err) {
      const duration = Date.now() - start;
      const r = {
        testId: tc.id, status: 'failed', duration,
        error: err.message, timestamp: new Date().toISOString(),
      };
      console.error(`>> ${tc.id}: FAILED (${(duration / 1000).toFixed(1)}s) — ${err.message}`);
      await screenshot(page, SCREENSHOT_DIR, `${tc.id}-error`);
      writeFileSync(resolve(RESULTS_DIR, `${tc.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }
    try { await dismissOverlays(page); } catch {}
    await sleep(1000);
  }

  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
