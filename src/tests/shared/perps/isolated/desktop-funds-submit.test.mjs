import test from "node:test";
import assert from "node:assert/strict";
import {
  fundsSubmitFixture,
  fundsConstants,
  ESwapTxHistoryStatus,
} from "./funds-submit-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const actions = (f) => f.events.map(([n]) => n);
for (const amount of ["", "0", "-1", "NaN"])
  test(`D20-37/65 actual submit validation rejects ${JSON.stringify(amount)} with enter-amount error`, () => {
    const f = fundsSubmitFixture({ amount });
    assert.equal(f.validate(), false);
    assert.deepEqual(plain(f.toasts), [["error", { title: "输入代币数量" }]]);
    assert.equal(f.submissions.length, 0);
  });
for (const selectedAction of ["deposit", "withdraw"])
  test(`D20-38/65 ${selectedAction} validates the correct token/unit ceiling before any request`, () => {
    const f = fundsSubmitFixture({
      selectedAction,
      amount: "1000",
      tokenAmount: "101",
    });
    assert.equal(f.validate(), false);
    assert.deepEqual(plain(f.toasts), [["error", { title: "余额不足" }]]);
    assert.equal(f.events.length, 0);
    assert.equal(f.submissions.length, 0);
  });
test("D20-36/38 actual USD amount uses converted token balance rather than comparing fiat to token balance", () => {
  const f = fundsSubmitFixture({
    amount: "1000",
    tokenAmount: "10",
    balance: "10",
  });
  assert.equal(f.validate(), true);
  assert.equal(f.toasts.length, 0);
  f.state.tokenAmount = "10.000001";
  assert.equal(f.validate(), false);
  assert.equal(f.toasts.at(-1)[1].title, "余额不足");
});
for (const selectedAction of ["deposit", "withdraw"])
  test(`D20-35/63 actual ${selectedAction} minimum error contains current amount/symbol and clears after correction`, () => {
    const f = fundsSubmitFixture({
      selectedAction,
      amount: "1.5",
      tokenAmount: "1.5",
      minimum: { value: false, minFromTokenAmount: "5" },
      minWithdraw: "2.500001",
    });
    assert.equal(f.validate(), false);
    assert.equal(f.state.showMinAmountError, true);
    assert.equal(
      f.toasts[0][1].title,
      selectedAction === "deposit"
        ? "最低存款金额为 5 USDC"
        : "最低提现金额为 2.500001 USDC",
    );
    f.state.amount = "10";
    f.state.tokenAmount = "10";
    f.state.minimum = { value: true };
    assert.equal(f.validate(), true);
    assert.equal(f.state.showMinAmountError, false);
  });
for (const [balance, reserve, expected] of [
  ["1.23456789", "0.01", "1.224567"],
  ["0.001", "0.01", "0"],
  ["1.23456789", undefined, "1.23456789"],
])
  test(`D20-39 native MAX balance=${balance} reserve=${reserve} uses current network and does not overdraw`, () => {
    const f = fundsSubmitFixture({
      nativeTokenConfigs: reserve
        ? [{ networkId: "evm--1", reserveGas: reserve }]
        : [],
    });
    f.max({
      networkId: "evm--1",
      isNative: true,
      amount: balance,
      symbol: "ETH",
      decimals: 6,
    });
    assert.equal(f.state.amount, expected);
    assert.equal(f.toasts[0][0], "message");
    assert.doesNotMatch(f.toasts[0][1].title, /undefined|NaN|Infinity|\{\w+\}/);
    assert.equal(f.submissions.length, 0);
  });
