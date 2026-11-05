import test from "node:test";
import assert from "node:assert/strict";
import { settingsLocaleFixture } from "./settings-locale-fixture.mjs";
import { twapListFixture } from "./twap-list-fixture.mjs";
import { stateFixture } from "./twap-state-fixture.mjs";
import { orderState, origin } from "./twap-source-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
test("D11-208 actual language settings persist then reload main/background together, without changing other settings", async () => {
  const f = await settingsLocaleFixture();
  try {
    assert.equal(f.select().testID, "setting-language-list-item-select");
    assert.deepEqual(plain(f.select().items.map((x) => x.value)), [
      "system",
      "zh-CN",
      "en",
      "ja-JP",
    ]);
    for (const locale of ["en", "zh-CN"]) {
      const start = f.events.length;
      await f.choose(locale);
      assert.deepEqual(f.errors, []);
      assert.equal(f.state.locale, locale);
      assert.equal(f.select().value, locale);
      assert.equal(f.state.currency, "usd");
      assert.equal(f.state.theme, "dark");
      assert.deepEqual(
        f.events.slice(start).map((x) => x[0]),
        [
          "analytics",
          "persist",
          "messages",
          "referral-cache-reset",
          "native-menu",
          "restart-log",
          "boot-success",
          "reload",
        ],
      );
      assert.deepEqual(
        plain(f.events.findLast((x) => x[0] === "restart-log")[1]),
        { mode: "all", reason: `setting.language.${locale}` },
      );
      await f.remount();
      assert.equal(
        f.select().value,
        locale,
        "Reloaded selector reads persistent value",
      );
    }
  } finally {
    await f.close();
  }
});
for (const [label, failAt, forbidden] of [
  ["persist", "persist", "messages"],
  ["messages", "messages", "native-menu"],
  ["reload", "reload", "unreachable"],
])
  test(`D11-208 actual settings ${label} error is not a successful reload`, async () => {
    const f = await settingsLocaleFixture("zh-CN", { failAt });
    try {
      await f.choose("en");
      assert.equal(f.errors.length, 1);
      assert.match(f.errors[0].message, /failed/u);
      assert.ok(!f.events.some((x) => x[0] === forbidden));
      if (failAt === "persist") assert.equal(f.select().value, "zh-CN");
    } finally {
      await f.close();
    }
  });
test("D11-208 deprecated English is normalized and same locale still takes explicit reload without rewriting storage", async () => {
  const legacy = await settingsLocaleFixture("en-US");
  try {
    assert.equal(legacy.select().value, "en");
    assert.ok(!legacy.select().items.some((x) => x.value === "en-US"));
  } finally {
    await legacy.close();
  }
  const f = await settingsLocaleFixture("en");
  try {
    await f.choose("en");
    assert.equal(
      f.events.some((x) => x[0] === "persist"),
      false,
    );
    assert.equal(f.events.at(-1)[0], "reload");
  } finally {
    await f.close();
  }
});
test("D11-208 actual setting/reload chain drives real TWAP current/history translations and refresh with invariant asset/size/duration", async () => {
  const settings = await settingsLocaleFixture(),
    store = stateFixture();
  const history = [
    "waitingForTrigger",
    "activated",
    "finished",
    "terminated",
    "stopped",
    "error",
  ].map((status, i) => ({
    twapId: i + 1,
    time: origin + i * 1000,
    state: orderState({ side: "B" }),
    status: { status },
  }));
  store.responses.history = history;
  store.responses.orders = {
    user: store.account,
    twapStates: [
      [1, orderState({ side: "B" })],
      [2, orderState({ side: "B", executedSz: "0.5", executedNtl: "50" })],
    ],
  };
  let previous;
  try {
    for (const [locale, resource, expected] of [
      [
        "zh-CN",
        "zh_CN",
        ["等待触发", "活跃中", "已完成", "已终止", "已停止", "异常"],
      ],
      [
        "en",
        "en_US",
        [
          "Waiting for Trigger",
          "Activated",
          "Finished",
          "Terminated",
          "Stopped",
          "Error",
        ],
      ],
      [
        "zh-CN",
        "zh_CN",
        ["等待触发", "活跃中", "已完成", "已终止", "已停止", "异常"],
      ],
    ]) {
      await settings.choose(locale);
      assert.deepEqual(settings.errors, []);
      const f = await twapListFixture({
        store,
        initialTab: "history",
        state: { locale: resource, now: origin + 10000 },
      });
      try {
        const read = () =>
          f.rows().map((r) => ({
            id: r.id,
            coin: r.record.state.coin,
            size: r.record.state.sz,
            minutes: r.record.state.minutes,
          }));
        const snapshot = read();
        if (previous) assert.deepEqual(snapshot, previous);
        previous = snapshot;
        for (const text of expected)
          assert.ok(
            f.rows().some((r) => r.cellValues.at(-1) === text),
            `Actual ${locale} status ${text}`,
          );
        await f.refresh();
        assert.deepEqual(
          read(),
          snapshot,
          "Explicit history refresh keeps semantic data",
        );
        await f.select("active");
        const active = read();
        assert.equal(active.length, 2);
        await f.refresh();
        assert.deepEqual(
          read(),
          active,
          "Explicit current refresh keeps semantic data",
        );
      } finally {
        await f.close();
      }
    }
  } finally {
    await settings.close();
  }
});
