// Pinned actual LanguageListItem → useLanguageSelector → ServiceSetting.setLocale
// → serviceApp.restartApp → appRestart. Storage, native menu and reload are local
// adapters. No live service API/transport/signature is imported or called.
import { React, renderer, evaluateSource } from "./source.mjs";
import { sourceClass } from "./twap-flow-fixture.mjs";
const host =
  (type) =>
  ({ children, ...props }) =>
    React.createElement(type, props, children);
export async function settingsLocaleFixture(
  initial = "zh-CN",
  { failAt } = {},
) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const state = { locale: initial, currency: "usd", theme: "dark" },
    events = [],
    pending = [],
    errors = [];
  const atom = {
    get: async () => ({ ...state }),
    set: async (fn) => {
      events.push(["persist"]);
      if (failAt === "persist") throw Error("persist failed");
      Object.assign(state, fn({ ...state }));
    },
  };
  const Setting = sourceClass(
    "packages/kit-bg/src/services/ServiceSetting.ts",
    ["setLocale"],
    { settingsPersistAtom: atom },
  );
  const serviceSetting = new Setting();
  serviceSetting.refreshLocaleMessages = async () => {
    events.push(["messages", state.locale]);
    if (failAt === "messages") throw Error("messages failed");
  };
  serviceSetting.backgroundApi = {
    serviceReferralCode: {
      resetPostConfig: async () => events.push(["referral-cache-reset"]),
    },
  };
  const { appRestart } = evaluateSource(
    "packages/shared/src/modules3rdParty/appRestart/index.ts",
    {
      names: ["appRestart"],
      globals: {
        platformEnv: { isDesktop: true },
        defaultLogger: {
          setting: {
            page: { restartApp: (opts) => events.push(["restart-log", opts]) },
          },
        },
        BootRecovery: { markBootSuccess: () => events.push(["boot-success"]) },
        globalThis: {
          desktopApiProxy: {
            system: {
              reload: async () => {
                events.push(["reload", state.locale]);
                if (failAt === "reload") throw Error("reload failed");
              },
            },
          },
        },
      },
    },
  );
  const App = sourceClass(
    "packages/kit-bg/src/services/ServiceApp.ts",
    ["restartApp"],
    { appRestart, EAppRestartMode: { All: "all" } },
  );
  const backgroundApiProxy = { serviceSetting, serviceApp: new App() };
  const options = [
    { value: "system", label: "Auto" },
    { value: "zh-CN", label: "简体中文" },
    { value: "en", label: "English" },
    { value: "en-US", label: "deprecated" },
    { value: "ja-JP", label: "日本語" },
  ];
  const hook = evaluateSource(
    "packages/kit/src/views/Setting/hooks/useLanguageSelector.ts",
    {
      names: ["changeLanguage", "useLanguageSelector"],
      globals: {
        ...React,
        backgroundApiProxy,
        platformEnv: { isDesktop: true },
        EAppRestartMode: { All: "all" },
        useLocaleOptions: () => options,
        useSettingsPersistAtom: () => [{ ...state }],
        globalThis: {
          desktopApiProxy: {
            system: {
              changeLanguage: (locale) => events.push(["native-menu", locale]),
            },
          },
        },
      },
    },
  );
  const { LanguageListItem } = evaluateSource(
    "packages/kit/src/views/Setting/pages/Tab/CustomElement.tsx",
    {
      names: ["LanguageListItem"],
      globals: {
        ...React,
        useLanguageSelector: () => {
          const value = hook.useLanguageSelector();
          return {
            ...value,
            onChange: (locale) => {
              const promise = value.onChange(locale);
              pending.push(promise);
              promise.catch((e) => errors.push(e));
              return promise;
            },
          };
        },
        Select: host("Select"),
        TabSettingsListItem: host("SettingsRow"),
        XStack: host("XStack"),
        ListItem: { Text: host("Text"), DrillIn: host("Chevron") },
        SettingsValueText: host("Value"),
        SettingTestIDs: { languageItem: "setting-language" },
        logSettingValueChanged: (change) => events.push(["analytics", change]),
        useLogSearchResultOnSelectOpen: () => () => {},
      },
    },
  );
  let tree;
  const render = () =>
    renderer.act(async () => {
      if (tree)
        tree.update(
          React.createElement(LanguageListItem, { title: "Language" }),
        );
      else
        tree = renderer.create(
          React.createElement(LanguageListItem, { title: "Language" }),
        );
    });
  await render();
  return {
    state,
    events,
    errors,
    select: () => tree.root.findByType("Select").props,
    async choose(value) {
      await renderer.act(async () =>
        tree.root.findByType("Select").props.onChange(value),
      );
      await Promise.allSettled(pending);
      await render();
    },
    async remount() {
      await renderer.act(async () => {
        tree.unmount();
      });
      tree = null;
      await render();
    },
    async close() {
      await renderer.act(async () => tree.unmount());
    },
  };
}
