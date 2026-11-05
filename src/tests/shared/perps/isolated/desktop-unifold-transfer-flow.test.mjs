import test from "node:test";
import assert from "node:assert/strict";
import { unifoldTransferFixture as mount } from "./unifold-transfer-fixture.mjs";
import { depositAddress, sourceCatalog } from "./unifold-session-fixture.mjs";
const actualHost = (f, id) =>
  f.root.findAllByProps({ testID: id }).find((n) => typeof n.type === "string");
const lines = (f) => f.texts();
test("D14-35/36/51 actual complete Desktop transfer composes raw catalog, route and independent fee fields", async () => {
  const f = await mount();
  try {
    assert.equal(f.nodes("DialogHeader")[0].props.title, "转入加密货币");
    assert.equal(f.nodes("QRCode")[0].props.value, depositAddress);
    const fields = f.root
      .findAll((n) => n.type?.name === "DetailRow")
      .map((n) => [n.props.label, n.props.value]);
    assert.deepEqual(fields, [
      ["第三方兑换手续费", "0.25%"],
      ["处理时间", "< 1 分钟"],
      ["最大滑点", "自动 • 0.50%"],
      ["价格影响", "0.01%"],
    ]);
    assert.ok(lines(f).includes("USDC"));
    assert.ok(lines(f).includes("USDC (Perp)"));
    await f.action(() =>
      actualHost(f, "perps-unifold-token-selector").props.onPress(),
    );
    assert.equal(
      actualHost(f, "perps-unifold-token-option-USDC").props.children !==
        undefined,
      true,
    );
    assert.ok(lines(f).includes("2 个网络"));
    assert.ok(lines(f).includes("1 网络"));
  } finally {
    await f.close();
  }
});

test("D14-35/37 actual token and chain controls update one full transfer, clear old token state", async () => {
  const f = await mount();
  try {
    await f.action(() =>
      actualHost(f, "perps-unifold-token-selector").props.onPress(),
    );
    await f.action(() =>
      actualHost(f, "perps-unifold-token-option-BTC").props.onPress(),
    );
    assert.equal(f.state.session.selection.asset.symbol, "BTC");
    assert.equal(f.state.session.selection.chain.chain_name, "Bitcoin");
    assert.equal(
      actualHost(f, "perps-unifold-token-option-BTC"),
      undefined,
      "Selector closes after choice",
    );
    assert.equal(
      actualHost(f, "perps-unifold-network-selector").props.children !==
        undefined,
      true,
    );
    assert.equal(
      f.root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props.testID?.startsWith("perps-unifold-copy-token-contract-"),
      ).length,
      0,
      "No stale EVM contract",
    );
    await f.action(() =>
      actualHost(f, "perps-unifold-token-selector").props.onPress(),
    );
    await f.action(() =>
      actualHost(f, "perps-unifold-token-option-USDC").props.onPress(),
    );
    await f.action(() =>
      actualHost(f, "perps-unifold-network-selector").props.onPress(),
    );
    const ethereum = f.root.findAll(
      (n) =>
        typeof n.type === "string" &&
        n.props.testID?.startsWith("perps-unifold-network-option-") &&
        n.props.testID.endsWith("-1"),
    );
    assert.equal(ethereum.length, 1);
    await f.action(() => ethereum[0].props.onPress());
    assert.equal(f.state.session.selection.chain.chain_name, "Ethereum");
    assert.ok(
      f.root
        .findAllByType("DashText")
        .some((n) => n.props.children === "最低 $10"),
    );
  } finally {
    await f.close();
  }
});
for (const locale of ["zh_CN", "en_US"])
  test(`D14-92 actual complete transfer language ${locale}, independent fee and network labels`, async () => {
    const f = await mount({ locale });
    try {
      assert.equal(
        f.nodes("DialogHeader")[0].props.title,
        locale === "zh_CN" ? "转入加密货币" : "Transfer Crypto",
      );
      const expected =
        locale === "zh_CN"
          ? ["已选代币", "已选网络", "条款", "帮助", "跟踪你的存款进度"]
          : [
              "Selected token",
              "Selected chain",
              "Terms",
              "Help",
              "Track your deposit progress",
            ];
      for (const text of expected) assert.ok(lines(f).includes(text), text);
      assert.ok(
        !lines(f).some((t) => /perp[._]unifold|global[._]|\{\w+\}/u.test(t)),
      );
      if (locale === "en_US")
        assert.ok(!lines(f).some((t) => /[\u3400-\u9fff]/u.test(t)));
      await f.action(() =>
        actualHost(f, "perps-unifold-terms").props.onPress(),
      );
      await f.action(() => actualHost(f, "perps-unifold-help").props.onPress());
      assert.deepEqual(f.events.urls, [
        "https://unifold.io/terms",
        "https://unifold.io/support",
      ]);
    } finally {
      await f.close();
    }
  });
