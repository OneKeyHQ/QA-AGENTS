import test from "node:test";
import assert from "node:assert/strict";
import {
  fundsQuoteFixture,
  quoteResponse,
  deferred,
} from "./funds-quote-fixture.mjs";
import { fundsConstants } from "./funds-submit-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
test("D20-42/43 actual deposit hook waits for both account addresses before quote and forwards exact amount/token/current owner", async () => {
  const pending = deferred(),
    f = await fundsQuoteFixture({ accountPending: pending });
  try {
    assert.equal(f.requests.length, 0);
    assert.equal(f.value.perpDepositQuoteLoading, true);
    assert.equal(f.value.checkRefreshQuote, false);
    f.state.accountPending = null;
    await f.settle(pending);
    assert.equal(f.requests.length, 1);
    assert.deepEqual(plain(f.requests[0]), {
      fromNetworkId: "evm--1",
      fromTokenAmount: "10",
      fromTokenAddress: "0xtoken",
      userAddress: "local-A:evm--1:address",
      receivingAddress: "local-A:evm--42161:address",
    });
    assert.equal(f.value.perpDepositQuote.orderId, "local");
    assert.equal(f.value.perpDepositQuoteLoading, false);
    assert.equal(f.value.checkRefreshQuote, false);
    assert.equal(f.events.length, 0);
  } finally {
    await f.close();
  }
});
for (const [name, patch] of [
  ["withdraw", { selectedAction: "withdraw" }],
  ["minimum invalid", { minimum: false }],
  ["no owner", { accountId: undefined }],
  ["no token", { token: undefined }],
  ["empty amount", { amount: "" }],
  ["zero amount", { amount: "0" }],
  ["negative amount", { amount: "-1" }],
  ["NaN amount", { amount: "NaN" }],
  ["insufficient balance", { availableBalanceError: true }],
  [
    "direct Arb USDC",
    {
      token: {
        networkId: "evm--42161",
        contractAddress: fundsConstants.USDC_TOKEN_INFO.address.toUpperCase(),
        symbol: "USDC",
      },
    },
  ],
])
  test(`D20-35/38/42/49 actual quote guards ${name} produce zero quote/build/sign requests`, async () => {
    const f = await fundsQuoteFixture(patch);
    try {
      assert.equal(f.requests.length, 0);
      assert.equal(f.value.perpDepositQuote, undefined);
      assert.equal(f.value.perpDepositQuoteLoading, false);
      assert.equal(f.history.orders.length, 0);
      assert.equal(f.events.length, 0);
      assert.ok(f.cancellations.length >= 1);
    } finally {
      await f.close();
    }
  });
