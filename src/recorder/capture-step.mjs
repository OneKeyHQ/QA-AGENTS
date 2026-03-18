// Step-by-step recorder — run between user interactions to capture state + events
// Usage: node src/recorder/capture-step.mjs <flow-name> <step-number> [label]

import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
const OUTPUT_DIR = resolve(import.meta.dirname, '../../shared/recordings');
const flowName = process.argv[2] || 'unnamed';
const stepNum = parseInt(process.argv[3] || '0');
const label = process.argv[4] || `step-${stepNum}`;

async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.connectOverCDP(CDP_URL);
  const context = browser.contexts()[0];
  if (!context) throw new Error('No browser context found');

  const pages = context.pages();
  const page = pages[pages.length - 1];
  if (!page) throw new Error('No page found');

  // Collect any events from previously injected listeners
  let events = [];
  try {
    events = await page.evaluate(() => {
      const evts = window.__recorderEvents || [];
      window.__recorderEvents = [];
      return evts;
    });
  } catch { /* no listeners injected yet */ }

  // Capture current page state
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
      value: el.type === 'password' ? '***' : el.value,
      testid: el.getAttribute('data-testid'),
      rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }; })(),
    }));

    const testids = getVisible('[data-testid]').map(el => ({
      testid: el.getAttribute('data-testid'),
      tag: el.tagName,
      text: el.textContent?.trim().substring(0, 80),
    }));

    const headings = [...new Set(
      getVisible('h1, h2, h3, h4, [class*="title"], [class*="Title"]')
        .map(el => el.textContent?.trim().substring(0, 100))
        .filter(Boolean)
    )];

    return { buttons, inputs, testids, headings };
  });

  // Screenshot
  const ssPath = resolve(OUTPUT_DIR, `${flowName}-step${stepNum}.png`);
  await page.screenshot({ path: ssPath });

  // Inject listeners for NEXT step
  try {
    await page.evaluate(() => {
      if (window.__recorderInjected) {
        window.__recorderEvents = [];
        return;
      }
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
          valueLength: el.value?.length || 0,
        });
      }, true);
    });
  } catch { /* ignore */ }

  // Build step data
  const stepData = {
    step: stepNum,
    label,
    timestamp: new Date().toISOString(),
    url: page.url(),
    title: await page.title(),
    headings: state.headings,
    buttons: state.buttons,
    inputs: state.inputs,
    testids: state.testids,
    screenshot: ssPath,
    capturedEvents: events,
  };

  // Append to flow file
  const flowPath = resolve(OUTPUT_DIR, `${flowName}-flow.json`);
  let flow = { flow: flowName, steps: [] };
  if (existsSync(flowPath)) {
    try { flow = JSON.parse(readFileSync(flowPath, 'utf-8')); } catch { /* reset */ }
  }
  flow.steps.push(stepData);
  flow.lastUpdated = new Date().toISOString();
  writeFileSync(flowPath, JSON.stringify(flow, null, 2));

  // Print summary
  console.log(JSON.stringify({
    step: stepNum,
    label,
    headings: state.headings,
    buttonsCount: state.buttons.length,
    inputsCount: state.inputs.length,
    testidsCount: state.testids.length,
    capturedEvents: events.length,
    buttons: state.buttons.map(b => ({ text: b.text, testid: b.testid })),
    inputs: state.inputs.map(i => ({ type: i.type, placeholder: i.placeholder, testid: i.testid })),
    events: events.map(e => e.type === 'click'
      ? { action: 'CLICK', text: e.text, testid: e.testid, tag: e.tag }
      : { action: 'INPUT', testid: e.testid, placeholder: e.placeholder }),
    screenshot: ssPath,
  }, null, 2));

  await browser.close();
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