for (const errorType of [
  "accountMismatch",
  "disabled",
  "geoBlocked",
  "unavailable",
  "sanctioned",
])
  for (const sessionId of ["session-support-123", null])
    test(`D14-91 actual full restricted screen ${errorType}/${sessionId}`, async () => {
      const f = await mount({
        session: {
          addressState: { status: "error", errorType },
          sessionId,
          qrAddress: null,
        },
      });
      try {
        assert.equal(f.nodes("QRCode").length, 0);
        assert.equal(f.nodes("HighlightAddress").length, 0);
        assert.equal(f.nodes("Empty").length, 1);
        const e = f.nodes("Empty")[0];
        assert.ok(e.props.title.length > 0);
        assert.ok(e.props.description.length > 0);
        assert.equal(f.events.unavailable, 1);
        if (errorType === "sanctioned") {
          assert.equal(
            e.props.description,
            sessionId
              ? "联系支持团队 · 参考编号 session-support-123"
              : "联系客服",
          );
        } else assert.ok(!e.props.description.includes("session-support-123"));
        await f.update({
          session: {
            addressState: { status: "ready" },
            qrAddress: depositAddress,
          },
        });
        assert.equal(f.nodes("Empty").length, 0);
        assert.equal(f.nodes("QRCode").length, 1);
        assert.equal(f.nodes("QRCode")[0].props.value, depositAddress);
      } finally {
        await f.close();
      }
    });
test("D14-89 actual full network error then ready restores address and removes error text", async () => {
  const f = await mount({
    session: {
      addressState: { status: "error", errorType: "network" },
      qrAddress: null,
    },
  });
  try {
    assert.ok(lines(f).includes("创建存款地址失败"));
    assert.ok(lines(f).includes("每 5 秒自动重试一次…"));
    assert.equal(f.nodes("QRCode").length, 0);
    assert.equal(f.nodes("Empty").length, 0);
    assert.equal(
      f.events.unavailable,
      0,
      "Transient network error keeps source selection reachable",
    );
    await f.update({
      session: { addressState: { status: "ready" }, qrAddress: depositAddress },
    });
    assert.ok(!lines(f).includes("创建存款地址失败"));
    assert.equal(f.nodes("QRCode")[0].props.value, depositAddress);
  } finally {
    await f.close();
  }
});
for (const fee of ["1", null])
  test(`actual transfer activation fee warning ${fee}`, async () => {
    const f = await mount({
      session: { showActivationWarning: true, activationFee: fee },
    });
    try {
      assert.equal(
        actualHost(f, "perps-unifold-activation-warning") !== undefined,
        true,
      );
      const text = lines(f).join(" ");
      assert.ok(fee ? text.includes("$1.00") : !text.includes("$1.00"));
      assert.ok(!text.includes("undefined"));
      assert.ok(!text.includes("NaN"));
      await f.update({ session: { showActivationWarning: false } });
      assert.equal(
        actualHost(f, "perps-unifold-activation-warning"),
        undefined,
      );
    } finally {
      await f.close();
    }
  });
