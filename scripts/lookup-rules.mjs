#!/usr/bin/env node
// Lookup QA rules / requirements / testcases by module / topic / keyword.
//
// Usage:
//   node scripts/lookup-rules.mjs --module wallet
//   node scripts/lookup-rules.mjs --module wallet --topic 多地址
//   node scripts/lookup-rules.mjs --topic Keyless
//   node scripts/lookup-rules.mjs --module wallet --kind rules        (只看 rules)
//   node scripts/lookup-rules.mjs --module wallet --kind requirements (只看 requirements)
//   node scripts/lookup-rules.mjs --module wallet --kind testcases    (只看 testcases)
//   node scripts/lookup-rules.mjs --keyword "新鲜地址,找零"            (OR 匹配，跨所有文档)
//   node scripts/lookup-rules.mjs --list                              (列出所有模块清单)
//   node scripts/lookup-rules.mjs --module wallet --headings          (只输出章节标题树)
//   node scripts/lookup-rules.mjs --module wallet --topic 多地址 --excerpt 300
//
// 输出格式：Markdown，按 kind (rules/requirements/testcases) 分组，每条含 文件路径 / 命中章节 / 摘要。
// 用于：写用例 / 规则前自动加载对应模块的全部上下文；Phase 0 调用；review 检查覆盖度。

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, relative, basename, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const RULES_DIR = resolve(ROOT, 'docs/qa/rules');
const REQS_DIR = resolve(ROOT, 'docs/qa/requirements');
const CASES_DIR = resolve(ROOT, 'docs/qa/testcases/cases');

// --- arg parsing ---
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

// --- module name aliases ---
// 用户输入的 module 关键词 → 实际目录/文件名映射
const MODULE_ALIASES = {
  wallet: { dir: 'wallet', rules: ['wallet-rules.md', 'transfer-chain-rules.md'], reqPrefix: ['Wallet-', 'Transfer-'] },
  transfer: { dir: 'transfer', rules: ['transfer-chain-rules.md', 'wallet-rules.md'], reqPrefix: ['Transfer-', 'Wallet-'] },
  account: { dir: 'account', rules: ['account-rules.md'], reqPrefix: ['Account-'] },
  swap: { dir: 'swap', rules: ['swap-rules.md', 'swap-network-features.md'], reqPrefix: ['Swap-'] },
  market: { dir: 'market', rules: ['market-rules.md'], reqPrefix: ['Market-'] },
  perps: { dir: 'Perps', rules: ['perps-rules.md'], reqPrefix: ['Perps-'] },
  defi: { dir: 'defi', rules: ['defi-rules.md'], reqPrefix: ['DeFi-'] },
  hardware: { dir: 'hardware', rules: ['hardware-rules.md'], reqPrefix: ['Hardware-'] },
  hw: { dir: 'hardware', rules: ['hardware-rules.md'], reqPrefix: ['Hardware-'] },
  prime: { dir: 'prime', rules: ['prime-rules.md'], reqPrefix: ['Prime-'] },
  referral: { dir: 'referral', rules: ['referral-rules.md'], reqPrefix: ['Referral-'] },
  browser: { dir: 'browser', rules: ['browser-rules.md'], reqPrefix: ['Browser-'] },
  utility: { dir: 'utility', rules: ['utility-rules.md'], reqPrefix: ['Utility-'] },
};

function resolveModule(name) {
  if (!name) return null;
  const lower = String(name).toLowerCase();
  return MODULE_ALIASES[lower] ?? null;
}

// --- file walking ---
function* walkMarkdown(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) yield* walkMarkdown(full);
    else if (st.isFile() && entry.endsWith('.md')) yield full;
  }
}

// --- markdown section parsing ---
// 把 markdown 切成 [{ heading, level, body, lineStart }]
function parseSections(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: '(file-top)', level: 0, body: [], lineStart: 1 };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    if (m) {
      if (current.body.length || current.heading !== '(file-top)') sections.push(current);
      current = { heading: m[2].trim(), level: m[1].length, body: [], lineStart: i + 1 };
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections;
}

// --- match helpers ---
function matchTopic(section, topicWords) {
  if (!topicWords.length) return true;
  const hay = (section.heading + '\n' + section.body.join('\n')).toLowerCase();
  return topicWords.some((w) => hay.includes(w.toLowerCase()));
}
function matchKeywordAny(text, keywords) {
  if (!keywords.length) return true;
  const hay = text.toLowerCase();
  return keywords.some((w) => hay.includes(w.toLowerCase()));
}

// --- output helpers ---
function shortExcerpt(body, maxChars) {
  const text = body.join('\n').trim();
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars).trimEnd() + ' …';
}

function printSection(filePath, section, opts) {
  const rel = relative(ROOT, filePath);
  const headingPath = section.heading;
  console.log(`### \`${rel}\` — ${headingPath} (L${section.lineStart}, h${section.level})\n`);
  if (opts.headings) return;
  const excerptLen = opts.excerpt ? parseInt(opts.excerpt) : 600;
  const excerpt = shortExcerpt(section.body, excerptLen);
  console.log(excerpt);
  console.log('\n---\n');
}

