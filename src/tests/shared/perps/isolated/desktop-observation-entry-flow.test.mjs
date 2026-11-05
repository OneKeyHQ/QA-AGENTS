// Real list/rows/scoped-cache hook; storage and selected-wallet notifications
// are controlled. No UI account switch, approval, signing or exchange calls.
import test from "node:test";
import assert from "node:assert/strict";
import {
  openOrdersListFixture,
  openOrder,
} from "./open-orders-list-fixture.mjs";
import { twapListFixture } from "./twap-list-fixture.mjs";
import { stateFixture } from "./twap-state-fixture.mjs";
import { orderState } from "./twap-source-fixture.mjs";

const account = "0x" + "a".repeat(40);
const selected = {
  ready: true,
  account: { id: "watching--local" },
  deriveType: "default",
};
const snapshot = (patch = {}) => ({
  entries: {
    [account]: {
      account: {
        accountAddress: account,
        accountId: "watching--local",
        deriveType: "default",
      },
      updatedAt: Date.now(),
      ...patch,
    },
  },
});

test("D13-63 actual display-only cache scope shows existing orders but has no chase entry and sends no mutation", async () => {
  const f = await openOrdersListFixture(
    {
      account: undefined,
      dataAccount: account,
      spotAccount: account,
      orders: [openOrder(1, { tif: "Gtc" })],
      selectedWalletAccount: selected,
      displaySnapshot: snapshot(),
    },
    { chase: true, scopeFromSnapshot: true },
  );
  try {
    assert.equal(
      f.rows().length,
      1,
      "Existing orders remain readable from the actual snapshot hook",
    );
    assert.equal(
      f.chaseButton(1),
      undefined,
      "Display-only scope cannot expose a chase action",
    );
    assert.deepEqual(f.activity.books, []);
    assert.deepEqual(f.activity.amends, []);
    assert.deepEqual(f.activity.dialogs, []);
    assert.equal(f.activity.enabled, 0);
    // A current active account is an independent positive control, without invoking it.
    await f.update({ account });
    assert.equal(typeof f.chaseButton(1)?.props.onPress, "function");
    await f.update({ account: undefined });
    assert.equal(f.chaseButton(1), undefined);
    assert.equal(f.activity.enabled, 0);
    assert.deepEqual(f.activity.amends, []);
  } finally {
    await f.close();
  }
});
for (const [name, patch] of [
  [
    "wallet not ready",
    { selectedWalletAccount: { ...selected, ready: false } },
  ],
  [
    "different selected wallet",
    {
      selectedWalletAccount: {
        ...selected,
        account: { id: "watching--other" },
      },
    },
  ],
  ["expired snapshot", { displaySnapshot: snapshot({ updatedAt: 0 }) }],
])
  test(`D13-63 actual scoped-cache ${name} cannot expose previous account rows or chase`, async () => {
    const f = await openOrdersListFixture(
      {
        account: undefined,
        dataAccount: account,
        spotAccount: account,
        orders: [openOrder(1, { tif: "Gtc" })],
        selectedWalletAccount: selected,
        displaySnapshot: snapshot(),
        ...patch,
      },
      { chase: true, scopeFromSnapshot: true },
    );
    try {
      assert.equal(f.rows().length, 0);
      assert.equal(f.chaseButton(1), undefined);
      assert.deepEqual(f.activity.books, []);
      assert.deepEqual(f.activity.amends, []);
      assert.equal(f.activity.enabled, 0);
    } finally {
      await f.close();
    }
  });

test("D13-62 actual dedicated Desktop TWAP rows never render chase, alongside a positive ordinary GTC control", async () => {
  const store = stateFixture();
  store.responses.orders = {
    user: store.account,
    twapStates: [
      [71, orderState({ side: "B" })],
      [72, orderState({ side: "A" })],
    ],
  };
  const twap = await twapListFixture({ store, initialTab: "active" });
  const ordinary = await openOrdersListFixture({
    orders: [openOrder(1, { tif: "Gtc" })],
  });
  try {
    assert.deepEqual(
      twap
        .rows()
        .map((r) => r.id)
        .sort(),
      [71, 72],
    );
    assert.equal(
      twap
        .root()
        .findAll(
          (n) =>
            typeof n.type === "string" &&
            String(n.props.testID ?? "").startsWith("chase-order-"),
        ).length,
      0,
    );
    assert.equal(
      twap
        .root()
        .findAllByType("SizableText")
        .some((n) => n.children.includes("追单")),
      false,
    );
    assert.ok(
      ordinary.chaseButton(1),
      "A qualified regular limit order has the real chase entry",
    );
    assert.deepEqual(ordinary.events, []);
    assert.equal(
      store.calls.some((c) => /cancel|place|amend/i.test(JSON.stringify(c))),
      false,
    );
  } finally {
    await ordinary.close();
    await twap.close();
  }
});
