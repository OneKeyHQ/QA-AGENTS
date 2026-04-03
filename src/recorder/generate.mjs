// Auto-generate test case definitions from recorded steps
// Analyzes the recording, identifies flow patterns, outputs:
//   1. Proposed test case JSON (for test_cases.json)
//   2. New UI elements discovered (for ui-map.json / ui-semantic-map.json)
//   3. Step-by-step route with semantic element mapping
//   4. Compiled locator payload for stable runner replay
//
// Usage: node src/recorder/generate.mjs [recording_dir] [--apply]

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename, relative } from 'path';

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const SHARED_DIR = resolve(import.meta.dirname, '../../shared');
const cliArgs = process.argv.slice(2);

function getFlagValue(name) {
  const exact = cliArgs.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const idx = cliArgs.indexOf(name);
  if (idx >= 0 && cliArgs[idx + 1] && !cliArgs[idx + 1].startsWith('--')) return cliArgs[idx + 1];
  return null;
}

function getFlagValues(name) {
  return cliArgs
    .filter((arg, idx) => arg === name || arg.startsWith(`${name}=`) || (idx > 0 && cliArgs[idx - 1] === name))
    .flatMap((arg, idx) => {
      if (arg === name) return [];
      if (arg.startsWith(`${name}=`)) return [arg.slice(name.length + 1)];
      return [];
    });
}

const positionalArgs = cliArgs.filter((arg, idx) => {
  if (!arg.startsWith('--')) {
    const prev = cliArgs[idx - 1];
    if (prev && ['--scenario-id', '--case-id', '--title', '--platform', '--priority', '--id-prefix', '--test-cases-file'].includes(prev)) {
      return false;
    }
    return true;
  }
  return false;
});

const RECORDING_DIR = positionalArgs[0]
  ? resolve(positionalArgs[0])
  : resolve(import.meta.dirname, '../../shared/results/recording');
const shouldApply = cliArgs.includes('--apply');
const applyScenarioId = getFlagValue('--scenario-id');
const applyCaseId = getFlagValue('--case-id');
const applyTitle = getFlagValue('--title');
const applyPlatform = getFlagValue('--platform') || 'desktop';
const applyPriority = getFlagValue('--priority') || 'P1';
const applyIdPrefix = (getFlagValue('--id-prefix') || 'DRAFT').toUpperCase();
const testCasesPath = resolve(getFlagValue('--test-cases-file') || resolve(SHARED_DIR, 'test_cases.json'));

const stepsFile = resolve(RECORDING_DIR, 'steps.json');
if (!existsSync(stepsFile)) {
  console.error(`No steps.json at ${stepsFile}. Run listen.mjs first.`);
  process.exit(1);
}

const steps = JSON.parse(readFileSync(stepsFile, 'utf-8'));
const uiMap = JSON.parse(readFileSync(resolve(SHARED_DIR, 'ui-map.json'), 'utf-8'));
const semanticMap = JSON.parse(readFileSync(resolve(SHARED_DIR, 'ui-semantic-map.json'), 'utf-8'));
const testIdIndex = JSON.parse(readFileSync(resolve(SHARED_DIR, 'generated/app-monorepo-testid-index.json'), 'utf-8'));
const existingElements = uiMap.elements || {};
const semanticElements = semanticMap.elements || {};
const indexedTestIds = testIdIndex.testIds || {};

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

function cloneJSON(value) {
  return value ? JSON.parse(JSON.stringify(value)) : value;
}

function compileLocatorFromSemantic(semanticKey) {
  if (!semanticKey) return null;
  const semantic = semanticElements[semanticKey];
  if (!semantic) return null;

  return {
    source: 'ui-semantic-map',
    semantic_key: semanticKey,
    primary: semantic.primary || null,
    quick_fallbacks: cloneJSON(semantic.quick_fallbacks || []),
    deep_search: cloneJSON(semantic.deep_search || null),
    source_testid: semantic.source_testid || null,
    page: semantic.page || null,
    feature: cloneJSON(semantic.feature || []),
    platform: cloneJSON(semantic.platform || []),
  };
}

