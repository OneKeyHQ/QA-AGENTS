// Desktop-only continuous chapter suites with explicit manual-row evidence.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR, unlockWalletIfNeeded } from "../../helpers/index.mjs";
import { createStepTracker, safeStep } from "../../helpers/components.mjs";
import { runPreconditions } from "../../helpers/preconditions.mjs";
import { PerpsPage } from "../../helpers/pages/perps.mjs";
import { assertTargetPage } from "../../helpers/platform-session.mjs";
import {
  favoriteSnapshot,
  restoreFavorites,
  closePairs,
} from "../../helpers/perps-ui.mjs";
import {
  snapshotSelectorPreferences,
  restoreSelectorPreferences,
} from "./selector-preferences.mjs";
import { currentInfoTab, restoreInfoTab } from "./info-tab.mjs";
import { markRestoreFailure } from "../../helpers/execution-policy.mjs";
import { snapshotFinancialState } from "./order-observation.mjs";
import {
  snapshotNonOrderForm,
  beginFormTransaction,
  finishFormTransaction,
  closeDialog,
  closePop,
} from "./non-order-ui.mjs";

export class SampleUnavailable extends Error {}
export function createDesktopRowSuite(definitions) {
  let preReport;
  const screenshotDir = resolve(RESULTS_DIR, "perps-desktop-completion");
  mkdirSync(screenshotDir, { recursive: true });
  const testCases = definitions.map((def) => ({
    id: def.id,
    name: def.name,
    fn: async (page) => {
      page.setDefaultTimeout(15000);
      const t = createStepTracker(def.id),
        rowResults = [];
      const ready = await safeStep(
        page,
        t,
        "前置：Desktop 合约页、钱包解锁",
        async () => {
          assertTargetPage(page, "desktop");
          await unlockWalletIfNeeded(page);
          await closePop(page);
          await closeDialog(page);
          await new PerpsPage(page).navigate();
          return "保持当前账户；不创建订单或转账";
        },
        screenshotDir,
      );
      if (!ready) return t.result();
      const financialBefore = await snapshotFinancialState(page);
      const infoTab = await currentInfoTab(page);
      const preferences = def.selectorPreferences
        ? await snapshotSelectorPreferences(page)
        : null;
      const favorites = def.favorites ? await favoriteSnapshot(page) : null;
      writeFileSync(
        resolve(screenshotDir, `${def.id}-baseline.json`),
        JSON.stringify(
          {
            at: new Date().toISOString(),
            financialBefore,
            preferences,
            favorites,
            infoTab,
            form: await snapshotNonOrderForm(page),
          },
          null,
          2,
        ),
      );
      let restoreError,
        financialChanged = false;
      try {
        for (const row of def.rows) {
          const before = await snapshotNonOrderForm(page);
          assert.ok(
            before.checkboxes.every((c) => c.state !== "unknown"),
            "Restorable checkbox baseline required",
          );
          beginFormTransaction(page, before);
          let status = "passed",
            detail = "",
            stack = null,
            fatalRestore = false;
          console.log(`  START ${row.ids.join(", ")} ${row.name}`);
          try {
            const tracker = {
              ...t,
              add: (name, stepStatus, message) =>
                t.add(
                  name,
                  status === "skipped" ? "skipped" : stepStatus,
                  message,
                ),
            };
            await safeStep(
              page,
              tracker,
              `${row.ids.join(", ")} ${row.name}`,
              async () => {
                try {
                  detail = await row.check(page);
                  return detail;
                } catch (e) {
                  fatalRestore = Boolean(e.fatalRestore);
                  stack = e.stack;
                  detail = e.message;
                  if (e instanceof SampleUnavailable) {
                    status = "skipped";
                    return detail;
                  }
                  status = "failed";
                  throw e;
                }
              },
              screenshotDir,
            );
          } finally {
            const unchanged = await safeStep(
              page,
              t,
              `核对 ${row.ids.join(", ")} 账户、持仓与委托`,
              async () => {
                assert.deepEqual(
                  await snapshotFinancialState(page),
                  financialBefore,
                  "Financial state changed during non-order validation; stop UI and investigate origin",
                );
                return "账户、仓位数量/成本、普通及分时委托独立读回未变化";
              },
              screenshotDir,
            );
            if (!unchanged) {
              financialChanged = true;
              fatalRestore = true;
              restoreError = Error(
                "资金状态发生变化；停止操作，未尝试资金恢复",
              );
            }
            if (!financialChanged) {
              const restored = await safeStep(
                page,
                t,
                `恢复 ${row.ids.join(", ")}`,
                async () => {
                  await finishFormTransaction(page, before);
                  assert.deepEqual(
                    await snapshotNonOrderForm(page),
                    before,
                    "Independent form baseline readback",
                  );
                  return "入口可见表单完整读回一致；跨币种中间快照仅留证，隐藏字段未采集则不声称恢复";
                },
                screenshotDir,
              );
              fatalRestore ||= !restored;
            }
          }
          rowResults.push({
            ids: row.ids,
            status,
            detail,
            stack,
            complete: row.complete !== false,
            missing: row.missing ?? "",
          });
          if (fatalRestore) {
            restoreError ??= Error("原表单恢复或读回不一致");
            break;
          }
        }
      } finally {
        if (favorites && !financialChanged) {
          const restored = await safeStep(
            page,
            t,
            "恢复原收藏及顺序",
            async () => {
              await restoreFavorites(page, favorites);
              assert.deepEqual(
                await favoriteSnapshot(page),
                favorites,
                "Independent favorites readback",
              );
              await closePairs(page);
              return "完整市场身份、报价币与收藏顺序均恢复";
            },
            screenshotDir,
          );
          if (!restored) restoreError = Error("原收藏恢复失败");
        }
        if (preferences && !financialChanged) {
          const restored = await safeStep(
            page,
            t,
            "恢复币种选择器分类与排序",
            async () => {
              await restoreSelectorPreferences(page, preferences);
              return "原顶级分类、子分类及各排序列独立读回一致";
            },
            screenshotDir,
          );
          if (!restored) restoreError = Error("币种选择器偏好恢复失败");
        }
        if (!financialChanged) {
          const tabRestored = await safeStep(
            page,
            t,
            "恢复交易信息区原标签",
            async () => {
              await closePairs(page);
              await restoreInfoTab(page, infoTab);
              assert.equal(await currentInfoTab(page), infoTab);
              return infoTab;
            },
            screenshotDir,
          );
          if (!tabRestored) restoreError = Error("交易信息区原标签恢复失败");
          const unchanged = await safeStep(
            page,
            t,
            "最终核对账户、持仓与委托",
            async () => {
              assert.deepEqual(
                await snapshotFinancialState(page),
                financialBefore,
                "Financial state changed during UI restoration",
              );
              return "完整用例结束后资金状态仍与基线一致";
            },
            screenshotDir,
          );
          if (!unchanged)
            restoreError = Error("恢复阶段资金状态发生变化；未尝试资金恢复");
        }
      }
      if (restoreError)
        return { ...markRestoreFailure(t.result(), restoreError), rowResults };
      const result = t.result();
      const incomplete = rowResults.length !== def.rows.length ||
        rowResults.some((r) => r.status === "skipped" || !r.complete);
      return {
        ...result,
        status: result.summary.failed
          ? "failed"
          : incomplete
            ? "skipped"
            : result.status,
        partial: incomplete,
        ...(incomplete && !result.summary.failed
          ? { error: "部分子场景跳过或断言未完整实现；详见逐行结果" }
          : {}),
        rowResults,
      };
    },
  }));
  return {
    testCases,
    setup: async (page) => {
      page.setDefaultTimeout(15000);
      assertTargetPage(page, "desktop");
      await unlockWalletIfNeeded(page);
      await closePop(page);
      await closeDialog(page);
      await new PerpsPage(page).navigate();
      preReport ??= await runPreconditions(
        page,
        testCases.map((c) => c.id),
      );
      return preReport;
    },
  };
}
