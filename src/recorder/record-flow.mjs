// Interactive flow recorder — captures click/input events in real-time via CDP
// Usage: node src/recorder/record-flow.mjs [flow-name]

import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createInterface } from 'node:readline';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUTPUT_DIR = resolve(import.meta.dirname, '../../shared/recordings');
const flowName = process.argv[2] || 'unnamed-flow';

const steps = [];
let stepIndex = 0;

async function capturePageState(page, label) {
  const state = await page.evaluate(() => {
    const getVisible = (selector) => {
      const els = [];
      document.querySelectorAll(selector).forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) els.push(el);
      });
      return els;
    };

    const buttons = getVisible('button, [role="button"]').map(el => ({
      text: el.textContent?.trim().substring(0, 80),
      testid: el.getAttribute('data-testid'),
      tag: el.tagName,
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    }));

    const inputs = getVisible('input, textarea').map(el => ({
      type: el.type || 'text',
      placeholder: el.placeholder,
      value: el.value,
      testid: el.getAttribute('data-testid'),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; })(),
    }));

    const testids = getVisible('[data-testid]').map(el => ({
      testid: el.getAttribute('data-testid'),
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 80),
    }));

    // Get page heading / title text
    const headings = getVisible('h1, h2, h3, [class*="title"], [class*="Title"]').map(el => el.textContent?.trim().substring(0, 100));

    return { buttons, inputs, testids, headings: [...new Set(headings)] };
  });

  state.url = page.url();
  state.title = await page.title();
  state.label = label;
  state.timestamp = new Date().toISOString();
  return state;
}

async function takeScreenshot(page, stepNum) {
  const ssPath = resolve(OUTPUT_DIR, `${flowName}-step${stepNum}.png`);
  await page.screenshot({ path: ssPath });
  return ssPath;
}

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n🎬 Flow Recorder — "${flowName}"`);
  console.log(`Connecting to CDP: ${CDP_URL}\n`);

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found');

  let page = context.pages()[0];
  if (!page) throw new Error('No page found');

  // Listen for new pages (popups, navigation)
  context.on('page', (newPage) => {
    console.log('  [New page detected, switching...]');
    page = newPage;
  });

  // Inject click/input listener into the page
  async function injectListeners(p) {
    try {
      await p.evaluate(() => {
        if (window.__recorderInjected) return;
        window.__recorderInjected = true;
        window.__recorderEvents = [];

        document.addEventListener('click', (e) => {
          const el = e.target.closest('button, [role="button"], a, [data-testid], input, select, [tabindex]') || e.target;
          const r = el.getBoundingClientRect();
          window.__recorderEvents.push({
            type: 'click',
            timestamp: Date.now(),
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 80),
            testid: el.getAttribute('data-testid'),
            role: el.getAttribute('role'),
            className: el.className?.toString().substring(0, 100),
            rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
          });
        }, true);

        document.addEventListener('input', (e) => {
          const el = e.target;
          window.__recorderEvents.push({
            type: 'input',
            timestamp: Date.now(),
            tag: el.tagName,
            inputType: el.type,
            testid: el.getAttribute('data-testid'),
            placeholder: el.placeholder,
            value: el.value,
          });
        }, true);
      });
    } catch { /* page might have navigated */ }
  }

  await injectListeners(page);

  // Poll for new events and re-inject on navigation
  const eventPoller = setInterval(async () => {
    try {
      await injectListeners(page);
    } catch { /* ignore */ }
  }, 2000);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise(r => rl.question(q, r));

  console.log('Commands:');
  console.log('  [Enter]  — Capture current page snapshot');
  console.log('  d        — Dump captured click/input events since last snapshot');
  console.log('  s        — Take screenshot only');
  console.log('  q        — Finish recording and save\n');

  // Capture initial state
  console.log('📸 Capturing initial page state...');
  const initState = await capturePageState(page, 'initial');
  const initSS = await takeScreenshot(page, 0);
  steps.push({ step: 0, label: 'initial', state: initState, screenshot: initSS, events: [] });
  console.log(`  Page: ${initState.title}`);
  console.log(`  Headings: ${initState.headings.join(' | ') || '(none)'}`);
  console.log(`  Buttons: ${initState.buttons.length}, Inputs: ${initState.inputs.length}, TestIDs: ${initState.testids.length}\n`);

  let running = true;
  while (running) {
    const cmd = await ask(`Step ${stepIndex + 1} > `);

    if (cmd.trim().toLowerCase() === 'q') {
      running = false;
      break;
    }

    if (cmd.trim().toLowerCase() === 's') {
      const ssPath = await takeScreenshot(page, stepIndex + 1);
      console.log(`  📷 Screenshot: ${ssPath}\n`);
      continue;
    }

    if (cmd.trim().toLowerCase() === 'd') {
      // Dump events
      try {
        const events = await page.evaluate(() => {
          const evts = window.__recorderEvents || [];
          window.__recorderEvents = [];
          return evts;
        });
        if (events.length === 0) {
          console.log('  (No events captured)\n');
        } else {
          events.forEach((evt, i) => {
            if (evt.type === 'click') {
              console.log(`  ${i + 1}. CLICK: "${evt.text}" [testid=${evt.testid || 'none'}] <${evt.tag}>`);
            } else if (evt.type === 'input') {
              console.log(`  ${i + 1}. INPUT: [testid=${evt.testid || 'none'}] placeholder="${evt.placeholder}" value="${evt.value}"`);
            }
          });
          console.log();
        }
      } catch {
        console.log('  (Could not read events - page may have navigated)\n');
      }
      continue;
    }

    // Default: capture snapshot
    stepIndex++;
    let events = [];
    try {
      events = await page.evaluate(() => {
        const evts = window.__recorderEvents || [];
        window.__recorderEvents = [];
        return evts;
      });
    } catch { /* page navigated */ }

    const label = cmd.trim() || `step-${stepIndex}`;
    const state = await capturePageState(page, label);
    const ssPath = await takeScreenshot(page, stepIndex);

    steps.push({ step: stepIndex, label, state, screenshot: ssPath, events });

    console.log(`\n📸 Step ${stepIndex}: "${label}"`);
    console.log(`  Page: ${state.title}`);
    console.log(`  Headings: ${state.headings.join(' | ') || '(none)'}`);
    console.log(`  Buttons: ${state.buttons.length}, Inputs: ${state.inputs.length}`);
    if (events.length > 0) {
      console.log(`  Captured events:`);
      events.forEach((evt, i) => {
        if (evt.type === 'click') {
          console.log(`    ${i + 1}. CLICK: "${evt.text}" [testid=${evt.testid || 'none'}] <${evt.tag}>`);
        } else if (evt.type === 'input') {
          console.log(`    ${i + 1}. INPUT: [testid=${evt.testid || 'none'}] value="${evt.value}"`);
        }
      });
    }
    console.log();
  }

  clearInterval(eventPoller);

  // Save full recording
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outPath = resolve(OUTPUT_DIR, `${flowName}-${timestamp}.json`);
  const recording = {
    flow: flowName,
    recordedAt: new Date().toISOString(),
    totalSteps: steps.length,
    steps,
  };
  writeFileSync(outPath, JSON.stringify(recording, null, 2));
  console.log(`\n✅ Recording saved: ${outPath}`);
  console.log(`Total steps: ${steps.length}`);

  rl.close();
  await browser.close();
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
