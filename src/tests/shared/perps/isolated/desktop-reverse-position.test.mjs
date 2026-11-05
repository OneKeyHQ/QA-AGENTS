import test from "node:test";
import assert from "node:assert/strict";
import { reversePositionFixture } from "./reverse-position-fixture.mjs";
import { deferred } from "./funds-quote-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
for (const [size, current, next, side] of [
  ["1", "做多 1 BTC", "做空 1 BTC", "出售 2 BTC"],
  ["-1", "做空 1 BTC", "做多 1 BTC", "购买 2 BTC"],
])
  test(`D18-22 actual reverse content ${size}: same-size opposite preview and double market quantity, no order on open`, async () => {
    const f = await reversePositionFixture({
      snapshot: { coin: "BTC", accountAddress: "0xaaa", positionSize: size },
      positions: [
        {
          position: {
            coin: "BTC",
            szi: size,
            leverage: { type: "cross", value: 10 },
          },
        },
      ],
    });
    try {
      const text = f.texts();
      assert.ok(text.includes(current));
      assert.ok(text.includes(next));
      assert.ok(text.includes(side));
      assert.ok(text.includes("市价"));
      assert.equal(f.button().props.disabled, false);
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.ensure, 0);
      assert.equal(
        f.calls.requests.filter(([name]) => name === "data").length,
        0,
        "preview must not depend on slow account-limit lookup",
      );
    } finally {
      await f.close();
    }
  });
test("D18-23 actual explicit HIP3 target is isolated from other same-name position; metadata/book queries use canonical coin", async () => {
  const f = await reversePositionFixture({
    snapshot: { coin: "xyz:BTC", accountAddress: "0xaaa", positionSize: "2" },
    positions: [
      {
        position: {
          coin: "BTC",
          szi: "99",
          leverage: { type: "cross", value: 10 },
        },
      },
      {
        position: {
          coin: "xyz:BTC",
          szi: "2",
          leverage: { type: "cross", value: 5 },
        },
      },
    ],
    meta: {
      coin: "xyz:BTC",
      isSpot: false,
      universe: { szDecimals: 5, maxLeverage: 20 },
    },
  });
  try {
    assert.ok(f.texts().includes("做多 2 BTC"));
    assert.ok(f.texts().includes("做空 2 BTC"));
    assert.ok(!f.texts().join(" ").includes("99 BTC"));
    assert.ok(
      f.calls.requests.every(([, args]) =>
        typeof args === "string" ? args === "xyz:BTC" : args.coin === "xyz:BTC",
      ),
    );
  } finally {
    await f.close();
  }
});
for (const [name, patch] of [
  ["account", { account: { accountAddress: "0xbbb" } }],
  ["closed", { positions: [] }],
  ["quantity", { positions: [{ position: { coin: "BTC", szi: "2" } }] }],
  ["direction", { positions: [{ position: { coin: "BTC", szi: "-1" } }] }],
  ["coin", { positions: [{ position: { coin: "ETH", szi: "1" } }] }],
])
  test(`D18-58 actual current ${name} change disables confirmation and stale callback still rejects before ensure/order`, async () => {
    const f = await reversePositionFixture();
    try {
      const stale = f.button().props.onPress;
      await f.update(patch);
      assert.equal(f.button().props.disabled, true);
      assert.ok(f.texts().includes("仓位或当前账户已变化，请重试。"));
      await (await import("./source.mjs")).renderer.act(async () => stale());
      assert.equal(f.calls.ensure, 0);
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.closed, 0);
      assert.equal(f.calls.toasts.length, 1);
      assert.equal(f.button().props.loading, false);
    } finally {
      await f.close();
    }
  });
for (const stage of ["enable", "target"])
  test(`D18-59/69 actual scope revalidated after deferred ${stage}, no order for changed account`, async () => {
    const pending = deferred(),
      f = await reversePositionFixture(
        stage === "enable"
          ? { ensure: () => pending.promise }
          : { target: pending },
      );
    try {
      const { request } = await f.startSubmit();
      assert.equal(f.button().props.loading, true);
      await f.update({ account: { accountAddress: "0xbbb" } });
      await f.settle(pending);
      await request;
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.closed, 0);
      assert.equal(f.calls.toasts.length, 1);
      assert.equal(f.button().props.loading, false);
    } finally {
      pending.resolve();
      await f.close();
    }
  });
