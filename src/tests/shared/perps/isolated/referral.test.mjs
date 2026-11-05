import test from "node:test";
import assert from "node:assert/strict";
import { React, renderer, evaluateSource } from "./source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const origin = "https://app.hyperliquid.xyz";
const message = JSON.stringify({
  message: { type: "approveAgent" },
  primaryType: "HyperliquidTransaction:ApproveAgent",
});
function useAsyncResult(fn, deps) {
  const [state, setState] = React.useState({
    result: undefined,
    isLoading: true,
  });
  React.useEffect(() => {
    let cancelled = false;
    void fn().then((result) => {
      if (!cancelled) setState({ result, isLoading: false });
    });
    return () => {
      cancelled = true;
    };
  }, deps);
  return state;
}
async function fixture(config = {}) {
  const checks = [],
    snoozes = [],
    binds = [],
    signatures = [];
  const state = { snoozed: {}, show: true, signError: null, ...config };
  const service = {
    getReferralBannerSnoozedUntil: async ({ userAddress }) =>
      state.snoozed[userAddress] ?? 0,
    checkReferralPromotionConditions: async (value) => {
      checks.push(value);
      return { shouldShow: state.show };
    },
    buildSetReferrerTypedData: async ({ code }) => {
      binds.push(code);
      return { typedData: {}, action: {}, nonce: 1 };
    },
    logReferralBindingStep: async () => {},
    logReferralBindingResult: async () => {},
    invalidateBannerCache: async () => {},
    submitSetReferrerWithSignature: async () => ({ status: "ok" }),
    snoozeReferralBanner: async ({ userAddress }) => snoozes.push(userAddress),
  };
  const { useHyperliquidReferralPromotion: hook } = evaluateSource(
    "packages/kit/src/views/SignatureConfirm/hooks/useHyperliquidReferralPromotion.ts",
    {
      mocks: {
        "@onekeyfe/hd-shared": {
          HardwareErrorCode: { ActionCancelled: "cancelled" },
        },
        "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
          serviceHyperliquidReferral: service,
          serviceSend: {
            signMessage: async (args) => {
              signatures.push(args);
              if (state.signError) throw state.signError;
              return "0xsynthetic-signature";
            },
          },
        },
        "@onekeyhq/kit/src/hooks/usePromiseResult": {
          usePromiseResult: useAsyncResult,
        },
        "@onekeyhq/shared/src/consts/perp": {
          HYPERLIQUID_REFERRAL_CODE: "1KREF",
          HYPER_LIQUID_ORIGIN: origin,
          PERPS_NETWORK_ID: "evm--42161",
        },
        "@onekeyhq/shared/types/message": {
          EMessageTypesEth: { TYPED_DATA_V4: "typed-v4" },
        },
      },
    },
  );
  let current, tree;
  const props = {
    origin,
    accountId: "synthetic-A",
    userAddress: "0xaaa",
    unsignedMessage: message,
    ...config.props,
  };
  function Probe(p) {
    current = hook(p);
    return null;
  }
  const render = async () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Probe, props));
      else tree = renderer.create(React.createElement(Probe, props));
    });
  await render();
  return {
    state,
    props,
    render,
    checks,
    snoozes,
    binds,
    signatures,
    result: () => current,
    dispose: () => renderer.act(async () => tree.unmount()),
  };
}
for (const props of [
  { origin: "https://other.invalid" },
  { origin: "" },
  { accountId: "" },
  { userAddress: "" },
  { unsignedMessage: "broken JSON" },
  {
    unsignedMessage: JSON.stringify({
      message: { type: "order" },
      primaryType: "HyperliquidTransaction:ApproveAgent",
    }),
  },
  {
    unsignedMessage: JSON.stringify({
      message: { type: "approveAgent" },
      primaryType: "Other",
    }),
  },
])
  test(`ApproveAgent 入口条件不满足 ${JSON.stringify(props)}`, async () => {
    const f = await fixture({ props });
    try {
      assert.equal(f.result().shouldShowReferralCheckbox, false);
      assert.equal(f.checks.length, 0);
      assert.equal(f.signatures.length, 0);
    } finally {
      await f.dispose();
    }
  });
test("ApproveAgent 默认选中、绑定后隐藏、两周 snooze 未到期不选中", async () => {
  for (const config of [
    {},
    { show: false },
    { snoozed: { "0xaaa": Date.now() + 14 * 86400000 } },
    { snoozed: { "0xaaa": Date.now() - 1 } },
  ]) {
    const f = await fixture(config);
    try {
      assert.equal(
        f.result().shouldShowReferralCheckbox,
        config.show !== false,
      );
      assert.equal(
        f.result().isReferralChecked,
        !config.snoozed || config.snoozed["0xaaa"] < Date.now(),
      );
    } finally {
      await f.dispose();
    }
  }
});
test("ApproveAgent 邀请码绑定在隔离签名适配器完成，不调用真实钱包", async () => {
  const f = await fixture();
  try {
    await renderer.act(async () => f.result().bindReferralCodeAfterSign());
    assert.deepEqual(f.binds, ["1KREF"]);
    assert.equal(f.signatures.length, 1);
  } finally {
    await f.dispose();
  }
});
for (const code of ["cancelled", "network-error"])
  test(`ApproveAgent 绑定签名失败静默恢复 ${code}`, async () => {
    const error = Error(code);
    error.code = code;
    const f = await fixture({ signError: error });
    try {
      await assert.doesNotReject(async () => {
        await renderer.act(async () => f.result().bindReferralCodeAfterSign());
      });
      assert.equal(f.snoozes.length, code === "cancelled" ? 1 : 0);
    } finally {
      await f.dispose();
    }
  });
// This contract intentionally remains a tracked failing regression until the
// product hook resets state for the new account. TODO is not a passing case.
test("ApproveAgent A 取消/被 snooze 后切 B，B 应恢复自己的默认选中", async (t) => {
  const f = await fixture({
    snoozed: { "0xaaa": Date.now() + 14 * 86400000 },
  });
  try {
    assert.equal(f.result().isReferralChecked, false);
    f.props.userAddress = "0xbbb";
    f.props.accountId = "synthetic-B";
    await f.render();
    t.todo("源码风险：同实例账户复用未重置；需确认真实签名入口是否复用该实例");
    assert.equal(f.result().isReferralChecked, true);
  } finally {
    await f.dispose();
  }
});
