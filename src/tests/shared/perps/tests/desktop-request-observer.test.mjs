import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import {
  isExchangeRequest,
  withDesktopRequestObservation,
} from "../desktop-request-observer.mjs";
function fixture({
  calibrate = true,
  url = "file:///OneKey/index.html",
  target = url,
  fault,
  cleanupError,
} = {}) {
  const session = new EventEmitter();
  let detached = 0,
    calls = [];
  const page = {
    url: () => url,
    context: () => ({ newCDPSession: async () => session }),
    waitForTimeout: async () => {},
  };
  session.send = async (method, params) => {
    calls.push(method);
    if (method === "Target.getTargetInfo")
      return { targetInfo: { type: "page", url: target } };
    if (params?.expression?.startsWith("fetch(")) {
      const probe = JSON.parse(
        params.expression.slice(6, params.expression.indexOf(").then")),
      );
      if (calibrate)
        session.emit("Network.requestWillBeSent", {
          requestId: "probe",
          request: { url: probe, method: "GET" },
        });
      return {
        result: { value: true },
        ...(fault ? { exceptionDetails: {} } : {}),
      };
    }
    return {};
  };
  session.detach = async () => {
    detached++;
    if (cleanupError) throw Error("detach failed");
  };
  return { session, page, calls, detached: () => detached };
}
test("Desktop request observer calibrates before action, scopes selected target and cleans up without callbacks", async () => {
  const f = fixture();
  let actions = 0;
  const result = await withDesktopRequestObservation(f.page, async () => {
    actions++;
    assert.ok(f.calls.includes("Network.enable"));
    f.session.emit("Network.requestWillBeSent", {
      request: { url: "https://api.hyperliquid.xyz/info", method: "POST" },
    });
    return "minimum toast";
  });
  assert.equal(actions, 1);
  assert.equal(result.detail, "minimum toast");
  assert.equal(result.observation.calibrated, true);
  assert.equal(f.detached(), 1);
  assert.equal(f.session.eventNames().length, 0);
});
test("Desktop observer rejects background exchange attempt even if no order ID or response exists", async () => {
  for (const url of [
    "https://api.hyperliquid.xyz/exchange",
    "https://api.hyperliquid-testnet.xyz/exchange/?q=redacted",
    "https://proxy.example/hyperliquid/exchange",
  ]) {
    const f = fixture();
    await assert.rejects(
      withDesktopRequestObservation(f.page, async () => {
        f.session.emit("Network.requestWillBeSent", {
          requestId: "bad",
          request: {
            url,
            method: "POST",
            postData: "private-signature-never-read",
          },
        });
        return "no order IDs changed";
      }),
      (e) =>
        /attempted an exchange request/u.test(e.message) &&
        !e.message.includes("private-signature"),
    );
    assert.equal(f.detached(), 1);
  }
});
test("Missing calibration/wrong target/probe exception stops before the invalid-input click", async () => {
  for (const options of [
    { calibrate: false },
    { target: "file:///another.html" },
    { url: "https://app.onekey.so" },
    { fault: true },
  ]) {
    const f = fixture(options);
    let action = false;
    await assert.rejects(
      withDesktopRequestObservation(f.page, async () => {
        action = true;
      }),
    );
    assert.equal(action, false);
    assert.equal(f.detached(), 1);
  }
});
test("Target reload/crash and unreadable request event fail closed", async () => {
  for (const emit of [
    (s) => s.emit("Runtime.executionContextsCleared"),
    (s) => s.emit("Inspector.detached"),
    (s) => s.emit("Inspector.targetCrashed"),
    (s) => s.emit("Network.requestWillBeSent", { request: {} }),
  ]) {
    const f = fixture();
    await assert.rejects(
      withDesktopRequestObservation(f.page, async () => emit(f.session)),
      /Observation remained valid/u,
    );
    assert.equal(f.detached(), 1);
  }
});
test("Observer preserves action failure and cleanup failure; never returns a partial success", async () => {
  const f = fixture({ cleanupError: true });
  await assert.rejects(
    withDesktopRequestObservation(f.page, async () => {
      throw Error("assertion failed");
    }),
    (e) =>
      e instanceof AggregateError && e.errors[0].message === "assertion failed",
  );
  assert.equal(f.session.eventNames().length, 0);
});
test("Exchange endpoint matcher rejects malformed URLs and ignores info/nonendpoint matches", () => {
  assert.equal(isExchangeRequest("https://a/exchange"), true);
  for (const url of [
    "https://a/info",
    "https://a/exchange-history",
    "data:application/json,{}",
  ])
    assert.equal(isExchangeRequest(url), false);
  assert.throws(() => isExchangeRequest("not a URL"));
});