function compileLocatorFromUi(uiElement) {
  if (!uiElement) return null;
  const ui = existingElements[uiElement];
  if (!ui) return null;

  return {
    source: 'ui-map',
    ui_element: uiElement,
    primary: ui.primary || null,
    quick_fallbacks: cloneJSON(ui.quick_fallbacks || []),
    deep_search: cloneJSON(ui.deep_search || null),
    tier_stats: cloneJSON(ui.tier_stats || null),
  };
}

function compileLocatorFromTestId(testid) {
  if (!testid) return null;
  const indexed = indexedTestIds[testid];
  if (!indexed) return null;

  return {
    source: 'app-monorepo-testid-index',
    raw_testid: testid,
    primary: indexed.selector || `[data-testid="${testid}"]`,
    quick_fallbacks: [],
    deep_search: null,
    files: cloneJSON(indexed.files || []),
    feature_hints: cloneJSON(indexed.featureHints || []),
    occurrences: indexed.occurrences || 0,
  };
}

function compileStepLocator(step) {
  const semanticCompiled = compileLocatorFromSemantic(step.semantic_element);
  if (semanticCompiled?.primary) {
    return {
      resolution: {
        strategy: 'semantic',
        semantic_element: step.semantic_element || null,
        ui_element: step.ui_element || null,
        raw_testid: step.raw_testid || null,
      },
      compiled_locator: semanticCompiled,
    };
  }

  const uiCompiled = compileLocatorFromUi(step.ui_element);
  if (uiCompiled?.primary) {
    return {
      resolution: {
        strategy: 'legacy-ui-map',
        semantic_element: step.semantic_element || null,
        ui_element: step.ui_element || null,
        raw_testid: step.raw_testid || null,
      },
      compiled_locator: uiCompiled,
    };
  }

  const testid = step.raw_testid || step.param?.startsWith('index-') ? step.raw_testid : step.raw_testid;
  const indexedCompiled = compileLocatorFromTestId(testid);
  if (indexedCompiled?.primary) {
    return {
      resolution: {
        strategy: 'app-testid-index',
        semantic_element: step.semantic_element || null,
        ui_element: step.ui_element || null,
        raw_testid: step.raw_testid || null,
      },
      compiled_locator: indexedCompiled,
    };
  }

  return {
    resolution: {
      strategy: 'unresolved',
      semantic_element: step.semantic_element || null,
      ui_element: step.ui_element || null,
      raw_testid: step.raw_testid || null,
    },
    compiled_locator: null,
  };
}

function classifyNewElement(testid, info) {
  if (semanticKeyByTestId.has(testid)) {
    return 'known-semantic-source';
  }
  if (info.recommendedSemanticKey) {
    return 'semantic-candidate';
  }
  if (isKnownByUiMap(testid)) {
    return 'known-legacy-ui';
  }
  if (indexedTestIds[testid]) {
    return 'indexed-only';
  }
  return 'unresolved';
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'recorded-flow';
}

