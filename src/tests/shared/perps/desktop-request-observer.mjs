// Independent Chromium Network stream, including Desktop's co-located business
// background fetch (pinned appRestart/BackgroundApiProxy/HttpTransport source).
// Never read request bodies/signatures, wrap product methods, or send orders.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
export function isExchangeRequest(url) {
  try {
    return /(?:^|\/)exchange\/?$/iu.test(new URL(url).pathname);
  } catch {
    throw Error("Unreadable observed request URL; cannot assert absence");
  }
}
export async function withDesktopRequestObservation(
  page,
  action,
  options = {},
) {
  const session = await (
    options.createSession ?? (() => page.context().newCDPSession(page))
  )();
  const requests = [],
    faults = [],
    listeners = [];
  const probe = `data:application/json,${encodeURIComponent(JSON.stringify({ onekeyQANetworkProbe: randomUUID() }))}`;
  let calibrated = false,
    armed = false,
    disposed = false,
    primary;
  const listen = (event, fn) => {
    session.on(event, fn);
    listeners.push([event, fn]);
  };
  const observe = (event) => {
    try {
      const request = event.request;
      assert.ok(request && typeof request.url === "string" && request.url);
      if (request.url === probe) {
        calibrated = true;
        return;
      }
      if (isExchangeRequest(request.url)) {
        const url = new URL(request.url);
        requests.push({
          requestId: event.requestId,
          endpoint: url.origin + url.pathname,
          method: request.method,
        });
      }
    } catch (e) {
      faults.push(e.message);
    }
  };
  const invalidate = () => {
    if (armed && !disposed)
      faults.push("Observed target/context detached, crashed or reloaded");
  };
  try {
    listen("Network.requestWillBeSent", observe);
    listen("Runtime.executionContextsCleared", invalidate);
    listen("Inspector.detached", invalidate);
    listen("Inspector.targetCrashed", invalidate);
    const { targetInfo } = await session.send("Target.getTargetInfo");
    assert.equal(
      targetInfo?.type,
      "page",
      "Observe selected Desktop page target",
    );
    assert.equal(
      targetInfo.url,
      page.url(),
      "CDP observer is attached to the exact tested target URL",
    );
    assert.ok(
      page.url().startsWith("file:"),
      "Desktop app shell required; web/extension scope is not equivalent",
    );
    await session.send("Runtime.enable");
    await session.send("Network.enable");
    // Local data URL only: calibrates actual event delivery without HTTP/order
    // side effects and without relying on an empty event collection as proof.
    const result = await session.send("Runtime.evaluate", {
      expression: `fetch(${JSON.stringify(probe)}).then(r => r.json()).then(v => Boolean(v.onekeyQANetworkProbe))`,
      awaitPromise: true,
      returnByValue: true,
    });
    assert.equal(
      result.exceptionDetails,
      undefined,
      "Network observation probe executed",
    );
    assert.equal(result.result?.value, true, "Network probe response verified");
    await session.send("Runtime.evaluate", {
      expression: "void 0",
      returnByValue: true,
    });
    assert.equal(
      calibrated,
      true,
      "Network events calibrated before invalid-input action",
    );
    assert.deepEqual(
      requests,
      [],
      "Unexpected exchange activity during observer setup",
    );
    armed = true;
    const detail = await action();
    await (options.settle ?? (() => page.waitForTimeout(1200)))();
    // Barrier after the observation window drains protocol events already sent.
    await session.send("Runtime.evaluate", {
      expression: "void 0",
      returnByValue: true,
    });
    assert.deepEqual(
      faults,
      [],
      "Observation remained valid for the complete action/window",
    );
    assert.deepEqual(
      requests,
      [],
      "Desktop business-background fetch attempted an exchange request",
    );
    return {
      detail,
      observation: {
        calibrated,
        sourceScope: "Desktop single-context background HttpTransport.fetch",
        requests: [...requests],
        settleMs: 1200,
      },
    };
  } catch (e) {
    primary = e;
    throw e;
  } finally {
    disposed = true;
    for (const [event, fn] of listeners) session.off(event, fn);
    try {
      await session.detach();
    } catch (e) {
      if (primary)
        throw new AggregateError(
          [primary, e],
          "Validation and observer detach failed",
        );
      throw e;
    }
  }
}
