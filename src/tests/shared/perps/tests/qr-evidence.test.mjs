import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { decodeRenderedQr } from "../qr-evidence.mjs";
test("a blank picture cannot satisfy rendered QR address evidence", async () => {
  const png = await sharp({
    create: { width: 200, height: 200, channels: 4, background: "white" },
  })
    .png()
    .toBuffer();
  await assert.rejects(() => decodeRenderedQr(png), /could not be decoded/);
});
test("dotted modules and circular finders decode from original pixels without reconstruction", async () => {
  const png = readFileSync(
    new URL("./fixtures/qr-dotted.png", import.meta.url),
  );
  assert.equal(
    await decodeRenderedQr(png),
    "Perps QA dotted fixture - no wallet or funds",
  );
});
test("small off-center QR on a full share canvas retains TRY_HARDER scanning", async () => {
  const qr = readFileSync(new URL("./fixtures/qr-share-small.png", import.meta.url));
  const fullCanvas = await sharp({
    create: { width: 900, height: 900, channels: 3, background: "black" },
  }).composite([{ input: qr, left: 750, top: 760 }]).png().toBuffer();
  assert.equal(await decodeRenderedQr(fullCanvas), "https://app.onekeytest.com/perps");
});
