// Exact manual price and runtime boundaries. Source/component evidence only.
import test from "node:test";
import assert from "node:assert/strict";
import {
  twap,
  guard,
  activeRow,
  historyRow,
  orderState,
  origin,
  baseInfo,
} from "./twap-source-fixture.mjs";

for (const side of ["long", "short"])
  for (const [stop, valid] of [
    ["99.99", false],
    ["100", false],
    ["100.01", true],
  ]) {
    test(`D11-333 no-trigger stop boundary ${side}/${stop}`, () => {
      const expected = side === "long" ? valid : stop === "99.99";
      const f = guard({ twapStopPrice: stop }, {}, side);
      assert.equal(f.result, expected ? undefined : "invalidTwapConfig");
      assert.deepEqual(
        f.toasts.map((t) => t.title),
        expected
          ? []
          : [
              side === "long"
                ? "价格上限必须高于当前标记价格。"
                : "价格下限必须低于当前标记价格。",
            ],
      );
    });
  }
for (const side of ["long", "short"])
  for (const trigger of ["90", "110"])
    for (const offset of [-0.01, 0, 0.01]) {
      test(`D11-334 stop must cross trigger rather than mark ${side}/${trigger}/${offset}`, () => {
        const stop = (Number(trigger) + offset).toFixed(2),
          valid = side === "long" ? offset > 0 : offset < 0;
        const f = guard(
          { twapTriggerPrice: trigger, twapStopPrice: stop },
          {},
          side,
        );
        assert.equal(f.result, valid ? undefined : "invalidTwapConfig");
        assert.deepEqual(
          f.toasts.map((t) => t.title),
          valid
            ? []
            : [
                side === "long"
                  ? "价格上限必须高于触发价格。"
                  : "价格下限必须低于触发价格。",
              ],
        );
      });
    }
for (const side of ["long", "short"])
  test(`D11-332 trigger can cross either direction, equality rejects ${side}`, () => {
    for (const price of ["99.99", "100.01"]) {
      assert.equal(
        guard({ twapTriggerPrice: price }, {}, side).result,
        undefined,
      );
      assert.equal(
        twap.getTwapTriggerAbove({ triggerPrice: price, markPrice: "100" }),
        price === "100.01",
      );
    }
    const f = guard({ twapTriggerPrice: "100" }, {}, side);
    assert.equal(f.result, "invalidTwapConfig");
    assert.deepEqual(
      f.toasts.map((t) => t.title),
      ["请输入触发价格"],
    );
  });
for (const field of ["twapTriggerPrice", "twapStopPrice"])
  for (const value of ["0", "-1", "abc", "NaN", "Infinity", "💰"]) {
    test(`D11-335 actual validation rejects ${field}=${value}`, () => {
      const f = guard({ [field]: value });
      assert.equal(f.result, "invalidTwapConfig");
      assert.equal(f.toasts.length, 1);
      assert.equal(
        f.toasts[0].title,
        field === "twapTriggerPrice"
          ? "请输入触发价格"
          : "价格上限必须高于当前标记价格。",
      );
    });
  }
test("D11-340 actual Desktop row hides waiting time, then starts at activation time", async () => {
  const state = orderState(),
    row = await activeRow(state, { now: origin + 120_000 });
  try {
    assert.equal(row.cells()[6], "--");
    assert.equal(row.cells()[7], "等待触发");
    await row.update({
      status: "activated",
      activatedAt: origin + 120_000,
      now: origin + 180_000,
    });
    assert.equal(row.cells()[6], "00:01:00 / 5 分钟");
    assert.equal(row.cells()[7], "活跃中");
  } finally {
    await row.close();
  }
});
test("D11-341 actual Desktop row stays activated with zero fills", async () => {
  const state = orderState(),
    status = twap.getActiveTwapRuntimeStatus({
      reportedStatus: "activated",
      triggerPrice: "120",
      executedSize: "0",
    });
  const row = await activeRow(state, {
    status,
    activatedAt: origin + 120_000,
    now: origin + 180_000,
  });
  try {
    assert.equal(status, "activated");
    assert.equal(row.cells()[7], "活跃中");
    assert.match(String(row.cells()[2]), /^0(?:\.0+)? BTC$/u);
    assert.equal(row.cells()[6], "00:01:00 / 5 分钟");
  } finally {
    await row.close();
  }
});
for (const status of ["finished", "stopped", "terminated", "error"])
  test(`D11-342 terminal ${status} freezes, caps duration and preserves legacy placeholder`, () => {
    const state = orderState();
    for (const now of [origin + 180_000, origin + 240_000]) {
      assert.equal(baseInfo(state, { status, now }).runningTimeText, "--");
      assert.equal(
        baseInfo(state, {
          status,
          activatedAt: origin + 120_000,
          endTime: origin + 180_000,
          now,
        }).runningTimeText,
        "00:01:00 / 5 分钟",
      );
      assert.equal(
        baseInfo(state, {
          status,
          activatedAt: origin,
          endTime: origin + 600_000,
          now,
        }).runningTimeText,
        "00:05:00 / 5 分钟",
      );
    }
  });
