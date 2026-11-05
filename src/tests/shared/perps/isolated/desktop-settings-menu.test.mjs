import test from "node:test";
import assert from "node:assert/strict";
import { settingsMenuFixture } from "./settings-menu-fixture.mjs";
const plain = (value) => JSON.parse(JSON.stringify(value));
const titles = {
  skip: "跳过订单确认",
  marks: "在图表上显示买卖点",
  lines: "在图表显示仓位和订单",
};
test("D16-33/157 actual Desktop button opens direct preferences with no mobile layout/actions, feature dot or shortcut grid", async () => {
  const f = await settingsMenuFixture();
  try {
    assert.equal(f.find("Switch").length, 0);
    await f.open();
    assert.equal(f.find("Popover")[0].props.open, true);
    assert.equal(f.find("Switch").length, 3);
    for (const t of Object.values(titles))
      assert.equal(f.find("ListItem", (p) => p.title === t).length, 1);
    for (const t of [
      "MobileLayout",
      "MobileLayoutContent",
      "PositionActions",
      "FeatureDot",
      "Shortcut",
    ])
      assert.equal(f.find(t).length, 0, t);
    assert.equal(
      f.find("ListItem", (p) => p.testID === f.ids.ResetLayoutButton).length,
      1,
    );
    assert.deepEqual(f.events, []);
  } finally {
    await f.close();
  }
});
for (const [name, key] of [
  ["skip", "skipOrderConfirm"],
  ["marks", "showTradeMarks"],
  ["lines", "showChartLines"],
])
  test(`D04-105/106/115/124 actual ${name} switch updates exactly its persisted property and survives local host remount`, async () => {
    const f = await settingsMenuFixture();
    try {
      await f.open();
      const before = plain(f.state.settings),
        next = !before[key];
      await f.switch(titles[name], next);
      assert.deepEqual(plain(f.state.settings), { ...before, [key]: next });
      assert.equal(
        f
          .find("ListItem", (p) => p.title === titles[name])[0]
          .findByType("Switch").props.value,
        next,
      );
      await f.remount();
      await f.open();
      assert.equal(
        f
          .find("ListItem", (p) => p.title === titles[name])[0]
          .findByType("Switch").props.value,
        next,
      );
      await f.switch(titles[name], before[key]);
      assert.deepEqual(plain(f.state.settings), before);
      assert.deepEqual(plain(f.state.layout), {
        chartHeight: 440,
        orderBook: false,
        other: 123,
      });
    } finally {
      await f.close();
    }
  });
test("D04-105/106/115 defaults missing marks/lines are true and independent from skipOrderConfirm", async () => {
  const f = await settingsMenuFixture({
    settings: { skipOrderConfirm: false, other: 1 },
  });
  try {
    await f.open();
    assert.deepEqual(
      f.find("Switch").map((n) => n.props.value),
      [false, true, true],
    );
    await f.switch(titles.marks, false);
    assert.deepEqual(plain(f.state.settings), {
      skipOrderConfirm: false,
      other: 1,
      showTradeMarks: false,
    });
    assert.deepEqual(
      f.find("Switch").map((n) => n.props.value),
      [false, false, true],
    );
  } finally {
    await f.close();
  }
});
test("D16-124/125/128 actual menu reset invokes actual reset updater clearing both height and hidden book, keeping other preferences; idempotent toast", async () => {
  const f = await settingsMenuFixture();
  try {
    await f.open();
    const prefs = plain(f.state.settings);
    await f.press(f.ids.ResetLayoutButton);
    assert.deepEqual(plain(f.state.layout), { other: 123 });
    assert.deepEqual(plain(f.state.settings), prefs);
    assert.deepEqual(plain(f.events), [
      ["layout", { other: 123 }],
      ["toast", "布局已重置"],
    ]);
    await f.press(f.ids.ResetLayoutButton);
    assert.deepEqual(plain(f.state.layout), { other: 123 });
    assert.equal(f.events.filter((e) => e[0] === "toast").length, 2);
    await f.remount();
    await f.open();
    assert.deepEqual(plain(f.state.layout), { other: 123 });
  } finally {
    await f.close();
  }
});
test("D16-157 actual menu reopen retains switch values and no hidden mobile navigation callbacks execute", async () => {
  const f = await settingsMenuFixture();
  try {
    await f.open();
    await f.switch(titles.lines, false);
    await f.remount();
    await f.open();
    assert.equal(f.find("Switch")[2].props.value, false);
    assert.deepEqual(
      f.events.map((e) => e[0]),
      ["settings"],
    );
    assert.equal(f.find("Shortcut").length, 0);
    assert.equal(f.find("ActivityContent").length, 0);
    assert.equal(
      f.find("ListItem", (p) => p.testID === f.ids.GuideButton).length,
      0,
    );
  } finally {
    await f.close();
  }
});
for (const [activities, guide] of [
  [true, false],
  [false, true],
  [true, true],
])
  test(`D16-157/161 actual configured campaign=${activities}/guide=${guide} flags and guide close-before-open`, async () => {
    const f = await settingsMenuFixture({
      activities,
      guide,
      activityCards: activities ? [{ title: "local campaign" }] : [],
    });
    try {
      await f.open();
      assert.equal(f.find("ActivityContent").length, activities ? 1 : 0);
      assert.equal(
        f.find("ListItem", (p) => p.testID === f.ids.GuideButton).length,
        guide ? 1 : 0,
      );
      assert.equal(f.find("Switch").length, 3);
      if (guide) {
        await f.press(f.ids.GuideButton);
        assert.deepEqual(f.events, [["close"], ["guide"]]);
        assert.equal(f.find("Popover")[0].props.open, false);
        await f.open();
        assert.equal(f.find("Switch").length, 3);
      }
    } finally {
      await f.close();
    }
  });
