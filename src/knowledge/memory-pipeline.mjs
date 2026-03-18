// Three-Phase Memory Pipeline for OneKey Agent Testing
// Phase 1: Event Slicing  — TestResult → MemCell
// Phase 2: Semantic Clustering — MemCells → MemScenes
// Phase 3: Intelligent Recall — Query → Relevant scenes + reasoning
// Phase 4: Intent Validation — Pre-validates test cases for conflicts

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SHARED_DIR = resolve(import.meta.dirname, '../../shared');
const read = (file) => JSON.parse(readFileSync(resolve(SHARED_DIR, file), 'utf-8'));
const write = (file, data) => writeFileSync(resolve(SHARED_DIR, file), JSON.stringify(data, null, 2));

// ────────────────────────────────────────────
// Phase 1: Event Slicing — TestResult → MemCell
// ────────────────────────────────────────────

export function createMemCell(testResult, stepDetail = {}) {
  const cells = read('mem_cells.json');
  const nextId = cells.cells.length + 1;

  const cell = {
    id: `mc-${String(nextId).padStart(4, '0')}`,
    timestamp: new Date().toISOString(),
    platform: stepDetail.platform || 'desktop',
    yaml_id: testResult.testId,
    status: testResult.status,
    screenshot_hash: stepDetail.screenshot_hash || null,
    error_type: classifyError(testResult.error),
    selector_used: stepDetail.selector_used || null,
    selector_success: stepDetail.selector_success ?? null,
    fallback_used: stepDetail.fallback_used || null,
    fallback_success: stepDetail.fallback_success ?? null,
    duration_ms: testResult.duration,
    step_index: stepDetail.step_index ?? null,
    error_message: testResult.error || null,
  };

  cells.cells.push(cell);
  write('mem_cells.json', cells);
  return cell;
}

function classifyError(errorMsg) {
  if (!errorMsg) return null;
  const msg = errorMsg.toLowerCase();
  if (msg.includes('timeout')) return 'timeout';
  if (msg.includes('modal') || msg.includes('overlay') || msg.includes('intercept')) return 'modal_overlay';
  if (msg.includes('not found') || msg.includes('no element')) return 'element_not_found';
  if (msg.includes('selector') || msg.includes('stale') || msg.includes('detach')) return 'selector_stale';
  if (msg.includes('network') || msg.includes('disconnect')) return 'network_mismatch';
  if (msg.includes('assert') || msg.includes('expect')) return 'assertion_failed';
  if (msg.includes('drift') || msg.includes('navigate')) return 'state_drift';
  return 'unknown';
}

// ────────────────────────────────────────────
// Phase 2: Semantic Clustering — MemCells → MemScenes
// ────────────────────────────────────────────

export function clusterMemScenes() {
  const cells = read('mem_cells.json').cells;
  const scenes = read('mem_scenes.json');

  // Group failed cells by (platform, error_type)
  const groups = {};
  for (const c of cells) {
    if (c.status !== 'failed' || !c.error_type) continue;
    const key = `${c.platform}::${c.error_type}`;
    (groups[key] ??= []).push(c);
  }

  let sceneCounter = scenes.scenes.length;

  for (const [key, groupCells] of Object.entries(groups)) {
    if (groupCells.length < 2) continue;

    const [platform, errorType] = key.split('::');
    const existing = scenes.scenes.find(
      s => s.name.includes(errorType) && s.name.includes(platform)
    );

    if (existing) {
      existing.cluster_size = groupCells.length;
      existing.last_seen = groupCells.at(-1).timestamp;
      existing.related_cells = groupCells.map(c => c.id);
      existing.confidence = calcConfidence(groupCells);
      existing.resolution = detectResolution(groupCells) || existing.resolution;
    } else {
      scenes.scenes.push({
        id: `ms-${String(++sceneCounter).padStart(3, '0')}`,
        name: `${platform} ${errorType} cluster`,
        cluster_size: groupCells.length,
        first_seen: groupCells[0].timestamp,
        last_seen: groupCells.at(-1).timestamp,
        pattern: detectPattern(groupCells),
        resolution: detectResolution(groupCells),
        confidence: calcConfidence(groupCells),
        related_cells: groupCells.map(c => c.id),
      });
    }
  }

  write('mem_scenes.json', scenes);
  return scenes;
}

function calcConfidence(cells) {
  return Math.min(0.99, 0.5 + cells.length * 0.05);
}

