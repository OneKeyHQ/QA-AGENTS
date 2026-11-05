// Same mounted actual content -> actual query hook -> actual usePromiseResult.
// Background transport, chart pixels and layout are explicit local boundaries.
import test from "node:test";
import assert from "node:assert/strict";
import { renderer } from "./source.mjs";
import {
  portfolioContentFixture,
  portfolioFunding,
} from "./portfolio-content-fixture.mjs";
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};
const retry = (f) =>
  f
    .byType("Button")
    .find(
      (n) =>
        n.props.testID?.includes("funding") && n.props.testID.includes("retry"),
    );
const summary = (f) =>
  ["24小时净额", "7天净额", "累计净额"].map((label) => f.metric(label)[0].text);
const amount = (f) => f.chart()?.data.reduce((sum, entry) => sum + entry[1], 0);
for (const lateFailure of [false, true])
  test(`D09-213 actual mounted content clears all A views during B load and ignores late A ${lateFailure ? "failure" : "success"}`, async () => {
    const a = deferred(),
      b = deferred();
    const f = await portfolioContentFixture({
      actualFundingQuery: true,
      initialChartType: "funding",
      fundingService: (args) =>
        args.accountAddress.toLowerCase() === "0xaaa" ? a.promise : b.promise,
    });
    try {
      assert.equal(f.fundingRequests.length, 1);
      await f.update({ account: { accountAddress: "0xbbb" } });
      assert.equal(f.fundingRequests.length, 2);
      assert.equal(f.chart(), undefined);
      assert.ok(f.byType("Skeleton").length >= 16);
      await renderer.act(async () => {
        b.resolve([portfolioFunding("SOL", 7)]);
        await Promise.resolve();
      });
      assert.equal(amount(f), 7);
      assert.deepEqual(summary(f), ["+$7.00", "+$7.00", "+$7.00"]);
      assert.ok(f.texts().includes("SOL 100.00%"));
      assert.ok(!f.texts().some((x) => /^BTC(?: |$)/u.test(x)));
      await renderer.act(async () => {
        if (lateFailure) a.reject(Error("stale A"));
        else a.resolve([portfolioFunding("BTC", 999)]);
        await Promise.resolve();
      });
      assert.equal(amount(f), 7);
      assert.deepEqual(summary(f), ["+$7.00", "+$7.00", "+$7.00"]);
      assert.ok(!f.texts().some((x) => /^BTC(?: |$)/u.test(x)));
      assert.equal(retry(f), undefined);
    } finally {
      a.resolve([]);
      b.resolve([]);
      await f.close();
    }
  });
for (const which of ["chart", "breakdown"])
  test(`D09-215 actual ${which} retry click invokes real query and restores chart, all summaries and distribution together`, async () => {
    const pending = deferred();
    let fail = true;
    const f = await portfolioContentFixture({
      actualFundingQuery: true,
      initialChartType: "funding",
      fundingService: async () => {
        if (fail) throw Error("local unavailable");
        return pending.promise;
      },
    });
    try {
      assert.equal(f.chart(), undefined);
      assert.deepEqual(summary(f), ["--", "--", "--"]);
      const buttons = f
        .byType("Button")
        .filter(
          (n) =>
            n.props.testID?.includes("funding") &&
            n.props.testID.includes("retry"),
        );
      assert.equal(buttons.length, 2);
      assert.ok(f.texts().includes("失败"));
      fail = false;
      await renderer.act(async () => {
        buttons[which === "chart" ? 0 : 1].props.onPress();
        await Promise.resolve();
      });
      assert.equal(f.fundingRequests.length, 2);
      assert.ok(f.byType("Skeleton").length >= 16);
      await renderer.act(async () => {
        pending.resolve([
          portfolioFunding("ETH", 9),
          portfolioFunding("SOL", -2),
        ]);
        await Promise.resolve();
      });
      assert.equal(amount(f), 7);
      assert.deepEqual(summary(f), ["+$7.00", "+$7.00", "+$7.00"]);
      assert.equal(retry(f), undefined);
      assert.equal(f.metric("累计收取")[0].text, "$9.00");
      assert.equal(f.metric("累计支付")[0].text, "$2.00");
    } finally {
      pending.resolve([]);
      await f.close();
    }
  });