test("D20-27/36/39 MAX immediately uses newly selected token balance, network reserve, unit and price", () => {
  const f = fundsSubmitFixture({
    depositInputUnit: "usd",
    tokenPrice: "999",
    nativeTokenConfigs: [
      { networkId: "evm--1", reserveGas: "0.1" },
      { networkId: "evm--42161", reserveGas: "0.001" },
    ],
  });
  f.max({
    networkId: "evm--1",
    isNative: true,
    amount: "1",
    symbol: "ETH",
    decimals: 6,
    price: "3.3333",
  });
  assert.equal(f.state.amount, "2.99");
  f.max({
    networkId: "evm--42161",
    isNative: false,
    amount: "7.123456",
    symbol: "USDC",
    decimals: 6,
    price: "1",
  });
  assert.equal(f.state.amount, "7.12");
  assert.equal(f.toasts.length, 1);
  f.state.depositInputUnit = "token";
  f.max({
    networkId: "evm--1",
    isNative: false,
    amount: "0.000001",
    symbol: "TOKEN",
    decimals: 6,
    price: "1000000",
  });
  assert.equal(f.state.amount, "0.000001");
});
test("D20-64/68 withdrawal MAX blocks before destination readiness then uses reserved spendable balance", () => {
  const f = fundsSubmitFixture({
    selectedAction: "withdraw",
    isWithdrawDestinationReady: false,
    maxWithdraw: "98.123456",
  });
  f.max();
  assert.equal(f.state.amount, "10");
  f.state.isWithdrawDestinationReady = true;
  f.max();
  assert.equal(f.state.amount, "98.123456");
  assert.equal(f.submissions.length, 0);
});
test("D20-61 destination change accepts only current supported id and preserves unrelated preferences", () => {
  const f = fundsSubmitFixture();
  for (const id of [undefined, "unknown", ""]) f.destination(id);
  assert.deepEqual(f.state.customSettings, { preserveOther: true });
  f.destination("ethereum");
  assert.deepEqual(plain(f.state.customSettings), {
    preserveOther: true,
    lastUsdcWithdrawDestinationId: "ethereum",
  });
});
for (const [name, patch] of [
  ["invalid amount", { isValidAmount: false }],
  ["missing address", { selectedAccount: { accountId: "A" } }],
  ["unsupported account", { checkAccountSupport: false }],
  ["unready destination", { isWithdrawDestinationReady: false }],
  ["second amount validation", { amount: "0" }],
])
  test(`D20-23/37/68 actual confirm blocks ${name} before all signing/transfer sinks`, async () => {
    const f = fundsSubmitFixture(patch);
    await f.confirm();
    assert.equal(f.submissions.length, 0);
    assert.equal(f.events.length, 0);
    assert.equal(f.logs.length, 0);
  });
for (const [name, patch, expected] of [
  [
    "pending quote",
    { isDepositQuotePendingDebounce: true },
    ["bot-check", "submitting"],
  ],
  [
    "stale quote",
    { shouldRefreshDepositQuote: true },
    ["bot-check", "quote", "submitting"],
  ],
  [
    "backup required",
    { notBackedUp: true },
    ["bot-check", "backup-check", "submitting"],
  ],
  [
    "deactivated wallet rejected",
    { deactivated: true },
    ["bot-check", "bot-warning"],
  ],
])
  test(`D20-42/43/53 actual confirm stops ${name} without transfer/history/close`, async () => {
    const f = fundsSubmitFixture(patch);
    await f.confirm();
    assert.equal(f.submissions.length, 0);
    assert.deepEqual(actions(f), expected);
    assert.equal(f.logs.length, 0);
    if (f.events.at(-1)?.[0] === "submitting")
      assert.equal(f.events.at(-1)[1], false);
  });
