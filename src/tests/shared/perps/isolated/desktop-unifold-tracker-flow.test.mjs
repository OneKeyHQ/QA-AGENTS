import test from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import {
  unifoldTrackerFixture as mount,
  execution,
  recipient,
} from "./unifold-tracker-fixture.mjs";
const plain = (v) => JSON.parse(JSON.stringify(v));
const rows = (f) =>
  f
    .nodes("XStack")
    .filter((n) => n.props.testID?.startsWith("perps-unifold-tracker-row-"));
for (const [status, terminal, title, icon] of [
  ["pending", false, "存款处理中", "ClockTimeHistoryOutline"],
  ["delayed", false, "存款处理中", "ClockTimeHistoryOutline"],
  ["succeeded", true, "存款已完成", "CheckLargeOutline"],
  ["failed", true, "存款需要处理", "ErrorOutline"],
  ["refunded", true, "存款需要处理", "ErrorOutline"],
])
  test(`D14-73/76 actual tracker row ${status} uses destination token and status corner`, async () => {
    const f = await mount({
      view: "row",
      execution: execution({ status, terminal }),
    });
    try {
      assert.deepEqual(f.texts(), [title, "2027/01/15 15:00:00", "$3.40"]);
      const token = f.nodes("Token")[0];
      assert.equal(token.props.tokenImageUri, "https://icons.example/perp.png");
      assert.ok(token.props.cornerBadge);
      assert.equal(f.nodes("Token").length, 1);
      assert.ok(f.nodes("Icon").some((n) => n.props.name === icon));
      assert.equal(
        f.nodes("Stack")[0].props.bg,
        !terminal
          ? "$bgInfoStrong"
          : status === "succeeded"
            ? "$bgSuccessStrong"
            : "$bgCautionStrong",
      );
      await f.action(() => rows(f)[0].props.onPress());
      assert.deepEqual(f.events.selections, ["row"]);
    } finally {
      await f.close();
    }
  });
test("D14-74/101 actual completed detail full amounts/networks/icons and copies execution id, not session", async () => {
  const e = execution(),
    assets = [
      {
        symbol: "USDC",
        icon_url: "https://icons.example/usdc.png",
        chains: [
          {
            chain_id: "42161",
            chain_type: "ethereum",
            icon_url: "https://icons.example/arb.png",
          },
        ],
      },
    ],
    f = await mount({ view: "detail", execution: e, assets });
  try {
    assert.deepEqual(f.texts(), [
      "已完成",
      "2027/01/15 15:00:00",
      "发送数量",
      "3.50 USDC",
      "收到数量",
      "3.40 USDC (Perp)",
      "美元价值",
      "$3.40",
      "来源网络",
      "Arbitrum",
      "目标网络",
      "HyperCore",
      "参考编号",
      "exec-123...5678",
      "存款交易",
      "0xsource...5678",
      "完成交易",
      "0xdestin...5678",
    ]);
    assert.deepEqual(
      f.nodes("Token").map((n) => n.props.tokenImageUri),
      [
        "https://icons.example/perp.png",
        "https://icons.example/usdc.png",
        "https://icons.example/perp.png",
        "https://icons.example/arb.png",
        "https://icons.example/hyper.png",
      ],
    );
    assert.equal(f.nodes("Alert").length, 0);
    const copy = f.nodes("XStack").filter((n) => n.props.role === "button");
    assert.equal(copy.length, 1);
    await f.action(() => copy[0].props.onPress());
    assert.deepEqual(f.events.copies, [e.executionId]);
    for (const n of f
      .nodes("XStack")
      .filter((n) => n.props.onPress && n.props.role !== "button"))
      await f.action(() => n.props.onPress());
    assert.deepEqual(f.events.urls, [
      "https://arbiscan.io/tx/source",
      "https://hypurrscan.io/tx/destination",
    ]);
  } finally {
    await f.close();
  }
});
for (const status of ["pending", "delayed", "failed", "refunded"])
  test(`D14-75/76 actual detail ${status} neutral/critical status and unknown receive is --`, async () => {
    const terminal = ["failed", "refunded"].includes(status),
      f = await mount({
        view: "detail",
        execution: execution({
          status,
          terminal,
          destinationAmountBaseUnit: null,
          destinationAmountUsd: null,
        }),
        eta: 60,
      });
    try {
      const text = f.texts();
      assert.equal(text[0], terminal ? "需要处理" : "处理中");
      assert.equal(text[text.indexOf("收到数量") + 1], "--");
      assert.ok(!text.includes("0 USDC (Perp)"));
      assert.ok(!text.includes("完成交易"));
      const a = f.nodes("Alert")[0];
      assert.equal(a.props.type, terminal ? "critical" : "info");
      assert.equal(
        a.props.descriptionComponent.props.children,
        status === "delayed"
          ? "处理时间比平时更长"
          : terminal
            ? "存款需要处理"
            : "存款处理中",
      );
      assert.equal(a.props.action.primary, "帮助");
      await f.action(() => a.props.action.onPrimaryPress());
      assert.deepEqual(f.events.urls, ["https://unifold.io/support"]);
      assert.equal(
        text.includes("预计到账时间"),
        !terminal && status !== "delayed",
      );
    } finally {
      await f.close();
    }
  });
