// D21 link/account/environment and action boundaries, actual pinned hooks.
// All service, clipboard, downloads and external-window outputs are local sinks.
import test from "node:test";
import assert from "node:assert/strict";
import { React, renderer, evaluateSource } from "./source.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const base = "packages/kit/src/views/Perp/components/PositionShare/";
const plain = (value) => JSON.parse(JSON.stringify(value));
async function referralFixture(initial = {}) {
  const state = {
      user: { isLoggedIn: false, isLoggedInOnServer: false },
      dev: { enabled: false, settings: {} },
      primary: "PRIMARY",
      fallback: "FALLBACK",
      ...initial,
    },
    calls = [];
  function usePromiseResult(fn, deps) {
    const [result, setResult] = React.useState(undefined),
      [isLoading, setLoading] = React.useState(true);
    React.useEffect(() => {
      let live = true;
      setLoading(true);
      setResult(undefined);
      void fn().then(
        (value) => {
          if (live) {
            setResult(value);
            setLoading(false);
          }
        },
        () => {
          if (live) {
            setResult(undefined);
            setLoading(false);
          }
        },
      );
      return () => {
        live = false;
      };
    }, deps);
    return { result, isLoading };
  }
  const { useReferralUrl } = evaluateSource(base + "useReferralUrl.ts", {
    mocks: {
      "@onekeyhq/kit/src/background/instance/backgroundApiProxy": {
        serviceReferralCode: {
          getSummaryInfo: async () => {
            calls.push(["primary", state.user.onekeyUserId]);
            const code =
              typeof state.primary === "function"
                ? await state.primary()
                : state.primary;
            return { inviteCode: code };
          },
          getMyReferralCode: async ({ onekeyUserId }) => {
            calls.push(["fallback", onekeyUserId]);
            return state.fallback;
          },
        },
      },
      "@onekeyhq/kit/src/hooks/usePromiseResult": { usePromiseResult },
      "@onekeyhq/kit-bg/src/states/jotai/atoms": {
        usePrimePersistAtom: () => [state.user],
      },
      "@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings": {
        useDevSettingsPersistAtom: () => [state.dev],
      },
      "@onekeyhq/shared/src/config/appConfig": {
        WEB_APP_URL: "https://app.onekey.so",
        WEB_APP_URL_DEV: "https://app.onekeytest.com",
      },
    },
  });
  let value, tree;
  function Harness() {
    value = useReferralUrl();
    return null;
  }
  const render = () =>
    renderer.act(async () => {
      if (tree) tree.update(React.createElement(Harness));
      else tree = renderer.create(React.createElement(Harness));
    });
  await render();
  return {
    state,
    calls,
    get value() {
      return plain(value);
    },
    render,
    flush: () => renderer.act(async () => {}),
    close: () => renderer.act(async () => tree.unmount()),
  };
}
for (const user of [
  { isLoggedIn: false, isLoggedInOnServer: false },
  { isLoggedIn: true, isLoggedInOnServer: false, onekeyUserId: "A" },
])
  test(`D21-46/48 incomplete login ${JSON.stringify(user)} uses plain default link without service lookup`, async () => {
    const f = await referralFixture({ user });
    try {
      assert.equal(f.value.referralQrCodeUrl, "https://app.onekey.so/perps");
      assert.equal(f.value.referralDisplayText, "https://app.onekey.so/perps");
      assert.equal(f.value.isReady, true);
      assert.equal(f.calls.length, 0);
    } finally {
      await f.close();
    }
  });
for (const [primary, fallback, code] of [
  ["PRIMARY", "SECONDARY", "PRIMARY"],
  [undefined, "LOCAL", "LOCAL"],
  [undefined, undefined, null],
])
  test(`D21-47/48 primary=${primary}/fallback=${fallback}`, async () => {
    const f = await referralFixture({
      user: { isLoggedIn: true, isLoggedInOnServer: true, onekeyUserId: "A" },
      primary,
      fallback,
    });
    try {
      assert.equal(
        f.value.referralQrCodeUrl,
        code
          ? `https://app.onekey.so/r/${code}/app/perps`
          : "https://app.onekey.so/perps",
      );
      assert.equal(
        f.value.referralDisplayText,
        code ?? "https://app.onekey.so/perps",
      );
      assert.deepEqual(
        f.calls,
        primary
          ? [["primary", "A"]]
          : [
              ["primary", "A"],
              ["fallback", "A"],
            ],
      );
    } finally {
      await f.close();
    }
  });
