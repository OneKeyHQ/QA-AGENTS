import test from "node:test";
import assert from "node:assert/strict";
import {
  unifoldMenuFixture,
  unifoldDeliveryFixture,
} from "./unifold-menu-delivery-fixture.mjs";
import {
  unifoldTrackerFixture,
  execution,
} from "./unifold-tracker-fixture.mjs";
const catalog = [
  {
    symbol: "USDC",
    chains: ["eth", "arb", "base", "eth", "op", "bsc"].map((id) => ({
      chain_type: "ethereum",
      chain_name: id,
      icon_url: "https://icons.example/" + id + ".svg",
    })),
  },
  {
    symbol: "BTC",
    chains: [
      {
        chain_type: "bitcoin",
        chain_name: "Bitcoin",
        icon_url: "https://icons.example/btc.svg",
      },
    ],
  },
  { symbol: "SOL", chains: [{ chain_type: "solana", icon_url: undefined }] },
];
for (const count of [0, 1, 4, 5, 7]) {
  test(`D14-24 actual menu raw catalog deduplicates Bitcoin-first icons and exact +N at ${count} source entries`, async () => {
    const chains =
      count === 7
        ? catalog
        : [
            {
              symbol: "USDC",
              chains: Array.from({ length: count }, (_, i) => ({
                chain_type: "ethereum",
                icon_url: `https://icons.example/${i}.svg`,
              })),
            },
          ];
    const f = await unifoldMenuFixture({ catalog: chains });
    try {
      assert.equal(f.events.assets.length, 1);
      assert.equal(f.events.assets[0].destinationChainId, "1337");
      const row = f.row("transfer-crypto");
      const expected =
        count === 7
          ? ["btc", "eth", "arb", "base"]
          : Array.from({ length: Math.min(count, 4) }, (_, i) => String(i));
      assert.deepEqual(
        row.findAllByType("Token").map((n) => n.props.tokenImageUri),
        expected.map((id) => "https://icons.example/" + id + ".svg"),
      );
      const texts = row
        .findAllByType("SizableText")
        .map((n) => n.children.join(""));
      assert.deepEqual(texts.slice(0, 2), [
        "链上收款",
        "将其他交易平台/钱包资产存入永续合约账户",
      ]);
      assert.deepEqual(
        texts.slice(2),
        count > 4 ? ["+" + (count === 7 ? 2 : count - 4)] : [],
      );
      assert.ok(f.row("connected-wallet"));
      assert.ok(f.row("tracker"));
      assert.equal(f.events.actions.length, 0);
    } finally {
      await f.close();
    }
  });
}
for (const [name, action] of [
  ["connected-wallet", "onekey"],
  ["transfer-crypto", "transfer"],
  ["tracker", "tracker"],
]) {
  test(`D14-24/26 actual ${name} menu action waits for menu close before navigating`, async () => {
    let release;
    const pending = new Promise((r) => {
      release = r;
    });
    const f = await unifoldMenuFixture({ closeRequest: () => pending });
    try {
      await f.action(() => {
        f.row(name).props.onPress();
      });
      assert.equal(f.events.closes, 1);
      assert.deepEqual(f.events.actions, []);
      await f.action(() => {
        release();
      });
      assert.deepEqual(f.events.actions, [action]);
    } finally {
      await f.close();
    }
  });
}
for (const [language, title, reference] of [
  ["zh_CN", "充值失败", "联系支持团队 · 参考编号 session-distinct-999"],
  ["en_US", "Deposit fail", "Contact support · Ref session-distinct-999"],
]) {
  for (const status of ["failed", "refunded"]) {
    test(`D14-101 actual ${language}/${status} terminal Toast uses session reference while actual detail copies execution reference`, async () => {
      const e = execution({ status, terminal: true });
      const f = await unifoldDeliveryFixture({
        locale: language,
        delivery: {
          deliveryId: "delivery-local-1",
          sessionId: "session-distinct-999",
          execution: e,
        },
      });
      try {
        await f.emit();
        assert.deepEqual(f.events.toasts, [
          {
            type: "error",
            toastId: "delivery-local-1",
            title,
            message: reference,
          },
        ]);
        assert.equal(f.events.acks.length, 1);
        assert.equal(f.events.claims[0].claimId, f.events.acks[0].claimId);
        assert.ok(!f.events.toasts[0].message.includes(e.executionId));
        const detail = await unifoldTrackerFixture({
          locale: language,
          view: "detail",
          execution: e,
        });
        try {
          const copies = detail
            .nodes("XStack")
            .filter((n) => n.props.role === "button");
          assert.equal(copies.length, 1);
          const copy = copies[0];
          assert.ok(copy);
          await detail.action(() => copy.props.onPress());
          assert.deepEqual(detail.events.copies, [e.executionId]);
          assert.notEqual(detail.events.copies[0], "session-distinct-999");
        } finally {
          await detail.close();
        }
      } finally {
        await f.close();
      }
    });
  }
}
test("D14-101 actual terminal ACK retry renews claim without repeating already presented Toast and unmount clears retry", async () => {
  const f = await unifoldDeliveryFixture({
    delivery: {
      deliveryId: "delivery-local-1",
      sessionId: "session-distinct-999",
      execution: execution({ status: "failed" }),
    },
    ack: () => ({ updated: false, reason: "retry" }),
  });
  try {
    await f.emit();
    assert.equal(f.events.toasts.length, 1);
    await f.tick(1049);
    assert.equal(f.events.acks.length, 1);
    await f.tick(1);
    assert.equal(f.events.acks.length, 2);
    assert.equal(f.events.claims.length, 2);
    assert.equal(f.events.toasts.length, 1);
    assert.equal(f.events.claims[1].claimId, f.events.claims[0].claimId);
    assert.equal(f.bus.listenerCount("delivery"), 1);
  } finally {
    await f.close();
  }
  assert.equal(f.bus.listenerCount("delivery"), 0);
  assert.equal(f.clock.countTimers(), 0);
});

