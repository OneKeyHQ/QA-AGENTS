// reconcile.mjs — Post-recording element reconciliation
// Compares recorded steps against ui-map.json + ui-semantic-map.json
// Detects: new elements, renamed testids, disappeared elements
// Outputs a diff report for user confirmation before updating maps
//
// Usage:
//   import { reconcile } from './reconcile.mjs';
//   const report = await reconcile();           // uses default steps.json
//   const report = await reconcile(stepsArray); // pass steps directly

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STEPS_PATH = resolve(import.meta.dirname, '../../shared/results/recording/steps.json');
const UI_MAP_PATH = resolve(import.meta.dirname, '../../shared/ui-map.json');
const SEMANTIC_MAP_PATH = resolve(import.meta.dirname, '../../shared/ui-semantic-map.json');

// ── Helpers ─────────────────────────────────────────────────

function loadJSON(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Score how likely two testids refer to the same element (0..1).
 * Uses token overlap: split by - _ . and compare shared tokens.
 * "account-selector-trigger" vs "account-selector-btn" → 0.67 (2/3 shared)
 * "home" vs "wallet-hd-5" → 0.0
 */
function testidSimilarity(a, b) {
  const tokenize = (s) => s.toLowerCase().replace(/([A-Z])/g, '-$1').split(/[-_.]+/).filter(Boolean);
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setB = new Set(tokensB);
  let shared = 0;
  for (const t of tokensA) {
    if (setB.has(t)) shared++;
  }
  // Jaccard-like: shared / max(len) — biased toward requiring meaningful overlap
  return shared / Math.max(tokensA.length, tokensB.length);
}

/** Extract the raw testid string from a selector like [data-testid="xxx"] */
function selectorToTestid(sel) {
  const m = sel.match(/data-testid="([^"]+)"/);
  return m ? m[1] : null;
}

/** Build a reverse index: testid → { source, elementName, selector, page, feature } */
function buildKnownIndex(uiMap, semanticMap) {
  const index = new Map(); // testid → info

  // ui-map entries
  if (uiMap?.elements) {
    for (const [name, entry] of Object.entries(uiMap.elements)) {
      const tid = selectorToTestid(entry.primary);
      if (tid) {
        index.set(tid, {
          source: 'ui-map',
          elementName: name,
          selector: entry.primary,
          page: entry.page || '',
          platform: entry.platform || [],
          fallbacks: entry.quick_fallbacks || [],
        });
      }
      // Also index fallback testids
      for (const fb of (entry.quick_fallbacks || [])) {
        const fbTid = selectorToTestid(fb);
        if (fbTid && !index.has(fbTid)) {
          index.set(fbTid, {
            source: 'ui-map-fallback',
            elementName: name,
            selector: fb,
            page: entry.page || '',
            platform: entry.platform || [],
            fallbacks: [],
          });
        }
      }
    }
  }

  // semantic-map entries
  if (semanticMap?.elements) {
    for (const [name, entry] of Object.entries(semanticMap.elements)) {
      const tid = entry.source_testid || selectorToTestid(entry.primary);
      if (tid && !index.has(tid)) {
        index.set(tid, {
          source: 'semantic-map',
          elementName: name,
          selector: entry.primary,
          page: entry.page || '',
          platform: entry.platform || [],
          fallbacks: [],
        });
      }
    }
  }

  return index;
}

// ── Core reconciliation ─────────────────────────────────────

/**
 * @typedef {Object} ReconcileChange
 * @property {'new'|'moved'|'renamed'|'conflict'} type
 * @property {string} recordedTestid - testid captured during recording
 * @property {string} recordedText   - visible text at the time of recording
 * @property {string} recordedTag    - HTML tag
 * @property {{x:number,y:number,w:number,h:number}} recordedRect - bounding rect
 * @property {string} [mapElementName]  - existing element name in map (for conflicts)
 * @property {string} [mapTestid]       - existing testid in map (for conflicts)
 * @property {string} [mapSource]       - which map file ('ui-map' | 'semantic-map')
 * @property {number} stepNumber        - step # in the recording
 * @property {string} action            - 'click' | 'input' | 'scroll'
 */