// --- list mode ---
function printModuleList() {
  console.log('# 可用模块（按模块查 rules + requirements + testcases）\n');
  for (const [key, conf] of Object.entries(MODULE_ALIASES)) {
    const rulesExist = conf.rules.filter((r) => existsSync(resolve(RULES_DIR, r)));
    const casesDir = resolve(CASES_DIR, conf.dir);
    const casesCount = existsSync(casesDir) ? readdirSync(casesDir).filter((f) => f.endsWith('.md')).length : 0;
    const reqsCount = conf.reqPrefix.reduce((acc, prefix) => {
      if (!existsSync(REQS_DIR)) return acc;
      return acc + readdirSync(REQS_DIR).filter((f) => f.startsWith(prefix) && f.endsWith('.md')).length;
    }, 0);
    console.log(`- **${key}** → rules: ${rulesExist.join(', ') || '(none)'} · requirements: ${reqsCount} · testcases: ${casesCount}`);
  }
  console.log('\n用法：');
  console.log('  node scripts/lookup-rules.mjs --module <key> [--topic <关键词>] [--kind rules|requirements|testcases]');
}

if (opts.list) {
  printModuleList();
  process.exit(0);
}

// --- main lookup ---
const moduleConf = resolveModule(opts.module);
const topicWords = opts.topic ? String(opts.topic).split(',').map((s) => s.trim()).filter(Boolean) : [];
const keywords = opts.keyword ? String(opts.keyword).split(',').map((s) => s.trim()).filter(Boolean) : [];
const kindFilter = opts.kind ? String(opts.kind).toLowerCase() : null;

if (!opts.module && !opts.keyword && !opts.topic) {
  console.error('Usage: lookup-rules.mjs --module <name> [--topic X] [--keyword "A,B"] [--kind rules|requirements|testcases] [--headings] [--excerpt 300]');
  console.error('       lookup-rules.mjs --list  (列出所有模块)');
  process.exit(1);
}

// Collect target files
const targets = []; // { kind, path }

function tryAddRules() {
  if (kindFilter && kindFilter !== 'rules') return;
  if (moduleConf) {
    for (const r of moduleConf.rules) {
      const p = resolve(RULES_DIR, r);
      if (existsSync(p)) targets.push({ kind: 'rules', path: p });
    }
  } else if (keywords.length) {
    for (const f of readdirSync(RULES_DIR)) {
      if (f.endsWith('.md')) targets.push({ kind: 'rules', path: resolve(RULES_DIR, f) });
    }
  }
}

function tryAddRequirements() {
  if (kindFilter && kindFilter !== 'requirements') return;
  if (!existsSync(REQS_DIR)) return;
  const all = readdirSync(REQS_DIR).filter((f) => f.endsWith('.md'));
  if (moduleConf) {
    for (const f of all) {
      if (moduleConf.reqPrefix.some((p) => f.startsWith(p))) {
        targets.push({ kind: 'requirements', path: resolve(REQS_DIR, f) });
      }
    }
  } else if (keywords.length) {
    for (const f of all) targets.push({ kind: 'requirements', path: resolve(REQS_DIR, f) });
  }
}

function tryAddTestcases() {
  if (kindFilter && kindFilter !== 'testcases') return;
  if (!existsSync(CASES_DIR)) return;
  if (moduleConf) {
    const dir = resolve(CASES_DIR, moduleConf.dir);
    if (existsSync(dir)) {
      for (const f of walkMarkdown(dir)) targets.push({ kind: 'testcases', path: f });
    }
  } else if (keywords.length) {
    for (const f of walkMarkdown(CASES_DIR)) targets.push({ kind: 'testcases', path: f });
  }
}

tryAddRules();
tryAddRequirements();
tryAddTestcases();

if (!targets.length) {
  console.error('No matching files found. Use --list to see available modules.');
  process.exit(2);
}

// Process and print
const groups = { rules: [], requirements: [], testcases: [] };
for (const t of targets) groups[t.kind].push(t);

const kindLabel = { rules: '📘 规则文档 (docs/qa/rules/)', requirements: '📋 需求文档 (docs/qa/requirements/)', testcases: '✅ 测试用例 (docs/qa/testcases/cases/)' };

let totalHits = 0;
for (const kind of ['rules', 'requirements', 'testcases']) {
  const items = groups[kind];
  if (!items.length) continue;
  console.log(`\n## ${kindLabel[kind]}\n`);

  for (const t of items) {
    const text = readFileSync(t.path, 'utf8');
    // Keyword mode: 跨章节全文搜
    if (keywords.length && !topicWords.length) {
      if (!matchKeywordAny(text, keywords)) continue;
      const sections = parseSections(text);
      const hits = sections.filter((s) => matchKeywordAny(s.heading + '\n' + s.body.join('\n'), keywords));
      if (!hits.length) {
        // 仍然列出文件
        const rel = relative(ROOT, t.path);
        console.log(`### \`${rel}\` (全文命中，无具体章节)\n`);
        totalHits++;
        continue;
      }
      for (const sec of hits) {
        printSection(t.path, sec, opts);
        totalHits++;
      }
      continue;
    }
    // Topic mode
    if (topicWords.length) {
      const sections = parseSections(text);
      const hits = sections.filter((s) => matchTopic(s, topicWords));
      for (const sec of hits) {
        printSection(t.path, sec, opts);
        totalHits++;
      }
      continue;
    }
    // No topic / keyword: 列文件头 + 章节树
    const rel = relative(ROOT, t.path);
    const sections = parseSections(text);
    console.log(`### \`${rel}\`\n`);
    if (opts.headings) {
      for (const sec of sections) {
        if (sec.level >= 1 && sec.level <= 3) {
          console.log(`${'  '.repeat(sec.level - 1)}- ${sec.heading} (L${sec.lineStart})`);
        }
      }
      console.log('');
    } else {
      const firstSection = sections.find((s) => s.level > 0) ?? sections[0];
      if (firstSection) printSection(t.path, firstSection, opts);
    }
    totalHits++;
  }
}

console.log(`\n---\n命中 ${totalHits} 条。`);
if (moduleConf) {
  console.log(`提示：完整列出该模块章节树用 \`--headings\` 选项。`);
}
