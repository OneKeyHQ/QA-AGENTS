import test from "node:test";
import assert from "node:assert/strict";
import { shareCanvasFixture } from "./share-canvas-fixture.mjs";
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
async function draw(f, event = "onload") {
  const pending = f.start();
  await f.settleImages(event);
  assert.equal(await pending, "local:recorded-canvas-output");
}
for (const [mode, side, priceType, label, entry, mark] of [
  ["perp", "long", "mark", "做多 5X", "开仓价格", "标记价格"],
  ["perp", "short", "exit", "做空 5X", "开仓价格", "平仓价格"],
  ["spot", "long", "mark", "购买", "平均成本价格", "当前价格"],
  ["spot", "short", "exit", "出售", "平均成本价格", "当前价格"],
])
  test(`D21-20/21/23/32 actual Desktop canvas ${mode}/${side}/${priceType} full drawing target and QR encoder`, async () => {
    const f = await shareCanvasFixture({
      data: {
        ...base,
        mode,
        side,
        priceType,
        tokenDisplayName: mode === "spot" ? "BTC/USDC" : "BTC",
      },
    });
    try {
      await draw(f);
      const texts = f.texts().map((c) => c.args[0]);
      for (const expected of [
        f.state.data.tokenDisplayName,
        label,
        entry,
        mark,
        "100",
        "110",
        "+50.00%",
        "https://app.onekey.so/perps",
      ])
        assert.ok(texts.includes(expected), expected);
      assert.equal(f.canvas.width, 900);
      assert.equal(f.canvas.height, 900);
      assert.equal(f.images.length, 2);
      assert.equal(f.images[0].crossOrigin, "anonymous");
      assert.equal(f.calls.filter((c) => c.op === "drawImage").length, 2);
      assert.equal(
        f.calls.filter((c) => c.op === "arc").length > 100,
        true,
        "actual dot QR modules drawn, not a no-op QR host",
      );
      assert.deepEqual(
        f.qrValues.map((q) => [q.value, q.options.errorCorrectionLevel]),
        [["https://app.onekey.so/perps", "M"]],
      );
      assert.equal(f.calls.at(-1).op, "toDataURL");
      assert.deepEqual(f.calls.at(-1).args, ["image/png", 1]);
      assert.ok(!texts.some((s) => ["保存", "收益率", "收益额"].includes(s)));
      if (mode === "spot")
        assert.ok(texts.every((s) => !String(s).includes("5X")));
    } finally {
      await f.close();
    }
  });
for (const [pnl, percent, background, color] of [
  ["10", "50", "profit", "long"],
  ["-10", "-50", "loss", "short"],
  [".00001", ".0001", "profit", "long"],
  ["-.00001", "-.0001", "loss", "short"],
])
  test(`D21-20/22/24 actual canvas ${pnl} background, exact mode text and color remain bound across redraw`, async () => {
    const f = await shareCanvasFixture({
      data: { ...base, pnl, pnlPercent: percent },
    });
    try {
      for (const [mode, expected] of [
        [
          "pnl",
          Number(pnl) > 0
            ? pnl === "10"
              ? "+$10"
              : "+< $0.01"
            : pnl === "-10"
              ? "-$10"
              : "-< $0.01",
        ],
        [
          "roe",
          Number(percent) > 0
            ? percent === "50"
              ? "+50.00%"
              : "+0.00%"
            : percent === "-50"
              ? "-50.00%"
              : "-0.00%",
        ],
      ]) {
        await f.update({ config: { pnlDisplayMode: mode } });
        await draw(f);
        const text = f.texts().findLast((c) => c.args[0] === expected);
        assert.ok(text);
        assert.equal(
          text.color,
          f.constants.getCanvasConfig(900).colors[color],
        );
        assert.ok(
          f.images[0].src.endsWith(
            f.constants.BACKGROUNDS[background][0].split("/").at(-1),
          ),
        );
        assert.equal(
          f.images.length,
          2,
          "actual successful image cache reused across mode redraw",
        );
        assert.ok(f.texts().some((c) => c.args[0] === "100"));
      }
    } finally {
      await f.close();
    }
  });
