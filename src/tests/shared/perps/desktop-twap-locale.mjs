// D11 手动用例：docs/qa/testcases/cases/perps/2026-06-03_Perps-分时分段委托下单.md
// D11-208: real Desktop Preferences -> language selection -> application reload.
// Existing TWAP records only. Restore language and TWAP navigation in finally.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import { unlockWalletIfNeeded } from "../../helpers/index.mjs";
import {
  createDesktopRowSuite,
  SampleUnavailable,
} from "./desktop-row-suite.mjs";
import { projectReactAll } from "./react-projection.mjs";
import { openLanguage, changeLocale as changeAppLocale } from "./language-settings.mjs";
import {
  desktopTwapState,
  selectSubtab,
  assertRendered,
  jump,
  withTwap,
} from "./desktop-twap-list-boundaries.mjs";
import { projectTwapCellRows } from "./twap-cell-projection.mjs";
import { assertTwapFieldRows, twapRowLocale } from "./twap-row-evidence.mjs";
import { twapRecordKey } from "./twap-list-evidence.mjs";
import { pollForm } from "./non-order-ui.mjs";
import { reloadPerps, markRestoreFailure } from "./runtime.mjs";
import { restoreInfoTab } from "./info-tab.mjs";

async function navigate(p) {
  await unlockWalletIfNeeded(p);
  const entry = locator(p, "global.sidebar.perps");
  await entry.click();
  await locator(p, "perps.form.root").waitFor({
    state: "visible",
    timeout: 45000,
  });
  await restoreInfoTab(p, "TWAP");
}
const reload = (p) =>
  reloadPerps(p, {
    navigate,
    ready: (p) =>
      locator(p, "perps.form.root").waitFor({
        state: "visible",
        timeout: 45000,
      }),
  });
const changeLocale = (p, target) => changeAppLocale(p, target, { navigate, reload });
export function twapLocaleSemantics(tab, records) {
  return records
    .map((r) => {
      const s = r.state;
      assert.ok(
        s &&
          typeof s.coin === "string" &&
          typeof s.sz === "string" &&
          Number.isFinite(s.minutes),
      );
      return {
        id: twapRecordKey(tab, r),
        coin: s.coin,
        size: s.sz,
        minutes: s.minutes,
        side: s.side,
        reduceOnly: s.reduceOnly,
        randomize: s.randomize,
        timestamp: s.timestamp,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}
async function readLocaleTables(p, expectedLocale) {
  const result = {};
  await selectSubtab(p, "history");
  const history = (await desktopTwapState(p)).data;
  const statuses = new Set(history.map((r) => r.status?.status));
  if (Object.keys(twapStatusLabels.zh).some((key) => !statuses.has(key)))
    throw new SampleUnavailable(
      "历史TWAP缺少六种状态中的至少一种；不能用部分状态宣称完整语言覆盖",
    );
  for (const tab of ["history", "active"]) {
    let state = await selectSubtab(p, tab);
    assert.equal(
      twapRowLocale(state.tabs),
      expectedLocale,
      "Actual TWAP tab labels reflect selected locale",
    );
    if (!state.data.length)
      throw new SampleUnavailable(
        `${tab}缺少已有委托；不能用空列表代替语言及资产/数量/时长断言`,
      );
    const snapshot = twapLocaleSemantics(tab, state.data),
      seen = [];
    const pages =
      tab === "active" ? 1 : Math.ceil(state.data.length / state.pageSize);
    for (let page = 1; page <= pages; page++) {
      if (state.page !== page) {
        await jump(p, page);
        state = await pollForm(
          () => desktopTwapState(p),
          (v) => v.page === page,
          "Language TWAP page",
        );
      }
      assert.deepEqual(
        twapLocaleSemantics(tab, state.data),
        snapshot,
        "Stable existing order semantics while inspecting locale",
      );
      const records = await assertRendered(p, state);
      const cells = (
        await projectReactAll(
          locator(p, "perps.position.table_body"),
          projectTwapCellRows,
        )
      ).flat();
      seen.push(
        ...assertTwapFieldRows(tab, records, cells, {
          locale: expectedLocale,
          history,
        }),
      );
    }
    assert.equal(
      new Set(seen).size,
      state.data.length,
      "Every locale row checked across all pages",
    );
    result[tab] = snapshot;
  }
  return result;
}
export const twapLocaleDefinitions = [
  {
    id: "PERPS-TWAP-LOCALE-001",
    name: "分时委托系统语言切换与刷新",
    rows: [
      {
        ids: ["D11-208"],
        name: "实际偏好设置中英切换及重载后全部状态/资产/数量/时长",
        check: (p) =>
          withTwap(p, async () => {
            const initial = await openLanguage(p);
            if (!["zh-CN", "en"].includes(initial.rawLocale)) {
              await reload(p);
              throw new SampleUnavailable(
                "当前语言不在可独立核对的中英基线，保留原语言；不修改不可选的旧en-US或系统语言",
              );
            }
            await reload(p);
            const baseline = await readLocaleTables(
              p,
              initial.rawLocale === "zh-CN" ? "zh" : "en",
            );
            let primary;
            try {
              for (const [locale, key] of [
                ["zh-CN", "zh"],
                ["en", "en"],
              ]) {
                await changeLocale(p, locale);
                assert.deepEqual(
                  await readLocaleTables(p, key),
                  baseline,
                  "Language reload preserves assets, total quantities and duration",
                );
                await reload(p);
                assert.deepEqual(
                  await readLocaleTables(p, key),
                  baseline,
                  "Explicit current/history refresh preserves semantic data and translations",
                );
              }
              return "通过实际偏好入口切换中英；重载epoch、持久化语言、两表全部实际字段、再次刷新及原语言恢复独立读回";
            } catch (e) {
              primary = e;
              throw e;
            } finally {
              try {
                await changeLocale(p, initial.rawLocale);
                const restored = await openLanguage(p);
                assert.equal(restored.rawLocale, initial.rawLocale);
                await reload(p);
              } catch (e) {
                throw markRestoreFailure(primary, e, "恢复原系统语言");
              }
            }
          }),
      },
    ],
  },
];
export const twapLocaleSuite = createDesktopRowSuite(twapLocaleDefinitions);
