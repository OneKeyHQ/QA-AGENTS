import test from "node:test";
import assert from "node:assert/strict";
import { fundingQueryFixture } from "./funding-query-fixture.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
test("D09-262 actual query hook and actual service cache compose: inactive zero transport, reentry hits cache, five-minute expiry and explicit force reload", async () => {
  const { appRequire } = await import("./source.mjs");
  const { fundingServiceFixture } =
    await import("./funding-service-fixture.mjs");
  const clock = appRequire("@sinonjs/fake-timers").install({
    now: 1800000000000,
    toFake: ["Date", "setTimeout", "clearTimeout"],
  });
  let service, f;
  try {
    service = fundingServiceFixture();
    service.state.records = [
      { time: 1800000000000, hash: "A", delta: { coin: "BTC", usdc: "1" } },
    ];
    f = await fundingQueryFixture({
      clock,
      service: (args) => service.service.getUserFundingHistory(args),
    });
    assert.equal(service.requests.length, 0);
    await f.update({ isActive: true });
    await f.tick(0);
    assert.equal(service.requests.length, 1);
    assert.equal(f.value.records[0].hash, "A");
    await f.update({ isActive: false });
    await f.update({ isActive: true });
    assert.equal(
      service.requests.length,
      1,
      "focus invokes hook but actual transport uses live cache",
    );
    await f.update({ isActive: false });
    await f.tick(299999);
    await f.update({ isActive: true });
    assert.equal(service.requests.length, 1);
    await f.update({ isActive: false });
    await f.tick(1);
    service.state.records = [
      { time: 1800000300000, hash: "B", delta: { coin: "ETH", usdc: "2" } },
    ];
    await f.update({ isActive: true });
    await f.tick(0);
    assert.equal(service.requests.length, 2);
    assert.equal(f.value.records[0].hash, "B");
    await f.refresh();
    await f.tick(0);
    assert.equal(service.requests.length, 3);
    assert.equal(f.requests.at(-1).force, true);
  } finally {
    await f?.close();
    service?.clear();
    clock.uninstall();
  }
});
test("D09-227/262 actual promise/funding hooks gate inactive views, preserve scope on reentry and revalidate focus", async () => {
  const f = await fundingQueryFixture();
  try {
    assert.equal(f.requests.length, 0);
    await f.tick(3600001);
    assert.equal(f.requests.length, 0);
    await f.update({ isActive: true });
    assert.equal(f.requests.length, 1);
    assert.equal(f.value.records.length, 1);
    await f.update({ isActive: false });
    assert.equal(f.requests.length, 1);
    assert.equal(f.value.records.length, 1);
    await f.update({ isActive: true });
    assert.equal(f.requests.length, 2);
    assert.equal(f.value.records.length, 1);
    assert.ok(f.requests.every((r) => r.force === false));
  } finally {
    await f.close();
  }
});
test("D09-228 actual hourly funding refresh fires once, resets from latest refresh, and cancels when inactive/unmounted", async () => {
  const f = await fundingQueryFixture({ isActive: true });
  try {
    assert.equal(f.requests.length, 1);
    await f.tick(3599999);
    assert.equal(f.requests.length, 1);
    await f.tick(1);
    assert.equal(f.requests.length, 2);
    await f.tick(60000);
    await f.refresh();
    assert.equal(f.requests.length, 3);
    assert.equal(f.requests[2].force, true);
    await f.tick(3599999);
    assert.equal(f.requests.length, 3);
    await f.tick(1);
    assert.equal(f.requests.length, 4);
    assert.equal(f.requests[3].force, false);
    await f.update({ isActive: false });
    await f.tick(3600000);
    assert.equal(f.requests.length, 4);
  } finally {
    await f.close();
  }
  assert.equal(f.clock.countTimers(), 0);
});
test("D09-215/216 actual refresh failure retains same-account success but fresh-account failure is explicit and retry recovers", async () => {
  const f = await fundingQueryFixture({ isActive: true });
  try {
    const original = plain(f.value.records);
    await f.update({ fail: true });
    await f.refresh();
    assert.deepEqual(plain(f.value.records), original);
    assert.equal(f.value.isError, false);
    await f.update({ address: "0xBBB" });
    assert.equal(f.value.records.length, 0);
    assert.equal(f.value.isError, true);
    await f.update({
      fail: false,
      records: [{ time: 2, delta: { coin: "ETH", usdc: "3" } }],
    });
    await f.refresh();
    assert.equal(f.value.isError, false);
    assert.equal(f.value.accountAddress, "0xbbb");
    assert.equal(f.value.records[0].delta.coin, "ETH");
    assert.equal(f.requests.at(-1).force, true);
  } finally {
    await f.close();
  }
});
for (const outcome of ["success", "failure"])
  test(`D09-213 actual late A ${outcome} after inactive switch cannot replace B, refocus loads only B`, async () => {
    const f = await fundingQueryFixture({ isActive: true });
    let release;
    try {
      const pending = new Promise((r) => (release = r));
      await f.update({ pending, fail: outcome === "failure" });
      let refresh = f.startRefresh();
      await Promise.resolve();
      await f.update({
        address: "0xBBB",
        isActive: false,
        pending: null,
        fail: false,
        records: [{ time: 2, delta: { coin: "ETH", usdc: "3" } }],
      });
      assert.equal(f.value.records.length, 0);
      release();
      await refresh;
      await f.flush();
      assert.equal(f.value.accountAddress, "0xbbb");
      assert.equal(f.value.records.length, 0);
      await f.update({ isActive: true });
      assert.equal(f.value.records[0].delta.coin, "ETH");
      assert.equal(f.value.isError, false);
    } finally {
      release?.();
      await f.close();
    }
  });
test("D09-265 missing account does not request and is never an infinite loading state", async () => {
  const f = await fundingQueryFixture({ isActive: true, address: undefined });
  try {
    assert.equal(f.requests.length, 0);
    assert.equal(f.value.records.length, 0);
    assert.equal(f.value.isLoading, false);
    assert.equal(f.value.isError, false);
  } finally {
    await f.close();
  }
});