test("D20-43 actual hook rejects older amount response after newer quote; exact precision preserved", async () => {
  const old = deferred(),
    next = deferred(),
    f = await fundsQuoteFixture({ quotePending: old });
  try {
    assert.equal(f.requests.length, 1);
    await f.update({ amount: "11.123456", quotePending: next });
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].fromTokenAmount, "11.123456");
    await f.settle(next, quoteResponse("new"));
    assert.equal(f.value.perpDepositQuote.orderId, "new");
    await f.settle(old, quoteResponse("old"));
    assert.equal(f.value.perpDepositQuote.orderId, "new");
    assert.equal(f.value.perpDepositQuoteLoading, false);
  } finally {
    old.resolve(quoteResponse());
    next.resolve(quoteResponse());
    await f.close();
  }
});
test("D20-43 actual same-mount account switch does not quote new amount with previous owner; stale A response cannot replace B", async () => {
  const old = deferred(),
    next = deferred(),
    account = deferred(),
    f = await fundsQuoteFixture({ quotePending: old });
  try {
    await f.update({
      accountId: "local-B",
      accountPending: account,
      quotePending: next,
    });
    assert.equal(
      f.requests.length,
      1,
      "B account preparation must block quotation with A addresses",
    );
    assert.equal(f.value.perpDepositQuoteLoading, true);
    f.state.accountPending = null;
    await f.settle(account);
    assert.equal(f.requests.length, 2);
    assert.equal(f.requests[1].userAddress, "local-B:evm--1:address");
    await f.settle(next, quoteResponse("B"));
    await f.settle(old, quoteResponse("A"));
    assert.equal(f.value.perpDepositQuote.orderId, "B");
  } finally {
    account.resolve();
    old.resolve(quoteResponse());
    next.resolve(quoteResponse());
    await f.close();
  }
});
test("D20-43 actual token network switch rejects stale quote and resolves both addresses for new network", async () => {
  const old = deferred(),
    next = deferred(),
    f = await fundsQuoteFixture({ quotePending: old });
  try {
    await f.update({
      token: {
        networkId: "evm--8453",
        contractAddress: "0xbase",
        symbol: "BASE",
        decimals: 6,
      },
      quotePending: next,
    });
    assert.equal(f.requests.at(-1).fromNetworkId, "evm--8453");
    assert.equal(f.requests.at(-1).fromTokenAddress, "0xbase");
    assert.equal(f.requests.at(-1).userAddress, "local-A:evm--8453:address");
    await f.settle(next, quoteResponse("base"));
    await f.settle(old, quoteResponse("eth"));
    assert.equal(f.value.perpDepositQuote.orderId, "base");
  } finally {
    old.resolve(quoteResponse());
    next.resolve(quoteResponse());
    await f.close();
  }
});
test("D20-42 invalidation cancels in-flight quote, clears state, and ignores late successful response", async () => {
  const old = deferred(),
    f = await fundsQuoteFixture({ quotePending: old });
  try {
    await f.update({ amount: "0" });
    assert.equal(f.value.perpDepositQuoteLoading, false);
    assert.equal(f.value.perpDepositQuote, undefined);
    await f.settle(old, quoteResponse("stale"));
    assert.equal(f.value.perpDepositQuote, undefined);
    assert.equal(f.requests.length, 1);
  } finally {
    old.resolve(quoteResponse());
    await f.close();
  }
});
test("D20-42 actual cancellation clears loading, requires refresh, then explicit retry recovers current quote", async () => {
  const old = deferred(),
    f = await fundsQuoteFixture({ quotePending: old });
  try {
    await f.settle(
      old,
      Object.assign(Error("local cancellation"), {
        cause: f.swapEnums.ESwapFetchCancelCause.SWAP_PERP_DEPOSIT_QUOTE_CANCEL,
      }),
      true,
    );
    assert.equal(f.value.perpDepositQuoteLoading, false);
    assert.equal(f.value.perpDepositQuote, undefined);
    assert.equal(f.value.checkRefreshQuote, true);
    f.state.quotePending = null;
    f.state.quote = quoteResponse("retry");
    await f.refresh();
    assert.equal(f.value.perpDepositQuote.orderId, "retry");
    assert.equal(f.value.checkRefreshQuote, false);
  } finally {
    old.resolve(quoteResponse());
    await f.close();
  }
});
test("D20-42 actual quote action surfaces non-cancellation failure and releases loading; explicit retry remains available", async () => {
  const f = await fundsQuoteFixture();
  try {
    const pending = deferred();
    f.state.quotePending = pending;
    let request;
    await (
      await import("./source.mjs")
    ).renderer.act(async () => {
      request = f.value.perpDepositQuoteAction();
    });
    const rejected = assert.rejects(request, /local quote failed/u);
    await f.settle(pending, Error("local quote failed"), true);
    await rejected;
    assert.equal(f.value.perpDepositQuoteLoading, false);
    assert.equal(f.value.checkRefreshQuote, true);
    f.state.quotePending = null;
    await f.refresh();
    assert.equal(f.value.perpDepositQuote.orderId, "local");
  } finally {
    await f.close();
  }
});
for (const toAmount of ["0", "-1", "NaN", undefined])
  test(`D20-42 actual empty/bad quote ${toAmount} requires refresh without pretending quote success`, async () => {
    const f = await fundsQuoteFixture({
      quote: quoteResponse("bad", { toAmount }),
    });
    try {
      assert.equal(f.value.checkRefreshQuote, true);
      assert.equal(f.value.perpDepositQuoteLoading, false);
      assert.equal(f.history.orders.length, 0);
    } finally {
      await f.close();
    }
  });
for (const [kind, allowance, expected] of [
  ["hd", { shouldResetApprove: false }, ""],
  ["hardware", undefined, ""],
  ["hardware", { shouldResetApprove: false }, "在设备上确认两次"],
  ["hardware", { shouldResetApprove: true }, "在设备上确认三次"],
  ["external", { shouldResetApprove: false }, "在设备上确认两次"],
])
  test(`D20-53 actual device step display ${kind}/${allowance?.shouldResetApprove}`, async () => {
    const f = await fundsQuoteFixture({
      hardware: kind === "hardware",
      external: kind === "external",
      quote: quoteResponse("approval", { allowanceResult: allowance }),
    });
    try {
      assert.equal(f.value.shouldApprove, Boolean(allowance));
      assert.equal(f.value.multipleStepText, expected);
    } finally {
      await f.close();
    }
  });
