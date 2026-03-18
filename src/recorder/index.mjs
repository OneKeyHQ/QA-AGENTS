// Recorder — Exploration tool for mapping new UI flows
// NOT for production regression. Captures DOM snapshots via CDP.

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUTPUT_DIR = resolve(import.meta.dirname, '../../shared/recordings');

async function captureSnapshot() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error('No page found');

  const snapshot = await page.evaluate(() => {
    const result = { testids: [], texts: [], inputs: [], buttons: [] };

    document.querySelectorAll('[data-testid]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        result.testids.push({
          testid: el.getAttribute('data-testid'),
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 80),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
    });

    document.querySelectorAll('span').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && el.textContent?.trim()) {
        result.texts.push({
          text: el.textContent.trim().substring(0, 60),
          rect: { x: Math.round(r.x), y: Math.round(r.y) },
        });
      }
    });

    document.querySelectorAll('input, textarea').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        result.inputs.push({
          type: el.type || 'text',
          placeholder: el.placeholder,
          testid: el.getAttribute('data-testid'),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) },
        });
      }
    });

    document.querySelectorAll('button, [role="button"]').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.width > 0) {
        result.buttons.push({
          text: el.textContent?.trim().substring(0, 40),
          testid: el.getAttribute('data-testid'),
          rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        });
      }
    });

    return result;
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ssPath = resolve(OUTPUT_DIR, `${timestamp}.png`);
  await page.screenshot({ path: ssPath });
  snapshot.screenshot = ssPath;
  snapshot.timestamp = new Date().toISOString();
  snapshot.url = page.url();
  snapshot.title = await page.title();

  const outPath = resolve(OUTPUT_DIR, `${timestamp}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Snapshot saved: ${outPath}`);
  console.log(`Screenshot: ${ssPath}`);
  console.log(`Found: ${snapshot.testids.length} data-testid, ${snapshot.texts.length} text spans, ${snapshot.inputs.length} inputs, ${snapshot.buttons.length} buttons`);

  await browser.close();
}

captureSnapshot().catch(e => { console.error('Fatal:', e); process.exit(1); });
