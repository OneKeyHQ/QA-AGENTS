import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  mountChaseCaptureGuard,
  chaseGuardKey,
  clickGuardedChasePreview,
} from "../chase-preview-dom-guard.mjs";
import {
  chasePreviewBlockReason,
  projectChaseEntry,
} from "../chase-preview-evidence.mjs";
const account = "0x" + "1".repeat(40),
  order = {
    oid: 1,
    coin: "BTC",
    sz: "1",
    limitPx: "100",
    side: "B",
    reduceOnly: false,
    isTrigger: false,
    orderType: "Limit",
    tif: "Gtc",
  };
test("追单入口从独立取消标签读取，合格委托缺按钮也保留可失败样本", () => {
  const dom = new JSDOM('<div><span id="cancel">取消</span></div>');
  try {
    const cancel = dom.window.document.getElementById("cancel");
    const row = {
      memoizedProps: { order, canChaseOrder: true, isChasingOrder: false },
    };
    const absent = projectChaseEntry(row, cancel);
    assert.equal(absent.order.oid, 1);
    assert.deepEqual(absent.renderedButtons, []);
    const chase = dom.window.document.createElement("span");
    chase.setAttribute("data-testid", "perp-chase-order-1-button");
    cancel.before(chase);
    assert.deepEqual(projectChaseEntry(row, cancel).renderedButtons, [
      "perp-chase-order-1-button",
    ]);
    assert.equal(projectChaseEntry({ memoizedProps: {} }, cancel), null);
  } finally {
    dom.window.close();
  }
});
for (const detach of [false, true])
  test(`追单固定同一元素，列表替换${detach ? "导致停止" : "不改变点击目标"}且移除门禁`, async () => {
    const calls = [];
    let replacement = false;
    const handle = {
      async evaluate(fn, payload) {
        if (typeof payload === "string") {
          calls.push("remove-original");
          return { blocked: [], allowed: ["pointerdown", "pointerup"] };
        }
        calls.push("guard-original");
        replacement = true;
      },
      async click() {
        calls.push("click-original");
        assert.equal(replacement, true);
        if (detach) throw Error("Element is not attached");
      },
      async dispose() {
        calls.push("dispose-original");
      },
    };
    const locator = {
      async elementHandle() {
        return handle;
      },
      async click() {
        throw Error("Must not resolve the replacement button");
      },
    };
    if (detach)
      await assert.rejects(
        () => clickGuardedChasePreview(locator, {}),
        /not attached/u,
      );
    else
      assert.deepEqual(await clickGuardedChasePreview(locator, {}), {
        blocked: [],
        allowed: ["pointerdown", "pointerup"],
      });
    assert.deepEqual(calls, [
      "guard-original",
      "click-original",
      "remove-original",
      "dispose-original",
    ]);
  });
test("偏好在前置检查后改变，真实DOM捕获阶段拦截全部指针/键盘事件且不调用产品冒泡处理", () => {
  const dom = new JSDOM(
    '<div id="root"><button id="chase">追单</button></div>',
  );
  try {
    const element = dom.window.document.getElementById("chase"),
      root = dom.window.document.getElementById("root");
    let calls = 0,
      state = {
        order,
        canChase: true,
        busy: false,
        skipValues: [false],
        accounts: [account],
      };
    const context = {
      account,
      financial: {
        account,
        orders: [{ ...order, id: "1", marketScope: "perp" }],
      },
      canTrade: true,
    };
    const events = [
      "pointerdown",
      "pointerup",
      "mousedown",
      "mouseup",
      "click",
      "keydown",
      "touchstart",
      "touchend",
    ];
    events.forEach((type) => root.addEventListener(type, () => calls++));
    mountChaseCaptureGuard(element, {
      resolve: (x) => x,
      owner: () => state,
      project: (x) => x,
      blockReason: chasePreviewBlockReason,
      context,
      key: chaseGuardKey,
    });
    state = { ...state, skipValues: [true] };
    for (const type of events) {
      const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true,
      });
      assert.equal(element.dispatchEvent(event), false);
    }
    assert.equal(calls, 0);
    assert.equal(element[chaseGuardKey].blocked.length, events.length);
    state = { ...state, skipValues: [false] };
    element.dispatchEvent(
      new dom.window.Event("click", { bubbles: true, cancelable: true }),
    );
    assert.equal(calls, 1);
    assert.deepEqual(element[chaseGuardKey].allowed, ["click"]);
    element[chaseGuardKey].dispose();
    assert.equal(element[chaseGuardKey], undefined);
  } finally {
    dom.window.close();
  }
});
test("捕获阶段读状态报错也拦截，不能失效放行", () => {
  const dom = new JSDOM("<button>追单</button>");
  try {
    const element = dom.window.document.querySelector("button");
    let calls = 0;
    mountChaseCaptureGuard(element, {
      resolve: () => {
        throw Error("unreadable");
      },
      owner: () => null,
      project: (x) => x,
      blockReason: chasePreviewBlockReason,
      context: {},
      key: chaseGuardKey,
    });
    element.addEventListener("click", () => calls++);
    element.dispatchEvent(
      new dom.window.Event("click", { bubbles: true, cancelable: true }),
    );
    assert.equal(calls, 0);
    assert.match(element[chaseGuardKey].blocked[0].reason, /unreadable/u);
    element[chaseGuardKey].dispose();
  } finally {
    dom.window.close();
  }
});
