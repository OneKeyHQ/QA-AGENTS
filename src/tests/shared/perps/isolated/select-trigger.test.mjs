// Diagnostic source regression. Does not replace the Desktop menu UI checks.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSource } from "./source.mjs";

test("D08-16 Trigger composes custom activation with menu open unless child returns false", async () => {
  const { composeEventHandlers } = evaluateSource(
    "packages/components/src/actions/Trigger/index.tsx",
    { names: ["composeEventHandlers"] },
  );
  const calls = [];
  await composeEventHandlers(
    () => {
      calls.push("activate");
    },
    () => calls.push("open"),
  )();
  assert.deepEqual(calls, ["activate", "open"]);
  calls.length = 0;
  await composeEventHandlers(
    () => {
      calls.push("activate");
      return false;
    },
    () => calls.push("open"),
  )();
  assert.deepEqual(calls, ["activate"]);
});