function detectPattern(cells) {
  const msgCounts = {};
  for (const c of cells) {
    if (!c.error_message) continue;
    const key = c.error_message.substring(0, 60);
    msgCounts[key] = (msgCounts[key] || 0) + 1;
  }
  const sorted = Object.entries(msgCounts).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || 'Unknown pattern';
}

function detectResolution(cells) {
  for (const c of cells) {
    if (c.fallback_used && c.fallback_success) {
      return `Fallback works: ${c.fallback_used}`;
    }
  }
  return null;
}

// ────────────────────────────────────────────
// Phase 3: Intelligent Recall
// ────────────────────────────────────────────

export function recallForTest(testId) {
  const cells = read('mem_cells.json').cells;
  const scenes = read('mem_scenes.json').scenes;

  const testCells = cells.filter(c => c.yaml_id === testId);
  if (testCells.length === 0) {
    return { query: testId, relevant_scenes: [], reasoning: 'No history for this test.' };
  }

  const lastFailure = testCells.filter(c => c.status === 'failed').at(-1);
  if (!lastFailure) {
    return { query: testId, relevant_scenes: [], reasoning: 'No failures recorded.' };
  }

  const matched = scenes.filter(s =>
    s.related_cells.some(id => testCells.some(c => c.id === id)) ||
    (lastFailure.error_type && s.name.includes(lastFailure.error_type))
  );

  return {
    query: `Why did ${testId} fail?`,
    relevant_scenes: matched.map(s => s.id),
    reasoning: matched.length > 0
      ? `Matches ${matched.length} scene(s): ${matched.map(s =>
          `"${s.name}" (${s.cluster_size} occurrences, ${(s.confidence * 100).toFixed(0)}% confidence)`
        ).join(', ')}. ${matched[0].resolution ? `Known resolution: ${matched[0].resolution}` : 'No resolution yet.'}`
      : `Error type "${lastFailure.error_type}" has no matching scene yet.`,
    suggested_fix: matched.find(s => s.resolution)?.resolution || null,
  };
}

// ────────────────────────────────────────────
// Phase 4: Intent Validation — Pre-validates test cases
// ────────────────────────────────────────────

export function validateTestCase(testCase) {
  const issues = [];
  const uiMap = read('ui-map.json');
  const scenes = read('mem_scenes.json');

  // 1. Check if strategies are defined
  if (!testCase.strategies || testCase.strategies.length === 0) {
    issues.push({ severity: 'warning', message: 'No strategies defined, will use default single-direction' });
  }

  // 2. Check if strategies reference valid account names
  for (const strategy of (testCase.strategies || [])) {
    if (!strategy.sender) {
      issues.push({ severity: 'error', message: `Strategy "${strategy.label}" missing sender` });
    }
    if (!strategy.recipient) {
      issues.push({ severity: 'error', message: `Strategy "${strategy.label}" missing recipient` });
    }
    if (strategy.sender === strategy.recipient) {
      issues.push({ severity: 'error', message: `Strategy "${strategy.label}" has same sender and recipient: ${strategy.sender}` });
    }
  }

  // 3. Check if required UI elements exist in ui-map
  const requiredElements = [
    'sidebarHome', 'walletSelector', 'networkButton', 'networkButtonText',
    'walletTabHeader', 'sendForm', 'contactsIcon', 'modal', 'chainSearchInput'
  ];
  for (const el of requiredElements) {
    if (!uiMap.elements[el]) {
      issues.push({ severity: 'error', message: `Required UI element "${el}" missing from ui-map` });
    }
  }

  // 4. Check selector health (success_rate < 0.5 = warning)
  const selectorHealth = {};
  for (const [name, el] of Object.entries(uiMap.elements)) {
    selectorHealth[name] = {
      success_rate: el.success_rate || 0,
      has_fallbacks: (el.quick_fallbacks || []).length > 0,
      deep_search_enabled: el.deep_search?.enabled || false,
    };
    if ((el.success_rate || 0) < 0.5) {
      issues.push({ severity: 'warning', message: `Selector "${name}" has low success rate: ${el.success_rate}` });
    }
  }

  // 5. Check for known conflicts in mem_scenes
  const knownConflicts = findKnownConflicts(testCase, scenes);
  if (knownConflicts.length > 0) {
    for (const conflict of knownConflicts) {
      issues.push({ severity: 'warning', message: `Known conflict: ${conflict.name} (${conflict.cluster_size} occurrences)` });
    }
  }

  // 6. Validate data fields
  if (!testCase.data?.network) {
    issues.push({ severity: 'error', message: 'Missing data.network' });
  }
  if (!testCase.data?.token) {
    issues.push({ severity: 'error', message: 'Missing data.token' });
  }
  if (!testCase.data?.amount) {
    issues.push({ severity: 'error', message: 'Missing data.amount' });
  }

  return {
    test_id: testCase.id,
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    selector_health: selectorHealth,
    known_conflicts: knownConflicts,
  };
}

