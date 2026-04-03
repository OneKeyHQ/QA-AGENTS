// Auto-generate test case definitions from recorded steps
// Analyzes the recording, identifies flow patterns, outputs:
//   1. Proposed test case JSON (for test_cases.json)
//   2. New UI elements discovered (for ui-map.json / ui-semantic-map.json)
//   3. Step-by-step route with semantic element mapping
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
const semanticMap = JSON.parse(readFileSync(resolve(SHARED_DIR, 'ui-semantic-map.json'), 'utf-8'));
const existingElements = uiMap.elements;
const semanticElements = semanticMap.elements || {};

const INTENT_RULES = [
  { testid: /ovelay-popover/, intent: 'dismiss_overlay', semanticKey: 'global.overlay.popover', uiElement: 'overlayPopover' },
  { testid: /app-modal-stacks-backdrop/, intent: 'dismiss_modal', semanticKey: 'global.modal.backdrop', uiElement: 'modalBackdrop' },
  { testid: /AccountSelectorTriggerBase/, intent: 'open_account_selector', semanticKey: 'wallet.account.selector.trigger', uiElement: 'walletSelector' },
  { testid: /account-item-index-(\d+)/, intent: 'select_account', semanticKey: 'wallet.account.selector.item_by_index', uiElement: 'accountItemByIndex', extractIndex: true },
  { testid: /account-network-trigger-button/, intent: 'open_network_selector', semanticKey: 'wallet.network.selector.trigger', uiElement: 'networkButton' },
  { testid: /nav-header-search-chain-selector|network-selector-input|all-networks-manager-search-bar/, intent: 'search_network', semanticKey: 'wallet.network.selector.search_input', uiElement: 'chainSearchInput' },
  { testid: /Wallet-Tab-Header/, text: /发送/, intent: 'click_send', semanticKey: 'wallet.home.header', uiElement: 'walletTabHeader' },
  { testid: /Wallet-Tab-Header/, text: /接收/, intent: 'click_receive', semanticKey: 'wallet.home.header', uiElement: 'walletTabHeader' },
  { testid: /APP-Modal-Screen/, intent: 'select_in_modal', semanticKey: 'global.modal.container', uiElement: 'modal' },
  { testid: /send-recipient-amount-form/, tag: 'INPUT', intent: 'click_amount_input', semanticKey: 'wallet.send.amount_input', uiElement: 'sendAmountInput' },
  { testid: /send-recipient-amount-form/, text: /最大|Max/i, intent: 'click_max_amount', semanticKey: 'wallet.send.max_button', uiElement: 'sendMaxButton' },
  { testid: /SvgPeopleCircle|contacts/, intent: 'open_contacts', semanticKey: 'wallet.send.contacts_button', uiElement: 'contactsIcon' },
  { testid: /TMPopover-ScrollView/, intent: 'contacts_popover_action', semanticKey: 'wallet.send.contacts_popover', uiElement: 'contactsPopover' },
  { testid: /page-footer-confirm/, intent: 'click_preview_or_confirm', semanticKey: 'global.footer.confirm', uiElement: 'pageFooterConfirm' },
  { testid: /page-footer-cancel/, intent: 'click_cancel', semanticKey: 'global.footer.cancel', uiElement: 'pageFooterCancel' },
  { testid: /nav-header-back/, intent: 'nav_back', semanticKey: 'global.nav.back', uiElement: 'navBack' },
  { testid: /nav-header-close/, intent: 'nav_close', semanticKey: 'global.nav.close', uiElement: 'navClose' },
];

const semanticKeyByTestId = new Map();
for (const [semanticKey, config] of Object.entries(semanticElements)) {
  if (!config?.source_testid) continue;
  const list = semanticKeyByTestId.get(config.source_testid) || [];
  list.push(semanticKey);
  semanticKeyByTestId.set(config.source_testid, list);
}