test("D20-49/54 actual direct-deposit callback sends exact current account/token amount to local confirmation sink and waits for success before history", async () => {
  const f = fundsSubmitFixture({ amount: "35", tokenAmount: "12.345678" });
  await f.confirm();
  assert.equal(f.submissions.length, 1);
  const request = f.submissions[0];
  assert.deepEqual(plain(request.transfersInfo), [
    {
      from: "local-account-A",
      to: fundsConstants.HYPERLIQUID_DEPOSIT_ADDRESS,
      amount: "12.345678",
      tokenInfo: plain(fundsConstants.USDC_TOKEN_INFO),
    },
  ]);
  assert.equal(request.gasAccountScenario, "perps");
  assert.equal(f.logs.length, 0);
  assert.ok(!actions(f).includes("history"));
  assert.ok(!actions(f).includes("close"));
  await request.onSuccess([{ signedTx: { txid: "local-hash-001" } }]);
  assert.deepEqual(plain(f.events.find(([n]) => n === "history")[1]), {
    fromToken: f.token,
    fromTxId: "local-hash-001",
    toAmount: "12.345678",
    fromAmount: "12.345678",
    isArbUSDCOrder: true,
    skipToast: true,
  });
  assert.deepEqual(actions(f).slice(-4), [
    "history",
    "status-check",
    "ledger-subscribe",
    "close",
  ]);
  assert.equal(f.logs[0].status, ESwapTxHistoryStatus.SUCCESS);
  assert.equal(f.logs[0].txId, "local-hash-001");
});
test("D20-53 actual cancel/failure logs once with no fabricated history, success or close; a new local attempt is possible", async () => {
  const f = fundsSubmitFixture();
  await f.confirm();
  const request = f.submissions[0];
  request.onCancel();
  request.onFail({ code: "SIGN_REJECT" });
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0].status, ESwapTxHistoryStatus.FAILED);
  assert.equal(f.logs[0].errorStage, "sign");
  assert.equal(f.logs[0].errorCode, "userRejected");
  assert.ok(
    !actions(f).some((n) =>
      ["history", "close", "ledger-subscribe"].includes(n),
    ),
  );
  await f.confirm();
  assert.equal(f.submissions.length, 2);
});
test("D20-53 build error is rethrown, records one actual error code, releases submitting and never closes", async () => {
  const failure = Object.assign(new Error("local failure"), {
    code: "BUILD_FAILED",
  });
  const f = fundsSubmitFixture({ failure });
  await assert.rejects(f.confirm(), (e) => e === failure);
  assert.equal(f.logs.length, 1);
  assert.equal(f.logs[0].errorStage, "build");
  assert.equal(f.logs[0].errorCode, "BUILD_FAILED");
  assert.deepEqual(f.events.at(-1), ["submitting", false]);
  assert.ok(!actions(f).includes("close"));
});
test("D20-49/54 missing success transaction entry records broadcast failure without inventing a history hash", async () => {
  const f = fundsSubmitFixture();
  await f.confirm();
  await f.submissions[0].onSuccess([]);
  assert.equal(f.logs[0].status, ESwapTxHistoryStatus.FAILED);
  assert.equal(f.logs[0].errorCode, "txidNotFound");
  assert.equal(f.logs[0].errorStage, "broadcast");
  assert.ok(!actions(f).includes("history"));
});
for (const route of ["cctp", "legacy"])
  test(`D20-62/66/67/74 actual withdrawal forwards ${route} fee and destination contract to local sink only`, async () => {
    const f = fundsSubmitFixture({
      selectedAction: "withdraw",
      withdrawRoute: route,
      withdrawDestinationId: "ethereum",
      amount: "12.123456",
    });
    await f.confirm();
    const args = f.events.find(([n]) => n === "withdraw")[1];
    assert.deepEqual(plain(args), {
      userAccountId: "local-id-A",
      amount: "12.123456",
      destinationId: "ethereum",
      expectedRoute: route,
      ...(route === "cctp" ? { expectedCctpFee: "0.5" } : {}),
    });
    assert.equal(f.submissions.length, 0);
    assert.deepEqual(actions(f).slice(-3), [
      "ledger-subscribe",
      "close",
      "submitting",
    ]);
  });
test("D20-53/75 withdrawal rejection refreshes reserve and route, rethrows and preserves modal for retry", async () => {
  const failure = new Error("local withdraw rejected");
  const f = fundsSubmitFixture({ selectedAction: "withdraw", failure });
  await assert.rejects(f.confirm(), (e) => e === failure);
  assert.deepEqual(actions(f).slice(-4), [
    "reserve-refresh",
    "route-refresh",
    "error",
    "submitting",
  ]);
  assert.ok(!actions(f).includes("close"));
  assert.equal(f.logs.length, 0);
  assert.equal(f.submissions.length, 0);
  f.state.failure = undefined;
  await f.confirm();
  assert.equal(f.events.filter(([n]) => n === "withdraw").length, 2);
});
test("D20-50 cross-deposit callback uses separate local builder rather than direct transfer; close follows successful builder only", async () => {
  const f = fundsSubmitFixture({ isArbitrumUsdcToken: false });
  await f.confirm();
  assert.equal(f.submissions.length, 0);
  assert.deepEqual(actions(f).slice(-4), [
    "cross-deposit",
    "ledger-subscribe",
    "close",
    "submitting",
  ]);
  const failure = new Error("local cross failure");
  const bad = fundsSubmitFixture({ isArbitrumUsdcToken: false, failure });
  await assert.rejects(bad.confirm(), (e) => e === failure);
  assert.ok(!actions(bad).includes("close"));
  assert.ok(!actions(bad).includes("ledger-subscribe"));
  assert.deepEqual(bad.events.at(-1), ["submitting", false]);
});
