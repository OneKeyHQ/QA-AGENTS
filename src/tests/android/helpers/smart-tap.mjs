// Smart hybrid tap — tries UIAutomator selectors in priority order, falls back
// to fixed coordinates. AI vision fallback can be slotted in later; for now we
// rely on OneKey's testID coverage (~70% of interactive elements have it).
//
// Priority: resource-id > content-desc > text > coords
//
// Usage:
//   smartTap({ resourceId: 'AccountSelectorTriggerBase' })
//   smartTap({ contentDesc: 'Wallet' })
//   smartTap({ text: 'Create wallet', coords: [810, 2486] })

import {
  adbShell,
  findElementByResourceId,
  findElementByContentDesc,
  findElementByText,
  getElements,
  invalidateCache,
} from './device.mjs';

export async function smartTap(spec) {
  const { resourceId, contentDesc, text, coords, name } = spec;

  if (resourceId) {
    const el = await findElementByResourceId(resourceId);
    if (el) return doTap(el.center.x, el.center.y, 'resourceId', resourceId);
  }
  if (contentDesc) {
    const el = await findElementByContentDesc(contentDesc);
    if (el) return doTap(el.center.x, el.center.y, 'contentDesc', contentDesc);
  }
  if (text) {
    const el = await findElementByText(text);
    if (el) return doTap(el.center.x, el.center.y, 'text', text);
  }
  if (coords && Array.isArray(coords) && coords.length === 2) {
    return doTap(coords[0], coords[1], 'coords', `${coords[0]},${coords[1]}`);
  }

  throw new Error(`smartTap failed (${name || 'unnamed'}): no selector matched`);
}

async function doTap(x, y, method, key) {
  await adbShell(`input tap ${x} ${y}`);
  invalidateCache();
  return { method, key, x, y };
}

// Smart type-text — explicitly finds an EditText matching the selector,
// taps it to focus, waits for IME, then types via adb.
//
// Bug history:
//  - v1: smartTap + immediate `input text "VIP999"` → only 'V' registered
//    (race with keyboard opening, but worse: smartTap matched a TextView label
//    with the same text='Referral code' as the EditText hint, so tap missed
//    the input and only 1 stray key reached anywhere).
//  - v2: smartTap + 500ms wait + per-char → 0 chars (same root cause; tapping
//    a TextView puts focus nowhere).
//  - v3 (current): explicitly filter for className contains 'EditText' so we
//    always tap the actual input field. Then 400ms IME wait + per-char input.
export async function smartType(spec, text, options = {}) {
  const editText = await findEditTextMatching(spec);
  if (editText) {
    await adbShell(`input tap ${editText.center.x} ${editText.center.y}`);
  } else {
    // Fallback: no EditText match, try the original smartTap (likely tapping a
    // wrapper that bubbles focus to a child EditText).
    await smartTap(spec);
  }
  await new Promise((r) => setTimeout(r, 400));

  // Per-char input with inter-char delay — robust against IME state quirks.
  for (const ch of text) {
    const escaped = ch === ' ' ? '%s' : ch;
    await adbShell(`input text "${escaped}"`);
    await new Promise((r) => setTimeout(r, 60));
  }

  // Dismiss IME so subsequent taps aren't blocked by the keyboard overlay.
  // On Android, KEYCODE_BACK with IME visible closes the keyboard only — it
  // does NOT navigate the activity (that takes a second press, which we don't
  // send). Skippable via `dismissKeyboard: false` for cases like Search where
  // the keyboard should stay open for autosuggest results.
  if (options.dismissKeyboard !== false) {
    await new Promise((r) => setTimeout(r, 200));
    await adbShell('input keyevent 4'); // 4 = KEYCODE_BACK
    await new Promise((r) => setTimeout(r, 500));
  }

  invalidateCache();
  return { method: 'type', text, matched: editText ? 'EditText' : 'fallback' };
}

// Locate an EditText whose attributes match the selector spec. Prefers exact
// resource-id, then content-desc, then text (matches placeholder/hint or
// actual current value).
async function findEditTextMatching(spec) {
  const els = await getElements();
  const isEditText = (el) => (el.className || '').includes('EditText');
  const matchesSpec = (el) => {
    if (spec.resourceId && el.resourceId && el.resourceId.includes(spec.resourceId)) return true;
    if (spec.contentDesc && el.contentDesc && el.contentDesc.includes(spec.contentDesc)) return true;
    if (spec.text && el.text && el.text.includes(spec.text)) return true;
    return false;
  };
  return els.find((el) => isEditText(el) && matchesSpec(el));
}

// Smart swipe — pure coords, used for scrolling lists or revealing offscreen UI.
// spec.swipe: { from: [x1,y1], to: [x2,y2], duration: ms (default 300) }
export async function smartSwipe(spec) {
  const { from, to, duration = 300 } = spec.swipe || {};
  if (!Array.isArray(from) || !Array.isArray(to)) {
    throw new Error(`smartSwipe: missing from/to in ${spec.name || 'spec'}`);
  }
  await adbShell(`input swipe ${from[0]} ${from[1]} ${to[0]} ${to[1]} ${duration}`);
  invalidateCache();
  return { method: 'swipe', from, to, duration };
}
