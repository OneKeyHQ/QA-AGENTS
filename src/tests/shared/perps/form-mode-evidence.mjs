import assert from "node:assert/strict";

export function projectOrderTabAppearance(_fiber, element) {
  let tab;
  for (let e = element; e; e = e.parentElement) {
    const style = getComputedStyle(e),
      rect = e.getBoundingClientRect();
    if (
      style.position === "relative" &&
      style.cursor === "pointer" &&
      rect.height >= 20 &&
      rect.height < 80 &&
      e.innerText.trim() === element.innerText.trim()
    ) {
      tab = e;
      break;
    }
  }
  if (!tab) throw Error("Actual order type tab container required");
  const rect = tab.getBoundingClientRect();
  const lines = [...tab.querySelectorAll("*")]
    .filter((e) => {
      const style = getComputedStyle(e),
        r = e.getBoundingClientRect();
      return (
        style.position === "absolute" &&
        r.height > 0 &&
        r.height <= 4 &&
        Math.abs(r.bottom - rect.bottom) <= 2 &&
        Math.abs(r.width - rect.width) <= 2 &&
        style.backgroundColor !== "transparent" &&
        !/rgba\([^)]*,\s*0(?:\.0+)?\)$/u.test(style.backgroundColor)
      );
    })
    .map((e) => getComputedStyle(e).backgroundColor);
  return {
    label: element.innerText.trim(),
    color: getComputedStyle(element).color,
    lines,
  };
}

export function assertOrderTabAppearance(states, selected) {
  assert.equal(
    states.length,
    3,
    "Exactly two primary tabs and one advanced tab",
  );
  assert.equal(new Set(states.map((s) => s.label)).size, 3);
  for (const primary of ["市价单", "限价单"])
    assert.ok(states.some((s) => s.label === primary));
  assert.ok(
    states.some((s) =>
      ["市价止盈止损", "限价止盈止损", "分段委托", "分时委托"].includes(
        s.label,
      ),
    ),
  );
  const active = states.filter((s) => s.label === selected);
  assert.equal(active.length, 1);
  for (const state of states) {
    assert.equal(
      state.lines.length,
      state.label === selected ? 1 : 0,
      `${state.label} selected underline`,
    );
    if (state.label === selected)
      assert.equal(
        state.lines[0],
        state.color,
        "Underline and active text share the foreground color",
      );
    else
      assert.notEqual(
        state.color,
        active[0].color,
        "Inactive tab uses subdued text",
      );
  }
}

// Serialized read-only projection of the committed SideButton submission ref.
// Only form values are returned; no callback/ref mutation is performed.
export function projectFormModeDraft(start) {
  const parents = new Set();
  for (let f = start; f; f = f.return) {
    if (parents.has(f) || parents.size >= 4096)
      throw Error("Invalid form parent chain");
    parents.add(f);
    const name =
      f.type?.displayName ||
      f.elementType?.displayName ||
      f.type?.type?.displayName ||
      f.type?.name;
    if (!name?.includes("SideButton")) continue;
    const drafts = [],
      hooks = new Set();
    for (let h = f.memoizedState; h; h = h.next) {
      if (hooks.has(h) || hooks.size >= 4096)
        throw Error("Invalid form hook chain");
      hooks.add(h);
      const state = h.memoizedState?.current;
      if (
        !state?.activeTradeInstrument ||
        !state.formData ||
        !state.computedSizeForSide
      )
        continue;
      const fields = [
        "type",
        "orderMode",
        "size",
        "sizePercent",
        "sizeInputMode",
        "side",
        "price",
        "hasTpsl",
        "bboPriceMode",
        "tpTriggerPx",
        "slTriggerPx",
        "tpValue",
        "slValue",
        "tpGainPercent",
        "slLossPercent",
        "tpType",
        "slType",
        "triggerPrice",
        "executionPrice",
        "triggerReduceOnly",
      ];
      drafts.push({
        coin: state.activeTradeInstrument.coin,
        ...Object.fromEntries(fields.map((key) => [key, state.formData[key]])),
      });
    }
    if (drafts.length !== 1)
      throw Error(`One committed form draft required, got ${drafts.length}`);
    return drafts[0];
  }
  throw Error("Actual form SideButton owner required");
}

export function assertAdvancedFormReset(before, after, target) {
  assert.ok(
    ["市价止盈止损", "限价止盈止损", "分段委托", "分时委托"].includes(target),
  );
  for (const key of [
    "coin",
    "size",
    "sizePercent",
    "sizeInputMode",
    "side",
    "price",
  ])
    assert.equal(after[key], before[key], `Mode switch preserves ${key}`);
  assert.equal(
    after.orderMode,
    target === "分段委托"
      ? "scale"
      : target === "分时委托"
        ? "twap"
        : "trigger",
  );
  assert.equal(
    after.type,
    ["限价止盈止损", "分段委托"].includes(target) ? "limit" : "market",
  );
  assert.equal(
    after.bboPriceMode,
    null,
    "BBO state is cleared, not merely hidden",
  );
  assert.equal(after.hasTpsl, false);
  for (const key of [
    "tpTriggerPx",
    "slTriggerPx",
    "tpValue",
    "slValue",
    "tpGainPercent",
    "slLossPercent",
  ])
    assert.equal(after[key], "", `${key} is cleared, not merely hidden`);
  assert.equal(after.tpType, "price");
  assert.equal(after.slType, "price");
}

export function assertReturnToStandard(before, after, target) {
  assert.ok(["市价单", "限价单"].includes(target));
  assert.deepEqual(
    after,
    {
      ...before,
      orderMode: "standard",
      type: target === "限价单" ? "limit" : "market",
    },
    "Returning to standard changes only the order type and mode",
  );
}
