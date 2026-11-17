// Capture the failing view before finally closes/restores it. Diagnostics must
// never replace the original assertion error or prevent state restoration.
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { RESULTS_DIR } from "../../helpers/index.mjs";
export async function recordBeforeRestore(page, tag, error) {
  const base = resolve(
    RESULTS_DIR,
    "perps-desktop-completion",
    `${tag}-before-restore-${Date.now()}`,
  );
  try {
    const dom = await page.evaluate(() => ({
      text: document.body.innerText,
      overlays: [
        ...document.querySelectorAll(
          '[role="dialog"],[data-testid="TMPopover-ScrollView"],[data-sentry-component="PerpDesktopEmptyState"]',
        ),
      ]
        .filter(
          (e) =>
            e.getBoundingClientRect().width > 0 &&
            e.getBoundingClientRect().height > 0,
        )
        .map((e) => e.outerHTML),
    }));
    writeFileSync(
      `${base}.json`,
      JSON.stringify({ error: String(error?.stack ?? error), ...dom }, null, 2),
    );
    await page.screenshot({ path: `${base}.png`, timeout: 5000 });
  } catch (diagnosticError) {
    console.warn(`Diagnostic capture failed: ${diagnosticError.message}`);
  }
}
