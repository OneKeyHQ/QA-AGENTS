import test from "node:test";
import assert from "node:assert/strict";
import { fillRow } from "./twap-fill-fixture.mjs";
import { historyRow, orderState } from "./twap-source-fixture.mjs";
import { stateFixture } from "./twap-state-fixture.mjs";

const cases = [
  {
    fills: [
      ["0.5", "100"],
      ["1", "110"],
    ],
    size: "1.5",
    notional: "160",
    average: "106.67",
  },
  {
    fills: [
      ["0.25", "90"],
      ["0.25", "110"],
      ["0.5", "110"],
    ],
    size: "1",
    notional: "105",
    average: "105",
  },
];
for (const [index, sample] of cases.entries())
  test(`D11-205 actual Desktop fill rows and weighted historical average ${index}`, async () => {
    const f = stateFixture();
    const fills = sample.fills.map(([sz, px], i) => ({
      twapId: 7,
      fill: {
        tid: i,
        time: new Date(2026, 9, 30, 8, 0, i + 1).getTime(),
        coin: "BTC",
        side: "B",
        sz,
        px,
        fee: "0",
        feeToken: "USDC",
        closedPnl: "0",
      },
    }));
    // The HTTP snapshot contains all fills; a duplicated short push must not
    // affect the independent executed-size/notional oracle or displayed rows.
    f.responses.fills = fills;
    await f.actions.loadTwapData();
    await f.actions.updateTwapSliceFills({
      user: f.account,
      twapSliceFills: fills.slice(-1),
    });
    assert.equal(f.state.fills.fills.length, fills.length);
    const total = f.state.fills.fills.reduce(
      (sum, r) => sum + Number(r.fill.sz),
      0,
    );
    const notional = f.state.fills.fills.reduce(
      (sum, r) => sum + Number(r.fill.sz) * Number(r.fill.px),
      0,
    );
    assert.equal(String(total), sample.size);
    assert.equal(String(notional), sample.notional);
    const rows = [];
    let historical;
    try {
      for (const record of f.state.fills.fills) {
        const row = await fillRow(record);
        rows.push(row);
        const cells = row.cells(),
          original = fills.find((r) => r.fill.tid === record.fill.tid);
        assert.equal(cells[0], "2026/10/30");
        assert.equal(cells[1], `08:00:0${original.fill.tid + 1}`);
        assert.equal(cells[2], "BTC");
        assert.equal(
          cells[4],
          original.fill.px,
          "Actual price, not estimated price",
        );
        assert.equal(cells[5], original.fill.sz, "Actual unequal fill size");
      }
      historical = await historyRow(
        orderState({ executedSz: sample.size, executedNtl: sample.notional }),
      );
      assert.equal(historical.cells()[4], `${sample.size} BTC`);
      assert.equal(
        historical.cells()[5],
        sample.average,
        "Independent literal weighted average, not arithmetic mean or form estimate",
      );
    } finally {
      for (const row of rows) await row.close();
      if (historical) await historical.close();
    }
  });
test("D11-205 actual fill row replaces previous order values and timestamp", async () => {
  const record = {
    twapId: 7,
    fill: {
      tid: 0,
      time: new Date(2026, 9, 30, 8, 0, 1).getTime(),
      coin: "BTC",
      side: "B",
      sz: "0.5",
      px: "100",
      fee: "0",
      feeToken: "USDC",
      closedPnl: "0",
    },
  };
  const row = await fillRow(record);
  try {
    assert.equal(row.cells()[2], "BTC");
    await row.update({
      record: {
        twapId: 8,
        fill: {
          ...record.fill,
          tid: 1,
          coin: "ETH",
          time: new Date(2026, 9, 30, 9, 1, 2).getTime(),
          sz: "2",
          px: "200",
        },
      },
    });
    assert.deepEqual(row.cells().slice(0, 6), [
      "2026/10/30",
      "09:01:02",
      "ETH",
      "direction-host",
      "200",
      "2",
    ]);
  } finally {
    await row.close();
  }
});
