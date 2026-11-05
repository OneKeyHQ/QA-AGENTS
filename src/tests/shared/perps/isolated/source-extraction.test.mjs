// Verify extraction after generic TypeScript arrows. Parsing .ts as TSX swallows
// subsequent declarations (e.g. sleepUntil after timeout<T>); exercise behavior.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSource, appRequire } from "./source.mjs";
function fixture() {
  const clock = appRequire("@sinonjs/fake-timers").createClock(1800000000000);
  const { sleepUntil } = evaluateSource(
    "packages/shared/src/utils/timerUtils.ts",
    {
      names: ["sleepUntil"],
      globals: { Date: clock.Date, setTimeout: clock.setTimeout.bind(clock) },
    },
  );
  return { clock, sleepUntil };
}
test("actual TypeScript sleepUntil after generic arrow resolves on first condition tick and cleans all timers", async () => {
  const { clock, sleepUntil } = fixture();
  let ready = false,
    done = false;
  const promise = sleepUntil({ conditionFn: () => ready, until: 2000 }).then(
    () => (done = true),
  );
  await clock.tickAsync(99);
  assert.equal(done, false);
  ready = true;
  await clock.tickAsync(1);
  await promise;
  assert.equal(done, true);
  assert.equal(clock.countTimers(), 0);
});
test("actual TypeScript sleepUntil timeout is strict greater-than boundary rather than manufactured exact deadline", async () => {
  const { clock, sleepUntil } = fixture();
  let done = false;
  const promise = sleepUntil({ conditionFn: () => false, until: 2000 }).then(
    () => (done = true),
  );
  await clock.tickAsync(2000);
  assert.equal(done, false);
  await clock.tickAsync(100);
  await promise;
  assert.equal(done, true);
  assert.equal(clock.countTimers(), 0);
});
