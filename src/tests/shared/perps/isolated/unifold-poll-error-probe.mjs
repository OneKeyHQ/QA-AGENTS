// Standalone child probe: collect actual fire-and-forget rejections without
// contaminating node:test process. No application global error handler is loaded.
import {
  unifoldTrackerFixture as mount,
  execution,
} from "./unifold-tracker-fixture.mjs";
const errors = [];
process.on("unhandledRejection", (e) => errors.push(e.message));
const f = await mount({ error: new Error("local timeout") });
const snap = () => ({
  texts: f.texts(),
  skeletons: f.nodes("Skeleton").length,
  empty: f
    .nodes("Empty")
    .map((n) => ({ title: n.props.title, description: n.props.description })),
  rows: f
    .nodes("XStack")
    .filter((n) => n.props.testID?.startsWith("perps-unifold-tracker-row-"))
    .length,
  loads: f.events.loads.length,
});
await f.tick(1);
await new Promise((r) => setImmediate(r));
const initial = snap();
await f.update({ error: undefined, records: [execution()] });
await f.tick(3000);
await new Promise((r) => setImmediate(r));
const recovered = snap();
await f.update({ error: new Error("later timeout") });
await f.tick(3000);
await new Promise((r) => setImmediate(r));
const later = snap();
await f.close();
console.log(JSON.stringify({ initial, recovered, later, errors }));