/**
 * Run reconciliation between recorded steps and existing map files.
 * @param {Array} [stepsOverride] - pass steps directly; if omitted, reads steps.json
 * @returns {{ changes: ReconcileChange[], matched: object[], summary: object }}
 */
export function reconcile(stepsOverride) {
  const steps = stepsOverride || loadJSON(STEPS_PATH);
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return { changes: [], matched: [], summary: { total: 0, matched: 0, new: 0, conflict: 0 } };
  }

  const uiMap = loadJSON(UI_MAP_PATH);
  const semanticMap = loadJSON(SEMANTIC_MAP_PATH);
  const knownIndex = buildKnownIndex(uiMap, semanticMap);

  // Deduplicate: group by testid, keep first occurrence with richest info
  const seen = new Map(); // testid → step info
  for (const step of steps) {
    if (!step.testid) continue;
    if (!seen.has(step.testid)) {
      seen.set(step.testid, step);
    }
  }

  const changes = [];
  const matched = [];

  for (const [testid, step] of seen) {
    const known = knownIndex.get(testid);

    if (known) {
      // This testid is in our maps — it's a match
      matched.push({
        testid,
        elementName: known.elementName,
        source: known.source,
        text: step.text,
        tag: step.tag,
        rect: step.rect,
        step: step.step,
      });
    } else {
      // This testid is NOT in any map — check if it might be a rename
      // Heuristic: look for a known element at a similar position (within 50px)
      // that was NOT matched by any other recorded step
      let possibleRename = null;
      for (const [knownTid, info] of knownIndex) {
        // Skip testids that were already matched in this recording
        if (seen.has(knownTid)) continue;
        // Skip if from a different page context (heuristic: sidebar elements stay in sidebar)
        // We can't be too strict here since we don't always know the page
        possibleRename = null; // position matching needs runtime data we don't have statically
        break;
      }

      changes.push({
        type: 'new',
        recordedTestid: testid,
        recordedText: step.text || '',
        recordedTag: step.tag || '',
        recordedRect: step.rect || {},
        action: step.type,
        stepNumber: step.step,
      });
    }
  }

  // Check for elements in ui-map that are "expected" in the same page context
  // but were NOT seen during recording. These might have been renamed or removed.
  // We detect this by looking at map elements whose page matches any recorded step's context.
  const recordedPages = new Set();
  for (const [testid] of seen) {
    const known = knownIndex.get(testid);
    if (known?.page) recordedPages.add(known.page);
  }

  // For each page that was touched during recording, find map elements on that page
  // that were NOT seen in the recording
  const missing = [];
  for (const [knownTid, info] of knownIndex) {
    if (info.source === 'ui-map-fallback') continue; // skip fallback entries
    if (seen.has(knownTid)) continue; // was recorded — not missing
    if (info.page && recordedPages.has(info.page)) {
      missing.push({
        testid: knownTid,
        elementName: info.elementName,
        source: info.source,
        page: info.page,
      });
    }
  }

  // Cross-reference: try to pair each NEW testid with a MISSING testid
  // that looks like a plausible rename (shared prefix, similar structure).
  // Each missing element can only be claimed once.
  const claimedMissing = new Set();

  for (const change of changes) {
    let bestMatch = null;
    let bestScore = 0;

    for (let i = 0; i < missing.length; i++) {
      if (claimedMissing.has(i)) continue;
      const miss = missing[i];

      // Score the similarity between recorded testid and missing testid
      const score = testidSimilarity(change.recordedTestid, miss.testid);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = { index: i, miss };
      }
    }

    // Only flag as conflict if similarity is high enough (> 0.5)
    // This catches renames like "old-btn" → "new-old-btn" but not random matches
    if (bestMatch && bestScore > 0.5) {
      change.type = 'conflict';
      change.mapElementName = bestMatch.miss.elementName;
      change.mapTestid = bestMatch.miss.testid;
      change.mapSource = bestMatch.miss.source;
      change.similarityScore = bestScore;
      claimedMissing.add(bestMatch.index);
    }
  }

  const summary = {
    total: seen.size,
    matched: matched.length,
    new: changes.filter(c => c.type === 'new').length,
    conflict: changes.filter(c => c.type === 'conflict').length,
  };

  return { changes, matched, missing, summary };
}

