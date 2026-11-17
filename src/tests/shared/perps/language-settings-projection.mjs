// Committed React reads only. Never invoke a product callback or expose the
// settings object (which contains unrelated sensitive application state).
export function projectLanguageSettings(fiber) {
  let select;
  const locales = new Set();
  for (let n = fiber; n; n = n.return) {
    const p = n.memoizedProps;
    if (
      p?.testID === "setting-language-list-item-select" &&
      Array.isArray(p.items) &&
      typeof p.onChange === "function"
    )
      select = {
        value: p.value,
        items: p.items.map(({ value, label }) => ({ value, label })),
      };
    // Jotai's useAtomValue hook stores [value, store, atom]. Read only the value
    // or its immediate tuple; do not recursively traverse a store/service.
    for (let h = n.memoizedState, i = 0; h && i < 200; h = h.next, i++) {
      for (const v of [
        h.memoizedState,
        ...(Array.isArray(h.memoizedState) ? h.memoizedState : []),
      ])
        if (
          v &&
          typeof v === "object" &&
          typeof v.locale === "string" &&
          typeof v.theme === "string" &&
          v.currencyInfo?.id
        )
          locales.add(v.locale);
    }
  }
  if (!select) return null;
  if (locales.size !== 1)
    throw Error(
      "Cannot independently identify the persistent language; refuse non-restorable changes",
    );
  return { ...select, rawLocale: [...locales][0] };
}
export function projectPreferencesEntry(fiber) {
  for (let n = fiber; n; n = n.return)
    if (
      n.memoizedProps?.trackID === "wallet-preferences" &&
      typeof n.memoizedProps.onPress === "function"
    )
      return true;
  return false;
}
export function projectPreferencesTitles(fiber) {
  let root = fiber;
  while (root.return) root = root.return;
  const titles = new Set(),
    stack = [root];
  for (let i = 0; stack.length && i < 100000; i++) {
    const n = stack.pop(),
      p = n.memoizedProps;
    if (
      p?.trackID === "wallet-preferences" &&
      typeof p.onPress === "function" &&
      typeof p.title === "string"
    )
      titles.add(p.title);
    if (n.sibling) stack.push(n.sibling);
    if (n.child) stack.push(n.child);
  }
  if (stack.length) throw Error("Preferences tree scan limit reached");
  return [...titles];
}
export function projectLanguageOption(fiber) {
  let item,
    language = false;
  for (let n = fiber; n; n = n.return) {
    const p = n.memoizedProps;
    if (
      typeof p?.onSelect === "function" &&
      typeof p.value === "string" &&
      Object.hasOwn(p, "selectedValue")
    )
      item = { value: p.value, disabled: Boolean(p.disabled) };
    if (
      p?.testID === "setting-language-list-item-select" &&
      Array.isArray(p.items)
    )
      language = true;
  }
  return language ? (item ?? null) : null;
}
