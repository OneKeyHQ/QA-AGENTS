import test from "node:test";
import assert from "node:assert/strict";
import { assertFavoriteSync, waitForFavoriteSync } from "../favorite-sync.mjs";

test("取消收藏后目标保留旧项、移除错项、重排或漏项都必须失败", () => {
  for (const stale of [
    ["BTC", "ETH", "BNB"],
    ["BTC", "BNB"],
    ["BNB", "ETH"],
    ["ETH"],
  ]) {
    assert.throws(
      () => assertFavoriteSync(["ETH", "BNB"], stale),
      /target mismatch/,
    );
  }
  assert.doesNotThrow(() => assertFavoriteSync(["ETH", "BNB"], ["ETH", "BNB"]));
});
test("独立读取异步目标；一直停留旧状态必须失败", async () => {
  let reads = 0;
  assert.deepEqual(
    await waitForFavoriteSync(
      async () => (++reads === 1 ? ["BTC", "ETH"] : ["ETH"]),
      ["ETH"],
      { interval: 1 },
    ),
    ["ETH"],
  );
  assert.equal(reads, 2);
  await assert.rejects(
    waitForFavoriteSync(async () => ["BTC", "ETH"], ["ETH"], {
      timeout: 2,
      interval: 1,
    }),
    /target mismatch/,
  );
});
