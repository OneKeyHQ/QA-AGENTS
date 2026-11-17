import assert from "node:assert/strict";
import test from "node:test";
import { aliasMatches } from "../search-alias-oracle.mjs";

const matches = (query, aliases) =>
  aliasMatches("TOKEN", query, {
    tokenSearchAliases: { TOKEN: { aliases } },
  });

test("one/two ASCII letters or digits match only the alias prefix, regardless of alias length", () => {
  assert.equal(matches("bt", ["notbitcoin"]), false);
  assert.equal(matches("b", ["notbitcoin"]), false);
  assert.equal(matches("bt", ["btctoken"]), true);
  assert.equal(matches("12", ["a12token"]), false);
  assert.equal(matches("12", ["12token"]), true);
});

test("three ASCII characters match a substring; comparison is case insensitive", () => {
  assert.equal(matches("BTC", ["wrappedBTC"]), true);
  assert.equal(matches("BT", ["BToken"]), true);
  assert.equal(matches("Btc", ["gold"]), false);
});

test("short non-ASCII or punctuation queries retain substring matching", () => {
  assert.equal(matches("币", ["比特币"]), true);
  assert.equal(matches("コイ", ["ビットコイン"]), true);
  assert.equal(matches(":", ["xyz:btc"]), true);
  assert.equal(matches("-b", ["wrapped-btc"]), true);
});

test("missing aliases do not invent a match", () => {
  assert.equal(
    aliasMatches("MISSING", "btc", { tokenSearchAliases: {} }),
    false,
  );
  assert.equal(matches("btc", []), false);
});
