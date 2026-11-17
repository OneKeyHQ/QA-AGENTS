// Decode the unmodified visible QR pixels, independently of QR component props.
// ZXing handles the product's rounded finders and dotted modules; jsQR rejects
// this valid style. No thresholding or reconstruction alters the evidence.
import sharp from "sharp";
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  RGBLuminanceSource,
  HybridBinarizer,
  BinaryBitmap,
} from "@zxing/library";
export async function decodeRenderedQr(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luminance = new Uint8ClampedArray(info.width * info.height);
  for (let i = 0; i < luminance.length; i++)
    luminance[i] = (data[i * 3] + 2 * data[i * 3 + 1] + data[i * 3 + 2]) >> 2;
  const reader = new MultiFormatReader();
  reader.setHints(
    new Map([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
      [DecodeHintType.TRY_HARDER, true],
    ]),
  );
  try {
    return reader
      // decode(image) resets the hints passed to setHints; retain TRY_HARDER
      // so a small QR embedded in a full share card is actually scanned.
      .decodeWithState(
        new BinaryBitmap(
          new HybridBinarizer(
            new RGBLuminanceSource(luminance, info.width, info.height),
          ),
        ),
      )
      .getText();
  } catch (cause) {
    throw Error("Visible QR screenshot could not be decoded", { cause });
  } finally {
    reader.reset();
  }
}