test("D18-24/60 actual content mount/unmount never invokes trading/ensure", async () => {
  const f = await reversePositionFixture();
  assert.equal(f.calls.orders.length, 0);
  assert.equal(f.calls.ensure, 0);
  assert.ok(f.texts().some((t) => /反手/u.test(t)));
  await f.close();
  assert.equal(f.calls.orders.length, 0);
  assert.equal(f.calls.ensure, 0);
  assert.equal(f.calls.closed, 0);
});
test("D18-59 actual unmount during enable preparation cannot place order even after successful enable", async () => {
  const pending = deferred(),
    f = await reversePositionFixture({ ensure: () => pending.promise });
  const { request } = await f.startSubmit();
  await f.close();
  await f.settle(pending);
  await request;
  assert.equal(f.calls.orders.length, 0);
  assert.equal(f.calls.closed, 0);
});
test("D18-69 actual enable then fetchTarget then local order sink; one in-flight click, exact double opposite request and locked success", async () => {
  const pending = deferred(),
    f = await reversePositionFixture({ place: () => pending.promise });
  try {
    const { request } = await f.startSubmit();
    await f.submit();
    assert.equal(f.calls.ensure, 1);
    assert.equal(f.calls.orders.length, 1);
    assert.deepEqual(plain(f.calls.orders[0]), {
      coin: "BTC",
      expectedAccountAddress: "0xaaa",
      isBuy: false,
      size: "2",
      price: "100",
      orderType: "market",
      slippage: 0.08,
    });
    assert.equal(f.calls.closed, 0);
    assert.equal(f.button().props.disabled, true);
    await f.settle(pending);
    await request;
    assert.equal(f.calls.closed, 1);
    await f.submit();
    assert.equal(f.calls.orders.length, 1);
  } finally {
    pending.resolve();
    await f.close();
  }
});
for (const patch of [
  { data: { coin: "ETH", user: "0xaaa" } },
  { data: { coin: "BTC", user: "0xbbb" } },
  { reference: "0" },
  { reference: "NaN" },
])
  test(`D18-59 actual fresh target invalid ${JSON.stringify(patch)} rejects before local order`, async () => {
    const f = await reversePositionFixture(patch);
    try {
      await f.submit();
      assert.equal(f.calls.orders.length, 0);
      assert.equal(f.calls.closed, 0);
      assert.equal(f.calls.toasts.length, 1);
      assert.equal(f.button().props.loading, false);
    } finally {
      await f.close();
    }
  });
test("D18-63 actual wrong/spot metadata gives placeholder, disabled and real retry recovers canonical perp metadata", async () => {
  const f = await reversePositionFixture({
    meta: { coin: "BTC", isSpot: true, universe: { szDecimals: 5 } },
  });
  try {
    assert.equal(f.button().props.disabled, true);
    assert.ok(f.texts().includes("--"));
    f.state.meta = {
      coin: "BTC",
      assetId: 0,
      isSpot: false,
      universe: { szDecimals: 5, maxLeverage: 40 },
    };
    await f.retry();
    assert.equal(f.button().props.disabled, false);
    assert.equal(f.calls.orders.length, 0);
  } finally {
    await f.close();
  }
});
for (const patch of [{ mid: "0" }, { ready: false }])
  test(
    `D18-63 actual missing market data must disable and expose retry ${JSON.stringify(patch)}`,
    {
      todo: "Pinned ReversePositionContent gates confirm only by metadata/size/scope/submitting; missing mid/freshness is not disabled and has no retry. Source regression; pending TF.",
    },
    async () => {
      const f = await reversePositionFixture(patch);
      try {
        assert.equal(f.button().props.disabled, true);
      } finally {
        await f.close();
      }
    },
  );
test("D18-63 diagnostic negative controls: metadata still loaded but missing mid/freshness leaves confirm enabled and retry absent", async () => {
  const f = await reversePositionFixture();
  try {
    assert.equal(f.button().props.disabled, false);
    for (const patch of [{ mid: "0" }, { mid: "100", ready: false }]) {
      await f.update(patch);
      assert.equal(f.button().props.disabled, false);
      assert.equal(f.hasRetry(), false);
      assert.equal(f.calls.orders.length, 0);
    }
  } finally {
    await f.close();
  }
});
for (const patch of [
  { ready: false },
  { mark: "0" },
  { mid: "0" },
  { bookFailure: true },
])
  test(`D18-64 actual unavailable liquidation ${JSON.stringify(patch)} displays placeholder not stale/zero`, async () => {
    const f = await reversePositionFixture(patch);
    try {
      const text = f.texts();
      const labelIndex = text.indexOf("预估强平价");
      assert.ok(labelIndex >= 0);
      assert.equal(text[labelIndex + 1], "--");
    } finally {
      await f.close();
    }
  });
