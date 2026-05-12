import { chromium } from 'playwright-core';

const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = browser.contexts()[0];
let page = null;
for (const p of ctx.pages()) {
  if (p.url().includes('onekeytest.com')) { page = p; break; }
}
if (!page) { console.error('no page'); process.exit(1); }
console.log('URL:', page.url());

// Sample data-testid values present on the page right now
const ids = await page.evaluate(() => {
  const all = document.querySelectorAll('[data-testid]');
  const counts = {};
  for (const el of all) {
    const id = el.getAttribute('data-testid');
    counts[id] = (counts[id] || 0) + 1;
  }
  return { total: all.length, unique: Object.keys(counts).length, samples: Object.entries(counts).slice(0, 50) };
});
console.log('Total elements with data-testid:', ids.total);
console.log('Unique testID values:', ids.unique);
console.log('First 50:');
for (const [id, n] of ids.samples) console.log(`  ×${n}\t${id}`);

// Check for PR 10966 new IDs
console.log('\nPR 10966 indicators (perp-*, swap-*, send-*):');
const prHits = await page.evaluate(() => {
  const prefixes = ['perp-', 'swap-', 'send-', 'refer-friends-', 'market-', 'onboarding-'];
  const hits = {};
  for (const el of document.querySelectorAll('[data-testid]')) {
    const id = el.getAttribute('data-testid');
    for (const p of prefixes) {
      if (id.startsWith(p)) { hits[id] = (hits[id] || 0) + 1; break; }
    }
  }
  return hits;
});
const keys = Object.keys(prHits);
console.log(`Found ${keys.length} matching prefixed IDs:`);
for (const k of keys.slice(0, 30)) console.log(`  ×${prHits[k]}\t${k}`);
