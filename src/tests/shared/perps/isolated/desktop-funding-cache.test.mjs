// Real source cache wrapper + real memoizee. Only clock and infoClient transport
// are local. No SDK/account/wallet/signature/background instance is imported.
import test from "node:test";
import assert from "node:assert/strict";
import { appRequire } from "./source.mjs";
import { fundingServiceFixture as serviceFixture } from "./funding-service-fixture.mjs";
const plain = (x) => JSON.parse(JSON.stringify(x));
test("D09-229/262 actual service cache shares in-flight requests, retains same-ms distinct records, caps/sorts 2000 and expires after exactly five minutes", async () => {
  const clock = appRequire("@sinonjs/fake-timers").install({
    now: 1800000000000,
    toFake: ["Date", "setTimeout", "clearTimeout"],
  });
  let f;
  try {
    f = serviceFixture();
    f.state.records = Array.from({ length: 2003 }, (_, i) => ({
      time: i < 3 ? 1000 : 2000,
      hash: String(i).padStart(5, "0"),
      delta: { coin: "BTC", usdc: String(i) },
    }));
    let release;
    f.state.pending = new Promise((r) => (release = r));
    const a = f.service.getUserFundingHistory({ accountAddress: "0xAAA" }),
      b = f.service.getUserFundingHistory({
        accountAddress: "0xaaa",
        force: true,
      });
    assert.equal(f.requests.length, 1);
    assert.deepEqual(plain(f.requests[0]), { user: "0xaaa" });
    release();
    const [first, second] = await Promise.all([a, b]);
    assert.equal(first, second);
    assert.equal(first.length, 2000);
    assert.equal(new Set(first.map((x) => x.hash)).size, 2000);
    assert.equal(first[0].hash, "02002");
    assert.equal(first.at(-1).hash, "00003");
    assert.ok(first.every((x) => x.time === 2000));
    f.state.pending = null;
    // memoizee registers expiry from settled promise via nextTick.
    await clock.tickAsync(0);
    await f.service.getUserFundingHistory({ accountAddress: "0xAAA" });
    assert.equal(f.requests.length, 1);
    await clock.tickAsync(299999);
    await f.service.getUserFundingHistory({ accountAddress: "0xaaa" });
    assert.equal(f.requests.length, 1);
    await clock.tickAsync(1);
    await f.service.getUserFundingHistory({ accountAddress: "0xaaa" });
    assert.equal(f.requests.length, 2);
    await clock.tickAsync(0);
    await f.service.getUserFundingHistory({
      accountAddress: "0xaaa",
      force: true,
    });
    assert.equal(f.requests.length, 3);
    await f.service.getUserFundingHistory({ accountAddress: "0xBBB" });
    assert.equal(f.requests.length, 4);
    assert.deepEqual(plain(f.requests.at(-1)), { user: "0xbbb" });
  } finally {
    f?.clear();
    clock.uninstall();
  }
});
test("D09-215 actual failed first request is evicted and retry obtains new records", async () => {
  const f = serviceFixture();
  try {
    f.state.fail = true;
    await assert.rejects(
      f.service.getUserFundingHistory({ accountAddress: "0xaaa" }),
      /local info unavailable/,
    );
    await new Promise((r) => setImmediate(r));
    f.state.fail = false;
    f.state.records = [
      { time: 2, hash: "b", delta: { coin: "ETH", usdc: "2" } },
    ];
    const records = await f.service.getUserFundingHistory({
      accountAddress: "0xaaa",
    });
    assert.equal(f.requests.length, 2);
    assert.equal(records[0].delta.coin, "ETH");
  } finally {
    f.clear();
  }
});
