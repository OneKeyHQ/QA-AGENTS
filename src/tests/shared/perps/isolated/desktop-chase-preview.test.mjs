// Real pinned source with inert order/dialog sinks, separate from TF UI proof.
import test from "node:test";
import assert from "node:assert/strict";
import {
  React,
  renderer,
  evaluateSource,
  evaluateCallback,
  perpsUtils,
  BigNumber,
  readSource,
} from "./source.mjs";
import { numberUtils } from "./number-format-source.mjs";
import { expectedChaseEligibility } from "../chase-preview-evidence.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const utils = perpsUtils();
const amendment = evaluateSource(
  "packages/shared/src/utils/perpsTpSlUtils.ts",
  { names: ["getPerpsChaseOrderAmendKind"] },
);
const eligible = evaluateSource(
  "packages/kit/src/views/Perp/components/OrderInfoPanel/utils.ts",
  {
    names: ["canChasePerpsOrder"],
    globals: {
      BigNumber,
      isSpotInstrument: utils.isSpotInstrument,
      getPerpsChaseOrderAmendKind: amendment.getPerpsChaseOrderAmendKind,
    },
  },
).canChasePerpsOrder;
const base = {
  oid: 1,
  coin: "BTC",
  side: "B",
  sz: "0.1",
  origSz: "0.2",
  limitPx: "70000",
  reduceOnly: false,
  orderType: "Limit",
  tif: "Gtc",
  isTrigger: false,
  isPositionTpsl: false,
};
const account = "0x" + "1".repeat(40),
  other = "0x" + "2".repeat(40);
const ETranslations = Object.fromEntries(
  [
    ...readSource("packages/shared/src/locale/enum/translations.ts")
      .toString()
      .matchAll(/^\s+(\w+) = '([^']+)'/gmu),
  ].map((m) => [m[1], m[2]]),
);
const cn = JSON.parse(readSource("packages/shared/src/locale/json/zh_CN.json"));
const intl = {
  formatMessage: ({ id }) => {
    assert.equal(typeof cn[id], "string", `Chinese translation ${id} exists`);
    return cn[id];
  },
};
test("D13-61/62 源码资格矩阵：普通/部分成交、现货、TIF、触发与余量", () => {
  for (const patch of [
    {},
    { sz: "0.05" },
    { tif: "Ioc" },
    { tif: "Alo" },
    { coin: "@107" },
    { coin: "BTC/USDC" },
    { orderType: "Stop Limit" },
    { isTrigger: true },
    { isPositionTpsl: true },
    { sz: "0" },
    { sz: "-1" },
    { sz: "NaN" },
  ]) {
    const order = { ...base, ...patch };
    assert.equal(
      eligible(order),
      expectedChaseEligibility(order),
      JSON.stringify(patch),
    );
  }
});
for (const locale of ["zh_CN", "en_US"])
  for (const [side, reduceOnly, direction] of [
    ["B", false, "做多"],
    ["A", false, "做空"],
    ["B", true, "平空"],
    ["A", true, "平多"],
  ])
    test(`D13-71/72/73/97 ${locale}/${direction}:实际确认字段、剩余量、共享偏好，渲染/取消配置不触发改单`, async () => {
      const messages = JSON.parse(
        readSource(`packages/shared/src/locale/json/${locale}.json`),
      );
      const tr = (key) => {
        const value = messages[ETranslations[key]];
        assert.equal(typeof value, "string");
        return value;
      };
      const intl = {
        formatMessage: ({ id }) => {
          assert.equal(typeof messages[id], "string");
          return messages[id];
        },
      };
      const host =
        (type) =>
        ({ children, ...props }) =>
          React.createElement(type, props, children);
      let shown,
        settings = { skipOrderConfirm: false },
        confirmed = 0,
        writes = 0;
      const components = {
        YStack: host("y-stack"),
        XStack: host("x-stack"),
        SizableText: host("text"),
        Checkbox: host("checkbox"),
        Dialog: {
          show: (config) => {
            shown = config;
            return { close() {} };
          },
        },
      };
      const source = evaluateSource(
        "packages/kit/src/views/Perp/components/OrderInfoPanel/ChaseOrderConfirmModal.tsx",
        {
          mocks: {
            "react-intl": { useIntl: () => intl },
            "@onekeyhq/components": components,
            "@onekeyhq/kit-bg/src/states/jotai/atoms": {
              usePerpsCustomSettingsAtom: () => [
                settings,
                (update) => {
                  writes++;
                  settings = update(settings);
                },
              ],
            },
            "@onekeyhq/shared/src/locale": { ETranslations },
            "@onekeyhq/shared/src/platformEnv": {
              default: { isNative: false },
            },
            "@onekeyhq/shared/src/utils/numberUtils": numberUtils("zh-CN"),
            "@onekeyhq/shared/src/utils/perpsUtils": utils,
            "./utils": { getOrderAssetDisplayName: (coin) => coin },
          },
        },
      );
      source.showChaseOrderConfirmDialog({
        order: { ...base, side, reduceOnly },
        targetPrice: "81001",
        szDecimals: 5,
        intl,
        onConfirm: async () => {
          confirmed++;
        },
      });
      assert.equal(shown.title, tr("confirm_chase_order__title"));
      assert.equal(shown.description, tr("chase_order_confirmation__desc"));
      assert.equal(shown.showCancelButton, true);
      assert.equal(shown.showConfirmButton, true);
      let tree;
      await renderer.act(async () => {
        tree = renderer.create(shown.renderContent);
      });
      try {
        const rows = [];
        const visit = (node) => {
          if (!node || typeof node !== "object") return;
          if (
            node.type === "x-stack" &&
            node.children?.length === 2 &&
            node.children.every((c) => c?.type === "text")
          )
            rows.push(node);
          for (const child of node.children ?? []) visit(child);
        };
        visit(tree.toJSON());
        const fields = rows.map((n) =>
          n.children.map((c) => c.children.join("")),
        );
        assert.deepEqual(fields, [
          [tr("perp_token_selector_asset"), "BTC"],
          [
            tr("perp_direction__title"),
            tr(
              side === "B"
                ? reduceOnly
                  ? "perp_order_close_short"
                  : "perp_long"
                : reduceOnly
                  ? "perp_order_close_long"
                  : "perp_short",
            ),
          ],
          [tr("perp_chase_current_order_price__title"), "$70,000"],
          [tr("perp_chase_target_price__title"), "$81,001"],
          [tr("perp_chase_unfilled_size__title"), "0.1 BTC"],
          [
            tr("perps_reduce_only"),
            tr(reduceOnly ? "perp_yes__title" : "perp_no__title"),
          ],
        ]);
        assert.equal(
          rows[1].children[1].props.color,
          side === "B" ? "$green11" : "$red11",
        );
        const check = tree.root.findByType("checkbox");
        assert.equal(check.props.value, false);
        assert.equal(check.props.label, tr("perp_confirm_not_show"));
        for (const cell of fields.flat()) {
          assert.ok(!/__(?:title|msg|action)|\{\w+\}/u.test(cell));
          if (locale === "en_US") assert.ok(!/[\u3400-\u9fff]/u.test(cell));
        }
        await renderer.act(async () => check.props.onChange(true));
        assert.equal(settings.skipOrderConfirm, true);
        assert.equal(writes, 1);
        assert.equal(
          confirmed,
          0,
          "Toggling preference or rendering must not confirm an order",
        );
      } finally {
        await renderer.act(async () => tree.unmount());
      }
      assert.equal(confirmed, 0);
    });
