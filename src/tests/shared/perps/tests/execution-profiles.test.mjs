import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadEntries, resolveCaseLine } from "../../../../../scripts/plan-perps-desktop.mjs";
import { createHash } from "node:crypto";
import {
  executionLane,
  planExecution,
  validateTarget,
} from "../execution/profiles.mjs";

const entries = loadEntries();
const address = "0x" + "aB".repeat(20);
const wallet = {
  kind: "wallet",
  walletName: "test-wallet-sentinel",
  accountName: "test-account-sentinel",
};
const row = (id) => entries.find((r) => r.rowId === id);
test("Desktop execution inventory retains every original row exactly once, with separate action queues", () => {
  assert.equal(entries.length, 916);
  assert.equal(new Set(entries.map((r) => r.rowId)).size, 916);
  const counts = Object.fromEntries(
    ["observation", "account", "orders", "funds"].map((lane) => [
      lane,
      entries.filter((r) => r.lane === lane).length,
    ]),
  );
  assert.deepEqual(counts, {
    observation: 729,
    account: 42,
    orders: 129,
    funds: 16,
  });
  for (const entry of entries) {
    assert.match(entry.rowSha256, /^[a-f0-9]{64}$/);
    assert.ok(entry.scenario && entry.steps && entry.expected);
    assert.equal(
      entry.targetRequirement,
      entry.lane === "observation" ? "address-or-wallet" : "wallet",
    );
  }
});
test("expected rejection/zero orders cannot turn a final-submit scenario into observation", () => {
  for (const id of [
    "D08-40",
    "D08-41",
    "D08-49",
    "D08-50",
    "D08-121",
    "D10-173",
    "D11-59",
    "D11-102",
    "D11-294",
    "D12-108",
    "D13-51",
    "D13-94",
    "D18-58",
    "D18-59",
    "D18-70",
  ])
    assert.equal(row(id).lane, "orders", id);
  for (const id of ["D13-47", "D13-48", "D13-49", "D13-50", "D15-173"])
    assert.equal(row(id).lane, "observation", id);
  for (const id of ["D11-261", "D13-52", "D19-26"])
    assert.equal(row(id).lane, "account", id);
});
test("unknown category or non-Desktop rows fail closed", () => {
  for (const lane of ["__proto__", "constructor", "all"]) {
    assert.throws(() => validateTarget(wallet, lane), /Unknown execution lane/);
    assert.throws(
      () =>
        planExecution(entries, { lane, rowIds: ["D13-47"], target: wallet }),
      /明确选择/,
    );
  }
  assert.throws(
    () =>
      executionLane({
        desktopApplicable: true,
        rowId: "X",
        task: { category: "new category" },
      }),
    /Unclassified/,
  );
  assert.throws(() => executionLane({ desktopApplicable: false }), /Desktop/);
});
test("observation accepts a complete EVM watch address or both wallet/account names", () => {
  assert.deepEqual(
    validateTarget({ kind: "address", address }, "observation"),
    { kind: "address", address: address.toLowerCase() },
  );
  assert.deepEqual(
    validateTarget(
      { ...wallet, walletName: ` ${wallet.walletName} ` },
      "observation",
    ),
    wallet,
  );
});
test("watch address is rejected for orders, funds and permission/settings flows", () => {
  for (const lane of ["orders", "funds", "account"]) {
    assert.throws(
      () => validateTarget({ kind: "address", address }, lane),
      /需要钱包账户/,
    );
    assert.deepEqual(validateTarget(wallet, lane), wallet);
  }
});
test("missing, malformed, secret and unexpected target configuration fails before scheduling", () => {
  for (const target of [
    null,
    [],
    {},
    { kind: "address", address: "0x123" },
    { kind: "address", address: "0x" + "z".repeat(40) },
    { kind: "wallet", walletName: "x", accountName: " " },
    { ...wallet, password: "sentinel" },
    { ...wallet, nested: { seed: "sentinel" } },
    { kind: "address", address, accountName: "x" },
  ])
    assert.throws(() => validateTarget(target, "observation"));
});
test("explicit observation selection produces only a plan, never permission to run", () => {
  const p = planExecution(entries, {
    lane: "observation",
    rowIds: ["D13-47"],
    target: { kind: "address", address },
  });
  assert.equal(p.canExecuteNow, false);
  assert.equal(p.state, "awaiting-live-target-verification");
  assert.deepEqual(
    p.rows.map((r) => r.rowId),
    ["D13-47"],
  );
  assert.match(p.candidateWarning, /不能|不等于/);
});
test("missing, duplicate, unknown, mixed lanes and absent per-batch target are rejected", () => {
  for (const request of [
    null,
    {},
    { lane: "all", rowIds: ["D13-47"], target: wallet },
    { lane: "observation", rowIds: [], target: wallet },
    { lane: "observation", rowIds: ["D13-47", "D13-47"], target: wallet },
    { lane: "observation", rowIds: ["unknown"], target: wallet },
    { lane: "observation", rowIds: ["D13-47", "D08-40"], target: wallet },
    { lane: "orders", rowIds: ["D08-40"] },
  ])
    assert.throws(() => planExecution(entries, request));
});
test("transaction plan still requires a new live identity check, not implicit whole-group consent", () => {
  const p = planExecution(entries, {
    lane: "orders",
    rowIds: ["D08-40"],
    target: wallet,
  });
  assert.equal(p.canExecuteNow, false);
  assert.deepEqual(
    p.rows.map((r) => r.rowId),
    ["D08-40"],
  );
  assert.match(p.rows[0].constraints.join(" "), /参数/);
});
test("formal CLI plan path validates before app imports and redacts the supplied identity", () => {
  const dir = mkdtempSync(join(tmpdir(), "perps-plan-test-"));
  try {
    const file = join(dir, "request.json");
    writeFileSync(
      file,
      JSON.stringify({
        lane: "observation",
        rowIds: ["D13-47"],
        target: wallet,
      }),
    );
    const output = execFileSync(
      process.execPath,
      ["src/tests/run.mjs", "desktop/perps", "--plan", "--request", file],
      { cwd: resolve(import.meta.dirname, "../../../../.."), encoding: "utf8" },
    );
    const parsed = JSON.parse(output);
    assert.deepEqual(parsed.target, { kind: "wallet", supplied: true });
    assert.equal(parsed.canExecuteNow, false);
    assert.equal(output.includes(wallet.walletName), false);
    assert.equal(output.includes(wallet.accountName), false);
    const rejected = spawnSync(
      process.execPath,
      ["scripts/plan-perps-desktop.mjs", "--execute", file],
      { encoding: "utf8" },
    );
    assert.notEqual(rejected.status, 0);
    assert.match(rejected.stderr, /不执行测试/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// Source line numbers can move without changing the approved expected result.
test("manual anchors relocate only an exact unique row and reject edits or ambiguity", () => {
  const source = "| P1 | approved scenario | input | exact expected |";
  const row = { rowId: "anchor-fixture", line: 2, rowSha256: createHash("sha256").update(source).digest("hex") };
  assert.equal(resolveCaseLine(["heading", source], row), 2);
  assert.equal(resolveCaseLine(["new metadata", "heading", source], row), 3);
  assert.throws(() => resolveCaseLine(["heading", source + " changed"], row), /手动用例已变更/);
  assert.throws(() => resolveCaseLine([source, "heading", source], row), /手动用例已变更/);
});