// ── Report formatting ───────────────────────────────────────

/**
 * Format reconciliation result as a human-readable report.
 * @returns {string} Markdown-formatted report
 */
export function formatReport(result) {
  const { changes, matched, missing, summary } = result;
  const lines = [];

  lines.push('# 录制对账报告\n');
  lines.push(`录制步骤中共发现 **${summary.total}** 个不同的 testid：`);
  lines.push(`- 已匹配（map 中已有）：${summary.matched}`);
  lines.push(`- 需确认（新增/冲突）：${changes.length}`);
  lines.push('');

  // Coverage analysis: which recorded steps hit existing components
  const { coveredSteps, uncoveredSteps } = postRecordingCoverage(
    // Reconstruct steps from matched + changes
    [...matched.map(m => ({ testid: m.testid, text: m.text, tag: m.tag, step: m.step, type: 'click' })),
     ...changes.map(c => ({ testid: c.recordedTestid, text: c.recordedText, tag: c.recordedTag, step: c.stepNumber, type: c.action }))]
  );

  if (coveredSteps.length > 0) {
    lines.push(`其中 **${coveredSteps.length}** 个元素已有公共组件覆盖，生成脚本时可直接调用（无需手动编写定位逻辑）。`);
    lines.push('');
  }

  if (changes.length === 0 && (!missing || missing.length === 0)) {
    lines.push('> 所有录制元素与现有 map 一致，无需更新。\n');
    return lines.join('\n');
  }

  // Section 1: Changes requiring confirmation
  if (changes.length > 0) {
    lines.push('## 需要确认的变更\n');

    for (let i = 0; i < changes.length; i++) {
      const c = changes[i];
      const num = i + 1;

      if (c.type === 'conflict') {
        lines.push(`### 变更 ${num}：疑似元素替换 ⚠️`);
        lines.push(`- **录制捕获**: \`${c.recordedTestid}\` (${c.recordedTag}, text="${c.recordedText}", step #${c.stepNumber})`);
        lines.push(`- **现有 map**: \`${c.mapTestid}\` → 元素名 \`${c.mapElementName}\` (来源: ${c.mapSource})`);
        lines.push(`- **操作类型**: ${c.action}`);
        lines.push(`- **位置**: x=${c.recordedRect.x}, y=${c.recordedRect.y}, ${c.recordedRect.w}×${c.recordedRect.h}`);
        lines.push('');
        lines.push('**请确认：**');
        lines.push(`1. 是否使用新元素 \`${c.recordedTestid}\` 替换旧的 \`${c.mapTestid}\`？`);
        lines.push(`2. 新录制的元素 \`${c.recordedTestid}\` 是否准确定位到了目标功能？`);
      } else {
        lines.push(`### 变更 ${num}：新增元素`);
        lines.push(`- **录制捕获**: \`${c.recordedTestid}\` (${c.recordedTag}, text="${c.recordedText}", step #${c.stepNumber})`);
        lines.push(`- **操作类型**: ${c.action}`);
        lines.push(`- **位置**: x=${c.recordedRect.x}, y=${c.recordedRect.y}, ${c.recordedRect.w}×${c.recordedRect.h}`);
        lines.push('');
        lines.push('**请确认：**');
        lines.push(`1. 是否将 \`${c.recordedTestid}\` 加入 ui-semantic-map？`);
        lines.push(`2. 录制的元素是否准确（testid、位置、功能是否匹配）？`);
      }
      lines.push('');
    }
  }

  // Section 2: Missing elements (in map but not seen during recording)
  if (missing && missing.length > 0) {
    lines.push('## 参考：同页面未出现的已知元素\n');
    lines.push('以下元素在 map 中注册且属于本次录制涉及的页面，但录制过程中未被触发。');
    lines.push('这不一定表示异常（可能只是本次录制未覆盖到），仅供参考。\n');
    lines.push('| 元素名 | testid | 来源 | 页面 |');
    lines.push('|--------|--------|------|------|');
    for (const m of missing.slice(0, 20)) {
      lines.push(`| ${m.elementName} | \`${m.testid}\` | ${m.source} | ${m.page} |`);
    }
    if (missing.length > 20) {
      lines.push(`| ... | 还有 ${missing.length - 20} 个 | | |`);
    }
    lines.push('');
  }

  // Section 3: Matched elements (for reference)
  if (matched.length > 0) {
    lines.push('<details><summary>已匹配元素（无需操作）</summary>\n');
    lines.push('| testid | 元素名 | 来源 | 录制文本 |');
    lines.push('|--------|--------|------|----------|');
    for (const m of matched) {
      lines.push(`| \`${m.testid}\` | ${m.elementName} | ${m.source} | ${m.text?.substring(0, 30) || ''} |`);
    }
    lines.push('\n</details>\n');
  }

  return lines.join('\n');
}

