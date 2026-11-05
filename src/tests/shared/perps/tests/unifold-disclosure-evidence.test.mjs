import test from "node:test";
import assert from "node:assert/strict";
import {
  parseUnifoldReference,
  unifoldReference,
  minimumDisclosure,
  assertMinimumDisclosure,
  assertContractDisclosure,
  projectUnifoldSelection,
  projectUnifoldHintCatalog,
  assertUnifoldHintLogos,
  assertUnifoldSelection,
  assertUnifoldCatalogRows,
  assertUnifoldDetailFields,
  assertUnifoldNetworkMinimum,
} from "../unifold-disclosure-evidence.mjs";
test("链上收款参考值必须来自已接受手动文档，缺失或结构变化不回退猜测", () => {
  assert.match(unifoldReference.contract, /^0x[\da-f]{40}$/iu);
  assert.deepEqual(unifoldReference.minimums, {
    Ethereum: "10",
    Arbitrum: "3",
  });
  for (const text of [
    "",
    "Arbitrum USDC 合约 `0x123`",
    "USDC 最低存款：Ethereum $10",
  ])
    assert.throws(() => parseUnifoldReference(text));
});
test("最低金额断言核对完整语义：缺累计兑换说明、错误网络金额、只有短标签均失败", () => {
  for (const amount of ["3", "10"])
    assertMinimumDisclosure(
      { trigger: `最低 $${amount}`, tooltip: minimumDisclosure(amount) },
      amount,
    );
  for (const patch of [
    { tooltip: "最低 $3" },
    { tooltip: minimumDisclosure("10") },
    { trigger: "最低 $10" },
    { tooltip: "所选网络的最低充值金额为 $3。" },
  ])
    assert.throws(() =>
      assertMinimumDisclosure(
        { trigger: "最低 $3", tooltip: minimumDisclosure("3"), ...patch },
        "3",
      ),
    );
  assert.throws(() => minimumDisclosure("NaN"));
});
test("代币合约警示、网络、完整地址、实际复制及不同存款地址分别严格核对", () => {
  const sample = {
    warning:
      "代币合约地址并非你的存款地址，向该地址转账可能导致资产损失。请确认当前信息与你要存入的 USDC 一致。",
    network: "Arbitrum",
    shown: unifoldReference.contract,
    copied: unifoldReference.contract,
    deposit: "0x" + "1".repeat(40),
  };
  assertContractDisclosure(sample);
  for (const patch of [
    { warning: "代币合约" },
    { network: "Ethereum" },
    { shown: "0xaf88…5831" },
    { shown: "0x" + "2".repeat(40) },
    { copied: sample.deposit },
    { deposit: sample.shown },
    { deposit: "" },
  ])
    assert.throws(() => assertContractDisclosure({ ...sample, ...patch }));
});
test("链上收款投影只读当前选择，拒绝旧资产、错网络、重复目录和过期最低额", () => {
  const chain = {
    chain_id: "42161",
    chain_type: "ethereum",
    chain_name: "Arbitrum",
    token_address: unifoldReference.contract,
    minimum_deposit_amount_usd: 3,
    icon_url: "https://icons.example/arb.svg",
  };
  const f = {
    memoizedProps: {
      selection: { asset: { symbol: "USDC", chains: [chain] }, chain },
      assets: [],
      onSelectChain() {
        throw Error("Do not invoke");
      },
    },
  };
  const state = projectUnifoldSelection(f);
  assertUnifoldSelection(state, "USDC", "Arbitrum");
  for (const patch of [
    { symbol: "BTC" },
    { chain: { ...state.chain, name: "Ethereum" } },
    { chain: { ...state.chain, minimum: 10 } },
    { chain: { ...state.chain, id: "1" } },
    { supported: [] },
    { supported: [...state.supported, ...state.supported] },
  ])
    assert.throws(() =>
      assertUnifoldSelection({ ...state, ...patch }, "USDC", "Arbitrum"),
    );
  assert.throws(() =>
    projectUnifoldSelection({ memoizedProps: { selection: null } }),
  );
});

