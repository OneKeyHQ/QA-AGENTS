import test from "node:test";
import assert from "node:assert/strict";
import { shareDialogFixture } from "./share-dialog-fixture.mjs";
const base = {
  token: "BTC",
  tokenDisplayName: "BTC",
  side: "long",
  mode: "perp",
  leverage: 5,
  pnl: "10",
  pnlPercent: "50",
  entryPrice: "100",
  markPrice: "110",
};
const user = { isLoggedIn: true, isLoggedInOnServer: true, onekeyUserId: "A" };
test("D21-20/22 actual Desktop dialog defaults exclusive ROE; modes update shared generator and preview props", async () => {
  const f = await shareDialogFixture();
  try {
    assert.equal(f.generator().config.pnlDisplayMode, "roe");
    assert.deepEqual(
      f.badges().map((n) => n.props.borderColor),
      ["$borderSubdued", "$borderActive"],
    );
    for (const mode of ["pnl", "roe", "pnl"]) {
      await f.toggle(mode);
      assert.equal(f.generator().config.pnlDisplayMode, mode);
      assert.deepEqual(
        f.badges().map((n) => n.props.borderColor),
        mode === "pnl"
          ? ["$borderActive", "$borderSubdued"]
          : ["$borderSubdued", "$borderActive"],
      );
      await f.tick(50);
      assert.equal(f.events.generations.at(-1).config.pnlDisplayMode, mode);
      assert.equal(f.events.generations.at(-1).data, f.state.data);
    }
    assert.equal(f.preview().length, 1);
  } finally {
    await f.close();
  }
});
for (const canSystemShare of [false, true])
  test(`D21-36 actual Desktop capability=${canSystemShare} menu matches real control branches`, async () => {
    const f = await shareDialogFixture({ canSystemShare });
    try {
      assert.deepEqual(
        f.buttons().map((n) => n.props.icon),
        canSystemShare
          ? ["DownloadOutline", "ShareOutline", "LinkOutline", "Xbrand"]
          : ["DownloadOutline", "LinkOutline", "Xbrand"],
      );
      for (const icon of [
        "DownloadOutline",
        ...(canSystemShare ? ["ShareOutline"] : []),
        "LinkOutline",
        "Xbrand",
      ]) {
        const a = await f.start(icon);
        assert.notEqual(a, false);
        await f.finish(a);
      }
      assert.equal(f.events.downloads.length, 1);
      assert.equal(f.events.shares.length, Number(canSystemShare));
      assert.deepEqual(f.events.copies, ["https://app.onekey.so/perps"]);
      assert.equal(f.events.windows.length, 1);
    } finally {
      await f.close();
    }
  });
for (const icon of ["DownloadOutline", "ShareOutline", "Xbrand"])
  test(`D21-38/39 actual ${icon} pending disables all controls and mode; completion releases and next export reads new mode`, async () => {
    const f = await shareDialogFixture();
    try {
      await f.tick(50);
      const pending = f.delayGenerator(),
        a = await f.start(icon);
      assert.ok(f.buttons().every((n) => n.props.disabled === true));
      assert.ok(f.badges().every((n) => n.props.disabled === true));
      assert.equal(await f.start(icon), false);
      assert.equal(await f.toggle("pnl"), false);
      assert.equal(f.events.generations.at(-1).config.pnlDisplayMode, "roe");
      pending.resolve();
      await f.releaseGenerator();
      await f.finish(a);
      assert.ok(f.buttons().every((n) => n.props.disabled === false));
      assert.equal(await f.toggle("pnl"), true);
      const b = await f.start(icon);
      await f.finish(b);
      assert.equal(f.events.generations.at(-1).config.pnlDisplayMode, "pnl");
      assert.equal(f.events.generations.at(-1).data, f.state.data);
      const outputs =
        icon === "DownloadOutline"
          ? f.events.downloads
          : icon === "ShareOutline"
            ? f.events.shares
            : f.events.windows;
      assert.equal(outputs.length, 2);
    } finally {
      await f.close();
    }
  });
for (const icon of ["DownloadOutline", "ShareOutline", "Xbrand"])
  for (const failure of [
    "generationEmpty",
    "generatorAvailable",
    "generationError",
  ])
    test(`D21-38 actual ${icon} ${failure} has no external output, releases loading and retry uses current data`, async () => {
      const f = await shareDialogFixture();
      try {
        await f.tick(50);
        await f.update({
          [failure]: failure === "generatorAvailable" ? false : true,
        });
        const a = await f.start(icon);
        if (failure === "generationError")
          await assert.rejects(() => f.finish(a), /local generator failure/);
        else await f.finish(a);
        assert.equal(
          f.events.downloads.length +
            f.events.shares.length +
            f.events.windows.length,
          0,
        );
        assert.ok(f.buttons().every((n) => n.props.disabled === false));
        if (failure !== "generationError")
          assert.equal(f.events.errors.length, 1);
        await f.update({
          [failure]: failure === "generatorAvailable" ? true : false,
        });
        await f.toggle("pnl");
        const b = await f.start(icon);
        await f.finish(b);
        assert.equal(f.events.generations.at(-1).config.pnlDisplayMode, "pnl");
        assert.equal(
          f.events.downloads.length +
            f.events.shares.length +
            f.events.windows.length,
          1,
        );
      } finally {
        await f.close();
      }
    });
