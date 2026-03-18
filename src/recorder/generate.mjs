// Auto-generate test case definitions from recorded steps
// Analyzes the recording, identifies flow patterns, outputs:
//   1. Proposed test case JSON (for test_cases.json)
//   2. New UI elements discovered (for ui-map.json)
//   3. Step-by-step route with element mapping
//
// Usage: node src/recorder/generate.mjs [recording_dir] [--apply]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const RECORDING_DIR = process.argv[2]?.startsWith('--')
  ? resolve(import.meta.dirname, '../../shared/results/recording')
  : (process.argv[2] || resolve(import.meta.dirname, '../../shared/results/recording'));
const SHARED_DIR = resolve(import.meta.dirname, '../../shared');
const shouldApply = process.argv.includes('--apply');

const stepsFile = resolve(RECORDING_DIR, 'steps.json');
if (!existsSync(stepsFile)) {
  console.error(`No steps.json at ${stepsFile}. Run listen.mjs first.`);
  process.exit(1);
}

const steps = JSON.parse(readFileSync(stepsFile, 'utf-8'));
const uiMap = JSON.parse(readFileSync(resolve(SHARED_DIR, 'ui-map.json'), 'utf-8'));
const existingElements = uiMap.elements;

// ─── Step 1: Merge consecutive inputs ───
const actions = [];
let inputBuffer = null;
for (const step of steps) {
  if (step.type === 'input') {
    if (inputBuffer && inputBuffer.testid === step.testid) {
      inputBuffer.value = step.value;
      inputBuffer.rawSteps.push(step.step);
    } else {
      if (inputBuffer) actions.push(inputBuffer);
      inputBuffer = { ...step, rawSteps: [step.step] };
    }
  } else {
    if (inputBuffer) { actions.push(inputBuffer); inputBuffer = null; }
    actions.push({ ...step, rawSteps: [step.step] });
  }
}
if (inputBuffer) actions.push(inputBuffer);

// ─── Step 2: Classify each action by intent ───
const INTENT_RULES = [
  { testid: /ovelay-popover/, intent: 'dismiss_overlay' },
  { testid: /app-modal-stacks-backdrop/, intent: 'dismiss_modal' },
  { testid: /AccountSelectorTriggerBase/, intent: 'open_account_selector' },
  { testid: /account-item-index-(\d+)/, intent: 'select_account', extractIndex: true },
  { testid: /account-network-trigger-button/, intent: 'open_network_selector' },
  { testid: /nav-header-search-chain-selector/, intent: 'search_network' },
  { testid: /Wallet-Tab-Header/, text: /发送/, intent: 'click_send' },
  { testid: /Wallet-Tab-Header/, text: /接收/, intent: 'click_receive' },
  { testid: /APP-Modal-Screen/, intent: 'select_in_modal' },
  { testid: /send-recipient-amount-form/, tag: 'INPUT', intent: 'click_amount_input' },
  { testid: /send-recipient-amount-form/, text: /最大/, intent: 'click_max_amount' },
  { testid: /SvgPeopleCircle|contacts/, intent: 'open_contacts' },
  { testid: /TMPopover-ScrollView/, intent: 'contacts_popover_action' },
  { testid: /page-footer-confirm/, intent: 'click_preview_or_confirm' },
  { testid: /page-footer-cancel/, intent: 'click_cancel' },
  { testid: /nav-header-back/, intent: 'nav_back' },
  { testid: /nav-header-close/, intent: 'nav_close' },
];

function classifyAction(action) {
  for (const rule of INTENT_RULES) {
    if (rule.testid && !rule.testid.test(action.testid || '')) continue;
    if (rule.text && !rule.text.test(action.text || '')) continue;
    if (rule.tag && action.tag !== rule.tag) continue;

    const result = { intent: rule.intent, action };
    if (rule.extractIndex) {
      const m = (action.testid || '').match(/index-(\d+)/);
      if (m) result.index = parseInt(m[1]);
    }
    return result;
  }

  if (action.type === 'input') return { intent: 'text_input', action };
  return { intent: 'unknown_click', action };
}

const classified = actions.map(classifyAction);

// ─── Step 3: Group into flow segments ───
// A "flow" is a sequence of actions that form a logical test operation
// Split on: dismiss_overlay/dismiss_modal at start, click_cancel/nav_back at end
const flows = [];
let currentFlow = [];

for (const c of classified) {
  currentFlow.push(c);

  // End markers: cancel, nav_back, or end of recording
  if (['click_cancel', 'nav_back', 'nav_close'].includes(c.intent)) {
    flows.push([...currentFlow]);
    currentFlow = [];
  }
}
if (currentFlow.length > 0) flows.push(currentFlow);

// ─── Step 4: Identify new testids not in ui-map ───
const allTestids = new Set();
const newTestids = new Map();
for (const s of steps) {
  if (!s.testid) continue;
  allTestids.add(s.testid);
  const inMap = Object.values(existingElements).some(el =>
    el.primary.includes(s.testid) ||
    (el.quick_fallbacks || []).some(f => f.includes(s.testid))
  );
  if (!inMap && !newTestids.has(s.testid)) {
    newTestids.set(s.testid, { tag: s.tag, text: (s.text || '').substring(0, 40), count: 0 });
  }
  if (newTestids.has(s.testid)) newTestids.get(s.testid).count++;
}