function classifyAction(action) {
  for (const rule of INTENT_RULES) {
    if (rule.testid && !rule.testid.test(action.testid || '')) continue;
    if (rule.text && !rule.text.test(action.text || '')) continue;
    if (rule.tag && action.tag !== rule.tag) continue;

    const result = { intent: rule.intent, action, semanticKey: rule.semanticKey, uiElement: rule.uiElement };
    if (rule.extractIndex) {
      const m = (action.testid || '').match(/index-(\d+)/);
      if (m) result.index = parseInt(m[1]);
    }
    return result;
  }

  if (action.type === 'input') {
    return {
      intent: 'text_input',
      action,
      semanticKey: inferSemanticKey(action.testid, action),
      uiElement: action.testid === 'network-selector-input' ? 'chainSearchInput' : null,
    };
  }
  return { intent: 'unknown_click', action, semanticKey: inferSemanticKey(action.testid, action), uiElement: null };
}

function inferSemanticKey(testid, action = {}) {
  if (!testid) return null;
  const direct = semanticKeyByTestId.get(testid);
  if (direct?.length) return direct[0];

  if (/Wallet-No-Address-Empty|TokenDetailsViews__Wallet-No-Address-Empty/.test(testid)) return 'wallet.receive.empty_state';
  if (/Wallet-No-Token-Empty/.test(testid)) return 'wallet.assets.empty_state';
  if (/Wallet-No-Search-Empty/.test(testid)) return 'wallet.assets.search_empty_state';
  if (/Wallet-No-History-Empty/.test(testid)) return 'wallet.history.empty_state';
  if (/Wallet-No-NFT-Empty/.test(testid)) return 'wallet.nft.empty_state';
  if (/Wallet-No-Approval-Empty/.test(testid)) return 'wallet.approval.empty_state';
  if (/Wallet-No-Wallet-Empty/.test(testid)) return 'wallet.home.empty_state';
  if (/Wallet-DeFi-Empty/.test(testid)) return 'wallet.defi.empty_state';
  if (/Wallet-Page-Header-Right/.test(testid)) return 'wallet.page.header.right_actions';
  if (/Wallet-Token-List-Header/.test(testid)) return 'wallet.token_list.header';
  if (/Wallet-Approval-List-Header/.test(testid)) return 'wallet.approval.list_header';
  if (/account-selector-header/.test(testid)) return 'wallet.account.selector.header';
  if (/account-selector-address-text/.test(testid)) return 'wallet.account.selector.address_text';
  if (/add-account-button/.test(testid)) return 'wallet.account.add_account_button';
  if (/batch-create-account-button-trigger/.test(testid)) return 'wallet.account.batch_create_button';
  if (/search-input/.test(testid)) return 'browser.search.input';
  if (/browser-bar-add/.test(testid)) return 'browser.bar.add';
  if (/browser-bar-go-back/.test(testid)) return 'browser.bar.back';
  if (/browser-bar-go-forward/.test(testid)) return 'browser.bar.forward';
  if (/browser-bar-home/.test(testid)) return 'browser.bar.home';
  if (/browser-bar-options/.test(testid)) return 'browser.bar.options';
  if (/browser-bar-refresh/.test(testid)) return 'browser.bar.refresh';
  if (/browser-bar-tabs/.test(testid)) return 'browser.bar.tabs';
  if (/browser-find-close-button/.test(testid)) return 'browser.find.close_button';
  if (/browser-find-next-button/.test(testid)) return 'browser.find.next_button';
  if (/browser-find-prev-button/.test(testid)) return 'browser.find.prev_button';
  if (/browser-history-button/.test(testid)) return 'browser.history.button';
  if (/browser-shortcuts-button/.test(testid)) return 'browser.shortcuts.button';
  if (/browser-header-tabs/.test(testid)) return 'browser.header.tabs';
  if (/sidebar-browser-section/.test(testid)) return 'browser.sidebar.section';
  if (/header-right-notification/.test(testid)) return 'global.header.notification';
  if (/perp-header-settings-button/.test(testid)) return 'perps.settings.button';
  if (/perp-mobile-settings-button/.test(testid)) return 'perps.settings.mobile_button';
  if (/perp-trading-form-mobile-deposit-button/.test(testid)) return 'perps.deposit.mobile_button';
  if (/header-right-perp-trade-refresh/.test(testid)) return 'perps.header.refresh_button';
  if (/replace-tx-modal/.test(testid)) return 'wallet.send.replace_tx.modal';
  if (/tab-list-modal-close-all/.test(testid)) return 'browser.tabs.close_all';
  if (/tab-list-modal-done/.test(testid)) return 'browser.tabs.done';
  if (/all-networks-manager-search-bar/.test(testid)) return 'wallet.network.manager.search_bar';
  if (/explore-index-search-input/.test(testid)) return 'discover.search.input';
  if (/explore-index-search/.test(testid)) return 'discover.search.trigger';
  if (/address-book-search-empty/.test(testid)) return 'address_book.search.empty_state';

  if (action.text && /最大|Max/i.test(action.text) && /send-recipient-amount-form/.test(testid || '')) return 'wallet.send.max_button';
  return null;
}

