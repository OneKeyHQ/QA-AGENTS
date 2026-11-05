import test from "node:test";
import assert from "node:assert/strict";
import {
  fundsExchangeFixture,
  LocalHttpRequestError,
} from "./funds-exchange-fixture.mjs";
import { fundsConstants } from "./funds-submit-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
for (const destination of fundsConstants.USDC_WITHDRAW_DESTINATIONS.filter(
  (d) => d.transferType === "cctp",
))
  test(`D20-61/62/74 actual ${destination.id} service uses live fee, exact current owner and that destination encoding`, async () => {
    const f = fundsExchangeFixture();
    await f.withdraw({ destinationId: destination.id });
    assert.equal(f.requests.length, 1);
    const request = f.requests[0];
    assert.equal(request.name, "sendToEvmWithData");
    assert.equal(request.args.amount, "2");
    assert.equal(request.args.token, "USDC");
    assert.equal(request.args.sourceDex, "spot");
    assert.equal(
      request.args.destinationChainId,
      { ethereum: 0, avalanche: 1, optimism: 2, arbitrum: 3, base: 6 }[
        destination.id
      ],
    );
    assert.equal(request.args.addressEncoding, "hex");
    assert.equal(request.args.destinationRecipient, f.state.accountAddress);
    assert.equal(
      f.events.find((e) => e[0] === "client")[1],
      destination.signatureChainId,
    );
    assert.ok(request.args.gasLimit > 0);
    assert.match(request.args.data, /^0x[0-9a-f]*$/i);
    assert.equal(f.logs.at(-1)[1].response.success, true);
    assert.equal(f.events.filter((e) => e[0] === "rpc").length, 1);
    assert.deepEqual(plain(f.events.find((e) => e[0] === "config")[1]), {
      ignoreCache: true,
    });
  });
for (const [name, patch, args, message] of [
  ["config unavailable", { config: false }, {}, /Unable to refresh/],
  ["unsupported target", {}, { destinationId: "not-enabled" }, /Unsupported/],
  [
    "legacy disables other chains",
    { legacy: true },
    { destinationId: "ethereum", expectedRoute: "bridge" },
    /route changed/,
  ],
  ["missing reviewed route", {}, { expectedRoute: undefined }, /route changed/],
  ["live route changed", { route: "bridge" }, {}, /route changed/],
  ["missing reviewed fee", {}, { expectedCctpFee: undefined }, /fee changed/],
  ["live fee changed", { feeMicros: "300000" }, {}, /fee changed/],
  ["amount equals fee", {}, { amount: "0.2" }, /must exceed/],
  ["amount below fee", {}, { amount: "0.199999" }, /must exceed/],
  [
    "configuration changes before signing",
    { changeLegacyBeforeSign: true },
    {},
    /route changed/,
  ],
])
  test(`D20-62/68/76 actual ${name} rejects before all local exchange actions`, async () => {
    const f = fundsExchangeFixture(patch);
    await assert.rejects(f.withdraw(args), message);
    assert.equal(f.requests.length, 0);
    assert.ok(
      !f.logs.some(([n, v]) => n === "withdraw" && v.response?.success),
    );
  });
test("D20-66 actual forced legacy Arbitrum uses withdraw3 to current owner and never CCTP RPC/sendAsset", async () => {
  const f = fundsExchangeFixture({
    legacy: true,
    feeFailure: new Error("must not query CCTP"),
  });
  await f.withdraw({ expectedRoute: "bridge", expectedCctpFee: undefined });
  assert.deepEqual(plain(f.requests), [
    {
      name: "withdraw3",
      args: { amount: "2", destination: f.state.accountAddress },
    },
  ]);
  assert.equal(f.events.filter((e) => e[0] === "rpc").length, 0);
});
test("D20-67 actual HyperEVM uses separate sendAsset USDC rail without CCTP quote or legacy bridge", async () => {
  const target = fundsConstants.USDC_WITHDRAW_DESTINATIONS.find(
    (d) => d.transferType === "hyperEvm",
  );
  assert.ok(target);
  const f = fundsExchangeFixture({
    feeFailure: new Error("must not query CCTP"),
  });
  await f.withdraw({
    destinationId: target.id,
    expectedRoute: undefined,
    expectedCctpFee: undefined,
  });
  assert.deepEqual(plain(f.requests), [
    {
      name: "sendAsset",
      args: {
        destination: fundsConstants.HYPEREVM_SYSTEM_ADDRESS,
        sourceDex: "spot",
        destinationDex: "spot",
        token: "USDC",
        amount: "2",
        fromSubAccount: "",
      },
    },
  ]);
  assert.equal(
    f.events.filter((e) => e[0] === "rpc" || e[0] === "route").length,
    0,
  );
});
for (const [name, mode, expected] of [
  [
    "unified same owner",
    {
      accountAddress: "0x1111111111111111111111111111111111111111",
      mode: "unifiedAccount",
    },
    "spot",
  ],
  [
    "portfolio margin same owner",
    {
      accountAddress: "0x1111111111111111111111111111111111111111",
      mode: "portfolioMargin",
    },
    "spot",
  ],
  [
    "foreign cached owner",
    {
      accountAddress: "0x2222222222222222222222222222222222222222",
      mode: "unifiedAccount",
    },
    "",
  ],
  [
    "legacy mode",
    {
      accountAddress: "0x1111111111111111111111111111111111111111",
      mode: "disabled",
    },
    "",
  ],
])
  test(`D20-64/76 actual ${name} resolves source balance scope from the signing owner`, async () => {
    const f = fundsExchangeFixture({ mode });
    await f.withdraw();
    assert.equal(f.requests[0].args.sourceDex, expected);
  });