test("D18-69 actual enable rejection releases loading, preserves preview and permits retry, no order until accepted", async () => {
  const f = await reversePositionFixture({
    ensure: async () => {
      throw Error("local user denied");
    },
  });
  try {
    await f.submit();
    assert.equal(f.calls.orders.length, 0);
    assert.equal(f.calls.toasts[0].title, "local user denied");
    assert.equal(f.button().props.loading, false);
    assert.equal(f.button().props.disabled, false);
    f.state.ensure = async () => {};
    await f.submit();
    assert.equal(f.calls.orders.length, 1);
  } finally {
    await f.close();
  }
});
test("D18-69 actual exchange failure leaves preview retryable without duplicate toast or close", async () => {
  const f = await reversePositionFixture({
    place: async () => {
      throw Error("local exchange rejected");
    },
  });
  try {
    await f.submit();
    assert.equal(f.calls.orders.length, 1);
    assert.equal(f.calls.toasts.length, 0);
    assert.equal(f.calls.closed, 0);
    assert.equal(f.button().props.loading, false);
    f.state.place = async () => {};
    await f.submit();
    assert.equal(f.calls.orders.length, 2);
    assert.equal(f.calls.closed, 1);
  } finally {
    await f.close();
  }
});
test("D18-64 retained book expires by wall clock when polling fails; liquidation placeholder appears without stream changes", async () => {
  const f = await reversePositionFixture();
  try {
    const price = () => {
      const text = f.texts();
      return text[text.indexOf("预估强平价") + 1];
    };
    assert.match(price(), /^\$[\d,.]+$/u);
    f.state.bookFailure = true;
    await f.tick(f.cache.PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS);
    assert.match(price(), /^\$[\d,.]+$/u);
    await f.tick(1);
    assert.equal(price(), "--");
    assert.equal(f.calls.orders.length, 0);
  } finally {
    await f.close();
  }
});

test("D18-60 actual PositionsRow callback opens dedicated reverse dialog even when ordinary confirmation is skipped, with zero preconfirm mutations", async () => {
  const f = await reversePositionFixture({
    useOuterDialog: true,
    skipOrdinaryOrderConfirmation: true,
  });
  try {
    assert.equal(f.dialogProps().title, "反手开仓");
    assert.equal(f.dialogProps().disableDrag, true);
    assert.equal(f.dialogProps().showFooter, false);
    assert.equal(f.dialogProps().onBeforeClose(), true);
    assert.ok(f.texts().includes("出售 2 BTC"));
    assert.equal(f.button().props.disabled, false);
    assert.deepEqual(f.calls.orders, []);
    assert.equal(f.calls.ensure, 0);
    assert.equal(f.state.positions[0].position.szi, "1");
    assert.equal(f.dialog.close(), true);
    assert.equal(f.calls.closed, 1);
    assert.deepEqual(f.calls.orders, []);
  } finally {
    await f.close();
  }
});
test("D18-65 actual outer dialog disallows closing during local in-flight submit and releases guard on failure", async () => {
  const pending = deferred();
  const f = await reversePositionFixture({
    useOuterDialog: true,
    place: () => pending.promise,
  });
  try {
    const run = await f.startSubmit();
    assert.equal(f.dialogProps().onBeforeClose(), false);
    assert.equal(f.dialog.close(), false);
    assert.equal(f.calls.closed, 0);
    assert.equal(f.button().props.loading, true);
    assert.equal(f.button().props.disabled, true);
    await f.submit();
    assert.equal(f.calls.orders.length, 1);
    await f.settle(pending, Error("local rejected"), true);
    await run.request;
    assert.equal(f.dialogProps().onBeforeClose(), true);
    assert.equal(f.button().props.loading, false);
    assert.equal(f.button().props.disabled, false);
    assert.equal(f.dialog.close(), true);
  } finally {
    pending.resolve();
    await f.close();
  }
});