test("D21-49 pending referral starts with usable default and updates after actual response", async () => {
  let resolve;
  const pending = new Promise((r) => (resolve = r));
  const f = await referralFixture({
    user: { isLoggedIn: true, isLoggedInOnServer: true, onekeyUserId: "A" },
    primary: () => pending,
  });
  try {
    assert.equal(f.value.referralQrCodeUrl, "https://app.onekey.so/perps");
    assert.equal(f.value.isReady, false);
    await renderer.act(async () => resolve("LATE"));
    assert.equal(
      f.value.referralQrCodeUrl,
      "https://app.onekey.so/r/LATE/app/perps",
    );
    assert.equal(f.value.isReady, true);
  } finally {
    await f.close();
  }
});
test("D21-49 primary API failure falls back to current-account code and completes loading", async () => {
  const f = await referralFixture({
    user: { isLoggedIn: true, isLoggedInOnServer: true, onekeyUserId: "A" },
    primary: () => {
      throw Error("fixture API failure");
    },
    fallback: "SAFE",
  });
  try {
    assert.equal(
      f.value.referralQrCodeUrl,
      "https://app.onekey.so/r/SAFE/app/perps",
    );
    assert.equal(f.value.isReady, true);
  } finally {
    await f.close();
  }
});
test("D21-50 logout, B account and environment never reuse A or production code", async () => {
  const f = await referralFixture({
    user: { isLoggedIn: true, isLoggedInOnServer: true, onekeyUserId: "A" },
    primary: "CODE_A",
  });
  try {
    assert.equal(
      f.value.referralQrCodeUrl,
      "https://app.onekey.so/r/CODE_A/app/perps",
    );
    f.state.user = { isLoggedIn: false, isLoggedInOnServer: false };
    await f.render();
    assert.equal(f.value.referralQrCodeUrl, "https://app.onekey.so/perps");
    f.state.user = {
      isLoggedIn: true,
      isLoggedInOnServer: true,
      onekeyUserId: "B",
    };
    f.state.primary = "CODE_B";
    await f.render();
    assert.equal(
      f.value.referralQrCodeUrl,
      "https://app.onekey.so/r/CODE_B/app/perps",
    );
    f.state.dev = { enabled: true, settings: { enableTestEndpoint: true } };
    f.state.primary = "CODE_B_DEV";
    await f.render();
    assert.equal(
      f.value.referralQrCodeUrl,
      "https://app.onekeytest.com/r/CODE_B_DEV/app/perps",
    );
    assert.deepEqual(f.calls, [
      ["primary", "A"],
      ["primary", "B"],
      ["primary", "B"],
    ]);
  } finally {
    await f.close();
  }
});
async function actionFixture(
  url = "https://app.onekey.so/perps",
  options = {},
) {
  const events = [],
    errors = [],
    success = [],
    copied = [],
    windows = [],
    state = { ...options };
  const { useShareActions } = evaluateSource(base + "useShareActions.tsx", {
    globals: {
      Blob,
      Uint8Array,
      ArrayBuffer,
      atob,
      Error,
      URL: {
        createObjectURL: (blob) => {
          events.push(["create", blob]);
          return "blob:fixture";
        },
        revokeObjectURL: (value) => events.push(["revoke", value]),
      },
      document: {
        createElement: () => {
          const link = {
            click() {
              if (state.downloadError) throw Error("download fixture failure");
              events.push(["download", this.href, this.download]);
            },
          };
          return link;
        },
        body: {
          appendChild: (link) => events.push(["append", link]),
          removeChild: (link) => events.push(["remove", link]),
        },
      },
      open: (url, target) => windows.push([url, target]),
    },
    mocks: {
      "react-intl": { useIntl: () => ({ formatMessage: ({ id }) => id }) },
      "react-native": {
        Linking: {
          openURL: () => {
            throw Error("Native external action forbidden");
          },
        },
      },
      "@onekeyhq/components": {
        Button: () => null,
        Toast: {
          success: (value) => success.push(value),
          error: (value) => errors.push(value),
        },
        useClipboard: () => ({ copyText: (value) => copied.push(value) }),
      },
      "@onekeyhq/kit/src/utils/shareUtils": {
        shareImageOnDesktop: async () => {
          if (state.shareError) throw Error(state.shareError);
          events.push(["system-share"]);
        },
      },
      "@onekeyhq/shared/src/locale": {
        ETranslations: new Proxy({}, { get: (_, key) => key }),
      },
      "@onekeyhq/shared/src/modules3rdParty/expo-sharing": {},
      "@onekeyhq/shared/src/modules3rdParty/photo-library": {},
      "@onekeyhq/shared/src/modules3rdParty/react-native-fs": {},
      "@onekeyhq/shared/src/platformEnv": { isNative: false, isDesktop: true },
    },
  });
  let api, tree;
  function Harness() {
    api = useShareActions(url);
    return null;
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Harness));
  });
  return {
    events,
    errors,
    success,
    copied,
    windows,
    api,
    state,
    close: () => renderer.act(async () => tree.unmount()),
  };
}
for (const link of [
  "https://app.onekey.so/perps",
  "https://app.onekey.so/r/A%26B/app/perps",
])
  test(`D21-52/58/60 clipboard and X draft encoding preserves ${link}`, async () => {
    const f = await actionFixture(link);
    try {
      f.api.copyLink();
      assert.deepEqual(f.copied, [link]);
      const text = "BUY BTC & TEST / USDC? #1 中文";
      await f.api.shareToX("", text);
      assert.equal(f.windows.length, 1);
      const [raw, target] = f.windows[0],
        url = new URL(raw);
      assert.equal(url.origin, "https://x.com");
      assert.equal(url.pathname, "/intent/tweet");
      assert.equal(url.searchParams.get("text"), `${text}\n\n${link}`);
      assert.equal(target, "_blank");
      assert.equal(f.events.length, 0);
      assert.equal(f.errors.length, 0);
    } finally {
      await f.close();
    }
  });
