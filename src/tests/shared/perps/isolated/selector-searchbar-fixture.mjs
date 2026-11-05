// Actual SearchBar + actual IME lock and installed use-debounce, connected to
// actual picker callbacks. Input rendering and filtered-result arrival are
// explicit boundaries; the complete picker portal/list is not mounted here.
import { readFileSync } from "node:fs";
import {
  React,
  renderer,
  evaluateSource,
  evaluateText,
  appRequire,
} from "./source.mjs";
import { selectorKeyboardFixture } from "./selector-keyboard-fixture.mjs";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
export async function selectorSearchbarFixture(patch = {}) {
  const keyboard = selectorKeyboardFixture(patch);
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const globals = {
    Date: clock.Date,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    window: {},
  };
  const debouncePath = appRequire.resolve("use-debounce");
  const debounce = evaluateText(
    debouncePath,
    readFileSync(debouncePath, "utf8"),
    { globals },
  );
  const ime = evaluateSource("packages/shared/src/utils/imeUtils.ts", {
    globals,
  });
  const focus = [];
  let props, tree;
  const Input = React.forwardRef((next, ref) => {
    props = next;
    React.useImperativeHandle(ref, () => ({
      focus: () => focus.push(clock.now),
    }));
    return null;
  });
  const { SearchBar } = evaluateSource(
    "packages/components/src/layouts/SearchBar/index.tsx",
    {
      globals,
      mocks: {
        "react-intl": { useIntl: () => ({ formatMessage: () => "搜索" }) },
        "use-debounce": debounce,
        "@onekeyhq/shared/src/locale": {
          ETranslations: { global_search: "global.search" },
        },
        "@onekeyhq/shared/src/platformEnv": { isNative: false },
        "@onekeyhq/shared/src/utils/imeUtils": ime,
        "../../forms/Input": { Input },
      },
    },
  );
  function Probe() {
    return React.createElement(SearchBar, {
      testID: "local-picker",
      autoFocus: true,
      onChangeText: (text) => keyboard.invoke("handleSearchQueryChange", text),
      onChange: (event) => keyboard.invoke("handleSearchInputChange", event),
      onKeyPress: (event) => keyboard.invoke("handleKeyboardNavigation", event),
      onSubmitEditing: (event) =>
        keyboard.invoke("handleKeyboardSubmit", event),
    });
  }
  await renderer.act(async () => {
    tree = renderer.create(React.createElement(Probe));
  });
  return {
    keyboard,
    clock,
    focus,
    get props() {
      return props;
    },
    type: async (text) =>
      renderer.act(async () => {
        keyboard.input.value = text;
        props.onChange({ nativeEvent: { text } });
        props.onChangeText(text);
      }),
    tick: async (ms) => renderer.act(async () => clock.tickAsync(ms)),
    startComposition: async () =>
      renderer.act(async () => props.onCompositionStart()),
    endComposition: async (text) =>
      renderer.act(async () =>
        props.onCompositionEnd({ target: { value: text } }),
      ),
    submit: async (text = keyboard.input.value) =>
      renderer.act(async () =>
        props.onSubmitEditing({ nativeEvent: { text }, preventDefault() {} }),
      ),
    clear: async () => renderer.act(async () => props.addOns[0].onPress()),
    // Models the asynchronous filter result atom independently from input.
    filtered: (query, data) => {
      keyboard.state.filteredQuery = query;
      if (data) keyboard.state.activeTabData = data;
    },
    close: async () => {
      await renderer.act(async () => tree.unmount());
      keyboard.close();
    },
  };
}