test("D11-344 actual Desktop row does not retain stale prices when fields disappear or coin changes", async () => {
  const state = orderState({ trigger: { px: "123.45" }, stopPx: "130.01" }),
    row = await activeRow(state);
  try {
    assert.deepEqual(row.cells().slice(4, 6), ["123.45", "130.01"]);
    await row.update({
      order: {
        twapId: 7,
        state: orderState({ trigger: undefined, stopPx: undefined }),
      },
    });
    assert.deepEqual(row.cells().slice(4, 6), ["--", "--"]);
    await row.update({
      order: {
        twapId: 8,
        state: orderState({
          coin: "ETH",
          trigger: { px: "90.5" },
          stopPx: "99",
        }),
      },
    });
    assert.equal(row.cells()[0], "ETH");
    assert.deepEqual(row.cells().slice(4, 6), ["90.5", "99"]);
  } finally {
    await row.close();
  }
});
test("D11-346 late earlier events cannot replace newer terminal runtime metadata", () => {
  const event = (id, offset, status) => ({
    twapId: id,
    time: origin + offset,
    state: { coin: "BTC", timestamp: origin },
    status: { status },
  });
  const stopped = event(7, 180_000, "stopped"),
    activated = event(7, 120_000, "activated"),
    waiting = event(7, 0, "waitingForTrigger");
  for (const events of [
    [stopped, activated, waiting],
    [waiting, stopped, activated],
    [activated, waiting, stopped],
  ]) {
    const map = twap.buildActiveTwapRuntimeInfoById([
      ...events,
      event(8, 160_000, "activated"),
      { ...waiting, twapId: undefined },
    ]);
    assert.equal(map.size, 2);
    assert.equal(map.get(7).reportedStatus, "stopped");
    assert.equal(map.get(7).activatedAt, origin + 120_000);
    assert.equal(map.get(8).reportedStatus, "activated");
    assert.equal(
      twap.getActiveTwapRuntimeStatus({
        reportedStatus: map.get(7).reportedStatus,
        executedSize: "1",
        triggerPrice: "120",
      }),
      "stopped",
    );
  }
});

test("D11-344 actual Desktop history row independently clears and replaces both prices", async () => {
  const state = orderState({ trigger: { px: "123.45" }, stopPx: "130.01" });
  const row = await historyRow(state);
  try {
    assert.deepEqual(row.cells().slice(6, 8), ["123.45", "130.01"]);
    await row.update({
      record: {
        twapId: 7,
        time: origin + 180_000,
        status: { status: "finished" },
        state: orderState({ trigger: undefined, stopPx: undefined }),
      },
    });
    assert.deepEqual(row.cells().slice(6, 8), ["--", "--"]);
    await row.update({
      record: {
        twapId: 8,
        time: origin + 180_000,
        status: { status: "stopped" },
        state: orderState({
          coin: "ETH",
          trigger: { px: "90.5" },
          stopPx: "99",
        }),
      },
    });
    assert.equal(row.cells()[2], "ETH");
    assert.deepEqual(row.cells().slice(6, 8), ["90.5", "99"]);
  } finally {
    await row.close();
  }
});

for (const field of ["twapTriggerPrice", "twapStopPrice"])
  test(`D11-335 blank optional ${field} is treated as absent`, () => {
    // Whitespace is trimmed before optional-field validation, so absence is valid.
    assert.equal(guard({ [field]: " " }).result, undefined);
  });
for (const [field, raw, formatted] of [
  ["twapTriggerPrice", "100.00000001", "100"],
  ["twapStopPrice", "100.00000001", "100"],
  ["twapTriggerPrice", "0.000000001", undefined],
]) {
  test(`D11-335 formatted ${field}=${raw} cannot bypass boundary validation`, () => {
    assert.equal(
      twap.formatTwapPriceForOrder({
        price: raw,
        szDecimals: 2,
        assetType: "perp",
      }),
      formatted,
    );
    assert.equal(guard({ [field]: raw }).result, "invalidTwapConfig");
  });
}
