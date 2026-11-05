#!/usr/bin/env node
// Pure offline inventory/preflight. No app connection or execution is possible.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import {
  executionEntry,
  lanes,
  planExecution,
} from "../src/tests/shared/perps/execution/profiles.mjs";
const root = resolve(import.meta.dirname, "..");
const reportDir = resolve(
  root,
  "shared/reports/perps-desktop-completion-2026-10-29",
);
const escape = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
// A moved line is not a changed expectation. Never accept fuzzy or duplicate matches.
export function resolveCaseLine(lines, row) {
  const matches = (text) => createHash("sha256").update(text ?? "").digest("hex") === row.rowSha256;
  if (matches(lines[row.line - 1])) return row.line;
  const candidates = lines.flatMap((text, index) => matches(text) ? [index + 1] : []);
  if (candidates.length !== 1)
    throw Error(`手动用例已变更，需重新审核分组：${row.rowId}`);
  return candidates[0];
}
export function loadEntries() {
  const ledger = JSON.parse(
    readFileSync(
      resolve(root, "src/tests/shared/perps/data/desktop-execution-cases.json"),
      "utf8",
    ),
  );
  return ledger.rows
    .filter((r) => r.desktopApplicable)
    .map((row) => {
      const lines = readFileSync(resolve(root, row.file), "utf8").split(/\r?\n/);
      return executionEntry({ ...row, line: resolveCaseLine(lines, row) });
    });
}
export function main(args = process.argv.slice(2)) {
  const entries = loadEntries();
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--request")
      throw Error("仅支持 --request <本地JSON>；此命令不执行测试");
    const request = JSON.parse(readFileSync(resolve(args[1]), "utf8"));
    const plan = planExecution(entries, request);
    // Do not persist or print a personal address/account into a shared report.
    console.log(
      JSON.stringify(
        { ...plan, target: { kind: plan.target.kind, supplied: true } },
        null,
        2,
      ),
    );
    return plan;
  }
  const counts = Object.fromEntries(
    Object.keys(lanes).map((lane) => [
      lane,
      entries.filter((r) => r.lane === lane).length,
    ]),
  );
  const payload = {
    platform: "Desktop",
    executionOnly: true,
    changesCoverageDenominator: false,
    counts,
    rows: entries,
  };
  mkdirSync(reportDir, { recursive: true });
  writeFileSync(
    resolve(reportDir, "execution-groups.json"),
    JSON.stringify(payload, null, 2) + "\n",
  );
  const tsv = [
    "用例\t分组\t场景\t账户要求\t脚本候选（需复核整段）",
    ...entries.map((r) =>
      [
        r.rowId,
        lanes[r.lane].title,
        r.scenario,
        r.targetRequirement,
        r.automationIds.join(","),
      ]
        .map((v) => v.replace(/\t|\r|\n/g, " "))
        .join("\t"),
    ),
  ].join("\n");
  writeFileSync(resolve(reportDir, "execution-groups.tsv"), tsv + "\n");
  const body = Object.entries(lanes)
    .map(
      ([lane, meta]) =>
        `<details open><summary>${escape(meta.title)} · ${counts[lane]} 行</summary><table><tr><th>行</th><th>场景</th><th>步骤</th><th>要求</th></tr>${entries
          .filter((r) => r.lane === lane)
          .map(
            (r) =>
              `<tr><td>${escape(r.rowId)}</td><td>${escape(r.scenario)}</td><td>${escape(r.steps).replace(/&lt;br\s*\/?&gt;/gi, "<br>")}</td><td>${r.constraints.map(escape).join("<br>")}</td></tr>`,
          )
          .join("")}</table></details>`,
    )
    .join("");
  writeFileSync(
    resolve(reportDir, "execution-groups.html"),
    `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Perps Desktop 执行分组</title><style>body{font:15px/1.6 system-ui;max-width:1400px;margin:32px auto;padding:0 20px;color:#17212f}summary{font-size:21px;font-weight:600;margin:24px 0;cursor:pointer}table{border-collapse:collapse;width:100%}td,th{padding:12px;border:1px solid #d7dde5;text-align:left;vertical-align:top}th{background:#edf3f8}td:first-child{white-space:nowrap}</style><h1>Perps Desktop 执行分组</h1><p>执行分组独立于覆盖率；所有916行保留。只读/输入组可以提供观察地址或钱包账户；签名、设置写入、真实订单及资金操作分别执行，执行前再提供该批钱包账户。本清单未运行App，未授予任何交易权限。</p><p>只使用已有数据样本，不自动下单补数据。混合编排只列脚本候选，不能凭某一行的分组执行整个脚本。</p>${body}</html>`,
  );
  console.log(
    JSON.stringify({
      counts,
      total: entries.length,
      report: resolve(reportDir, "execution-groups.html"),
      executed: false,
    }),
  );
  return payload;
}
if (
  process.argv[1] &&
  import.meta.url === new URL(`file://${resolve(process.argv[1])}`).href
)
  main();
