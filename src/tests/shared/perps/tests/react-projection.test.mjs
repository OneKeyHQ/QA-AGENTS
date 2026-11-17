import test from "node:test";
import assert from "node:assert/strict";
import { committedFiber, fiberOwner } from "../react-projection.mjs";
function branches() {
  const state = { current: null };
  const a = { tag: 3, stateNode: state, return: null },
    b = { tag: 3, stateNode: state, return: null };
  a.alternate = b;
  b.alternate = a;
  const old = { return: a, memoizedProps: { coin: "OLD" } },
    current = { return: b, memoizedProps: { coin: "CURRENT" } };
  old.alternate = current;
  current.alternate = old;
  a.child = old;
  b.child = current;
  state.current = b;
  return { a, b, old, current, state };
}
test("stale DOM fiber resolves to the committed alternate rather than old row identity", () => {
  const { old, current } = branches();
  assert.equal(committedFiber(old), current);
  assert.equal(committedFiber(current), current);
});
test("commit swap follows current root in both directions", () => {
  const t = branches();
  t.state.current = t.a;
  assert.equal(committedFiber(t.current), t.old);
});
test("shared child list resolves the mounted branch without using stale props", () => {
  const t = branches();
  t.a.child = t.b.child = t.current;
  t.current.return = t.a;
  t.old.return = t.a;
  assert.equal(committedFiber(t.old), t.current);
});
test("missing, detached and uncommitted roots fail closed", () => {
  assert.throws(() => committedFiber(null), /unavailable/);
  assert.throws(() => committedFiber({ return: null, tag: 5 }), /Uncommitted/);
  const root = { tag: 3, stateNode: { current: {} }, return: null };
  assert.throws(() => committedFiber({ return: root }), /Uncommitted/);
});
test("imperative canvas may use its nearest React container only with explicit opt-in", () => {
  const chartFiber = { chart: true },
    appFiber = { app: true };
  const app = { __reactFiber$app: appFiber, parentElement: null };
  const container = { __reactFiber$chart: chartFiber, parentElement: app };
  const canvas = { parentElement: { parentElement: container } };
  assert.throws(() => fiberOwner(canvas), /unavailable/);
  assert.equal(fiberOwner(canvas, true), chartFiber);
  assert.equal(fiberOwner(container), chartFiber);
  assert.throws(() => fiberOwner({ parentElement: null }, true), /unavailable/);
});
