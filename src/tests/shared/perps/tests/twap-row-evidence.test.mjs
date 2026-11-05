import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedTwapCells,
  assertTwapCellEvidence,
  assertTwapFieldRows,
  independentTwapRuntime,
  twapRowLocale,
} from "../twap-row-evidence.mjs";
import { twapSchemas } from "../twap-list-evidence.mjs";
const origin = 1800000000000;
const state = {
  coin: "BTC",
  side: "B",
  sz: "2",
  executedSz: "0.5",
  executedNtl: "50",
  timestamp: origin,
  minutes: 5,
  reduceOnly: false,
  randomize: true,
};
const record = { twapId: 7, state };
const context = {
  locale: "zh",
  timeZone: "Asia/Shanghai",
  status: "activated",
  now: origin + 60000,
  history: [],
};
function cells(tab, r, c = context) {
  const e = expectedTwapCells(tab, r, c);
  return e.fields.map((text, i) => ({
    key: twapSchemas[tab][i],
    text,
    colorTokens: e.colors[twapSchemas[tab][i]]
      ? [e.colors[twapSchemas[tab][i]]]
      : [],
    semanticColors: e.colors[twapSchemas[tab][i]]
      ? [
          {
            token: e.colors[twapSchemas[tab][i]],
            resolved: "rgb(0, 128, 0)",
            actual: "rgb(0, 128, 0)",
          },
        ]
      : [],
    domColors: ["rgb(0, 128, 0)"],
  }));
}
function fragments() {
  const row = {
    record,
    status: "activated",
    activatedAt: undefined,
    now: context.now,
    capturedAt: context.now + 800,
    timeZone: context.timeZone,
    spotDisplayMap: {},
    spotPairDisplayNameMap: {},
  };
  const c = cells("active", record);
  return [
    { ...row, renderMode: "left", cells: c.slice(0, -1) },
    { ...row, renderMode: "right", cells: c.slice(-1) },
  ];
}
test("TWAP independent fixed values include creation/event date, all active columns and clock", () => {
  assert.deepEqual(expectedTwapCells("active", record, context).fields, [
    "BTC",
    "2 BTC",
    "0.5 BTC",
    "100",
    "--",
    "--",
    "00:01:00 / 5 分钟",
    "活跃中",
    "否",
    "是",
    "2027/01/15 16:00:00",
    "终止",
  ]);
  assert.equal(twapRowLocale([{ key: "active", label: "Active" }]), "en");
  assert.throws(() => twapRowLocale([{ key: "active", label: "Actif" }]));
});
test("TWAP field assertions reject every wrong cell value, order and missing semantic color", () => {
  const base = cells("active", record);
  assertTwapCellEvidence("active", record, base, context);
  for (let i = 0; i < base.length; i++) {
    const changed = structuredClone(base);
    changed[i].text = "wrong";
    assert.throws(() =>
      assertTwapCellEvidence("active", record, changed, context),
    );
  }
  assert.throws(() =>
    assertTwapCellEvidence("active", record, [...base].reverse(), context),
  );
  for (const patch of [
    { colorTokens: ["$red11"] },
    { domColors: ["rgba(0, 0, 0, 0)"] },
    {
      semanticColors: [{ token: "$green11", resolved: "green", actual: "red" }],
    },
  ]) {
    const changed = structuredClone(base);
    Object.assign(changed[0], patch);
    assert.throws(() =>
      assertTwapCellEvidence("active", record, changed, context),
    );
  }
});
test("TWAP base-token fee keeps token units, USDC fee subtracts once, tiny value remains signed", () => {
  const r = {
    twapId: 7,
    fill: {
      time: origin,
      tid: 0,
      coin: "UBTC/USDC",
      side: "B",
      px: "0.0000006",
      sz: "2",
      fee: "0.00000001",
      feeToken: "UBTC",
      closedPnl: "0",
    },
  };
  assert.deepEqual(expectedTwapCells("fills", r, context).fields, [
    "2027/01/1516:00:00",
    "BTC/USDC",
    "购买",
    "0.0000006",
    "2",
    "$0.0000012",
    "0.00000001 BTC",
    "$0.00",
  ]);
  const e = expectedTwapCells(
    "fills",
    { ...r, fill: { ...r.fill, fee: "0.001", feeToken: "USDC" } },
    context,
  );
  assert.equal(e.fields[7], "-< $0.01");
});
test("TWAP spot average selects precision from the truncated grid before rounding display", () => {
  // Existing TF history 2222390: 199.79738 / 2.49 = 80.2399116… .
  // Grid is 80.239 (3 decimals); the separate display round yields 80.240.
  const r = {
    twapId: 2222390,
    time: origin / 1000,
    status: { status: "finished" },
    state: { ...state, coin: "UBTC/USDC", executedSz: "2.49", executedNtl: "199.79738" },
  };
  const e = expectedTwapCells("history", r, context);
  const i = twapSchemas.history.indexOf("avgPx");
  assert.equal(e.fields[i], "80.240");
  const actual = cells("history", r);
  actual[i].text = "80.24";
  assert.throws(() => assertTwapCellEvidence("history", r, actual, context), /avgPx/);
});
test("TWAP raw history chooses earliest activation, latest status and executed evidence", () => {
  const history = [
    {
      twapId: 7,
      time: (origin + 2000) / 1000,
      status: { status: "activated" },
    },
    {
      twapId: 7,
      time: (origin + 1000) / 1000,
      status: { status: "activated" },
    },
  ];
  assert.deepEqual(independentTwapRuntime(record, history), {
    status: "activated",
    activatedAt: origin + 1000,
  });
  assert.equal(
    independentTwapRuntime(record, [
      ...history,
      { twapId: 7, time: origin / 1000 + 3, status: { status: "terminated" } },
    ]).status,
    "terminated",
  );
});
test("TWAP field groups include actual fixed right cells and reject duplicates, stale clock, wrong record/status", () => {
  assert.deepEqual(
    assertTwapFieldRows("active", [record], fragments(), context),
    ["7"],
  );
  const mutations = [
    (r) => r.pop(),
    (r) => r.push(r[1]),
    (r) => r.reverse(),
    (r) => {
      r[0].record.state.coin = "ETH";
    },
    (r) => {
      for (const x of r) x.status = "waitingForTrigger";
    },
    (r) => {
      for (const x of r) x.now -= 3000;
    },
    (r) => {
      r[1].cells[0].text = "wrong";
    },
  ];
  for (const mutate of mutations) {
    const rows = structuredClone(fragments());
    mutate(rows);
    assert.throws(() => assertTwapFieldRows("active", [record], rows, context));
  }
});