for (const icon of ["LinkOutline", "DownloadOutline", "Xbrand"])
  test(`D21-49 actual ${icon} resolves current referral before bounded wait and never exports/copies initial fallback`, async () => {
    let resolve;
    const pending = new Promise((r) => (resolve = r)),
      f = await shareDialogFixture({ user, primary: () => pending });
    try {
      await f.tick(50);
      const a = await f.start(icon);
      resolve("LATE_CODE");
      await f.update({});
      await f.tick(100);
      await f.finish(a);
      const url = "https://app.onekey.so/r/LATE_CODE/app/perps";
      assert.equal(f.generator().referralQrCodeUrl, url);
      if (icon === "LinkOutline") assert.deepEqual(f.events.copies, [url]);
      else {
        assert.equal(f.events.generations.at(-1).referralQrCodeUrl, url);
        assert.equal(
          f.events.generations.at(-1).referralDisplayText,
          "LATE_CODE",
        );
        if (icon === "Xbrand")
          assert.equal(
            new URL(f.events.windows.at(-1).url).searchParams
              .get("text")
              .split("\n\n")[1],
            url,
          );
      }
    } finally {
      await f.close();
    }
  });
test("D21-49 actual unresolved referral releases after source sleepUntil >2000ms and copies fallback, not infinite loading", async () => {
  const f = await shareDialogFixture({
    user,
    primary: () => new Promise(() => {}),
  });
  try {
    const a = await f.start("LinkOutline");
    await f.tick(2000);
    assert.deepEqual(f.events.copies, []);
    await f.tick(100);
    await f.finish(a);
    assert.deepEqual(f.events.copies, ["https://app.onekey.so/perps"]);
  } finally {
    await f.close();
  }
});
for (const message of ["User cancel", "local share failed"])
  test(`D21-37/38 actual system share ${message} returns controls; cancellation no false failure`, async () => {
    const f = await shareDialogFixture({ shareError: message });
    try {
      const a = await f.start("ShareOutline");
      await f.finish(a);
      assert.equal(f.events.errors.length, message === "User cancel" ? 0 : 1);
      assert.equal(f.events.success.length, 0);
      assert.ok(f.buttons().every((n) => !n.props.disabled));
      await f.update({ shareError: null });
      const b = await f.start("ShareOutline");
      await f.finish(b);
      assert.equal(f.events.shares.length, 1);
    } finally {
      await f.close();
    }
  });
test("D21-38 actual download failure emits no success and next mode retry downloads once", async () => {
  const f = await shareDialogFixture({ downloadError: true });
  try {
    const a = await f.start("DownloadOutline");
    await f.finish(a);
    assert.equal(f.events.errors.length, 1);
    assert.equal(f.events.success.length, 0);
    assert.equal(f.events.downloads.length, 0);
    assert.ok(f.buttons().every((n) => !n.props.disabled));
    await f.update({ downloadError: false });
    await f.toggle("pnl");
    const b = await f.start("DownloadOutline");
    await f.finish(b);
    assert.equal(f.events.downloads.length, 1);
    assert.equal(f.events.generations.at(-1).config.pnlDisplayMode, "pnl");
  } finally {
    await f.close();
  }
});
for (const [mode, side, word] of [
  ["perp", "long", "LONG"],
  ["perp", "short", "SHORT"],
  ["spot", "long", "BUY"],
  ["spot", "short", "SELL"],
])
  test(`D21-58/60 actual dialog X ${mode}/${side} preserves special name/link and only opens draft`, async () => {
    const f = await shareDialogFixture({
      data: {
        ...base,
        mode,
        side,
        tokenDisplayName: "BTC & SPACE / USD? #中文",
      },
    });
    try {
      const a = await f.start("Xbrand");
      await f.finish(a);
      assert.equal(f.events.windows.length, 1);
      const out = f.events.windows[0],
        url = new URL(out.url);
      assert.equal(url.origin, "https://x.com");
      assert.equal(url.pathname, "/intent/tweet");
      assert.equal(out.target, "_blank");
      assert.ok(url.searchParams.get("text").includes(word));
      assert.ok(
        url.searchParams.get("text").includes("BTC & SPACE / USD? #中文"),
      );
      assert.ok(
        url.searchParams
          .get("text")
          .endsWith("\n\nhttps://app.onekey.so/perps"),
      );
      assert.equal(
        f.events.downloads.length +
          f.events.shares.length +
          f.events.success.length,
        0,
      );
    } finally {
      await f.close();
    }
  });