test("支持代币目录对账拒绝缺项、额外项、重复身份和错网络数", () => {
  const catalog = [
    { symbol: "USDC", networkCount: 6 },
    { symbol: "BTC", networkCount: 1 },
  ];
  const rows = [
    { symbol: "USDC", lines: ["USDC", "6 个网络"] },
    { symbol: "BTC", lines: ["BTC", "1 网络"] },
  ];
  assertUnifoldCatalogRows(catalog, rows);
  for (const wrong of [
    rows.slice(0, 1),
    [...rows, rows[1]],
    [rows[0], rows[0]],
    [rows[0], { symbol: "BTC", lines: ["BTC", "2 个网络"] }],
    [rows[0], { symbol: "BTC", lines: ["BTC", "1 网络", "旧数据"] }],
  ])
    assert.throws(() => assertUnifoldCatalogRows(catalog, wrong));
  assert.throws(() => assertUnifoldCatalogRows([], []));
  assert.throws(() => assertUnifoldCatalogRows([catalog[0], catalog[0]], rows));
});

test("明细按独立行核对，最大滑点的0.25%不能冒充第三方手续费", () => {
  const valid = [
    { label: "第三方兑换手续费", value: "0.25%" },
    { label: "处理时间", value: "< 1 分钟" },
    { label: "最大滑点", value: "自动 • 0.25%" },
    { label: "价格影响", value: "0.01%" },
  ];
  assertUnifoldDetailFields(valid);
  for (const rows of [
    valid.slice(1),
    valid.map((r, i) => (i === 0 ? { ...r, value: "0.50%" } : r)),
    valid.map((r, i) => (i === 1 ? { ...r, value: "--" } : r)),
    valid.map((r, i) => (i === 2 ? { ...r, value: "0.25%" } : r)),
    valid.map((r, i) => (i === 3 ? { ...r, value: "NaN%" } : r)),
    [valid[1], valid[0], ...valid.slice(2)],
  ])
    assert.throws(() => assertUnifoldDetailFields(rows));
});

test("网络最低额整行核对，$3.99/$30/$3.001均不能通过$3检查", () => {
  assertUnifoldNetworkMinimum("Arbitrum\n最低存款 $3", "Arbitrum", 3);
  for (const text of [
    "Arbitrum\n最低存款 $3.99",
    "Arbitrum\n最低存款 $30",
    "Arbitrum\n最低存款 $3.001",
    "Ethereum\n最低存款 $3",
    "Arbitrum\n$3",
    "Arbitrum\n最低存款 $3\n旧网络",
  ])
    assert.throws(() => assertUnifoldNetworkMinimum(text, "Arbitrum", 3));
});

test("来源网络图标必须按原始目录去重、Bitcoin优先、最多四个及精确+N，错误与旧目录拒绝", () => {
  const catalog = [
    {
      symbol: "USDC",
      chains: ["eth", "arb", "eth", "base", "op", "bsc"].map((icon) => ({
        type: "ethereum",
        icon,
      })),
    },
    { symbol: "BTC", chains: [{ type: "bitcoin", icon: "btc" }] },
  ];
  assertUnifoldHintLogos(catalog, ["btc", "eth", "arb", "base"], ["+2"]);
  for (const [icons, suffix] of [
    [["eth", "arb", "base", "btc"], ["+2"]],
    [["btc", "eth", "arb"], ["+2"]],
    [["btc", "eth", "arb", "base"], ["+3"]],
    [["btc", "eth", "arb", "base"], []],
  ])
    assert.throws(() => assertUnifoldHintLogos(catalog, icons, suffix));
  const raw = catalog.map((a) => ({
    symbol: a.symbol,
    chains: a.chains.map((c) => ({ chain_type: c.type, icon_url: c.icon })),
  }));
  const f = {
    type: { name: "TransferChainHintLogos" },
    memoizedState: { memoizedState: raw },
  };
  assert.deepEqual(
    projectUnifoldHintCatalog(f),
    catalog.map((a) => ({
      ...a,
      name: undefined,
      chains: a.chains.map((c) => ({ ...c, name: undefined })),
    })),
  );
  assert.throws(() =>
    projectUnifoldHintCatalog({ type: { name: "Unrelated" } }),
  );
  assert.throws(() =>
    projectUnifoldHintCatalog({ ...f, memoizedState: { memoizedState: [] } }),
  );
  assert.throws(() =>
    projectUnifoldHintCatalog({
      ...f,
      memoizedState: {
        memoizedState: raw,
        next: { memoizedState: [{ symbol: "OLD", chains: [] }] },
      },
    }),
  );
});
