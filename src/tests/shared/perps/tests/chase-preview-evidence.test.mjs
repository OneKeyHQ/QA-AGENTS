import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedChaseEligibility,
  projectChasePreviewState,
  assertSafeChasePreview,
  chaseDirection,
  canonicalChaseDecimal,
  missingChaseDirections,
} from "../chase-preview-evidence.mjs";
const account = "0x" + "1".repeat(40);
const order = {
  oid: 123,
  coin: "BTC",
  side: "B",
  sz: "0.1",
  origSz: "0.2",
  limitPx: "100",
  reduceOnly: false,
  orderType: "Limit",
  tif: "Gtc",
  isTrigger: false,
  isPositionTpsl: false,
};
const financial = {
  account,
  orders: [
    {
      id: "123",
      marketScope: "perp",
      ...Object.fromEntries(
        ["coin", "side", "sz", "limitPx", "reduceOnly", "isTrigger"].map(
          (k) => [k, order[k]],
        ),
      ),
    },
  ],
};
test("追单价格和剩余数量精确到原始十进制，不把浮点别名当成相等", () => {
  assert.equal(canonicalChaseDecimal("00012.3400"), "12.34");
  assert.equal(canonicalChaseDecimal("0.00000000000100"), "0.000000000001");
  assert.equal(Number("9007199254740992"), Number("9007199254740993"));
  assert.notEqual(
    canonicalChaseDecimal("9007199254740992"),
    canonicalChaseDecimal("9007199254740993"),
  );
  for (const invalid of ["NaN", "1e-8", "-1", "1,000", ".1", ""])
    assert.throws(() => canonicalChaseDecimal(invalid));
});
test("追单只允许未成交GTC非触发合约：IOC/ALO/现货/止盈止损/零余量全部拒绝", () => {
  assert.equal(expectedChaseEligibility(order), true);
  for (const patch of [
    { tif: "Ioc" },
    { tif: "Alo" },
    { tif: undefined },
    { coin: "@1" },
    { coin: "BTC/USDC" },
    { orderType: "Stop Limit" },
    { isTrigger: true },
    { isPositionTpsl: true },
    { sz: "0" },
    { sz: "-1" },
    { sz: "NaN" },
  ])
    assert.equal(expectedChaseEligibility({ ...order, ...patch }), false);
  assert.equal(
    expectedChaseEligibility({ ...order, coin: "xyz:BTC", sz: "0.00001" }),
    true,
  );
});
test("追单默认跳过确认、未知/冲突偏好、忙碌/错账户/错委托均禁止预览点击", () => {
  const state = {
    order,
    canChase: true,
    busy: false,
    skipValues: [false],
    accounts: [account],
  };
  const context = { account, financial, canTrade: true };
  assertSafeChasePreview(state, context);
  for (const patch of [
    { skipValues: [true] },
    { skipValues: [] },
    { skipValues: [false, true] },
    { canChase: false },
    { busy: true },
    { order: { ...order, oid: 999 } },
    { order: { ...order, sz: "0.2" } },
  ])
    assert.throws(() =>
      assertSafeChasePreview({ ...state, ...patch }, context),
    );
  for (const patch of [
    { account: "0x" + "2".repeat(40) },
    { canTrade: false },
    { financial: { account, orders: [] } },
  ])
    assert.throws(() =>
      assertSafeChasePreview(state, { ...context, ...patch }),
    );
});
test("追单只读投影不调用onPress，读取明确当前列表偏好而非其他祖先猜测", () => {
  const parent = {
    type: { name: "PerpOpenOrdersList" },
    memoizedState: {
      memoizedState: [{ skipOrderConfirm: false }, { accountAddress: account }],
      next: null,
    },
  };
  const row = {
    memoizedProps: {
      order,
      canChaseOrder: true,
      isChasingOrder: false,
      handleChaseOrder() {
        throw Error("Must not call");
      },
    },
    return: parent,
  };
  const state = projectChasePreviewState(row);
  assert.deepEqual(state.skipValues, [false]);
  assertSafeChasePreview(state, { account, financial, canTrade: true });
  parent.type.name = "OtherList";
  assert.deepEqual(projectChasePreviewState(row).skipValues, []);
  assert.throws(() => projectChasePreviewState(parent));
});
test("追单四种方向区分交易侧与只减仓，数量取剩余而非原始值", () => {
  for (const [side, reduceOnly, expected] of [
    ["B", false, "做多"],
    ["A", false, "做空"],
    ["B", true, "平空"],
    ["A", true, "平多"],
  ])
    assert.equal(chaseDirection({ ...order, side, reduceOnly }), expected);
  assert.throws(() => chaseDirection({ ...order, side: "S" }));
  assert.throws(() => chaseDirection({ ...order, reduceOnly: undefined }));
});
test("追单样本门禁按已核对方向集合，不以四笔同方向委托充当四方向完整", () => {
  assert.deepEqual(missingChaseDirections(["做多", "做多", "做多", "做多"]), [
    "做空",
    "平多",
    "平空",
  ]);
  assert.deepEqual(
    missingChaseDirections(["平多", "做多", "平空", "做空"]),
    [],
  );
  assert.deepEqual(missingChaseDirections([]), [
    "做多",
    "做空",
    "平多",
    "平空",
  ]);
  assert.throws(() => missingChaseDirections(["unknown"]));
});