function titleFromScenarioId(value) {
  return String(value || 'Recorded Flow')
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function nextCaseId(cases, prefix) {
  const nums = cases
    .map((c) => c.id || '')
    .filter((id) => id.startsWith(`${prefix}-`))
    .map((id) => Number(id.split('-')[1]))
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function buildDraftCase({ cases, recordingDir, proposedSteps }) {
  const recordingBase = basename(recordingDir);
  const scenarioId = applyScenarioId || slugify(recordingBase);
  const caseId = applyCaseId || nextCaseId(cases, applyIdPrefix);
  const title = applyTitle || titleFromScenarioId(scenarioId);

  const preconditions = [
    '录制流程对应页面已打开',
    '执行前请补充准确的业务前置条件',
  ];
  const expected = [
    '请根据业务目标补充预期结果',
  ];

  return {
    id: caseId,
    scenarioId,
    title,
    platform: applyPlatform,
    priority: applyPriority,
    tags: ['draft', 'recorded'],
    preconditions,
    steps: proposedSteps.map((step) => ({
      ...step,
      description: step.description || `Auto-generated from recording: ${step.action}`,
    })),
    expected,
    recording: {
      source: relative(REPO_ROOT, resolve(recordingDir, 'steps.json')),
      generated: relative(REPO_ROOT, resolve(recordingDir, 'generated.json')),
      date: new Date().toISOString().slice(0, 10),
      rawSteps: String(steps.length),
      applyMode: 'auto-generated-draft',
    },
  };
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
console.log(`  App testid index loaded: ${Object.keys(indexedTestIds).length} elements`);
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
      step = { order: stepOrder, action: 'dismiss_overlays', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'dismiss_modal':
      step = { order: stepOrder, action: 'dismiss_overlays', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'open_account_selector':
      step = { order: stepOrder, action: 'open_account_selector', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'select_account':
      step = { order: stepOrder, action: 'select_account', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid, param: `index-${c.index}` };
      break;
    case 'open_network_selector':
      step = { order: stepOrder, action: 'open_network_selector', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'search_network':
      step = { order: stepOrder, action: 'search_network', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid, value: a.value || a.text || '' };
      break;
    case 'click_send':
      step = { order: stepOrder, action: 'click_send', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid, text: '发送' };
      break;
    case 'click_receive':
      step = { order: stepOrder, action: 'click_receive', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid, text: '接收' };
      break;
    case 'select_in_modal':
      step = { order: stepOrder, action: 'select_token', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid, param: a.text?.substring(0, 20) };
      break;
    case 'open_contacts':
      step = { order: stepOrder, action: 'open_contacts', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'contacts_popover_action':
      step = { order: stepOrder, action: 'select_from_contacts', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid, text: a.text?.substring(0, 20) };
      break;
    case 'click_amount_input':
      step = { order: stepOrder, action: 'focus_amount', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
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
      step = { order: stepOrder, action: 'click_max', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'click_preview_or_confirm':
      step = { order: stepOrder, action: 'click_preview', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'click_cancel':
      step = { order: stepOrder, action: 'click_cancel', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'nav_back':
      step = { order: stepOrder, action: 'nav_back', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
      break;
    case 'nav_close':
      step = { order: stepOrder, action: 'nav_close', semantic_element: c.semanticKey, ui_element: c.uiElement, raw_testid: a.testid };
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

  const compiled = compileStepLocator(step);
  step.resolution = compiled.resolution;
  step.compiled_locator = compiled.compiled_locator;

  proposedSteps.push(step);
  const semanticStr = step.semantic_element ? ` semantic="${step.semantic_element}"` : '';
  const resolutionStr = step.resolution?.strategy ? ` via=${step.resolution.strategy}` : '';
  const uiStr = step.ui_element ? ` ui="${step.ui_element}"` : (step.raw_testid ? ` raw="${step.raw_testid}"` : '');
  const paramStr = step.param ? ` param="${step.param}"` : (step.value ? ` value="${step.value}"` : (step.text ? ` text="${step.text}"` : ''));
  console.log(`    ${String(step.order).padStart(3)}.  ${step.action.padEnd(24)}${semanticStr}${uiStr}${paramStr}${resolutionStr}`);
}

console.log('');

const compiledStats = {
  semantic: proposedSteps.filter((s) => s.resolution?.strategy === 'semantic').length,
  legacyUiMap: proposedSteps.filter((s) => s.resolution?.strategy === 'legacy-ui-map').length,
  appTestidIndex: proposedSteps.filter((s) => s.resolution?.strategy === 'app-testid-index').length,
  unresolved: proposedSteps.filter((s) => s.resolution?.strategy === 'unresolved').length,
};

console.log('  ── Compiled Locator Summary ──');
console.log('');
console.log(`    semantic:        ${compiledStats.semantic}`);
console.log(`    legacy-ui-map:   ${compiledStats.legacyUiMap}`);
console.log(`    app-testid-index:${compiledStats.appTestidIndex}`);
console.log(`    unresolved:      ${compiledStats.unresolved}`);
console.log('');

const newElements = Object.fromEntries(newTestids);
const newElementBuckets = {
  semanticCandidates: {},
  indexedOnly: {},
  unresolved: {},
};
for (const [tid, info] of Object.entries(newElements)) {
  const bucket = classifyNewElement(tid, info);
  if (bucket === 'semantic-candidate') newElementBuckets.semanticCandidates[tid] = info;
  else if (bucket === 'indexed-only') newElementBuckets.indexedOnly[tid] = info;
  else newElementBuckets.unresolved[tid] = info;
}

if (newTestids.size > 0) {
  console.log('  ── New Elements (not in ui-map.json / ui-semantic-map.json) ──');
  console.log('');
  for (const [tid, info] of newTestids) {
    const suggested = info.recommendedSemanticKey ? `  suggested=${info.recommendedSemanticKey}` : '';
    const bucket = classifyNewElement(tid, info);
    console.log(`    ${tid}  (${info.tag}, ${info.count}x)  text="${info.text}"  bucket=${bucket}${suggested}`);
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
  appTestIdIndexElements: Object.keys(indexedTestIds).length,
  compiledStats,
  proposedSteps,
  newElements,
  newElementBuckets,
  route: classified.map((c) => ({ intent: c.intent, semanticKey: c.semanticKey || null, testid: c.action.testid || null })),
};

const outputPath = resolve(RECORDING_DIR, 'generated.json');
writeFileSync(outputPath, JSON.stringify(output, null, 2));
console.log(`  Generated: ${outputPath}`);

if (shouldApply) {
  console.log('');
  console.log(`  --apply: Writing to ${testCasesPath} ...`);

  const testCasesData = JSON.parse(readFileSync(testCasesPath, 'utf-8'));
  const cases = testCasesData.cases || [];
  const matcher = (c) => (applyCaseId && c.id === applyCaseId) || (applyScenarioId && c.scenarioId === applyScenarioId);
  const existingIndex = cases.findIndex(matcher);

  if (existingIndex >= 0) {
    const existing = cases[existingIndex];
    const updated = {
      ...existing,
      steps: proposedSteps.map((step) => ({
        ...step,
        description: step.description || existing.steps?.find((s) => s.order === step.order)?.description || `Updated from recording: ${step.action}`,
      })),
      recording: {
        ...(existing.recording || {}),
        source: relative(REPO_ROOT, resolve(RECORDING_DIR, 'steps.json')),
        generated: relative(REPO_ROOT, resolve(RECORDING_DIR, 'generated.json')),
        date: new Date().toISOString().slice(0, 10),
        rawSteps: String(steps.length),
        applyMode: 'updated-from-recording',
      },
    };
    cases[existingIndex] = updated;
    testCasesData.lastUpdated = new Date().toISOString();
    writeFileSync(testCasesPath, JSON.stringify(testCasesData, null, 2));
    console.log(`  Updated existing case: ${updated.id} (${updated.scenarioId})`);
  } else {
    const draftCase = buildDraftCase({ cases, recordingDir: RECORDING_DIR, proposedSteps });
    cases.push(draftCase);
    testCasesData.cases = cases;
    testCasesData.lastUpdated = new Date().toISOString();
    writeFileSync(testCasesPath, JSON.stringify(testCasesData, null, 2));
    console.log(`  Appended draft case: ${draftCase.id} (${draftCase.scenarioId})`);
  }
}

console.log('');
console.log('  Selector compile order:');
console.log('    1. shared/ui-semantic-map.json');
console.log('    2. shared/ui-map.json');
console.log('    3. shared/generated/app-monorepo-testid-index.json');
console.log('    4. unresolved → human review');
console.log('');
console.log('  Complete pipeline:');
console.log('    1. node src/recorder/listen.mjs    # Record your clicks');
console.log('    2. node src/recorder/review.mjs    # Review steps + screenshots');
console.log('    3. node src/recorder/generate.mjs  # Generate semantic-aware compiled route');
console.log('    4. Agent reviews generated.json → updates test_cases.json + ui-map/ui-semantic-map');
console.log('');
