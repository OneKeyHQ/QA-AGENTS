// Live Recorder — Continuously captures user interactions via CDP
// Usage: node src/recorder/live-record.mjs
// Press Ctrl+C to stop and save the recording.

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUTPUT_DIR = resolve(import.meta.dirname, '../../shared/recordings');

mkdirSync(OUTPUT_DIR, { recursive: true });

const steps = [];
let stepIndex = 0;

async function run() {
  const browser = await chromium.connectOverCDP(CDP_URL);
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error('No page found via CDP');

  console.log('='.repeat(60));
  console.log('  Live Recorder - Connected to OneKey');
  console.log('  Listening for clicks, inputs, and navigation...');
  console.log('  Press Ctrl+C to stop and save.');
  console.log('='.repeat(60));

  // Take initial screenshot
  const initSS = resolve(OUTPUT_DIR, 'live-init.png');
  await page.screenshot({ path: initSS });
  console.log(`\n  Initial screenshot: ${initSS}`);

  // Inject event listeners into the page
  await page.evaluate(() => {
    window.__onekey_recorder_steps = [];

    // Helper: get best selector for an element
    function getSelector(el) {
      if (!el) return null;
      // data-testid first
      const testid = el.getAttribute('data-testid');
      if (testid) return `[data-testid="${testid}"]`;
      // data-sentry-component
      const sentry = el.getAttribute('data-sentry-component');
      if (sentry) return `[data-sentry-component="${sentry}"]`;
      // role + text
      const role = el.getAttribute('role');
      const text = el.textContent?.trim().substring(0, 30);
      if (role && text) return `[role="${role}"]:has-text("${text}")`;
      // tag + text
      if (text && text.length < 30) return `${el.tagName.toLowerCase()} >> text="${text}"`;
      // fallback: tag + class
      if (el.className && typeof el.className === 'string') {
        return `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`;
      }
      return el.tagName.toLowerCase();
    }

    // Helper: get ancestor chain of testids
    function getTestIdChain(el) {
      const chain = [];
      let cur = el;
      while (cur && cur !== document.body) {
        const tid = cur.getAttribute?.('data-testid');
        if (tid) chain.push(tid);
        cur = cur.parentElement;
      }
      return chain;
    }

    // Click listener
    document.addEventListener('click', (e) => {
      const el = e.target;
      const r = el.getBoundingClientRect();
      window.__onekey_recorder_steps.push({
        type: 'click',
        timestamp: Date.now(),
        selector: getSelector(el),
        testidChain: getTestIdChain(el),
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 80) || '',
        placeholder: el.placeholder || null,
        rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
        pageX: Math.round(e.pageX),
        pageY: Math.round(e.pageY),
      });
    }, true);

    // Input listener
    document.addEventListener('input', (e) => {
      const el = e.target;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        window.__onekey_recorder_steps.push({
          type: 'input',
          timestamp: Date.now(),
          selector: getSelector(el),
          testidChain: getTestIdChain(el),
          tag: el.tagName,
          value: el.value,
          placeholder: el.placeholder || null,
        });
      }
    }, true);

    // Focus listener (for detecting page transitions)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        window.__onekey_recorder_steps.push({
          type: 'navigation',
          timestamp: Date.now(),
          from: lastUrl,
          to: location.href,
        });
        lastUrl = location.href;
      }
    }, 500);
  });

  console.log('  Event listeners injected.\n');

  // Poll for new steps and print them
  const pollInterval = setInterval(async () => {
    try {
      const newSteps = await page.evaluate((fromIndex) => {
        const all = window.__onekey_recorder_steps || [];
        return all.slice(fromIndex);
      }, stepIndex);

      for (const step of newSteps) {
        stepIndex++;
        steps.push(step);
        if (step.type === 'click') {
          console.log(`  [${stepIndex}] CLICK "${step.text?.substring(0, 40)}" — ${step.selector}`);
        } else if (step.type === 'input') {
          console.log(`  [${stepIndex}] INPUT "${step.value}" — ${step.selector} (placeholder: ${step.placeholder})`);
        } else if (step.type === 'navigation') {
          console.log(`  [${stepIndex}] NAV ${step.from} -> ${step.to}`);
        }
      }
    } catch {
      // page might have reloaded, re-inject
    }
  }, 500);

  // Save on Ctrl+C
  async function save() {
    clearInterval(pollInterval);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  Recording stopped. ${steps.length} steps captured.`);

    // Take final screenshot
    try {
      const finalSS = resolve(OUTPUT_DIR, 'live-final.png');
      await page.screenshot({ path: finalSS });
      console.log(`  Final screenshot: ${finalSS}`);
    } catch {}

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const recording = {
      timestamp: new Date().toISOString(),
      source: 'live-recorder',
      stepsCount: steps.length,
      steps,
    };
    const outPath = resolve(OUTPUT_DIR, `live-${timestamp}.json`);
    writeFileSync(outPath, JSON.stringify(recording, null, 2));
    console.log(`  Saved: ${outPath}`);
    console.log('='.repeat(60));

    await browser.close();
    process.exit(0);
  }

  process.on('SIGINT', save);
  process.on('SIGTERM', save);
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