for (const bad of [
  "javascript:alert(1)",
  "http://example.com",
  "file:///tmp/a",
  "",
])
  test(`D14-74 actual detail refuses unsafe explorer ${bad}`, async () => {
    const f = await mount({
      view: "detail",
      execution: execution({ explorerUrl: bad, destinationExplorerUrl: bad }),
    });
    try {
      assert.ok(!f.texts().includes("存款交易"));
      assert.ok(!f.texts().includes("完成交易"));
      assert.deepEqual(f.events.urls, []);
    } finally {
      await f.close();
    }
  });
for (const amount of [null, "0", "0.000000001", "1.23456789"])
  test(`D14-80 actual full detail missing and tiny USD amount ${amount}`, async () => {
    const expected =
        amount === null
          ? "--"
          : amount === "0"
            ? "$0.00"
            : amount === "0.000000001"
              ? "<$0.01"
              : "$1.23",
      f = await mount({
        view: "detail",
        execution: execution({
          sourceAmountUsd: amount,
          destinationAmountUsd: amount,
        }),
      });
    try {
      const t = f.texts();
      assert.equal(t[t.indexOf("美元价值") + 1], expected);
    } finally {
      await f.close();
    }
  });
for (const [count, text] of [
  [0, null],
  [1, "1"],
  [99, "99"],
  [100, "99+"],
  [1000, "99+"],
])
  test(`D14-63/77 actual history-only progress card badge ${count}`, async () => {
    const f = await mount({ view: "badge", count });
    try {
      assert.equal(f.texts()[0], "跟踪你的存款进度");
      assert.deepEqual(f.texts().slice(1), text ? [text] : []);
      assert.equal(
        f
          .nodes("XStack")
          .filter((n) =>
            n.props.testID?.startsWith("perps-unifold-status-card-"),
          ).length,
        0,
      );
      await f.action(() => f.nodes("XStack")[0].props.onPress());
      assert.equal(f.events.deposits, 1);
    } finally {
      await f.close();
    }
  });
test("D14-73/78 actual tracker skeleton->empty preserves intro/deposit, no persistent spinner or error", async () => {
  let release;
  const pending = new Promise((r) => {
    release = r;
  });
  const f = await mount({ pending });
  try {
    assert.equal(f.nodes("Skeleton").length, 4);
    assert.equal(f.nodes("Button")[0].props.children, "存款");
    assert.equal(f.nodes("DialogHeader")[0].props.title, "链上存款");
    release();
    await f.tick(1);
    assert.equal(f.nodes("Skeleton").length, 0);
    assert.ok(f.texts().includes("暂无存款"));
    assert.ok(f.texts().includes("加密货币转入记录"));
    assert.ok(f.texts().includes("跟踪处理中、已完成或需要处理的存款。"));
    assert.equal(f.nodes("Empty").length, 0);
    await f.action(() => f.nodes("Button")[0].props.onPress());
    assert.equal(f.events.deposits, 1);
  } finally {
    await f.close();
  }
});
test("D14-74/75/90 actual tracker detail derives fresh poll execution, then closes to current list", async () => {
  const e = execution({
      status: "pending",
      terminal: false,
      destinationAmountBaseUnit: null,
    }),
    f = await mount({ records: [e] });
  try {
    await f.tick(1);
    assert.equal(rows(f).length, 1);
    await f.action(() => rows(f)[0].props.onPress());
    assert.equal(f.texts()[0], "处理中");
    assert.deepEqual(f.events.selections, [e.executionId]);
    await f.update({ records: [execution()] });
    await f.tick(3000);
    assert.equal(f.texts()[0], "已完成");
    assert.ok(f.texts().includes("3.40 USDC (Perp)"));
    const header = f.nodes("DialogHeader")[0];
    const back = header.findAllByType("XStack").find((n) => n.props.onPress);
    assert.ok(back);
    await f.action(() => back.props.onPress());
    assert.equal(f.events.selections.at(-1), null);
    assert.equal(rows(f).length, 1);
    assert.ok(f.texts().includes("存款已完成"));
    assert.ok(f.events.loads.length >= 2);
  } finally {
    await f.close();
  }
});
for (const account of ["0x" + "b".repeat(40), undefined])
  test(`D14-48/79 actual opened tracker account changes ${account ? "B" : "logout"}: old history hidden and polling stops`, async () => {
    const f = await mount({ records: [execution()] });
    try {
      await f.tick(1);
      assert.equal(rows(f).length, 1);
      const count = f.events.loads.length;
      await f.update({ account });
      assert.equal(rows(f).length, 0);
      assert.equal(f.nodes("Empty").length, 1);
      await f.tick(9000);
      assert.equal(f.events.loads.length, count);
      assert.ok(!f.texts().includes("$3.40"));
    } finally {
      await f.close();
    }
  });
