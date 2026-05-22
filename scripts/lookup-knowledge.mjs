#!/usr/bin/env node
// Lookup knowledge entries from shared/knowledge.json by scenario / category / keyword / id.
//
// Usage:
//   node scripts/lookup-knowledge.mjs --scenario defi-channel-flow
//   node scripts/lookup-knowledge.mjs --scenario modal-flow,row-with-button   (多个用逗号)
//   node scripts/lookup-knowledge.mjs --id K-127
//   node scripts/lookup-knowledge.mjs --category locator --platform desktop
//   node scripts/lookup-knowledge.mjs --keyword "modal,confirm,signing"       (OR 匹配)
//   node scripts/lookup-knowledge.mjs --list                                  (列出所有 scenarios)
//   node scripts/lookup-knowledge.mjs --search "DeFi 持仓"                    (在 pattern+details 全文搜)
//
// 输出格式：Markdown，每条含 ID / category / platform / pattern / details。
// 用于：写 .test.mjs 前查相关知识；调试时快速找 K-NNN 解释；新 AI 会话热身。

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const KNOWLEDGE_PATH = resolve(import.meta.dirname, '../shared/knowledge.json');
if (!existsSync(KNOWLEDGE_PATH)) {
  console.error(`knowledge.json not found at ${KNOWLEDGE_PATH}`);
  process.exit(1);
}

const argv = process.argv.slice(2);
const opts = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) {
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      opts[key] = next;
      i++;
    } else {
      opts[key] = true;
    }
  }
}

const k = JSON.parse(readFileSync(KNOWLEDGE_PATH, 'utf8'));
const patterns = k.patterns || [];
const scenarios = k.scenarios || {};

function printScenarioList() {
  console.log('# 可用 scenarios（按场景查 knowledge）\n');
  const groups = {
    'DeFi 系列': [],
    '通用 UI 模式': [],
    '元素定位': [],
    '时序': [],
    '工作流': [],
    '工具/环境': [],
  };
  for (const [name, info] of Object.entries(scenarios)) {
    let group = '工作流';
    if (name.startsWith('defi-')) group = 'DeFi 系列';
    else if (['modal-flow', 'long-list-scroll', 'row-with-button', 'anchor-relative-text', 'tab-swiper'].includes(name)) group = '通用 UI 模式';
    else if (['testid-management', 'onekey-sidebar-nav', 'svg-click', 'rn-web-scroll-container'].includes(name)) group = '元素定位';
    else if (['case-prerequisites', 'tx-async-history', 'page-transition-timing'].includes(name)) group = '时序';
    else if (['dashboard-restart', 'recorder-resilience'].includes(name)) group = '工具/环境';
    groups[group].push({ name, ...info });
  }
  for (const [gname, items] of Object.entries(groups)) {
    if (items.length === 0) continue;
    console.log(`## ${gname}\n`);
    for (const item of items) {
      console.log(`- **${item.name}**: ${item.description}`);
      console.log(`  - 适用：${(item.applicable_to || []).slice(0, 3).join(' / ')}`);
      console.log(`  - K-IDs：${[...(item.required_knowledge || []), ...(item.common_pitfalls || [])].join(', ')}`);
    }
    console.log('');
  }
}

function findById(ids) {
  return patterns.filter(p => ids.includes(p.id));
}

function findByCategory(category, platform) {
  return patterns.filter(p => p.category === category && (!platform || p.platform === platform || p.platform === 'all'));
}

function findByKeyword(keywordCsv) {
  const kws = keywordCsv.toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  return patterns.filter(p => {
    const text = `${p.id} ${p.pattern} ${p.details}`.toLowerCase();
    return kws.some(kw => text.includes(kw));
  });
}

function findByScenarios(scenarioCsv) {
  const names = scenarioCsv.split(',').map(s => s.trim()).filter(Boolean);
  const ids = new Set();
  const usedScenarios = [];
  for (const name of names) {
    const s = scenarios[name];
    if (!s) {
      console.error(`⚠️ Unknown scenario: ${name}`);
      console.error(`Available: ${Object.keys(scenarios).join(', ')}`);
      continue;
    }
    usedScenarios.push({ name, ...s });
    for (const id of (s.required_knowledge || [])) ids.add(id);
    for (const id of (s.common_pitfalls || [])) ids.add(id);
  }
  return { matched: findById([...ids]), scenarioInfo: usedScenarios };
}

function printEntries(entries, header) {
  console.log(`# ${header} — ${entries.length} 条\n`);
  for (const p of entries) {
    console.log(`## ${p.id}  [${p.category} / ${p.platform}]  confidence=${p.confidence}\n`);
    console.log(`**Pattern**: ${p.pattern}\n`);
    if (p.superseded_by) console.log(`> ⚠️ 已被 ${p.superseded_by} 替代\n`);
    console.log(p.details);
    console.log('\n---\n');
  }
}

// 主分发
if (opts.list || (!opts.scenario && !opts.id && !opts.category && !opts.keyword && !opts.search)) {
  if (Object.keys(opts).length === 0 || opts.list) {
    printScenarioList();
    if (!opts.list) {
      console.log('\n用法：');
      console.log('  --scenario <name>[,<name>...]  按场景查');
      console.log('  --id K-NNN                     按 ID 查');
      console.log('  --category <cat>               按 category 查（locator/process/timing/quirk/assertion）');
      console.log('  --platform <plat>              配合 category 用');
      console.log('  --keyword "X,Y"                关键词 OR 匹配');
      console.log('  --search "中文文本"            在 pattern+details 全文搜');
      console.log('  --list                         列出所有 scenarios');
    }
    process.exit(0);
  }
}

if (opts.scenario) {
  const { matched, scenarioInfo } = findByScenarios(opts.scenario);
  console.log(`# 场景：${scenarioInfo.map(s => s.name).join(' + ')}\n`);
  for (const s of scenarioInfo) {
    console.log(`## ${s.name}`);
    console.log(`描述：${s.description}`);
    console.log(`适用：${(s.applicable_to || []).join(' / ')}`);
    console.log(`必读 K：${(s.required_knowledge || []).join(', ')}`);
    console.log(`常见坑 K：${(s.common_pitfalls || []).join(', ')}\n`);
  }
  printEntries(matched, '相关 knowledge');
} else if (opts.id) {
  const ids = opts.id.split(',').map(s => s.trim());
  printEntries(findById(ids), `ID = ${ids.join(', ')}`);
} else if (opts.category) {
  printEntries(findByCategory(opts.category, opts.platform), `category = ${opts.category}${opts.platform ? ` / platform = ${opts.platform}` : ''}`);
} else if (opts.keyword || opts.search) {
  const kw = opts.keyword || opts.search;
  printEntries(findByKeyword(kw), `keyword = "${kw}"`);
}
