// Actual wallet-token -> supported-token utilities and actual Desktop selector.
// Network labels/layout/list virtualization are explicit local adapters. No CDP.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSource, React, renderer } from "./source.mjs";
import { intl, ETranslations } from "./twap-source-fixture.mjs";
import { numberUtils } from "./number-format-source.mjs";
import { fundsConstants } from "./funds-submit-fixture.mjs";
const constantsPath = "@onekeyhq/shared/types/hyperliquid/perp.constants";
const utils = evaluateSource(
  "packages/kit-bg/src/services/ServiceWebviewPerp/utils/depositTokenListUtils.ts",
  {
    mocks: {
      "@onekeyhq/shared/src/consts/perp": { PERPS_NETWORK_ID: "evm--42161" },
      [constantsPath]: fundsConstants,
    },
  },
);
const token = (
  networkId = "evm--1",
  contractAddress = "0xaaa",
  fiatValue = "10",
  symbol = "USDC",
) => ({
  networkId,
  contractAddress,
  fiatValue,
  symbol,
  name: symbol + " name",
  decimals: 6,
  balanceParsed: "10",
  price: "1",
  logoURI: `token-logo:${networkId}:${contractAddress}`,
  networkLogoURI: `network-logo:${networkId}`,
});
const plain = (v) => JSON.parse(JSON.stringify(v));
test("D20-24 actual default picks maximum positive finite fiat value even when not Arbitrum USDC", () => {
  const tokens = [
    token("evm--42161", fundsConstants.USDC_TOKEN_INFO.address, "5"),
    token("evm--1", "0xbbb", "100", "ETH"),
    token("evm--56", "0xccc", "99", "BNB"),
  ];
  assert.equal(utils.getDefaultPerpsDepositToken({ tokens }), tokens[1]);
  assert.equal(
    utils.getDefaultPerpsDepositToken({
      tokens: [tokens[2], tokens[1], tokens[0]],
    }),
    tokens[1],
  );
});
for (const fiatValue of ["0", "-1", "", "NaN", "Infinity", undefined])
  test(`D20-24 actual default rejects nonpositive/nonfinite fiat ${fiatValue} and uses supported marked fallback`, () => {
    const invalid = token("evm--1", "0xaaa", fiatValue);
    invalid.fiatValue = fiatValue;
    const marked = { ...token("evm--56", "0xbbb", "0"), isDefault: true };
    assert.equal(
      utils.getDefaultPerpsDepositToken({ tokens: [invalid, marked] }),
      marked,
    );
  });
