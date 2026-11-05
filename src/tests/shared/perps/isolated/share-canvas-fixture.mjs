// Actual Desktop canvas generator, image loader and QR dot drawing/encoder.
// Image network and canvas primitives are local command-recording boundaries;
// no real raster/PNG pixels or font glyph measurements are claimed.
import {
  React,
  renderer,
  evaluateSource,
  readSource,
  perpsUtils,
  appRequire,
} from "./source.mjs";
const base = "packages/kit/src/views/Perp/components/PositionShare/";
const locale = evaluateSource(
  "packages/shared/src/locale/enum/translations.ts",
);
const messages = JSON.parse(
  readSource("packages/shared/src/locale/json/zh_CN.json"),
);
export async function shareCanvasFixture(patch = {}) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = {
    data: {
      token: "BTC",
      tokenDisplayName: "BTC",
      side: "long",
      mode: "perp",
      leverage: 5,
      pnl: "10",
      pnlPercent: "50",
      entryPrice: "100",
      markPrice: "110",
    },
    config: { pnlDisplayMode: "roe" },
    referralQrCodeUrl: "https://app.onekey.so/perps",
    referralDisplayText: "https://app.onekey.so/perps",
    isReferralReady: true,
    noCanvas: false,
    noContext: false,
    qrError: false,
    drawError: false,
    ...patch,
  };
  const calls = [],
    images = [],
    qrValues = [],
    clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  let tree;
  const globals = {
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
  };
  const Image = class {
    constructor() {
      images.push(this);
    }
    set src(value) {
      this.url = value;
    }
    get src() {
      return this.url;
    }
  };
  const properties = {
    font: "10px sans-serif",
    fillStyle: "black",
    textBaseline: "alphabetic",
    globalAlpha: 1,
    filter: "none",
  };
  const context = new Proxy(
    {},
    {
      get: (_, key) =>
        key in properties
          ? properties[key]
          : key === "measureText"
            ? (text) => ({ width: String(text).length * 10 })
            : key === "createLinearGradient"
              ? () => ({
                  addColorStop: (...args) =>
                    calls.push({ op: "gradient", args }),
                })
              : (...args) => {
                  if (state.drawError && key === "drawImage")
                    throw Error("local canvas unavailable");
                  calls.push({
                    op: key,
                    args,
                    font: properties.font,
                    color: properties.fillStyle,
                    alpha: properties.globalAlpha,
                  });
                },
      set: (_, key, value) => {
        properties[key] = value;
        return true;
      },
    },
  );
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => (state.noContext ? null : context),
    toDataURL: (...args) => {
      calls.push({ op: "toDataURL", args });
      return "local:recorded-canvas-output";
    },
  };
  const qrcode = appRequire("qrcode");
  const loader = {
    getQRCodeUtil: () => ({
      create: (value, options) => {
        qrValues.push({ value, options });
        if (state.qrError) throw Error("local encoder failed");
        return qrcode.create(value, options);
      },
    }),
    ensureQRCodeUtilLoaded: async () => {},
    isQRCodeUtilLoaded: () => true,
  };
  const qrUtils = evaluateSource(
    "packages/components/src/content/QRCode/QRCode.utils.ts",
    { mocks: { "./qrCodeUtilLoader": loader } },
  );
  const qr = evaluateSource("packages/kit/src/utils/qrCodeCanvas.ts", {
    mocks: { "@onekeyhq/components/src/content/QRCode/QRCode.utils": qrUtils },
  });
  const constants = evaluateSource(base + "constants.ts", {
    mocks: { "@onekeyhq/shared/src/locale": locale },
  });
  const { ShareImageGenerator } = evaluateSource(
    base + "ShareImageGenerator.tsx",
    {
      globals: { ...globals, Image, console: { error: () => {} } },
      mocks: {
        "react-intl": {
          useIntl: () => ({ formatMessage: ({ id }) => messages[id] }),
        },
        "@onekeyhq/components": {
          Stack: ({ children, ...props }) =>
            React.createElement("Stack", props, children),
        },
        "@onekeyhq/kit/src/utils/qrCodeCanvas": qr,
        "@onekeyhq/shared/src/locale": locale,
        "@onekeyhq/shared/src/platformEnv": { isNative: false, isDev: false },
        "@onekeyhq/shared/src/utils/perpsUtils": perpsUtils(),
        "./constants": constants,
      },
    },
  );
  const ref = React.createRef();
  const render = () =>
    renderer.act(async () => {
      const element = React.createElement(ShareImageGenerator, {
        ...state,
        ref,
      });
      if (tree) tree.update(element);
      else
        tree = renderer.create(element, {
          createNodeMock: (e) =>
            e.type === "canvas" && !state.noCanvas ? canvas : null,
        });
    });
  await render();
  return {
    state,
    calls,
    images,
    qrValues,
    clock,
    canvas,
    constants,
    get tree() {
      return tree;
    },
    texts: () => calls.filter((c) => c.op === "fillText"),
    async update(p) {
      Object.assign(state, p);
      await render();
    },
    start() {
      return ref.current.generate();
    },
    async settleImages(event = "onload") {
      for (const image of images) image[event]?.();
      await Promise.resolve();
    },
    async tick(ms) {
      await clock.tickAsync(ms);
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