function findKnownConflicts(testCase, scenes) {
  const scenesList = scenes.scenes || scenes;
  const conflicts = [];

  for (const scene of scenesList) {
    // Check if any related cells match this test case's network/token
    if (scene.name && testCase.data) {
      const network = testCase.data.network?.toLowerCase() || '';
      const token = testCase.data.token?.toLowerCase() || '';
      const sceneName = scene.name.toLowerCase();

      if (sceneName.includes(network) || sceneName.includes(token)) {
        conflicts.push(scene);
      }
    }

    // Check if this test case has had failures in scenes
    if (scene.related_cells && testCase.id) {
      // Cross-reference with mem_cells would need the cells data
      // For now, check if pattern mentions this test's error types
      if (scene.pattern?.includes(testCase.id)) {
        conflicts.push(scene);
      }
    }
  }

  return conflicts;
}

// ────────────────────────────────────────────
// UI Map helpers
// ────────────────────────────────────────────

export function getSelector(elementName) {
  const uiMap = read('ui-map.json');
  const el = uiMap.elements[elementName];
  if (!el) return null;
  return {
    primary: el.primary,
    quick_fallbacks: el.quick_fallbacks || [],
    deep_search: el.deep_search || { enabled: false },
  };
}

export function updateSelectorStats(elementName, success) {
  const uiMap = read('ui-map.json');
  const el = uiMap.elements[elementName];
  if (!el) return;

  const prev = el.success_rate || 0.5;
  el.success_rate = prev * 0.8 + (success ? 1 : 0) * 0.2;
  el.last_verified = new Date().toISOString();
  uiMap.lastUpdated = new Date().toISOString();
  write('ui-map.json', uiMap);
}

/**
 * Update tier_stats for a specific element and tier.
 * Called by Runner's resolve() to track which tier resolved the element.
 */
export function updateTierStats(elementName, tier) {
  const uiMap = read('ui-map.json');
  const el = uiMap.elements[elementName];
  if (!el || !el.tier_stats) return;

  el.tier_stats.total_attempts = (el.tier_stats.total_attempts || 0) + 1;

  if (tier === 'primary') {
    el.tier_stats.primary_hits = (el.tier_stats.primary_hits || 0) + 1;
  } else if (tier === 'quick') {
    el.tier_stats.quick_hits = (el.tier_stats.quick_hits || 0) + 1;
  } else if (tier === 'deep') {
    el.tier_stats.deep_hits = (el.tier_stats.deep_hits || 0) + 1;
  }

  // Also update success_rate (primary hit = success)
  const prev = el.success_rate || 0.5;
  el.success_rate = prev * 0.8 + (tier === 'primary' ? 1 : 0.5) * 0.2;
  el.last_verified = new Date().toISOString();
  uiMap.lastUpdated = new Date().toISOString();
  write('ui-map.json', uiMap);
}

// ────────────────────────────────────────────
// Profile helpers
// ────────────────────────────────────────────

export function updateProfile(platform, testResult) {
  const profile = read('profile.json');
  const p = profile.platforms[platform] ??= {
    total_runs: 0, pass_rate: 0,
    common_failures: [], reliable_selectors: [], unreliable_selectors: []
  };

  p.total_runs++;
  p.pass_rate = ((p.pass_rate * (p.total_runs - 1)) + (testResult.status === 'passed' ? 1 : 0)) / p.total_runs;

  if (testResult.error) {
    const errType = classifyError(testResult.error);
    if (errType && !p.common_failures.includes(errType)) {
      p.common_failures.push(errType);
      if (p.common_failures.length > 10) p.common_failures.shift();
    }
  }

  profile.lastUpdated = new Date().toISOString();
  write('profile.json', profile);
}
