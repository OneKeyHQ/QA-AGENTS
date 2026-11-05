// Shared real Desktop Preferences interactions. No direct settings writes.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import { unlockWalletIfNeeded } from "../../helpers/index.mjs";
import { projectReactAll } from "./react-projection.mjs";
import {
  projectLanguageSettings, projectPreferencesEntry,
  projectPreferencesTitles, projectLanguageOption,
} from "./language-settings-projection.mjs";
import { closeDialog, closePop } from "./non-order-ui.mjs";

export async function openLanguage(p) {
  await unlockWalletIfNeeded(p);
  if (!(await locator(p, "settings.setting-language").count())) {
    await closePop(p);
    await closeDialog(p);
    await locator(p, "settings.desktop-more-menu").click();
    const titles = (
      await projectReactAll(
        locator(p, "settings.desktop-more-menu"),
        projectPreferencesTitles,
      )
    ).flat();
    assert.equal(titles.length, 1, "Unique actual Preferences menu title");
    const entries = p
      .getByText(titles[0], { exact: true })
      .filter({ visible: true });
    // Exact grid component ownership; text, position, and current UI language
    // alone cannot identify the Preferences entry reliably.
    const owned = await projectReactAll(entries, projectPreferencesEntry);
    const matches = owned.flatMap((yes, i) => (yes ? [i] : []));
    // Text selectors can match both a label and its container; click the
    // innermost owned host after proving all matches have the same owner text.
    assert.ok(matches.length > 0, "Owned Preferences menu entry visible");
    const texts = await Promise.all(
      matches.map((i) => entries.nth(i).innerText()),
    );
    assert.equal(
      new Set(texts.map((s) => s.trim())).size,
      1,
      "One unique Preferences label",
    );
    await entries.nth(matches.at(-1)).click();
  }
  await locator(p, "settings.setting-language").waitFor({ state: "visible" });
  const values = await projectReactAll(
    locator(p, "settings.setting-language"),
    projectLanguageSettings,
  );
  assert.equal(values.length, 1);
  assert.ok(values[0]);
  return values[0];
}
export async function changeLocale(p, target, { navigate, reload }) {
  const before = await openLanguage(p);
  assert.ok(
    before.items.some((x) => x.value === target),
    "Original/target language has a selectable option",
  );
  if (before.rawLocale === target) {
    await reload(p);
    return;
  }
  const epoch = await p.evaluate(() => performance.timeOrigin);
  await unlockWalletIfNeeded(p);
  await locator(p, "settings.setting-language").click();
  const options = locator(p, "settings.language-options");
  await options.first().waitFor({ state: "visible" });
  const projected = await projectReactAll(options, projectLanguageOption);
  const indices = projected.flatMap((v, i) =>
    v?.value === target && !v.disabled ? [i] : [],
  );
  assert.equal(
    indices.length,
    1,
    "One enabled option owned by the actual language Select",
  );
  await options.nth(indices[0]).click();
  await p.waitForFunction((old) => performance.timeOrigin !== old, epoch, {
    timeout: 45000,
  });
  await navigate(p);
  const current = await openLanguage(p);
  assert.equal(
    current.rawLocale,
    target,
    "Independent persisted language after actual reload",
  );
  assert.equal(current.value, target, "Reloaded actual language Select agrees");
  await reload(p);
}
