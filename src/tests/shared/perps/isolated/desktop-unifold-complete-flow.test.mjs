// Complete actual dialog navigation + session/transfer/tracker/detail. UI
// primitives, read-only RPC replies, cache, clipboard and URL are local hosts.
import test from "node:test";
import assert from "node:assert/strict";
import {
  unifoldSessionFixture,
  depositAddress,
  sessionRecipient,
  sourceCatalog,
} from "./unifold-session-fixture.mjs";
import { unifoldTransferFixture } from "./unifold-transfer-fixture.mjs";
import {
  unifoldTrackerFixture,
  execution,
} from "./unifold-tracker-fixture.mjs";
import { unifoldMenuFixture } from "./unifold-menu-delivery-fixture.mjs";
const host = (root, id) =>
  root.findAll((n) => typeof n.type === "string" && n.props.testID === id)[0];
const texts = (root) =>
  root
    .findAllByType("SizableText")
    .flatMap((n) => n.children.filter((c) => typeof c === "string"));
for (const locale of ["zh_CN", "en_US"])
  test(`D14-92 actual complete menu -> real session transfer -> tracker -> detail -> back -> deposit ${locale}`, async () => {
    const runtime = await unifoldSessionFixture({ deferMount: true });
    const transfer = await unifoldTransferFixture({
      deferMount: true,
      runtime,
      locale,
    });
    const record = execution();
    const tracker = await unifoldTrackerFixture({
      deferMount: true,
      records: [record],
      locale,
    });
    const f = await unifoldMenuFixture({
      fromHook: true,
      locale,
      catalog: sourceCatalog,
      TransferComponent: transfer.Component,
      TrackerComponent: tracker.Component,
    });
    const en = locale === "en_US";
    const localized = () => {
      const displayed = [f.config.title, ...texts(f.root())];
      assert.ok(displayed.every((t) => !/(?:perp|global)[._]|\{\w+\}/.test(t)));
      if (en)
        assert.ok(
          displayed.every((t) => !/[\u3400-\u9fff]/.test(t)),
          displayed.join(" | "),
        );
    };
    try {
      await f.open();
      assert.equal(f.config.title, en ? "Deposit" : "存款");
      localized();
      assert.ok(f.row("connected-wallet"));
      assert.equal(
        f.row("tracker"),
        undefined,
        "Actual deposit hook intentionally hides a separate tracker menu row",
      );
      assert.ok(f.row("transfer-crypto"));
      await f.action(() => f.row("transfer-crypto").props.onPress());
      assert.equal(f.config.title, en ? "Transfer Crypto" : "转入加密货币");
      localized();
      assert.equal(
        f.root().findAllByType("QRCode")[0].props.value,
        depositAddress,
      );
      for (const label of en
        ? [
            "Selected token",
            "Selected chain",
            "Terms",
            "Help",
            "Track your deposit progress",
          ]
        : ["已选代币", "已选网络", "条款", "帮助", "跟踪你的存款进度"])
        assert.ok(texts(f.root()).includes(label), label);
      assert.equal(runtime.events.address.length, 1);
      assert.equal(runtime.events.activation.length, 1);
      await f.action(() =>
        host(f.root(), "perps-unifold-deposit-history-card").props.onPress(),
      );
      await tracker.tick(1);
      assert.equal(f.config.title, en ? "Crypto Deposits" : "链上存款");
      localized();
      const row = host(
        f.root(),
        "perps-unifold-tracker-row-" + record.executionId,
      );
      assert.ok(row);
      await f.action(() => row.props.onPress());
      localized();
      assert.ok(
        host(f.root(), "perps-unifold-execution-detail-" + record.executionId),
      );
      for (const label of en
        ? [
            "Amount Sent",
            "Amount Received",
            "Source Network",
            "Destination Network",
            "Reference",
          ]
        : ["发送数量", "收到数量", "来源网络", "目标网络", "参考编号"])
        assert.ok(texts(f.root()).includes(label), label);
      assert.ok(texts(f.root()).includes("3.50 USDC"));
      assert.ok(texts(f.root()).includes("3.40 USDC (Perp)"));
      const header = f.root().findAllByType("DialogHeader")[0];
      await f.action(() =>
        header
          .findAllByType("XStack")
          .find((n) => n.props.onPress)
          .props.onPress(),
      );
      assert.equal(
        host(f.root(), "perps-unifold-execution-detail-" + record.executionId),
        undefined,
      );
      await f.action(() =>
        host(f.root(), "perps-unifold-tracker-deposit").props.onPress(),
      );
      assert.equal(f.config.title, en ? "Transfer Crypto" : "转入加密货币");
      localized();
      assert.equal(
        f.root().findAllByType("QRCode")[0].props.value,
        depositAddress,
      );
      assert.ok(tracker.events.loads.length >= 1);
      assert.ok(
        runtime.events.address.length >= 2,
        "Re-entering mounts a new actual session",
      );
    } finally {
      await f.close();
    }
    assert.equal(runtime.clock.countTimers(), 0);
  });
for (const type of [
  "disabled",
  "geoBlocked",
  "sanctioned",
  "unavailable",
  "accountMismatch",
])
  test(`D14-91 actual session + full restricted transfer reopens twice with cached old address: ${type}`, async () => {
    const runtime = await unifoldSessionFixture({ deferMount: true });
    const f = await unifoldTransferFixture({ runtime });
    try {
      assert.equal(f.nodes("QRCode")[0].props.value, depositAddress);
      assert.ok(
        runtime.state.cache.size > 0,
        "Warm a real session cache before restriction",
      );
      if (type === "accountMismatch")
        runtime.state.account = "0x" + "e".repeat(40);
      else if (type === "unavailable")
        runtime.state.getActivationStatus = () => {
          throw Error("local activation unavailable");
        };
      else if (type === "sanctioned")
        runtime.state.activation = { isSanctioned: true };
      else
        runtime.state.getSupportedAssets = () => {
          throw {
            code: runtime.types[
              type === "disabled"
                ? "UNIFOLD_ERROR_CODE_FEATURE_DISABLED"
                : "UNIFOLD_ERROR_CODE_GEO_BLOCKED"
            ],
          };
        };
      for (let cycle = 0; cycle < 2; cycle++) {
        await f.remount();
        assert.equal(
          f.nodes("QRCode").length,
          0,
          `${type}: no cached QR while activation is pending`,
        );
        if (type === "unavailable") {
          await f.tick(5000);
          await f.tick(5000);
        }
        assert.equal(f.nodes("QRCode").length, 0);
        assert.equal(f.nodes("HighlightAddress").length, 0);
        assert.equal(f.nodes("Empty").length, 1);
        const empty = f.nodes("Empty")[0];
        assert.ok(empty.props.title && empty.props.description);
        assert.equal(host(f.root, "perps-unifold-token-selector"), undefined);
        if (type === "sanctioned")
          assert.equal(
            empty.props.description,
            "联系支持团队 · 参考编号 session-local-123",
          );
      }
      assert.equal(runtime.events.tracks.length, 0);
    } finally {
      await f.close();
    }
    assert.equal(runtime.clock.countTimers(), 0);
  });