// ── Apply confirmed changes ─────────────────────────────────

/**
 * Apply user-confirmed changes to map files.
 * @param {ReconcileChange[]} confirmedChanges - changes the user approved
 * @param {Object} opts
 * @param {boolean} opts.dryRun - if true, don't write files, just return what would change
 * @returns {{ updatedUiMap: boolean, updatedSemantic: boolean, details: string[] }}
 */
export function applyChanges(confirmedChanges, opts = {}) {
  const details = [];
  let updatedUiMap = false;
  let updatedSemantic = false;

  if (!confirmedChanges || confirmedChanges.length === 0) {
    return { updatedUiMap, updatedSemantic, details: ['No changes to apply.'] };
  }

  const uiMap = loadJSON(UI_MAP_PATH);
  const semanticMap = loadJSON(SEMANTIC_MAP_PATH);

  for (const change of confirmedChanges) {
    if (change.type === 'conflict' && change.mapTestid) {
      // Replace: update the existing element's primary selector
      const newSel = `[data-testid="${change.recordedTestid}"]`;

      // Update ui-map if the old element was there
      if (uiMap?.elements) {
        for (const [name, entry] of Object.entries(uiMap.elements)) {
          const tid = selectorToTestid(entry.primary);
          if (tid === change.mapTestid) {
            // Keep old selector as first fallback for transition period
            if (!entry.quick_fallbacks) entry.quick_fallbacks = [];
            if (!entry.quick_fallbacks.includes(entry.primary)) {
              entry.quick_fallbacks.unshift(entry.primary);
            }
            entry.primary = newSel;
            entry.last_verified = new Date().toISOString();
            updatedUiMap = true;
            details.push(`ui-map: ${name} primary 更新 ${change.mapTestid} → ${change.recordedTestid}（旧值保留为 fallback）`);
            break;
          }
        }
      }

      // Update semantic-map if the old element was there
      if (semanticMap?.elements) {
        for (const [name, entry] of Object.entries(semanticMap.elements)) {
          if (entry.source_testid === change.mapTestid) {
            entry.primary = newSel;
            entry.source_testid = change.recordedTestid;
            entry.last_verified = new Date().toISOString();
            updatedSemantic = true;
            details.push(`semantic-map: ${name} 更新 ${change.mapTestid} → ${change.recordedTestid}`);
            break;
          }
        }
      }
    } else if (change.type === 'new') {
      // Add new element to semantic-map only (ui-map needs manual structuring)
      if (semanticMap?.elements) {
        // Generate a semantic name from the testid
        const semName = change.recordedTestid
          .replace(/-/g, '_')
          .replace(/([A-Z])/g, '_$1')
          .toLowerCase()
          .replace(/__+/g, '_')
          .replace(/^_/, '');

        // Don't overwrite existing entries
        if (!semanticMap.elements[semName]) {
          semanticMap.elements[semName] = {
            primary: `[data-testid="${change.recordedTestid}"]`,
            source_testid: change.recordedTestid,
            source: 'recording',
            recorded_text: change.recordedText || '',
            recorded_tag: change.recordedTag || '',
            last_verified: new Date().toISOString(),
          };
          updatedSemantic = true;
          details.push(`semantic-map: 新增 ${semName} → ${change.recordedTestid}`);
        }
      }
    }
  }

  // Write files
  if (!opts.dryRun) {
    if (updatedUiMap && uiMap) {
      uiMap.lastUpdated = new Date().toISOString();
      writeFileSync(UI_MAP_PATH, JSON.stringify(uiMap, null, 2) + '\n');
      details.push('✓ ui-map.json 已更新');
    }
    if (updatedSemantic && semanticMap) {
      semanticMap.lastUpdated = new Date().toISOString();
      writeFileSync(SEMANTIC_MAP_PATH, JSON.stringify(semanticMap, null, 2) + '\n');
      details.push('✓ ui-semantic-map.json 已更新');
    }
  }

  return { updatedUiMap, updatedSemantic, details };
}

