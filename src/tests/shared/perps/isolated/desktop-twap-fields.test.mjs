// Actual pinned Desktop rows, independent column arithmetic/text expectations.
// Layout/CSS hosts remain local; no browser or actual computed-style claim.
import test from "node:test";
import assert from "node:assert/strict";
import { twapListFixture } from "./twap-list-fixture.mjs";
import { stateFixture } from "./twap-state-fixture.mjs";
import { orderState, origin } from "./twap-source-fixture.mjs";
import {
  assertTwapCellEvidence,
  twapRowLocale,
  twapStatusLabels,
} from "../twap-row-evidence.mjs";
import { twapSchemas } from "../twap-list-evidence.mjs";
function actualCells(f, row, tab) {
  const name = {
    active: "TwapActiveRow",
    history: "TwapHistoryRow",
    fills: "TwapFillRow",
  }[tab];
  const fragments = f
    .root()
    .findAll(
      (n) =>
        typeof n.type === "function" &&
        n.type.name === name &&
        (n.props.order ?? n.props.record) === row.record,
    );
  return fragments
    .flatMap((n) =>
      n
        .findAllByType("XStack")[0]
        .children.filter((x) => typeof x !== "string")
        .map((cell) => {
          const collect = (x) =>
            typeof x === "string"
              ? x
              : (x.children ?? []).map(collect).join("");
          const colorTokens = [
            ...new Set(
              [cell, ...cell.findAll(() => true)]
                .map((x) => x.props.color)
                .filter(Boolean),
            ),
          ];
          return {
            text: collect(cell),
            colorTokens,
            semanticColors: colorTokens.map((token) => ({
              token,
              resolved: "local-CSS-boundary",
              actual: "local-CSS-boundary",
            })),
            domColors: ["local-CSS-boundary"],
          };
        }),
    )
    .map((cell, i) => ({ ...cell, key: twapSchemas[tab][i] }));
}
const context = (f, r) => ({
  locale: twapRowLocale(f.tabs()),
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  now: f.state.now,
  status: r.props.status,
  activatedAt: r.props.activatedAt,
});
for (const locale of ["zh_CN", "en_US"]) {
  for (const status of Object.keys(twapStatusLabels.zh))
    test(`D11-249 actual Desktop ${locale} history every field/status ${status}`, async () => {
      const store = stateFixture();
      store.responses.history = [
        {
          twapId: 7,
          time: (origin + 150000) / 1000,
          state: orderState({
            side: status === "error" ? "A" : "B",
            executedSz: "0.125",
            executedNtl: "12345.6789",
            sz: "1234.56789",
            minutes: 75,
            stopPx: "123456.789",
            trigger: { px: "12345.67" },
            reduceOnly: true,
          }),
          status: { status, description: "fixture diagnostic" },
        },
      ];
      const f = await twapListFixture({
        store,
        initialTab: "history",
        state: { locale, now: origin + 300000 },
      });
      try {
        assert.equal(f.rows().length, 1);
        const row = f.rows()[0];
        assertTwapCellEvidence(
          "history",
          row.record,
          actualCells(f, row, "history"),
          context(f, row),
        );
      } finally {
        await f.close();
      }
    });
  for (const [label, patch, now] of [
    ["waiting", { trigger: { px: "120" } }, origin + 10000],
    [
      "running",
      { trigger: undefined, executedSz: "0.125", executedNtl: "12.34567" },
      origin + 123456,
    ],
    ["clamped", { trigger: undefined }, origin + 999999],
    ["future", { trigger: undefined }, origin - 10000],
  ])
    test(`D11-249 actual Desktop ${locale} active full fields and clock ${label}`, async () => {
      const store = stateFixture();
      store.responses.orders = {
        user: store.account,
        twapStates: [
          [7, orderState({ side: "A", stopPx: "135.6789", ...patch })],
        ],
      };
      const f = await twapListFixture({ store, state: { locale, now } });
      try {
        assert.equal(f.rows().length, 1);
        const row = f.rows()[0];
        assertTwapCellEvidence(
          "active",
          row.record,
          actualCells(f, row, "active"),
          context(f, row),
        );
        assert.equal(
          actualCells(f, row, "active").length,
          12,
          "Fixed terminate column is independently included",
        );
      } finally {
        await f.close();
      }
    });
  for (const [label, patch] of [
    [
      "USDC-positive",
      { closedPnl: "100.1234", fee: "1.2345", dir: "Open Long" },
    ],
    [
      "USDC-negative",
      { closedPnl: "0", fee: "0.00123456", dir: "Close Long", side: "A" },
    ],
    [
      "base-token",
      {
        coin: "UBTC/USDC",
        px: "0.0000006",
        fee: "0.00000001",
        feeToken: "UBTC",
        closedPnl: "0",
        dir: "Buy",
      },
    ],
    [
      "reverse",
      {
        dir: "Long > Short",
        side: "A",
        feeToken: undefined,
        fee: "0",
        closedPnl: "-2.54",
        px: "12345.6789",
      },
    ],
  ])
    test(`D11-249 actual Desktop ${locale} fills all cells/fee/pnl ${label}`, async () => {
      const store = stateFixture();
      store.responses.fills = [
        {
          twapId: 7,
          fill: {
            tid: 0,
            coin: "BTC",
            time: origin,
            side: "B",
            sz: "1234.56789",
            px: "100.123456",
            fee: "0",
            feeToken: "USDC",
            closedPnl: "0",
            ...patch,
          },
        },
      ];
      const f = await twapListFixture({
        store,
        initialTab: "fills",
        state: { locale, now: origin },
      });
      try {
        assert.equal(f.rows().length, 1);
        const row = f.rows()[0];
        assertTwapCellEvidence(
          "fills",
          row.record,
          actualCells(f, row, "fills"),
          context(f, row),
        );
      } finally {
        await f.close();
      }
    });
}