function isKnownByUiMap(testid) {
  return Object.values(existingElements).some((el) =>
    (el.primary || '').includes(testid) || (el.quick_fallbacks || []).some((f) => f.includes(testid)),
  );
}

function isKnownBySemanticMap(testid) {
  return semanticKeyByTestId.has(testid) || Boolean(inferSemanticKey(testid));
}

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

const classified = actions.map(classifyAction);

// ─── Step 3: Group into flow segments ───
const flows = [];
let currentFlow = [];

for (const c of classified) {
  currentFlow.push(c);

  if (['click_cancel', 'nav_back', 'nav_close'].includes(c.intent)) {
    flows.push([...currentFlow]);
    currentFlow = [];
  }
}
if (currentFlow.length > 0) flows.push(currentFlow);

// ─── Step 4: Identify new testids not in known maps ───
const allTestids = new Set();
const newTestids = new Map();
for (const s of steps) {
  if (!s.testid) continue;
  allTestids.add(s.testid);
  const known = isKnownByUiMap(s.testid) || isKnownBySemanticMap(s.testid);
  if (!known && !newTestids.has(s.testid)) {
    newTestids.set(s.testid, {
      tag: s.tag,
      text: (s.text || '').substring(0, 40),
      count: 0,
      recommendedSemanticKey: inferSemanticKey(s.testid, s),
    });
  }
  if (newTestids.has(s.testid)) newTestids.get(s.testid).count++;
}

console.log('');
console.log('  ╔═══════════════════════════════════════════════════════╗');
console.log('  ║        Recording Analysis & Script Generation         ║');
console.log('  ╚═══════════════════════════════════════════════════════╝');
console.log('');

console.log(`  Raw steps: ${steps.length}  →  Actions: ${actions.length}  →  Flows: ${flows.length}`);
console.log(`  Semantic map loaded: ${Object.keys(semanticElements).length} elements`);
console.log('');