// ── Pre-recording advice ────────────────────────────────────

/**
 * Catalog of reusable component functions that cover common operations.
 * Each entry: { fn, description, coversTestids[] }
 * Used by preRecordingAdvice() to tell users which steps they can skip.
 */
const COMPONENT_CATALOG = [
  {
    fn: 'clickSidebarTab(page, name)',
    description: '侧栏导航（Home/Wallet/Market/Swap/Perps/DeFi/Discover/Browser/Device/Menu）',
    coversTestids: ['Desktop-AppSideBar-Content-Container', 'home', 'tab-home'],
    coversActions: ['click sidebar tab', '点击侧栏'],
  },
  {
    fn: 'openSearchModal(page)',
    description: '打开搜索弹窗',
    coversTestids: ['nav-header-search', 'APP-Modal-Screen'],
    coversActions: ['open search', '打开搜索'],
  },
  {
    fn: 'typeSearch(page, value)',
    description: '在搜索弹窗中输入',
    coversTestids: ['nav-header-search'],
    coversActions: ['type in search', '搜索输入'],
  },
  {
    fn: 'clearSearch(page) / closeSearch(page)',
    description: '清空搜索 / 关闭搜索弹窗',
    coversTestids: ['-clear', 'nav-header-close'],
    coversActions: ['clear search', 'close search'],
  },
  {
    fn: 'closeModal(page) / closeAllModals(page)',
    description: '关闭弹窗',
    coversTestids: ['nav-header-close', 'APP-Modal-Screen', 'app-modal-stacks-backdrop'],
    coversActions: ['close modal', '关闭弹窗'],
  },
  {
    fn: 'dismissOverlays(page) / dismissPopover(page)',
    description: '关闭遮罩层/气泡弹窗',
    coversTestids: ['ovelay-popover', 'app-modal-stacks-backdrop', 'TMPopover-ScrollView'],
    coversActions: ['dismiss overlay', 'dismiss popover'],
  },
  {
    fn: 'unlockIfNeeded(page)',
    description: '检测并自动解锁钱包',
    coversTestids: ['password-input', 'page-footer-confirm'],
    coversActions: ['unlock wallet', '解锁钱包', 'enter password'],
  },
  {
    fn: 'handlePasswordPrompt(page)',
    description: '处理密码验证弹窗',
    coversTestids: ['password-input', 'verifying-password'],
    coversActions: ['password prompt', '密码验证'],
  },
  {
    fn: 'switchToAccount(page, name, walletType)',
    description: '切换账户（支持按钱包类型+账户名查找）',
    coversTestids: ['AccountSelectorTriggerBase', 'account-selector-wallet-list', 'account-selector-accountList'],
    coversActions: ['switch account', '切换账户'],
  },
  {
    fn: 'goBackToMainPage(page)',
    description: '返回主页（点击 nav-header-back）',
    coversTestids: ['nav-header-back'],
    coversActions: ['go back', '返回'],
  },
  {
    fn: 'openNetworkSelector(page) / selectNetwork(page, name)',
    description: '打开网络选择器 / 选择网络',
    coversTestids: ['account-network-trigger-button', 'account-network-trigger-button-text'],
    coversActions: ['select network', '选择网络'],
  },
  {
    fn: 'scrollToTop(page)',
    description: '滚动页面到顶部',
    coversTestids: [],
    coversActions: ['scroll to top', '滚动到顶部'],
  },
];