test("D21-25/50 actual canvas target/DEX and referral update use current namespaces and encode current QR after old draw", async () => {
  const f = await shareCanvasFixture({
    data: { ...base, token: "xyz:BTC", tokenDisplayName: "BTC (xyz)" },
    referralQrCodeUrl: "https://app.onekey.so/r/A/app/perps",
    referralDisplayText: "A",
  });
  try {
    await draw(f);
    assert.ok(f.images[1].src.endsWith("/xyzBTC.png"));
    const oldCount = f.calls.length;
    await f.update({
      data: {
        ...base,
        token: "abc:BTC",
        tokenDisplayName: "BTC (abc)",
        side: "short",
      },
      referralQrCodeUrl: "https://app.onekey.so/r/B/app/perps",
      referralDisplayText: "B",
    });
    await draw(f);
    assert.ok(f.images.at(-1).src.endsWith("/abcBTC.png"));
    const texts = f.calls
      .slice(oldCount)
      .filter((c) => c.op === "fillText")
      .map((c) => c.args[0]);
    assert.ok(texts.includes("BTC (abc)"));
    assert.ok(!texts.includes("BTC (xyz)"));
    assert.ok(texts.includes("B"));
    assert.ok(!texts.includes("A"));
    assert.equal(
      f.qrValues.at(-1).value,
      "https://app.onekey.so/r/B/app/perps",
    );
  } finally {
    await f.close();
  }
});
test("D21-26/40 actual image loader waits both sources, 3000ms bound cancels handlers; fallback is characterized separately from complete image export", async () => {
  const f = await shareCanvasFixture();
  try {
    const result = f.start();
    let done = false;
    result.then(() => (done = true));
    f.images[0].onload();
    await f.tick(2999);
    assert.equal(done, false);
    await f.tick(1);
    assert.equal(await result, "local:recorded-canvas-output");
    assert.equal(f.images[1].onload, null);
    assert.equal(f.images[1].onerror, null);
    assert.equal(f.clock.countTimers(), 0);
    assert.equal(
      f.calls.filter((c) => c.op === "drawImage").length,
      1,
      "token unavailable fallback does not fabricate an icon",
    );
  } finally {
    await f.close();
  }
});
for (const key of ["noCanvas", "noContext", "drawError"])
  test(`D21-38 actual generator ${key} returns empty failure and never calls canvas export`, async () => {
    const f = await shareCanvasFixture({ [key]: true });
    try {
      const pending = f.start();
      await f.settleImages();
      assert.equal(await pending, "");
      assert.equal(f.calls.filter((c) => c.op === "toDataURL").length, 0);
    } finally {
      await f.close();
    }
  });
test(
  "D21-26/40 QR encoder failure must prevent export of a white QR plate",
  {
    todo: "Candidate source gap: Desktop generator catches QR error then exports card with blank QR; no TF or introduction-version evidence",
  },
  async () => {
    const f = await shareCanvasFixture({ qrError: true });
    try {
      const result = f.start();
      await f.settleImages();
      assert.equal(
        await result,
        "",
        "A card with ungenerated QR must not count as complete export",
      );
    } finally {
      await f.close();
    }
  },
);
test(
  "D21-24 very long amount must retain positive font size in actual canvas output",
  {
    todo: "Candidate source boundary: linear font shrink becomes non-positive for long decimal amounts; TF glyph rendering not verified",
  },
  async () => {
    const f = await shareCanvasFixture({
      data: { ...base, pnl: "1000000000000000000.129" },
      config: { pnlDisplayMode: "pnl" },
    });
    try {
      await draw(f);
      const text = f
        .texts()
        .find((c) => c.args[0] === "+$1000000000000000000.12");
      assert.ok(text);
      assert.ok(
        Number(text.font.match(/(-?\d+(?:\.\d+)?)px/u)[1]) > 0,
        "Canvas text font must remain positive",
      );
    } finally {
      await f.close();
    }
  },
);