for (const [primary, fallback, code] of [
  ["MAIN", "SECONDARY", "MAIN"],
  [undefined, "LOCAL", "LOCAL"],
  [undefined, undefined, undefined],
])
  test(`D21-46/47/48 actual logged-in dialog primary=${primary} fallback=${fallback} synchronizes canvas props/copy/X link`, async () => {
    const f = await shareDialogFixture({ user, primary, fallback });
    try {
      const url = code
        ? `https://app.onekey.so/r/${code}/app/perps`
        : "https://app.onekey.so/perps";
      assert.equal(f.generator().referralQrCodeUrl, url);
      assert.equal(f.generator().referralDisplayText, code ?? url);
      for (const icon of ["LinkOutline", "Xbrand"]) {
        const action = await f.start(icon);
        await f.finish(action);
      }
      assert.deepEqual(f.events.copies, [url]);
      assert.equal(
        new URL(f.events.windows.at(-1).url).searchParams
          .get("text")
          .split("\n\n")[1],
        url,
      );
      assert.equal(f.events.generations.at(-1).referralQrCodeUrl, url);
      assert.ok(!url.includes("undefined"));
    } finally {
      await f.close();
    }
  });
test("D21-50 actual mounted dialog logout/A to B to isolated endpoint removes A and synchronizes default/current link across controls and generator", async () => {
  const f = await shareDialogFixture({ user, primary: "CODE_A" });
  try {
    assert.equal(f.generator().referralDisplayText, "CODE_A");
    await f.update({ user: { isLoggedIn: false, isLoggedInOnServer: false } });
    assert.equal(
      f.generator().referralQrCodeUrl,
      "https://app.onekey.so/perps",
    );
    await f.update({ user: { ...user, onekeyUserId: "B" }, primary: "CODE_B" });
    assert.equal(
      f.generator().referralQrCodeUrl,
      "https://app.onekey.so/r/CODE_B/app/perps",
    );
    await f.update({
      dev: { enabled: true, settings: { enableTestEndpoint: true } },
      primary: "CODE_B_DEV",
    });
    assert.equal(
      f.generator().referralQrCodeUrl,
      "https://app.onekeytest.com/r/CODE_B_DEV/app/perps",
    );
    const a = await f.start("LinkOutline");
    await f.finish(a);
    assert.deepEqual(f.events.copies, [
      "https://app.onekeytest.com/r/CODE_B_DEV/app/perps",
    ]);
    assert.ok(!f.generator().referralDisplayText.includes("CODE_A"));
  } finally {
    await f.close();
  }
});
test("D21-26 actual first preview timeout renders retry; late current result recovers with current mode still operable", async () => {
  const f = await shareDialogFixture();
  try {
    const wait = f.delayGenerator();
    await f.tick(50);
    assert.equal(f.preview().length, 0);
    await f.tick(4950);
    const retry = f.tree.root.findAllByType("Button");
    assert.equal(retry.length, 1);
    wait.resolve();
    await f.releaseGenerator();
    assert.equal(f.preview().length, 1);
    assert.equal(f.tree.root.findAllByType("Button").length, 0);
    await f.toggle("pnl");
    await f.tick(50);
    assert.equal(f.events.generations.at(-1).config.pnlDisplayMode, "pnl");
    assert.equal(f.tree.root.findAllByType("Spinner").length, 0);
  } finally {
    await f.close();
  }
});

test("D21-25/26 actual preview generation nonce refuses old ROE image after new PnL result", async () => {
  const f = await shareDialogFixture();
  try {
    const old = f.delayGenerator();
    await f.tick(50);
    const latest = f.delayGenerator();
    await f.toggle("pnl");
    await f.tick(50);
    assert.equal(f.events.generations.length, 2);
    assert.deepEqual(
      f.events.generations.map((g) => g.config.pnlDisplayMode),
      ["roe", "pnl"],
    );
    latest.resolve("data:image/png;base64,NEW_LOCAL_PNL");
    await f.releaseGenerator();
    assert.deepEqual(f.preview(), ["data:image/png;base64,NEW_LOCAL_PNL"]);
    old.resolve("data:image/png;base64,OLD_LOCAL_ROE");
    await f.tick(0);
    assert.deepEqual(f.preview(), ["data:image/png;base64,NEW_LOCAL_PNL"]);
  } finally {
    await f.close();
  }
});