/**
 * Given a list of planned test steps (from test case doc), return advice
 * on which steps are already covered by component library and can be skipped
 * during recording.
 *
 * @param {string[]} plannedSteps - descriptions of planned test steps
 * @returns {{ skipSteps: Array<{step: string, coveredBy: string, description: string}>, recordSteps: string[] }}
 */
export function preRecordingAdvice(plannedSteps) {
  const skipSteps = [];
  const recordSteps = [];

  for (const step of plannedSteps) {
    const lower = step.toLowerCase();
    let covered = false;

    for (const comp of COMPONENT_CATALOG) {
      const actionMatch = comp.coversActions.some(a => lower.includes(a.toLowerCase()));
      if (actionMatch) {
        skipSteps.push({
          step,
          coveredBy: comp.fn,
          description: comp.description,
        });
        covered = true;
        break;
      }
    }

    if (!covered) recordSteps.push(step);
  }

  return { skipSteps, recordSteps };
}

/**
 * Given recorded steps, identify which ones overlap with existing components
 * and can be auto-generated instead of recorded.
 * This runs AFTER recording to tell the user what could have been skipped.
 *
 * @param {Array} steps - recorded steps from steps.json
 * @returns {{ coveredSteps: Array, uncoveredSteps: Array }}
 */
export function postRecordingCoverage(steps) {
  if (!steps || steps.length === 0) return { coveredSteps: [], uncoveredSteps: [] };

  const coveredSteps = [];
  const uncoveredSteps = [];

  for (const step of steps) {
    if (!step.testid) {
      uncoveredSteps.push(step);
      continue;
    }

    let covered = false;
    for (const comp of COMPONENT_CATALOG) {
      if (comp.coversTestids.includes(step.testid)) {
        coveredSteps.push({
          step: step.step,
          testid: step.testid,
          text: step.text,
          type: step.type,
          coveredBy: comp.fn,
          description: comp.description,
        });
        covered = true;
        break;
      }
    }

    if (!covered) uncoveredSteps.push(step);
  }

  return { coveredSteps, uncoveredSteps };
}

/**
 * Format pre-recording advice as markdown.
 */
export function formatPreAdvice(plannedSteps) {
  const { skipSteps, recordSteps } = preRecordingAdvice(plannedSteps);
  const lines = [];

  lines.push('# 录制前分析：哪些步骤可以跳过\n');

  if (skipSteps.length > 0) {
    lines.push(`## 可跳过的步骤（${skipSteps.length} 个，已有组件覆盖）\n`);
    lines.push('以下步骤已由公共组件实现，**不需要录制**，脚本生成时会自动调用对应函数：\n');
    lines.push('| 步骤 | 替代函数 | 说明 |');
    lines.push('|------|----------|------|');
    for (const s of skipSteps) {
      lines.push(`| ${s.step} | \`${s.coveredBy}\` | ${s.description} |`);
    }
    lines.push('');
  }

  if (recordSteps.length > 0) {
    lines.push(`## 需要录制的步骤（${recordSteps.length} 个）\n`);
    lines.push('以下步骤没有现成组件，需要你在 app 上操作录制：\n');
    for (let i = 0; i < recordSteps.length; i++) {
      lines.push(`${i + 1}. ${recordSteps[i]}`);
    }
    lines.push('');
  }

  if (skipSteps.length > 0) {
    lines.push(`> 总计 ${skipSteps.length + recordSteps.length} 个步骤中，${skipSteps.length} 个可自动生成，只需录制 ${recordSteps.length} 个。`);
  }

  return lines.join('\n');
}

// ── CLI entry point ─────────────────────────────────────────

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const result = reconcile();
  console.log(formatReport(result));

  if (result.changes.length > 0) {
    console.log('\n---');
    console.log('请确认后使用 applyChanges() 应用变更，或手动编辑 map 文件。');
    console.log(`共 ${result.changes.length} 项变更待确认。`);
  }
}