async function invokePress(patch = {}) {
  const events = { orders: [], dialogs: [], errors: [] },
    activeRef = { current: account },
    scopedRef = { current: account };
  const globals = {
    perpsCustomSettings: { skipOrderConfirm: false },
    handleChaseOrder: async (...args) => {
      events.orders.push(args);
    },
    canMutateScopedOrders: true,
    canChasePerpsOrder: eligible,
    isChasingOrder: () => false,
    currentUser: { accountAddress: account },
    accountScopedAddress: account,
    normalizePerpsAccountAddress: utils.normalizePerpsAccountAddress,
    runChasingOrderTask: async (_, fn) => fn(),
    resolveChaseTargetPrice: async () => ({ price: "81001", szDecimals: 5 }),
    activeAccountAddressRef: activeRef,
    scopedAccountAddressRef: scopedRef,
    showChaseOrderConfirmDialog: (config) => events.dialogs.push(config),
    intl,
    ETranslations,
    Error,
    OneKeyLocalError: class extends Error {},
    Toast: { error: (value) => events.errors.push(value) },
    ...patch,
  };
  const callback = evaluateCallback(
    "packages/kit/src/views/Perp/components/OrderInfoPanel/List/PerpOpenOrdersList.tsx",
    "handleChaseOrderPress",
    globals,
  );
  await callback(base);
  return { events, globals };
}
test("D13-71/74 false仅打开预览，true直接进入改单路径；证明自动化必须拦截true", async () => {
  const safe = await invokePress();
  assert.equal(safe.events.dialogs.length, 1);
  assert.deepEqual(safe.events.orders, []);
  const direct = await invokePress({
    perpsCustomSettings: { skipOrderConfirm: true },
  });
  assert.equal(direct.events.orders.length, 1);
  assert.deepEqual(direct.events.dialogs, []);
});
test("D13-63/94 当前/数据账户不匹配或准备行情后切账户，都不能打开确认或改单", async () => {
  for (const patch of [
    { canMutateScopedOrders: false },
    { currentUser: { accountAddress: other } },
    { accountScopedAddress: other },
    { isChasingOrder: () => true },
  ]) {
    const { events } = await invokePress(patch);
    assert.deepEqual(events.orders, []);
    assert.deepEqual(events.dialogs, []);
  }
  const activeRef = { current: account };
  const { events } = await invokePress({
    activeAccountAddressRef: activeRef,
    resolveChaseTargetPrice: async () => {
      activeRef.current = other;
      return { price: "81001", szDecimals: 5 };
    },
  });
  assert.deepEqual(events.orders, []);
  assert.deepEqual(events.dialogs, []);
  assert.equal(events.errors.length, 1);
  assert.match(events.errors[0].title, /账户.*变化/u);
});
