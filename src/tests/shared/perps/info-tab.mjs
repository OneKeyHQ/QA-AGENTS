// Read and restore Desktop's selected information tab through its visible UI.
import assert from "node:assert/strict";
import { locator } from "../../helpers/perps-ui.mjs";
import { projectReactAll } from "./react-projection.mjs";
const items = (p) => locator(p, "perps.info.tab_items");
export async function infoTabs(p) {
  const rows = await projectReactAll(items(p), (f, e) => {
    for (; f; f = f.return) {
      const v = f.memoizedProps;
      if (typeof v?.name === "string" && typeof v.isFocused === "boolean")
        return { id: e.dataset.testid, name: v.name, focused: v.isFocused };
    }
    throw Error("Information tab committed selection missing");
  });
  assert.equal(
    new Set(rows.map((r) => r.name)).size,
    rows.length,
    "Information tab identities unique",
  );
  assert.equal(
    rows.filter((r) => r.focused).length,
    1,
    "One selected information tab",
  );
  return rows;
}
export async function currentInfoTab(p) {
  return (await infoTabs(p)).find((r) => r.focused).name;
}
export async function restoreInfoTab(p, name) {
  const rows = await infoTabs(p),
    index = rows.findIndex((r) => r.name === name);
  assert.ok(index >= 0, "Original information tab remains available");
  if (!rows[index].focused) await items(p).nth(index).click();
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    if ((await currentInfoTab(p)) === name) return;
    await p.waitForTimeout(100);
  }
  assert.equal(await currentInfoTab(p), name, "Information tab restored");
}
