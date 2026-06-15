// Kaspa Transfer Tests (Extension) — EXT-KASPA-001 ~ EXT-KASPA-006
// covers: docs/qa/testcases/cases/transfer/2026-05-20_Transfer-Kaspa转账-软件钱包.md §1 参数表
// source: recipient = runtime-config 账户2（可用 KASPA_TEST_RECIPIENT 覆盖）

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { sleep } from '../../../helpers/constants.mjs';
import { dismissOverlays, unlockWalletIfNeeded } from '../../../helpers/index.mjs';
import { connectExtensionCDP, getExtensionId } from '../../../helpers/extension-cdp.mjs';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import { switchNetwork } from '../../../helpers/network.mjs';
import { verifyHistoryRecord } from '../../../helpers/transfer.mjs';
import { requireAccounts } from '../../../helpers/runtime-config.mjs';

const RESULTS_DIR = resolve(import.meta.dirname, '../../../../../../shared/results');
const SCREENSHOT_DIR = resolve(RESULTS_DIR, 'ext-kaspa-screenshots');
mkdirSync(SCREENSHOT_DIR, { recursive: true });

export const displayName = 'Kaspa 转账';

/** Fallback when KASPA_TEST_RECIPIENT unset — must match Dashboard 账户2 on Kaspa network. */
const DEFAULT_KASPA_RECIPIENT = 'kaspa:qrshkvwnn5fd4ggv93jsumkymaz83ghf42ganhh7xqy60wppmqya2r9zygsag';

function resolveRecipientAddress() {
  if (process.env.KASPA_TEST_RECIPIENT) return process.env.KASPA_TEST_RECIPIENT;
  requireAccounts({ required: ['secondary'] });
  return DEFAULT_KASPA_RECIPIENT;
}

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
  await page.locator(`[data-testid="asset-selector-token-item-kaspa--kaspa-${token}"]`).first().click();
  await sleep(500);
}

async function enterRecipientAndNext(page) {
  const recipient = resolveRecipientAddress();
  const input = page.locator('[data-testid="base-input-shared-styles-textarea"]').first();
  await input.click();
  await input.evaluate((el) => el.select());
  await input.press('Backspace');
  await input.pressSequentially(recipient, { delay: 40 });
  await sleep(300);
  await page.locator('[data-testid="page-footer-confirm"]').first().click();
  await sleep(1000);
}

async function enterAmount(page, amount) {
  const input = page.locator('[data-testid="send-amount-input"]').first();
  await input.click();
  await input.evaluate((el) => el.select());
  await input.press('Backspace');
  await input.pressSequentially(amount, { delay: 50 });
  await sleep(600);
}

async function clickPreview(page) {
  await page.locator('[data-testid="page-footer-confirm"]').first().click();
  await sleep(1200);
}

async function clickConfirm(page) {
  await page.locator('[data-testid="page-footer-confirm"]').first().click();
  await sleep(1200);
}

async function switchAllFeeLevels(page) {
  await page.locator('[data-testid="sig-confirm-fee-selector-trigger"]').first().click();
  await sleep(800);
  for (const level of ['慢', '正常', '快速', '自定义', '正常']) {
    const option = page.locator(`span:has-text("${level}")`).first();
    await option.click({ timeout: 2000 }).catch(() => {});
    await sleep(500);
  }
  await page.locator('[data-testid="signature-confirm-btn"]').first().click();
  await sleep(800);
}

async function submitTransfer(page) {
  await clickPreview(page);
  await clickConfirm(page);
  await sleep(2000);
}

async function runCase(page, id, name, fn) {
  const t = createStepTracker(id);
  await safeStep(page, t, '进入钱包并解锁', async () => {
    await dismissOverlays(page);
    await goToWallet(page);
    await unlockWalletIfNeeded(page);
    await switchNetwork(page, 'Kaspa');
    return 'wallet ready';
  }, SCREENSHOT_DIR);
  await fn(t);
  return t.result();
}