flows.forEach((flow, fi) => {
  console.log(`  ── Flow ${fi + 1} (${flow.length} actions) ──`);
  for (const c of flow) {
    const a = c.action;
    const tid = a.testid ? `[${a.testid}]` : '';
    const detail = a.type === 'input' ? `"${a.value}"` : (a.text ? `"${a.text.substring(0, 30)}"` : '');
    const semantic = c.semanticKey ? ` → ${c.semanticKey}` : '';
    console.log(`    ${c.intent.padEnd(28)} ${tid} ${detail}${semantic}`);
  }
  console.log('');
});

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
      step = { order: stepOrder, action: 'dismiss_overlays', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'dismiss_modal':
      step = { order: stepOrder, action: 'dismiss_overlays', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'open_account_selector':
      step = { order: stepOrder, action: 'open_account_selector', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'select_account':
      step = { order: stepOrder, action: 'select_account', semantic_element: c.semanticKey, ui_element: c.uiElement, param: `index-${c.index}` };
      break;
    case 'open_network_selector':
      step = { order: stepOrder, action: 'open_network_selector', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'search_network':
      step = { order: stepOrder, action: 'search_network', semantic_element: c.semanticKey, ui_element: c.uiElement, value: a.value || a.text || '' };
      break;
    case 'click_send':
      step = { order: stepOrder, action: 'click_send', semantic_element: c.semanticKey, ui_element: c.uiElement, text: '发送' };
      break;
    case 'click_receive':
      step = { order: stepOrder, action: 'click_receive', semantic_element: c.semanticKey, ui_element: c.uiElement, text: '接收' };
      break;
    case 'select_in_modal':
      step = { order: stepOrder, action: 'select_token', semantic_element: c.semanticKey, ui_element: c.uiElement, param: a.text?.substring(0, 20) };
      break;
    case 'open_contacts':
      step = { order: stepOrder, action: 'open_contacts', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'contacts_popover_action':
      step = { order: stepOrder, action: 'select_from_contacts', semantic_element: c.semanticKey, ui_element: c.uiElement, text: a.text?.substring(0, 20) };
      break;
    case 'click_amount_input':
      step = { order: stepOrder, action: 'focus_amount', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'text_input':
      step = {
        order: stepOrder,
        action: c.semanticKey === 'wallet.network.selector.search_input' ? 'search_network' : 'input_text',
        semantic_element: c.semanticKey,
        ui_element: c.uiElement,
        value: a.value,
        raw_testid: a.testid,
      };
      break;
    case 'click_max_amount':
      step = { order: stepOrder, action: 'click_max', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'click_preview_or_confirm':
      step = { order: stepOrder, action: 'click_preview', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'click_cancel':
      step = { order: stepOrder, action: 'click_cancel', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'nav_back':
      step = { order: stepOrder, action: 'nav_back', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    case 'nav_close':
      step = { order: stepOrder, action: 'nav_close', semantic_element: c.semanticKey, ui_element: c.uiElement };
      break;
    default:
      step = {
        order: stepOrder,
        action: c.intent,
        semantic_element: c.semanticKey,
        ui_element: c.uiElement,
        raw_testid: a.testid,
        raw_text: a.text?.substring(0, 30),
      };
  }

  proposedSteps.push(step);
  const semanticStr = step.semantic_element ? ` semantic="${step.semantic_element}"` : '';
  const uiStr = step.ui_element ? ` ui="${step.ui_element}"` : (step.raw_testid ? ` raw="${step.raw_testid}"` : '');
  const paramStr = step.param ? ` param="${step.param}"` : (step.value ? ` value="${step.value}"` : (step.text ? ` text="${step.text}"` : ''));
  console.log(`    ${String(step.order).padStart(3)}.  ${step.action.padEnd(24)}${semanticStr}${uiStr}${paramStr}`);
}

console.log('');

if (newTestids.size > 0) {
  console.log('  ── New Elements (not in ui-map.json / ui-semantic-map.json) ──');
  console.log('');
  for (const [tid, info] of newTestids) {
    const suggested = info.recommendedSemanticKey ? `  suggested=${info.recommendedSemanticKey}` : '';
    console.log(`    ${tid}  (${info.tag}, ${info.count}x)  text="${info.text}"${suggested}`);
  }
  console.log('');
}

const output = {
  generatedAt: new Date().toISOString(),
  sourceRecording: RECORDING_DIR,
  rawSteps: steps.length,
  actions: actions.length,
  flows: flows.length,
  semanticMapElements: Object.keys(semanticElements).length,
  proposedSteps,
  newElements: Object.fromEntries(newTestids),
  route: classified.map((c) => ({ intent: c.intent, semanticKey: c.semanticKey || null, testid: c.action.testid || null })),
};

const outputPath = resolve(RECORDING_DIR, 'generated.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`  Generated: ${outputPath}`);

if (shouldApply) {
  console.log('');
  console.log('  --apply: Writing to shared/ files...');
  console.log('  (Auto-apply not yet implemented. Use generated.json as reference.)');
}

console.log('');
console.log('  Selector reference order:');
console.log('    1. shared/ui-semantic-map.json');
console.log('    2. shared/generated/app-monorepo-testid-index.json');
console.log('    3. shared/ui-map.json');
console.log('    4. Runtime CDP/text/OCR fallback');
console.log('');
console.log('  Complete pipeline:');
console.log('    1. node src/recorder/listen.mjs    # Record your clicks');
console.log('    2. node src/recorder/review.mjs    # Review steps + screenshots');
console.log('    3. node src/recorder/generate.mjs  # Generate semantic-aware test case route');
console.log('    4. Agent reviews generated.json → updates test_cases.json + ui-map/ui-semantic-map');
console.log('');
