// Screen state assertions for runner safety.
//
// Why: coord-only taps in the wrong state are dangerous — one near-miss today
// almost triggered OneKey's "Reset all wallets" dialog. Before/after asserts
// catch state drift and abort cleanly instead of letting the runner barrel on.
//
// Schema (used by runner + YAML):
//   preflight:
//     require:
//       - resourceId: AccountSelectorTriggerBase
//       - text: "Account"
//     message: "Must start on wallet home"
//
//   steps:
//     - name: ...
//       coords: [x, y]
//       assert_before:
//         require:
//           - text: "Backup your wallet"
//         message: "Backup card must be visible"
//       assert_after:
//         require:
//           - contentDesc: "OneKey KeyTag"
//         retry: 1
//         message: "Tap should have opened the backup popover"
//
// A `require` entry matches if ANY of resourceId / contentDesc / text criterion
// on the entry is a substring match on the corresponding attr of some on-screen
// element. Each requirement in the array must independently match.

import { getElements, invalidateCache } from './device.mjs';

const matchesRequirement = (el, req) => {
  if (req.resourceId && (!el.resourceId || !el.resourceId.includes(req.resourceId))) return false;
  if (req.contentDesc && (!el.contentDesc || !el.contentDesc.includes(req.contentDesc))) return false;
  if (req.text && (!el.text || !el.text.includes(req.text))) return false;
  return Boolean(req.resourceId || req.contentDesc || req.text);
};

/**
 * Verify all `requirements` are present on the current screen.
 * Always re-dumps (invalidates cache) so it sees the latest state.
 *
 * @param {Array<{resourceId?:string, contentDesc?:string, text?:string}>} requirements
 * @returns {{ ok: boolean, missing: Array<object> }}
 */
export async function assertScreenHas(requirements) {
  if (!Array.isArray(requirements) || requirements.length === 0) {
    return { ok: true, missing: [] };
  }
  invalidateCache();
  const els = await getElements();
  const missing = [];
  for (const req of requirements) {
    const hit = els.some((el) => matchesRequirement(el, req));
    if (!hit) missing.push(req);
  }
  return { ok: missing.length === 0, missing };
}

function fmtRequirement(req) {
  const parts = [];
  if (req.resourceId) parts.push(`rid=${req.resourceId}`);
  if (req.contentDesc) parts.push(`desc="${req.contentDesc}"`);
  if (req.text) parts.push(`text="${req.text}"`);
  return parts.join(' ');
}

export function describeMissing(missing) {
  return missing.map(fmtRequirement).join(' | ');
}
