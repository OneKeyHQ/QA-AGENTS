// Review recorded steps — terminal display with step details + screenshot paths
// Usage: node src/recorder/review.mjs [recording_dir]

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const RECORDING_DIR = process.argv[2]
  || resolve(import.meta.dirname, '../../shared/results/recording');

const stepsFile = resolve(RECORDING_DIR, 'steps.json');
if (!existsSync(stepsFile)) {
  console.error(`No steps.json found at ${stepsFile}`);
  console.error('Run "node src/recorder/listen.mjs" first to record.');
  process.exit(1);
}

const steps = JSON.parse(readFileSync(stepsFile, 'utf-8'));

// ─── Header ───
console.log('');
console.log('  ╔═══════════════════════════════════════════════════════╗');
console.log(`  ║  Recording Review — ${steps.length} steps${' '.repeat(Math.max(0, 32 - String(steps.length).length))}║`);
console.log(`  ║  Source: ${RECORDING_DIR.substring(RECORDING_DIR.length - 42).padEnd(44)} ║`);
console.log('  ╚═══════════════════════════════════════════════════════╝');
console.log('');

// ─── Group steps into logical actions ───
// Consecutive input events on the same field = one "type" action
const grouped = [];
let inputBuffer = null;

for (const step of steps) {
  if (step.type === 'input') {
    if (inputBuffer && inputBuffer.testid === step.testid) {
      // Same input field — merge (keep latest value)
      inputBuffer.value = step.value;
      inputBuffer.rawSteps.push(step.step);
    } else {
      if (inputBuffer) grouped.push(inputBuffer);
      inputBuffer = { ...step, rawSteps: [step.step] };
    }
  } else {
    if (inputBuffer) {
      grouped.push(inputBuffer);
      inputBuffer = null;
    }
    grouped.push({ ...step, rawSteps: [step.step] });
  }
}
if (inputBuffer) grouped.push(inputBuffer);

// ─── Display ───
let actionNum = 0;
for (const g of grouped) {
  actionNum++;
  const stepNums = g.rawSteps.length > 1
    ? `steps ${g.rawSteps[0]}-${g.rawSteps[g.rawSteps.length - 1]}`
    : `step ${g.rawSteps[0]}`;

  if (g.type === 'click') {
    const testid = g.testid || '(none)';
    const text = g.text ? `"${g.text.substring(0, 50)}"` : '';
    console.log(`  ${String(actionNum).padStart(3)}.  CLICK   ${g.tag.padEnd(8)} testid=${testid}`);
    if (text) console.log(`             text: ${text}`);
    console.log(`             pos: (${g.x}, ${g.y})  [${stepNums}]`);
  } else {
    const testid = g.testid || '(none)';
    const placeholder = g.placeholder ? `placeholder="${g.placeholder}"` : '';
    console.log(`  ${String(actionNum).padStart(3)}.  INPUT   ${g.tag.padEnd(8)} testid=${testid}  ${placeholder}`);
    console.log(`             value: "${g.value}"  [${stepNums}]`);
  }

  // Screenshot
  const ssPath = g.screenshot
    || resolve(RECORDING_DIR, `step-${String(g.rawSteps[g.rawSteps.length - 1]).padStart(2, '0')}.png`);
  if (existsSync(ssPath)) {
    console.log(`             screenshot: ${ssPath}`);
  }
  console.log('');
}

// ─── Flow Summary ───
console.log('  ─────────────────────────────────────────────────');
console.log('  Flow Summary:');
console.log('');

// Extract unique testids as route
const route = [];
for (const g of grouped) {
  if (g.type === 'click' && g.testid) {
    const label = g.text ? `${g.testid} ("${g.text.substring(0, 20)}")` : g.testid;
    route.push(label);
  } else if (g.type === 'input') {
    route.push(`input → "${g.value}"`);
  }
}

route.forEach((r, i) => {
  const prefix = i === route.length - 1 ? '  └─' : '  ├─';
  console.log(`  ${prefix} ${r}`);
});

console.log('');
console.log(`  Total: ${steps.length} raw events → ${grouped.length} actions`);
console.log(`  Duration: ${steps.length > 1 ? ((new Date(steps[steps.length - 1].time) - new Date(steps[0].time)) / 1000).toFixed(0) + 's' : 'N/A'}`);

// ─── Discovered Elements ───
const testids = new Map();
for (const s of steps) {
  if (s.testid && s.type === 'click') {
    if (!testids.has(s.testid)) testids.set(s.testid, { count: 0, texts: new Set() });
    const entry = testids.get(s.testid);
    entry.count++;
    if (s.text) entry.texts.add(s.text.substring(0, 30));
  }
}

if (testids.size > 0) {
  console.log('');
  console.log('  Discovered testids:');
  for (const [tid, info] of testids) {
    const texts = [...info.texts].join(', ');
    console.log(`    [${info.count}x] ${tid}${texts ? ` — "${texts}"` : ''}`);
  }
}

console.log('');
console.log('  Next: run "node src/recorder/generate.mjs" to auto-generate test scripts.');
console.log('');