test("D21-32 save creates exactly one PNG blob download with matching bytes then cleans URL", async () => {
  const f = await actionFixture();
  try {
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      result = await f.api.saveImage(
        "data:image/png;base64," + bytes.toString("base64"),
      );
    assert.equal(result.success, true);
    assert.equal(f.success.length, 1);
    assert.equal(f.errors.length, 0);
    assert.deepEqual(
      f.events.map((e) => e[0]),
      ["create", "append", "download", "remove", "revoke"],
    );
    const blob = f.events[0][1];
    assert.equal(blob.type, "image/png");
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), bytes);
    assert.match(f.events[2][2], /^onekey-position-\d+\.png$/u);
  } finally {
    await f.close();
  }
});
test("D21-38 download failure reports failure rather than save completion and subsequent retry succeeds", async () => {
  const f = await actionFixture(undefined, { downloadError: true });
  try {
    const image = "data:image/png;base64,iVBORw0KGgo=";
    assert.equal((await f.api.saveImage(image)).success, false);
    assert.equal(f.errors.length, 1);
    assert.equal(f.success.length, 0);
    f.state.downloadError = false;
    assert.equal((await f.api.saveImage(image)).success, true);
    assert.equal(f.success.length, 1);
  } finally {
    await f.close();
  }
});
for (const [message, errors] of [
  ["User cancel", 0],
  ["system unavailable", 1],
])
  test(`D21-37/38 desktop system share ${message}`, async () => {
    const f = await actionFixture(undefined, { shareError: message });
    try {
      await f.api.shareImage("data:image/png;base64,iVBORw0KGgo=");
      assert.equal(f.errors.length, errors);
      assert.equal(f.windows.length, 0);
    } finally {
      await f.close();
    }
  });