for (const remote of [false, undefined])
  test(`D14-25 actual hydrated remote flag ${remote} routes directly to wallet deposit form and never shows chain menu`, async () => {
    const f = await unifoldMenuFixture({
      fromHook: true,
      config: { perpConfigCommon: { unifoldDepositEnabled: remote } },
    });
    try {
      await f.open();
      assert.equal(f.config, undefined);
      assert.equal(f.row("transfer-crypto"), undefined);
      assert.deepEqual(f.events.forms, [{ actionType: "deposit" }]);
      assert.equal(f.events.preload, 0);
      assert.deepEqual(f.events.analytics, []);
      // Source opens the wallet form directly; do not claim a menu entry was clicked.
    } finally {
      await f.close();
    }
  });
for (const late of [false, true])
  test(`D14-100 actual watching deposit remains silent ${late ? "after awaiting hydrated config" : "at initial entry"}`, async () => {
    let release;
    const pending = new Promise((r) => {
      release = r;
    });
    const f = await unifoldMenuFixture({
      fromHook: true,
      ...(late
        ? { configRequest: () => pending }
        : {
            account: {
              accountId: "watching--local",
              accountAddress: "0x" + "a".repeat(40),
            },
          }),
    });
    try {
      if (late) {
        await f.action(() => {
          void f.result().showDepositWithdrawModal("deposit");
        });
        f.state.account = { ...f.state.account, accountId: "watching--local" };
        await f.action(() => {
          release(f.state.config);
        });
      } else {
        assert.equal(f.result().isDepositDisabled, true);
        await f.open();
      }
      assert.equal(f.config, undefined);
      assert.deepEqual(f.events.forms, []);
      assert.deepEqual(f.events.analytics, []);
      assert.equal(f.events.preload, 0);
    } finally {
      await f.close();
    }
  });
for (const sessionId of [null, undefined, ""])
  test(`D14-65 actual failed terminal without session ${sessionId} shows title only, never execution id`, async () => {
    const f = await unifoldDeliveryFixture({
      delivery: {
        deliveryId: "d",
        sessionId,
        execution: execution({ status: "failed" }),
      },
    });
    try {
      await f.emit();
      assert.deepEqual(f.events.toasts, [
        { type: "error", toastId: "d", title: "充值失败" },
      ]);
      assert.equal(f.events.acks.length, 1);
    } finally {
      await f.close();
    }
  });