test("D14-48 actual tracker mismatched incoming recipient never fetches another account history", async () => {
  const f = await mount({ recipient: "0x" + "b".repeat(40) });
  try {
    await f.tick(9000);
    assert.deepEqual(f.events.loads, []);
    assert.equal(rows(f).length, 0);
    assert.equal(f.nodes("Empty").length, 1);
  } finally {
    await f.close();
  }
});
test("D14-90 actual tracker unmount removes poll timers and no later request", async () => {
  const f = await mount({ records: [execution()] });
  await f.tick(1);
  const count = f.events.loads.length;
  await f.close();
  await f.tick(9000);
  assert.equal(f.events.loads.length, count);
  assert.equal(f.clock.countTimers(), 0);
});
test("D14-92 actual same tracker changes locale, row status, intro, detail and help without missing keys", async () => {
  const f = await mount({ records: [execution()] });
  try {
    await f.tick(1);
    await f.update({ locale: "en_US" });
    assert.deepEqual(f.texts(), [
      "Transfer Crypto activity",
      "Track deposits that are processing, completed, or need attention.",
      "Deposit completed",
      "01/15/2027 15:00:00",
      "$3.40",
    ]);
    assert.equal(f.nodes("Button")[0].props.children, "Deposit");
    await f.action(() => rows(f)[0].props.onPress());
    assert.ok(f.texts().includes("Amount Sent"));
    assert.ok(f.texts().includes("Amount Received"));
    assert.ok(f.texts().includes("Reference"));
    assert.ok(!f.texts().some((t) => /perp_|global_/.test(t)));
  } finally {
    await f.close();
  }
});

let errorProbe;
function pollFailureProbe() {
  if (!errorProbe) {
    const output = execFileSync(
      process.execPath,
      [
        fileURLToPath(
          new URL("./unifold-poll-error-probe.mjs", import.meta.url),
        ),
      ],
      { encoding: "utf8", timeout: 20000, stdio: ["ignore", "pipe", "pipe"] },
    );
    errorProbe = JSON.parse(output.trim().split("\n").at(-1));
  }
  return errorProbe;
}
test("D14-90 actual tracker first failure exits skeleton, 3s poll recovers and later failure retains rows", () => {
  const p = pollFailureProbe();
  assert.deepEqual(p.initial, {
    texts: [],
    skeletons: 0,
    empty: [
      { title: "网络错误", description: "请检查网络连接，系统将自动重试。" },
    ],
    rows: 0,
    loads: 1,
  });
  assert.equal(p.recovered.rows, 1);
  assert.equal(p.recovered.loads, 2);
  assert.deepEqual(p.recovered.empty, []);
  assert.equal(p.recovered.skeletons, 0);
  assert.ok(p.recovered.texts.includes("存款已完成"));
  assert.equal(p.later.rows, 1);
  assert.equal(p.later.loads, 3);
  assert.deepEqual(p.later.empty, []);
  assert.equal(p.later.skeletons, 0);
  assert.deepEqual(p.later.texts, p.recovered.texts);
});
test(
  "D14-90 tracker automatic polling must not emit an unhandled rejection on network failure",
  {
    todo: "Pinned source candidate: tracker rethrows request error and usePromiseResult automatic run does not catch; no TF/global error-handler verification",
  },
  () => {
    assert.deepEqual(
      pollFailureProbe().errors,
      [],
      "Automatic background polling error escapes through unhandledRejection",
    );
  },
);
