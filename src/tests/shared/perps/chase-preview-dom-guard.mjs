import { committedFiber, fiberOwner } from "./react-projection.mjs";
import {
  projectChasePreviewState,
  chasePreviewBlockReason,
} from "./chase-preview-evidence.mjs";
export const chaseGuardKey = "__qaPerpsChasePreviewGuard";
// This changes no product state and never invokes a product event handler.
// Invalid pointer/key events are stopped before the actual preview handler.
export function mountChaseCaptureGuard(
  element,
  { resolve, owner, project, blockReason, context, key },
) {
  if (element[key]) throw Error("Chase capture guard already present");
  const allowed = [],
    blocked = [];
  const events = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "click",
    "keydown",
    "touchstart",
    "touchend",
  ];
  const guard = (event) => {
    let reason;
    try {
      reason = blockReason(project(resolve(owner(element))), context);
    } catch (error) {
      reason = String(error.message || error);
    }
    if (reason) {
      event.preventDefault();
      event.stopImmediatePropagation();
      blocked.push({ type: event.type, reason });
    } else allowed.push(event.type);
  };
  events.forEach((type) => element.addEventListener(type, guard, true));
  element[key] = {
    allowed,
    blocked,
    dispose: () => {
      events.forEach((type) => element.removeEventListener(type, guard, true));
      delete element[key];
    },
  };
}
export async function installChasePreviewGuard(action, context) {
  await action.evaluate(
    (element, payload) => {
      const restore = (source) => Function("return (" + source + ")")();
      restore(payload.mount)(element, {
        resolve: restore(payload.resolve),
        owner: restore(payload.owner),
        project: restore(payload.project),
        blockReason: restore(payload.blockReason),
        context: payload.context,
        key: payload.key,
      });
    },
    {
      mount: mountChaseCaptureGuard.toString(),
      resolve: committedFiber.toString(),
      owner: fiberOwner.toString(),
      project: projectChasePreviewState.toString(),
      blockReason: chasePreviewBlockReason.toString(),
      context,
      key: chaseGuardKey,
    },
  );
}
export function removeChasePreviewGuard(action) {
  return action.evaluate((element, key) => {
    const guard = element[key];
    if (!guard) throw Error("Chase capture guard disappeared");
    const result = { allowed: guard.allowed, blocked: guard.blocked };
    guard.dispose();
    return result;
  }, chaseGuardKey);
}
export async function clickGuardedChasePreview(action, context) {
  // A Locator may resolve a new, unguarded row after a render. Pin the exact
  // element for installation, click and cleanup; detachment must fail closed.
  const element = await action.elementHandle();
  if (!element) throw Error("Chase preview element disappeared");
  let installed = false;
  try {
    await installChasePreviewGuard(element, context);
    installed = true;
    await element.click();
    const result = await removeChasePreviewGuard(element);
    installed = false;
    return result;
  } finally {
    try {
      if (installed) await removeChasePreviewGuard(element);
    } finally {
      await element.dispose();
    }
  }
}
