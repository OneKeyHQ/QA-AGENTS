import test from "node:test";
import assert from "node:assert/strict";
import { enableTradingFixture } from "./enable-trading-fixture.mjs";
for (const code of [undefined, "CUSTOM"])
  test(`D02-72 actual internal enable pipeline approves fee and agent, then binds ${code ?? "1KREF"} locally without DApp Checkbox`, async () => {
    const f = enableTradingFixture({ referralCode: code });
    await f.check({ isEnableTradingTrigger: true });
    await f.flush();
    assert.deepEqual(JSON.parse(JSON.stringify(f.state.status.details)), {
      activatedOk: true,
      agentOk: true,
      referralCodeOk: true,
      builderFeeOk: true,
      internalRebateBoundOk: true,
      abstractionOk: true,
    });
    const names = f.calls.map((c) => c.name);
    assert.ok(
      names.indexOf("approveBuilderFee") < names.indexOf("approveAgent"),
    );
    assert.ok(names.indexOf("approveAgent") < names.indexOf("setReferrerCode"));
    assert.deepEqual(
      JSON.parse(
        JSON.stringify(
          f.calls.find((c) => c.name === "approveBuilderFee").payload,
        ),
      ),
      { builder: "0xBUILDER", maxFeeRate: "0.04%" },
    );
    assert.equal(
      f.calls.find((c) => c.name === "approveAgent").payload.authorize,
      true,
    );
    assert.equal(f.state.bound, code ?? "1KREF");
    assert.equal(f.state.loading.enableTradingLoading, false);
    assert.equal(f.state.loading.enableTradingStatusPending, false);
    assert.equal(
      f.calls.some((c) => /Checkbox|dapp|signMessage/u.test(c.name)),
      false,
    );
    await f.check({ isEnableTradingTrigger: true });
    assert.equal(
      f.calls.filter((c) => c.name === "setReferrerCode").length,
      1,
      "Same credential referral cache avoids duplicate binding",
    );
    await f.flush();
  });
test("D02-72 passive account entry never creates agent or approves fee", async () => {
  const f = enableTradingFixture();
  await f.check();
  await f.flush();
  assert.equal(
    f.calls.filter((c) =>
      ["approveAgent", "approveBuilderFee", "setReferrerCode"].includes(c.name),
    ).length,
    0,
  );
  assert.equal(f.state.status.details.agentOk, false);
  assert.equal(f.state.status.details.builderFeeOk, false);
});
for (const failureAt of [
  "approveBuilderFee",
  "passwordSession",
  "approveAgent",
])
  test(`D02-72 ${failureAt} rejection cannot report full authorization or bind referrer`, async () => {
    const f = enableTradingFixture({ failureAt });
    await assert.rejects(
      f.check({ isEnableTradingTrigger: true }),
      new RegExp(failureAt),
    );
    await f.flush();
    assert.equal(
      f.calls.some((c) => c.name === "setReferrerCode"),
      false,
    );
    assert.equal(f.state.status.details.agentOk, false);
    assert.equal(f.state.loading.enableTradingLoading, false);
  });
test("D02-72 existing valid local credential avoids signing and still binds referrer once", async () => {
  const credential = {
    userAddress: "0xAAA",
    agentAddress: "0xLOCAL_AGENT",
    agentName: "OneKeyAgent1",
  };
  const f = enableTradingFixture({
    approvedFee: 40,
    agents: [
      {
        name: "OneKeyAgent1",
        address: "0xLOCAL_AGENT",
        validUntil: 1800000000000 + 86400000 * 3,
      },
    ],
    credentials: new Map([["OneKeyAgent1", credential]]),
  });
  await f.check({ isEnableTradingTrigger: true });
  await f.flush();
  assert.equal(f.state.status.details.agentOk, true);
  assert.equal(f.state.bound, "1KREF");
  assert.equal(
    f.calls.some((c) =>
      ["approveAgent", "approveBuilderFee", "passwordSession"].includes(c.name),
    ),
    false,
  );
});
test("D02-72 explicit enable changes abstraction only when required and independently rechecks it", async () => {
  const f = enableTradingFixture({ abstraction: "disabled" });
  await f.check({ isEnableTradingTrigger: true });
  await f.flush();
  assert.equal(f.calls.filter((c) => c.name === "setAbstraction").length, 1);
  assert.equal(f.state.status.details.abstractionOk, true);
  assert.equal(f.state.abstraction, "unifiedAccount");
});