test("D14-63 actual full transfer reserves measured history-card height plus4 and opens tracker", async () => {
  const f = await mount();
  try {
    const overlay = f
      .nodes("Stack")
      .filter((n) => n.props.position === "absolute");
    assert.equal(overlay.length, 1);
    await f.action(() =>
      overlay[0].props.onLayout({ nativeEvent: { layout: { height: 56.2 } } }),
    );
    assert.equal(f.nodes("Stack").filter((n) => n.props.pb === 61).length, 1);
    // History component owns the onPress prop, without simulating a system browser.
    const card = f.root.findAll(
      (n) => n.type?.name === "UnifoldDepositHistoryCard",
    );
    assert.equal(card.length, 1);
    await f.action(() => card[0].props.onPress());
    assert.equal(f.events.opens, 1);
    await f.update({ props: { historyCardPlacement: "hidden" } });
    assert.equal(
      f.nodes("Stack").filter((n) => n.props.position === "absolute").length,
      0,
    );
  } finally {
    await f.close();
  }
});

test("D14-35/36 full transfer seven required tokens and all six USDC network rows, selection moves uniquely", async () => {
  const names = [
    ["1", "Ethereum", 10],
    ["8453", "Base", 3],
    ["42161", "Arbitrum", 3],
    ["137", "Polygon", 3],
    ["10", "Optimism", 3],
    ["56", "BSC", 3],
  ];
  const chains = names.map(([id, name, min]) => ({
    ...sourceCatalog[0].chains[0],
    chain_id: id,
    chain_name: name,
    minimum_deposit_amount_usd: min,
  }));
  const assets = [
    { ...sourceCatalog[0], chains },
    sourceCatalog[1],
    ...["SOL", "HYPE", "USDe", "BTCB", "UBTC"].map((symbol) => ({
      symbol,
      chains: symbol === "USDe" ? chains : [chains[0]],
    })),
  ];
  const f = await mount({
    session: {
      supportedAssets: assets,
      selection: { asset: assets[0], chain: chains[0] },
    },
  });
  try {
    await f.action(() =>
      actualHost(f, "perps-unifold-token-selector").props.onPress(),
    );
    const options = f.root.findAll(
      (n) =>
        typeof n.type === "string" &&
        n.props.testID?.startsWith("perps-unifold-token-option-"),
    );
    assert.deepEqual(
      options.map((n) =>
        n.props.testID.replace("perps-unifold-token-option-", ""),
      ),
      ["USDC", "BTC", "SOL", "HYPE", "USDe", "BTCB", "UBTC"],
    );
    for (const [symbol, want] of [
      ["USDe", "6 个网络"],
      ["BTC", "1 网络"],
    ]) {
      const row = actualHost(f, `perps-unifold-token-option-${symbol}`);
      assert.deepEqual(
        row.findAllByType("SizableText").map((n) => n.children.join("")),
        [symbol, want],
      );
    }
    await f.action(() =>
      actualHost(f, "perps-unifold-token-option-USDC").props.onPress(),
    );
    for (const [id, name, min] of names) {
      await f.action(() =>
        actualHost(f, "perps-unifold-network-selector").props.onPress(),
      );
      const all = f.root.findAll(
        (n) =>
          typeof n.type === "string" &&
          n.props.testID?.startsWith("perps-unifold-network-option-"),
      );
      assert.equal(all.length, 6);
      const checked = all.filter((n) =>
        n.findAllByType("Icon").some((i) => i.props.name === "CheckRadioSolid"),
      );
      assert.equal(checked.length, 1);
      assert.equal(
        checked[0].props.testID,
        `perps-unifold-network-option-ethereum-${f.state.session.selection.chain.chain_id}`,
      );
      const option = actualHost(
        f,
        `perps-unifold-network-option-ethereum-${id}`,
      );
      assert.deepEqual(
        option.findAllByType("SizableText").map((n) => n.children.join("")),
        [name, `最低存款 $${min}`],
      );
      await f.action(() => option.props.onPress());
      assert.equal(f.state.session.selection.chain.chain_id, id);
      assert.ok(
        f.root
          .findAllByType("DashText")
          .some((n) => n.props.children === `最低 $${min}`),
      );
    }
  } finally {
    await f.close();
  }
});