// ─── Step 5: Generate route description ───
console.log('');
console.log('  ╔═══════════════════════════════════════════════════════╗');
console.log('  ║        Recording Analysis & Script Generation         ║');
console.log('  ╚═══════════════════════════════════════════════════════╝');
console.log('');

console.log(`  Raw steps: ${steps.length}  →  Actions: ${actions.length}  →  Flows: ${flows.length}`);
console.log('');

// Display each flow
flows.forEach((flow, fi) => {
  console.log(`  ── Flow ${fi + 1} (${flow.length} actions) ──`);
  for (const c of flow) {
    const a = c.action;
    const tid = a.testid ? `[${a.testid}]` : '';
    const detail = a.type === 'input' ? `"${a.value}"` : (a.text ? `"${a.text.substring(0, 30)}"` : '');
    console.log(`    ${c.intent.padEnd(28)} ${tid} ${detail}`);
  }
  console.log('');
});

// ─── Step 6: Build proposed test case steps ───
console.log('  ── Proposed Test Case Steps ──');
console.log('');

const proposedSteps = [];
let stepOrder = 0;

for (const c of classified) {
  stepOrder++;
  const a = c.action;
  let step = null;

  switch (c.intent) {
    case 'dismiss_overlay':
      step = { order: stepOrder, action: 'dismiss_overlays', ui_element: 'overlayPopover' };
      break;
    case 'dismiss_modal':
      step = { order: stepOrder, action: 'dismiss_overlays', ui_element: 'modalBackdrop' };
      break;
    case 'open_account_selector':
      step = { order: stepOrder, action: 'open_account_selector', ui_element: 'walletSelector' };
      break;
    case 'select_account':
      step = { order: stepOrder, action: 'select_account', ui_element: 'accountItemByIndex', param: `index-${c.index}` };
      break;
    case 'open_network_selector':
      step = { order: stepOrder, action: 'open_network_selector', ui_element: 'networkButton' };
      break;
    case 'click_send':
      step = { order: stepOrder, action: 'click_send', ui_element: 'walletTabHeader', text: '发送' };
      break;
    case 'select_in_modal':
      step = { order: stepOrder, action: 'select_token', ui_element: 'modal', param: a.text?.substring(0, 20) };
      break;
    case 'open_contacts':
      step = { order: stepOrder, action: 'open_contacts', ui_element: 'contactsIcon' };
      break;
    case 'contacts_popover_action':
      step = { order: stepOrder, action: 'select_from_contacts', ui_element: 'contactsPopover', text: a.text?.substring(0, 20) };
      break;
    case 'click_amount_input':
      step = { order: stepOrder, action: 'focus_amount', ui_element: 'sendAmountInput' };
      break;
    case 'text_input':
      step = { order: stepOrder, action: 'input_amount', ui_element: 'sendAmountInput', value: a.value };
      break;
    case 'click_max_amount':
      step = { order: stepOrder, action: 'click_max', ui_element: 'sendMaxButton' };
      break;
    case 'click_preview_or_confirm':
      step = { order: stepOrder, action: 'click_preview', ui_element: 'pageFooterConfirm' };
      break;
    case 'click_cancel':
      step = { order: stepOrder, action: 'click_cancel', ui_element: 'pageFooterCancel' };
      break;
    default:
      step = { order: stepOrder, action: c.intent, raw_testid: a.testid, raw_text: a.text?.substring(0, 30) };
  }

  proposedSteps.push(step);
  const paramStr = step.param ? ` param="${step.param}"` : (step.value ? ` value="${step.value}"` : (step.text ? ` text="${step.text}"` : ''));
  console.log(`    ${String(step.order).padStart(3)}.  ${step.action.padEnd(24)} ${(step.ui_element || step.raw_testid || '').padEnd(22)}${paramStr}`);
}

console.log('');

// ─── Step 7: New elements for ui-map ───
if (newTestids.size > 0) {
  console.log('  ── New Elements (not in ui-map.json) ──');
  console.log('');
  for (const [tid, info] of newTestids) {
    console.log(`    ${tid}  (${info.tag}, ${info.count}x)  text="${info.text}"`);
  }
  console.log('');
}

// ─── Step 8: Output JSON ───
const output = {
  generatedAt: new Date().toISOString(),
  sourceRecording: RECORDING_DIR,
  rawSteps: steps.length,
  actions: actions.length,
  flows: flows.length,
  proposedSteps,
  newElements: Object.fromEntries(newTestids),
  route: classified.map(c => c.intent),
};

const outputPath = resolve(RECORDING_DIR, 'generated.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`  Generated: ${outputPath}`);

if (shouldApply) {
  console.log('');
  console.log('  --apply: Writing to shared/ files...');
  // TODO: merge into test_cases.json and ui-map.json
  console.log('  (Auto-apply not yet implemented. Use generated.json as reference.)');
}

console.log('');
console.log('  Complete pipeline:');
console.log('    1. node src/recorder/listen.mjs    # Record your clicks');
console.log('    2. node src/recorder/review.mjs    # Review steps + screenshots');
console.log('    3. node src/recorder/generate.mjs  # Generate test case route');
console.log('    4. Agent reviews generated.json → updates test_cases.json + ui-map.json');
console.log('');
