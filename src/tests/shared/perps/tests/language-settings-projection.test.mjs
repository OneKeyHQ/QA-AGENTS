import test from "node:test";
import assert from "node:assert/strict";
import {
  projectLanguageSettings,
  projectLanguageOption,
  projectPreferencesEntry,
  projectPreferencesTitles,
} from "../language-settings-projection.mjs";
import { twapLocaleSemantics } from "../desktop-twap-locale.mjs";
test("Language projection reads actual Select plus independent persistent locale, without exposing sensitive settings", () => {
  const raw = {
    locale: "zh-CN",
    theme: "dark",
    currencyInfo: { id: "usd" },
    sensitiveEncodeKey: "never-export",
  };
  const owner = {
    memoizedProps: {},
    memoizedState: { memoizedState: [raw, {}, {}] },
  };
  const select = {
    memoizedProps: {
      testID: "setting-language-list-item-select",
      value: "zh-CN",
      items: [{ value: "zh-CN", label: "中文" }],
      onChange() {
        throw Error("never invoke");
      },
    },
    return: owner,
  };
  const value = projectLanguageSettings(select);
  assert.equal(value.rawLocale, "zh-CN");
  assert.ok(!JSON.stringify(value).includes("never-export"));
  assert.equal(projectLanguageSettings(owner), null);
  assert.throws(
    () => projectLanguageSettings({ ...select, return: null }),
    /Cannot independently/u,
  );
  owner.memoizedState.next = { memoizedState: { ...raw, locale: "en" } };
  assert.throws(() => projectLanguageSettings(select), /Cannot independently/u);
});
test("Legacy language stays distinguishable from normalized English and cannot be silently restored as another raw value", () => {
  const select = {
    memoizedProps: {
      testID: "setting-language-list-item-select",
      value: "en",
      items: [],
      onChange() {},
    },
    memoizedState: {
      memoizedState: [
        { locale: "en-US", theme: "dark", currencyInfo: { id: "usd" } },
      ],
    },
  };
  assert.equal(projectLanguageSettings(select).rawLocale, "en-US");
});
test("Language options and Preferences require actual owning components, not matching text or another Select", () => {
  const language = {
    memoizedProps: { testID: "setting-language-list-item-select", items: [] },
  };
  const item = {
    memoizedProps: {
      value: "en",
      selectedValue: "zh-CN",
      disabled: false,
      onSelect() {
        throw Error("not invoked");
      },
    },
    return: language,
  };
  assert.deepEqual(projectLanguageOption(item), {
    value: "en",
    disabled: false,
  });
  assert.equal(projectLanguageOption({ ...item, return: null }), null);
  const pref = {
    memoizedProps: {
      trackID: "wallet-preferences",
      title: "Preferences",
      onPress() {},
    },
  };
  assert.equal(projectPreferencesEntry(pref), true);
  assert.equal(projectPreferencesEntry(language), false);
  assert.deepEqual(projectPreferencesTitles({ child: pref }), ["Preferences"]);
});
test("TWAP language invariants include own identities/assets/total quantity/duration but tolerate legitimate changing execution totals", () => {
  const records = [
    {
      twapId: 1,
      time: 1000,
      status: { status: "activated" },
      state: {
        coin: "BTC",
        sz: "1",
        minutes: 5,
        side: "B",
        timestamp: 1000,
        executedSz: "0",
      },
    },
  ];
  const baseline = twapLocaleSemantics("history", records);
  records[0].state.executedSz = "0.5";
  assert.deepEqual(twapLocaleSemantics("history", records), baseline);
  for (const [key, value] of [
    ["coin", "ETH"],
    ["sz", "2"],
    ["minutes", 6],
    ["side", "A"],
  ]) {
    const changed = structuredClone(records);
    changed[0].state[key] = value;
    assert.notDeepEqual(twapLocaleSemantics("history", changed), baseline);
  }
  assert.throws(() =>
    twapLocaleSemantics("history", [{ twapId: 1, state: {} }]),
  );
});
