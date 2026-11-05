// Published SDK HTTP transport, exact package version from the pinned source.
// All fetch calls terminate at the local sink. No clients/signing/app connection.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { evaluateText, evaluateSource, readSource } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const directory = new URL("./vendor/hyperliquid-0.33.3/", import.meta.url);
test("D15-86 actual Desktop proxy initializes its local background and dispatches in the same context", async () => {
  const service = {
    async localProbe(value) {
      assert.equal(this, service);
      return { value };
    },
  };
  let initCount = 0,
    selected;
  const background = { serviceProbe: service };
  evaluateSource("packages/kit/src/background/instance/backgroundApiProxy.ts", {
    mocks: {
      "@onekeyhq/kit-bg/src/apis/BackgroundApiProxy": class {
        constructor(options) {
          selected = options;
        }
      },
      "@onekeyhq/shared/src/appGlobals": {},
      "@onekeyhq/shared/src/platformEnv": {
        isDesktop: true,
        isExtensionUi: false,
        isNativeMainThread: false,
        enableNativeBackgroundThread: false,
      },
      "./backgroundApiInit": () => {
        initCount++;
        return background;
      },
    },
  });
  assert.equal(initCount, 1);
  assert.equal(selected.backgroundApi, background);
  const Proxy = sourceClass(
    "packages/kit-bg/src/apis/BackgroundApiProxyBase.ts",
    ["_callBackgroundMethodAsync"],
    {
      platformEnv: { isDesktop: true },
      OneKeyLocalError: Error,
      getBackgroundServiceApi: ({ serviceName, backgroundApi }) =>
        backgroundApi[serviceName],
      getLocalBackgroundServiceMethod: ({ serviceApi, methodName }) =>
        serviceApi[methodName],
      ensurePromiseObject: (v) => assert.equal(typeof v.then, "function"),
      ensureSerializable: (v) => v,
      throwMethodNotFound: () => {
        throw Error("missing method");
      },
    },
  );
  const proxy = new Proxy();
  proxy.ensureLocalBackgroundApi = async () => selected.backgroundApi;
  const result = await proxy._callBackgroundMethodAsync({
    sync: false,
    serviceName: "serviceProbe",
    methodName: "localProbe",
    backgroundMethodName: "localProbe",
    params: [7],
  });
  assert.equal(result.value, 7);
});
test("D15-86 Desktop background scope is co-located and pinned exchange service selects published HttpTransport 0.33.3", () => {
  const pkg = JSON.parse(readSource("package.json"));
  assert.equal(pkg.dependencies["@nktkas/hyperliquid"], "0.33.3");
  const proxy = readSource(
    "packages/kit/src/background/instance/backgroundApiProxy.ts",
  );
  assert.match(proxy, /backgroundApi\s*=\s*backgroundApiInit\(/u);
  assert.match(proxy, /isExtensionUi/u);
  assert.match(proxy, /isNativeMainThread/u);
  const restart = readSource(
    "packages/shared/src/modules3rdParty/appRestart/index.ts",
  );
  assert.match(restart, /have a single JS context/u);
  const exchange = readSource(
    "packages/kit-bg/src/services/ServiceHyperLiquid/ServiceHyperliquidExchange.ts",
  );
  assert.match(exchange, /HttpTransport/u);
  assert.match(exchange, /new HttpTransport\(/u);
  assert.ok(!/new (?:WebSocketTransport|WebSocket)\(/u.test(exchange));
  assert.ok(
    !readSource("patches/@nktkas+hyperliquid+0.33.3.patch").includes(
      "transport/http/",
    ),
    "Pinned application patch does not alter the audited HTTP transport",
  );
});
test("D15-86 exact published SDK bytes route mainnet/testnet/custom exchange and info through global fetch", async () => {
  const source = readFileSync(new URL("http.js", directory), "utf8");
  const provenance = JSON.parse(
    readFileSync(new URL("provenance.json", directory)),
  );
  assert.equal(
    createHash("sha256").update(source).digest("hex"),
    provenance.httpSha256,
  );
  assert.equal(
    JSON.parse(readFileSync(new URL("package.json", directory))).version,
    "0.33.3",
  );
  const calls = [];
  const { HttpTransport } = evaluateText("hyperliquid-0.33.3-http.js", source, {
    mocks: {
      "../_base.js": { TransportError: Error },
      "../_abort.js": {
        scheduleTimeout: () => ({ cancel() {} }),
        relay: () => () => {},
      },
    },
    globals: {
      URL,
      AbortController,
      Headers,
      Response,
      fetch: async (url, init) => {
        calls.push({ url: String(url), method: init.method, body: init.body });
        return new Response('{"status":"local-only"}', {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  });
  for (const [options, base] of [
    [{}, "https://api.hyperliquid.xyz"],
    [{ isTestnet: true }, "https://api.hyperliquid-testnet.xyz"],
    [
      { apiUrl: "https://local.invalid/proxy?key=redacted" },
      "https://local.invalid/proxy",
    ],
  ]) {
    for (const endpoint of ["info", "exchange"]) {
      const response = await new HttpTransport(options).request(endpoint, {
        type: "qa-local-probe",
      });
      assert.equal(response.status, "local-only");
      assert.equal(
        new URL(calls.at(-1).url).origin + new URL(calls.at(-1).url).pathname,
        `${base}/${endpoint}`,
      );
      assert.equal(calls.at(-1).method, "POST");
      assert.equal(calls.at(-1).body, '{"type":"qa-local-probe"}');
    }
  }
  assert.equal(calls.length, 6);
});