test("D20-75 actual rejected exchange is not automatically retried on another rail and records failure only", async () => {
  const failure = new Error("local signature rejection");
  const f = fundsExchangeFixture({ exchangeFailure: failure });
  await assert.rejects(f.withdraw(), (e) => e === failure);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].name, "sendToEvmWithData");
  assert.equal(f.logs.filter(([n]) => n === "withdraw").length, 1);
  assert.ok(!f.logs[0][1].response.success);
});
test("D20-23 actual can-trade gate failure prevents config, wallet, fee and exchange work", async () => {
  const failure = new Error("watch only");
  const f = fundsExchangeFixture({ gateFailure: failure });
  await assert.rejects(f.withdraw(), (e) => e === failure);
  assert.deepEqual(
    f.events.map((e) => e[0]),
    ["can-trade"],
  );
  assert.equal(f.requests.length, 0);
});
for (const [fee, expected] of [
  ["0", "0.01"],
  ["0.001", "0.01"],
  ["0.01", "0.01"],
  ["0.123456", "0.123456"],
])
  test(`D20-64 actual pre-transfer reserve fee=${fee} uses maximum with buffer, not addition`, async () => {
    const f = fundsExchangeFixture({
      reserveResponse: { fee, isSanctioned: false },
    });
    const result = await f.service.getUsdcWithdrawReserve({
      userAccountId: "local-A",
    });
    assert.deepEqual(plain(result), {
      accountAddress: f.state.accountAddress,
      reserve: expected,
      isEstimate: false,
    });
    assert.equal(f.requests.length, 0);
  });
for (const response of [
  { fee: "0.2", isSanctioned: true },
  { fee: "0.2" },
  { fee: "NaN", isSanctioned: false },
  { fee: "-1", isSanctioned: false },
  { fee: 0.2, isSanctioned: false },
  { isSanctioned: false },
])
  test(`D20-68 actual invalid/restricted pre-transfer response ${JSON.stringify(response)} is not zero-fee readiness`, async () => {
    const f = fundsExchangeFixture({ reserveResponse: response });
    assert.equal(
      await f.service.getUsdcWithdrawReserve({ userAccountId: "local-A" }),
      undefined,
    );
    assert.equal(f.logs[0][1].fallbackApplied, false);
  });
for (const [name, failure, fallback] of [
  ["HTTP500", new LocalHttpRequestError(500), true],
  ["network", new LocalHttpRequestError(undefined), true],
  ["HTTP400", new LocalHttpRequestError(400), false],
  ["HTTP429", new LocalHttpRequestError(429), false],
  [
    "malformed JSON",
    new LocalHttpRequestError(undefined, new SyntaxError("invalid JSON")),
    false,
  ],
  ["other error", new Error("local failure"), false],
])
  test(`D20-64/68 actual reserve ${name} ${fallback ? "uses explicit 1.01 estimate" : "stays unready"}`, async () => {
    const f = fundsExchangeFixture({ reserveFailure: failure });
    const result = await f.service.getUsdcWithdrawReserve({
      userAccountId: "local-A",
    });
    assert.deepEqual(
      plain(result ?? null),
      fallback
        ? {
            accountAddress: f.state.accountAddress,
            reserve: "1.01",
            isEstimate: true,
          }
        : null,
    );
    assert.equal(f.logs[0][1].fallbackApplied, fallback);
    assert.equal(f.requests.length, 0);
  });