export const testCases = [
  {
    id: 'EXT-KASPA-001',
    name: 'SILVER 金额=0 拦截',
    fn: async (page) => runCase(page, 'EXT-KASPA-001', 'SILVER 金额=0 拦截', async (t) => {
      await safeStep(page, t, '打开 SILVER 发送', async () => {
        await selectToken(page, 'SILVER');
        await enterRecipientAndNext(page);
        return 'opened';
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '输入金额 0 并检查预览不可提交', async () => {
        await enterAmount(page, '0');
        const text = await page.evaluate(() => document.body.textContent || '');
        const hasMinHint = text.includes('0.2') || text.includes('最小');
        if (!hasMinHint) throw new Error('未出现最小金额提示');
        return 'min hint shown';
      }, SCREENSHOT_DIR);
    }),
  },
  {
    id: 'EXT-KASPA-002',
    name: 'SILVER 金额=0.2 + 费用四档',
    fn: async (page) => runCase(page, 'EXT-KASPA-002', 'SILVER 金额=0.2 + 费用四档', async (t) => {
      await safeStep(page, t, '打开 SILVER 发送并输入 0.2', async () => {
        await selectToken(page, 'SILVER');
        await enterRecipientAndNext(page);
        await enterAmount(page, '0.2');
        return 'amount=0.2';
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
        const levelAliases = {
          '慢': ['慢', 'Slow'],
          '正常': ['正常', 'Normal'],
          '快速': ['快速', 'Fast'],
          '自定义': ['自定义', 'Custom'],
        };

        for (const level of levels) {
          const aliases = levelAliases[level] || [level];

          // 1) 打开网络费用编辑弹窗（沿用之前入口）
          let feeEntryOpened = false;
          for (let i = 0; i < 3; i++) {
            feeEntryOpened = await page.evaluate(() => {
              const trigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
              if (!trigger) return false;
              const r = trigger.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) return false;
              const style = window.getComputedStyle(trigger);
              if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
              trigger.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return true;
            });
            if (feeEntryOpened) break;
            await sleep(250);
          }
          if (!feeEntryOpened) throw new Error('未找到网络费用编辑触发按钮');

          // 2) 等待弹窗就绪
          let modalReady = false;
          for (let i = 0; i < 12; i++) {
            modalReady = await page.evaluate(() => {
              const modal = document.querySelector('[role="dialog"], [data-testid="APP-Modal-Screen"]');
              if (!modal) return false;
              const r = modal.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) return false;
              const txt = modal.textContent || '';
              return txt.includes('慢') || txt.includes('正常') || txt.includes('快速') || txt.includes('自定义') || txt.includes('Slow') || txt.includes('Normal') || txt.includes('Fast') || txt.includes('Custom');
            });
            if (modalReady) break;
            await sleep(250);
          }
          if (!modalReady) throw new Error('网络费用弹窗未成功打开');

          // 3) 在“网络费用”弹窗内容容器内点击目标档位
          // 先锁定带“网络费用”标题的 dialog content，再只在 SegmentControlItem 中找档位文本
          let levelClicked = false;
          let levelDebug = null;
          for (const alias of aliases) {
            const ret = await page.evaluate((label) => {
              const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
              const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [data-testid="APP-Modal-Screen"]'));

              const longestCn = (input) => {
                const s = normalize(input || '');
                const matches = s.match(/[一-鿿]+/g) || [];
                if (!matches.length) return '';
                return matches.reduce((a, b) => (b.length > a.length ? b : a), '');
              };

              const debug = {
                label,
                dialogCount: dialogs.length,
                hasTargetDialog: false,
                dialogLongestChinese: dialogs.map((d, idx) => ({
                  idx,
                  longest: longestCn(d.textContent || ''),
                })),
                itemTexts: [],
                targetItemText: null,
                climb: [],
              };

              const contentRoot = dialogs.find((d) => {
                const t = normalize(d.textContent || '');
                return t.includes('网络费用') || t.includes('Network Fee');
              });
              if (!contentRoot) return { clicked: false, debug };

              const targetDialog = contentRoot;
              debug.hasTargetDialog = true;
              const items = Array.from(contentRoot.querySelectorAll('[data-sentry-component="SegmentControlItem"], [tabindex="0"]'));
              debug.itemTexts = items.map((item) => normalize(item.textContent || '')).filter(Boolean).slice(0, 20);

              const targetItem = items.find((item) => {
                const t = normalize(item.textContent || '');
                return t === label || t.includes(label);
              });
              if (!targetItem) return { clicked: false, debug };
              debug.targetItemText = normalize(targetItem.textContent || '');

              const inspect = (el) => {
                if (!el) return { ok: false, reason: 'null' };
                const r = el.getBoundingClientRect();
                if (r.width <= 0 || r.height <= 0) return { ok: false, reason: 'size', rect: { w: r.width, h: r.height } };
                const style = window.getComputedStyle(el);
                if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
                  return { ok: false, reason: 'style', style: { display: style.display, visibility: style.visibility, pointerEvents: style.pointerEvents } };
                }
                if (el.hasAttribute('disabled') || el.getAttribute('aria-disabled') === 'true') {
                  return { ok: false, reason: 'disabled' };
                }
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                const top = document.elementFromPoint(cx, cy);
                if (!top) return { ok: false, reason: 'no-top' };
                const hit = top === el || el.contains(top) || top.contains(el);
                if (!hit) {
                  return {
                    ok: false,
                    reason: 'covered',
                    topTag: top.tagName,
                    topClass: top.className || null,
                    point: { x: Math.round(cx), y: Math.round(cy) },
                  };
                }
                return { ok: true };
              };

              let clickable = targetItem;
              let depth = 0;
              while (clickable && depth < 6) {
                const r = inspect(clickable);
                debug.climb.push({
                  depth,
                  tag: clickable.tagName,
                  cls: clickable.className || null,
                  ...r,
                });
                if (r.ok) break;
                clickable = clickable.parentElement;
                depth += 1;
              }

              if (!clickable) return { clicked: false, debug };
              const final = inspect(clickable);
              if (!final.ok) return { clicked: false, debug };

              clickable.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return { clicked: true, debug };
            }, alias);
            levelClicked = !!ret?.clicked;
            levelDebug = ret?.debug || null;
            if (levelClicked) break;
          }
          if (!levelClicked) {
            const dbg = levelDebug ? JSON.stringify(levelDebug) : 'no-debug';
            throw new Error(`网络费用弹窗内未找到或无法点击档位: ${level} | debug=${dbg}`);
          }

          // 4) 点弹窗确认按钮，应用该档位（这是之前缺失的关键动作）
          let appliedByModalConfirm = false;
          for (let i = 0; i < 4; i++) {
            appliedByModalConfirm = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="signature-confirm-btn"]');
              if (!btn) return false;
              const r = btn.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) return false;
              const style = window.getComputedStyle(btn);
              if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
              btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return true;
            });
            if (appliedByModalConfirm) break;
            await sleep(250);
          }
          if (!appliedByModalConfirm) throw new Error(`档位已点击但未找到应用按钮: ${level}`);

          // 5) 校验触发器文案已切到目标档位
          let levelApplied = false;
          for (let i = 0; i < 12; i++) {
            levelApplied = await page.evaluate((target, aliasList) => {
              const normalize = (s) => (s || '').replace(/\s+/g, ' ').trim();
              const trigger = document.querySelector('[data-testid="sig-confirm-fee-selector-trigger"]');
              const t = normalize(trigger?.textContent || '');
              if (!t) return false;
              if (t.includes(target)) return true;
              return aliasList.some(a => t.includes(a));
            }, level, aliases);
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

        // EXT-KASPA-002 专用：费率弹层后确认按钮会重渲染，避免调用通用 clickConfirm
        let finalConfirmClicked = false;
        for (let i = 0; i < 4; i++) {
          finalConfirmClicked = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"]'));
            for (const btn of btns) {
              const r = btn.getBoundingClientRect();
              if (r.width <= 0 || r.height <= 0) continue;
              const style = window.getComputedStyle(btn);
              if (style.display === 'none' || style.visibility === 'hidden') continue;
              const disabled = btn.getAttribute('aria-disabled') === 'true' || btn.hasAttribute('disabled');
              if (disabled) continue;
              const cx = r.left + r.width / 2;
              const cy = r.top + r.height / 2;
              const top = document.elementFromPoint(cx, cy);
              if (!top) continue;
              const clickable = top === btn || btn.contains(top) || top.contains(btn);
              if (!clickable) continue;
              btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
              return true;
            }
            return false;
          });
          if (finalConfirmClicked) break;
          await sleep(700);
        }

        if (!finalConfirmClicked) {
          const btn = page.locator('[data-testid="page-footer-confirm"]').first();
          const box = await btn.boundingBox();
          if (!box) throw new Error('费率切换后确认按钮不可见，无法提交');
          await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        }

        await sleep(1200);
        return `submitted fee-switch=${switchedSummary}`;
      }, SCREENSHOT_DIR);
    }),
  },
  {
    id: 'EXT-KASPA-003',
    name: 'SILVER 最大值发送',
    fn: async (page) => runCase(page, 'EXT-KASPA-003', 'SILVER 最大值发送', async (t) => {
      await safeStep(page, t, '打开 SILVER 发送并点最大', async () => {
        await selectToken(page, 'SILVER');
        await enterRecipientAndNext(page);
        await page.locator('[data-testid="send-max-button"]').first().click();
        return 'max selected';
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览并确认', async () => {
        await submitTransfer(page);
        return 'submitted';
      }, SCREENSHOT_DIR);
    }),
  },
  {
    id: 'EXT-KASPA-004',
    name: 'KAS 金额=0.2 发送',
    fn: async (page) => runCase(page, 'EXT-KASPA-004', 'KAS 金额=0.2 发送', async (t) => {
      await safeStep(page, t, '打开 KAS 发送并输入 0.2', async () => {
        await selectToken(page, 'KAS');
        await enterRecipientAndNext(page);
        await enterAmount(page, '0.2');
        return 'amount=0.2';
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览并确认', async () => {
        await submitTransfer(page);
        return 'submitted';
      }, SCREENSHOT_DIR);
    }),
  },
  {
    id: 'EXT-KASPA-005',
    name: 'KAS 最大值发送',
    fn: async (page) => runCase(page, 'EXT-KASPA-005', 'KAS 最大值发送', async (t) => {
      await safeStep(page, t, '打开 KAS 发送并点最大', async () => {
        await selectToken(page, 'KAS');
        await enterRecipientAndNext(page);
        await page.locator('[data-testid="send-max-button"]').first().click();
        return 'max selected';
      }, SCREENSHOT_DIR);
      await safeStep(page, t, '预览并确认', async () => {
        await submitTransfer(page);
        return 'submitted';
      }, SCREENSHOT_DIR);
    }),
  },
  {
    id: 'EXT-KASPA-006',
    name: '历史记录字段检查',
    fn: async (page) => runCase(page, 'EXT-KASPA-006', '历史记录字段检查', async (t) => {
      await safeStep(page, t, '打开历史记录并校验 SILVER 记录字段', async () => {
        const { fields } = await verifyHistoryRecord(page, 'SILVER');
        return `fields=${fields.join(',')}`;
      }, SCREENSHOT_DIR);
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