test("D20-24 configured defaults match network plus case-insensitive contract; same symbol is insufficient", () => {
  const a = token("evm--1", "0xaAa", "0"),
    b = token("evm--56", "0xaaa", "0"),
    c = token("evm--1", "0xbbb", "0");
  assert.equal(
    utils.getDefaultPerpsDepositToken({
      tokens: [b, c, a],
      defaultTokens: [{ ...a, contractAddress: "0xAAA" }],
    }),
    a,
  );
  assert.equal(
    utils.getDefaultPerpsDepositToken({ tokens: [b, c], defaultTokens: [a] }),
    b,
  );
  assert.equal(utils.getDefaultPerpsDepositToken({ tokens: [] }), undefined);
});
test("D20-24/25 stable fiat sorting preserves tie order, numeric precision and original input list", () => {
  const tokens = [
    token("evm--1", "A", "10.000000000000000001"),
    token("evm--1", "B", "9"),
    token("evm--1", "C", "10.000000000000000001"),
    token("evm--1", "D", "10.000000000000000002"),
  ];
  const sorted = utils.sortPerpsDepositTokensByFiatValue(tokens);
  assert.deepEqual(plain(sorted.map((t) => t.contractAddress)), [
    "D",
    "A",
    "C",
    "B",
  ]);
  assert.deepEqual(
    tokens.map((t) => t.contractAddress),
    ["A", "B", "C", "D"],
  );
});
test("D20-24/25 wallet response fiat keys retain current network, token, balance and logo as one identity", () => {
  const data = [
    {
      networkId: "evm--1",
      address: "0xAbC",
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      isNative: false,
    },
    {
      networkId: "evm--56",
      address: "0xAbC",
      symbol: "BNB",
      name: "BNB",
      decimals: 18,
    },
    { address: "no-network", symbol: "invalid" },
  ];
  const actual = utils.buildPerpsDepositTokensFromWalletTokenResponses({
    responses: [
      {
        tokens: {
          data,
          map: {
            "EVM--1:0xabc": { price: "2", balanceParsed: "6", fiatValue: "12" },
            "evm--56_0xabc": { price: 1, balanceParsed: "5", fiatValue: "5" },
          },
        },
      },
    ],
    networkLogoURIByNetworkId: { "evm--1": "eth-logo", "evm--56": "bnb-logo" },
  });
  assert.deepEqual(
    plain(
      actual.map((t) => [
        t.networkId,
        t.contractAddress,
        t.symbol,
        t.price,
        t.balanceParsed,
        t.fiatValue,
        t.networkLogoURI,
      ]),
    ),
    [
      ["evm--1", "0xAbC", "ETH", "2", "6", "12", "eth-logo"],
      ["evm--56", "0xAbC", "BNB", "1", "5", "5", "bnb-logo"],
    ],
  );
});
test("D20-24/25 merge keeps wallet balances on exact network/contract while adding missing supported defaults at zero", () => {
  const wallet = token("evm--1", "0xaAa", "22"),
    server = [
      { ...token("EVM--1", "0xAAA", "999"), isDefault: true },
      token("evm--56", "0xaaa", undefined),
    ];
  server[1].fiatValue = undefined;
  server[1].balanceParsed = undefined;
  const merged = utils.mergePerpsDepositTokensWithServerTokens({
    walletTokens: [wallet],
    serverTokens: server,
  });
  assert.equal(merged.length, 2);
  assert.deepEqual(
    plain(
      merged.map((t) => [
        t.networkId,
        t.contractAddress,
        t.balanceParsed,
        t.fiatValue,
        t.isDefault ?? false,
      ]),
    ),
    [
      ["evm--1", "0xaAa", "10", "22", true],
      ["evm--56", "0xaaa", "0", "0", false],
    ],
  );
  const byNetwork = utils.buildPerpsDepositTokensByNetwork(merged);
  assert.equal(byNetwork["evm--1"].length, 1);
  assert.equal(byNetwork["evm--56"].length, 1);
});
test("D20-28 actual account-change resolution uses the new list balance, retains exact valid identity and falls back from absent old network", () => {
  const old = token("evm--1", "0xaaa", "8"),
    same = { ...old, balanceParsed: "3", fiatValue: "3" },
    other = token("evm--56", "0xaaa", "30");
  assert.equal(
    utils.resolvePerpsDepositSelectedToken({
      tokens: [other, same],
      currentToken: old,
    }),
    same,
  );
  assert.equal(
    utils.resolvePerpsDepositSelectedToken({
      tokens: [other],
      currentToken: old,
    }),
    other,
  );
  assert.equal(
    utils.resolvePerpsDepositSelectedToken({ tokens: [], currentToken: old }),
    undefined,
  );
});
test("D20-24 actual positive-fiat filtering ignores missing, negative, zero and nonfinite balances without cross-network merging", () => {
  const positives = [
    token("evm--1", "A", "0.00000001"),
    token("evm--56", "A", "10"),
  ];
  const values = ["0", "-1", "NaN", "Infinity", ""].map((v) =>
    token("evm--1", v, v),
  );
  assert.deepEqual(
    plain(
      utils.filterPerpsDepositTokensWithPositiveFiatValue([
        ...values,
        ...positives,
      ]),
    ),
    positives,
  );
  const grouped = utils.filterPerpsDepositTokensByNetworkWithPositiveFiatValue({
    "evm--1": values,
    "evm--56": positives,
  });
  assert.equal(grouped["evm--1"].length, 0);
  assert.equal(grouped["evm--56"].length, 2);
});
async function selectionFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const tokens = [
    token("evm--1", "A", "20", "ETH"),
    token("evm--42161", "B", "10", "USDC"),
    token("evm--56", "C", "5", "USDC"),
  ];
  const state = {
    depositTokensWithPrice: tokens,
    hasLoaded: true,
    isLoading: false,
    ...patch,
  };
  let atom = { other: "preserved" },
    tree;
  const events = [];
  const host =
    (type) =>
    ({ children, ...props }) =>
      React.createElement(type, props, children);
  const components = Object.fromEntries(
    [
      "Empty",
      "SearchBar",
      "SizableText",
      "Skeleton",
      "Stack",
      "XStack",
      "YStack",
    ].map((n) => [n, host(n)]),
  );
  components.ListView = ({ data, renderItem, ListEmptyComponent, ...props }) =>
    React.createElement(
      "ListView",
      { ...props, data },
      data.length
        ? data.map((item) =>
            React.createElement(
              React.Fragment,
              { key: `${item.networkId}:${item.contractAddress}` },
              renderItem({ item }),
            ),
          )
        : ListEmptyComponent,
    );
  const { DepositTokenSelectionContent } = evaluateSource(
    "packages/kit/src/views/Perp/components/TradingPanel/modals/DepositTokenSelectionContent.tsx",
    {
      mocks: {
        "react-intl": { useIntl: () => intl },
        "@onekeyhq/components": components,
        "@onekeyhq/kit/src/components/Token": { Token: host("Token") },
        "@onekeyhq/kit-bg/src/states/jotai/atoms": {
          usePerpsDepositTokensAtom: () => [
            atom,
            (value) => {
              atom = value(atom);
              events.push("select");
            },
          ],
        },
        "@onekeyhq/shared/src/locale": { ETranslations },
        "@onekeyhq/shared/src/platformEnv": { isNative: false },
        "@onekeyhq/shared/src/utils/networkUtils": {
          getLocalNetworkInfo: (id) => ({
            name: {
              "evm--1": "Ethereum",
              "evm--42161": "Arbitrum One",
              "evm--56": "BNB Smart Chain",
            }[id],
          }),
        },
        "@onekeyhq/shared/src/utils/numberUtils": numberUtils("zh-CN"),
      },
    },
  );
  const render = async () =>
    renderer.act(async () => {
      const node = React.createElement(DepositTokenSelectionContent, {
        symbol: "$",
        ...state,
        onClose: () => events.push("close"),
      });
      if (tree) tree.update(node);
      else tree = renderer.create(node);
    });
  await render();
  const nodes = (type) => tree.root.findAllByType(type),
    items = () =>
      nodes("XStack").filter(
        (n) => n.props.testID === "perp-deposit-token-item",
      );
  return {
    tokens,
    state,
    events,
    atom: () => atom,
    nodes,
    items,
    data: () => nodes("ListView")[0].props.data,
    search: async (text) =>
      renderer.act(async () => nodes("SearchBar")[0].props.onChangeText(text)),
    choose: async (i) => renderer.act(async () => items()[i].props.onPress()),
    update: async (patch) => {
      Object.assign(state, patch);
      await render();
    },
    close: async () => renderer.act(async () => tree.unmount()),
  };
}
test("D20-26 actual selector searches symbol/name/network with trim and case folding, clear restores the whole ordered list", async () => {
  const f = await selectionFixture();
  try {
    for (const q of ["usdc", "USDC", "  UsDc  "]) {
      await f.search(q);
      assert.deepEqual(plain(f.data().map((t) => t.contractAddress)), [
        "B",
        "C",
      ]);
    }
    for (const q of ["  ARBITRUM  ", "arbitrum"]) {
      await f.search(q);
      assert.deepEqual(plain(f.data().map((t) => t.contractAddress)), ["B"]);
    }
    await f.search("ether");
    assert.deepEqual(plain(f.data().map((t) => t.contractAddress)), ["A"]);
    await f.search("no-asset-123");
    assert.equal(f.data().length, 0);
    assert.equal(f.nodes("Empty").length, 1);
    assert.equal(f.nodes("Empty")[0].props.title, "未找到结果");
    await f.search("");
    assert.deepEqual(plain(f.data()), f.tokens);
    assert.equal(f.nodes("Empty").length, 0);
  } finally {
    await f.close();
  }
});
test("D20-25/26 actual token row formats balance/fiat, keeps logos and selects exact same-symbol network contract", async () => {
  const f = await selectionFixture();
  try {
    assert.equal(f.items().length, 3);
    assert.deepEqual(
      f
        .nodes("Token")
        .map((n) => [n.props.tokenImageUri, n.props.networkImageUri]),
      f.tokens.map((t) => [t.logoURI, t.networkLogoURI]),
    );
    const texts = f
      .items()
      .map((n) =>
        n.findAllByType("SizableText").map((t) => t.children.join("")),
      );
    assert.deepEqual(texts, [
      ["ETH", "ETH name", "10", "$20.00"],
      ["USDC", "USDC name", "10", "$10.00"],
      ["USDC", "USDC name", "10", "$5.00"],
    ]);
    await f.search("USDC");
    await f.choose(1);
    assert.equal(f.atom().currentPerpsDepositSelectedToken, f.tokens[2]);
    assert.equal(f.atom().other, "preserved");
    assert.deepEqual(f.events, ["select", "close"]);
  } finally {
    await f.close();
  }
});
test("D20-22/26 actual selector distinguishes initial loading, loaded empty and later recovered current list", async () => {
  const f = await selectionFixture({
    depositTokensWithPrice: [],
    hasLoaded: false,
    isLoading: true,
  });
  try {
    assert.equal(f.nodes("Skeleton").length, 15);
    assert.equal(f.nodes("Empty").length, 0);
    await f.update({ hasLoaded: true, isLoading: false });
    assert.equal(f.nodes("Skeleton").length, 0);
    assert.equal(f.nodes("Empty").length, 1);
    await f.update({ depositTokensWithPrice: f.tokens });
    assert.equal(f.items().length, 3);
    assert.equal(f.nodes("Empty").length, 0);
    await f.update({ isLoading: true });
    assert.equal(f.items().length, 3);
    assert.equal(f.nodes("Skeleton").length, 0);
  } finally {
    await f.close();
  }
});
