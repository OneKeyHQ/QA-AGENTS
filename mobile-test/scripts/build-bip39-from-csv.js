#!/usr/bin/env node
/**
 * 从 dataset_OK-23809.csv 生成 dataset/bip39_mnemonic.js
 * 用法: node scripts/build-bip39-from-csv.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(process.env.HOME || '', 'Downloads/dataset_OK-23809.csv');
const PHRASES = {
  12: 'air census life sheriff attack include paper provide fantasy left opera sauce',
  15: 'grunt joke assist bird abstract exhibit hidden harbor couch order arrange sugar success entry snack ',
  18: 'slab canyon coffee wine gold bronze rigid peace output security boy quick vital cat become stove tape super',
  21: 'season setup pupil siege cruise dog pottery word favorite today extend april casino piano announce robot nerve toward century reason vintage',
  24: 'gorilla absent bone address stay minimum artist train piano coil gadget truck almost voice runway drip pony pizza uncover expose country enlist avocado hotel',
};

// CSV: 助记词,测试链,派生规则,第一个账户地址,第二十个账户地址,第五十个账户地址
// 列: 0=wordCount, 1=chain, 2=derivation, 3=addr_0, 4=addr_19, 5=addr_49
function getKeyPrefix(chain, derivation) {
  const c = (chain || '').trim();
  const d = (derivation || '').trim().toLowerCase();
  if (c === 'ETH') return d === 'ledger live' ? 'evm_ledgerlive' : 'evm_bip44';
  if (c === 'BTC') {
    if (d === 'taproot') return 'btc_taproot';
    if (d === 'nested segwit') return 'btc_nested_segwit';
    if (d === 'native segwit') return 'btc_native_segwit';
    if (d === 'legacy') return 'btc_legacy';
  }
  if (c === 'BCH' && d === 'legacy') return 'bch_legacy';
  if (c === 'LTC') {
    if (d === 'nested segwit') return 'ltc_nested_segwit';
    if (d === 'native segwit') return 'ltc_native_segwit';
    if (d === 'legacy') return 'ltc_legacy';
  }
  if (c === 'DOGE' && d === 'legacy') return 'doge';
  if (c === 'SOL') return d === 'ledgerlive' ? 'sol_ledgerlive' : 'sol_bip44';
  const chainMap = {
    'sui': 'sui', 'Joystream': 'joystream', 'Polkadot': 'polkadot', 'Astar': 'astar',
    'Kusama': 'kusama', 'near': 'near', 'tron': 'tron', 'Aptos': 'aptos', 'cardano': 'cardano',
    'algorand': 'algorand', 'Conflux': 'conflux', 'cosmos': 'cosmos', 'Akash': 'akash',
    'Celestia': 'celestia', 'Crypto.org': 'crypto_org', 'Fetch.ai ': 'fetch_ai', 'Fetch.ai': 'fetch_ai',
    'juno': 'juno', 'Osmosis': 'osmosis', 'Ripple': 'ripple', 'nexa': 'nexa', 'Filecoin': 'filecoin',
    'kaspa': 'kaspa', 'Secret': 'secret', 'Nervos': 'nervos', 'Neurai': 'neurai',
    'Manta Atlantic': 'manta_atlantic', 'Nostr': 'nostr',
  };
  return chainMap[c] || null;
}

function run() {
  const csv = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = csv.split(/\r?\n/).filter((l) => l.trim());
  const byWordCount = { 12: {}, 15: {}, 18: {}, 21: {}, 24: {} };

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 6) continue;
    const wordCount = parseInt(parts[0], 10);
    if (!byWordCount[wordCount]) continue;
    const chain = parts[1];
    const derivation = parts[2];
    const addr0 = (parts[3] || '').trim();
    const addr19 = (parts[4] || '').trim();
    const addr49 = (parts[5] || '').trim();
    const prefix = getKeyPrefix(chain, derivation);
    if (!prefix) continue;
    const obj = byWordCount[wordCount];
    obj[`${prefix}_address_index_0`] = addr0 === 'N/A' ? '' : addr0;
    obj[`${prefix}_address_index_19`] = addr19 === 'N/A' ? '' : addr19;
    obj[`${prefix}_address_index_49`] = addr49 === 'N/A' ? '' : addr49;
  }

  // 键顺序与现有 JS 一致，并加入 BCH 及新链
  const keyOrder = [
    'evm_bip44', 'evm_ledgerlive', 'btc_taproot', 'btc_nested_segwit', 'btc_native_segwit', 'btc_legacy',
    'bch_legacy',
    'ltc_nested_segwit', 'ltc_native_segwit', 'ltc_legacy', 'doge',
    'sol_bip44', 'sol_ledgerlive', 'sui', 'joystream', 'polkadot', 'astar', 'kusama', 'tron', 'near', 'aptos',
    'cardano', 'algorand', 'conflux', 'filecoin', 'kaspa', 'cosmos', 'akash', 'celestia', 'crypto_org',
    'fetch_ai', 'juno', 'osmosis', 'ripple', 'nexa',
    'secret', 'nervos', 'neurai', 'manta_atlantic', 'nostr',
  ];
  const indices = [0, 19, 49];

  function orderedEntries(obj) {
    const out = [];
    for (const prefix of keyOrder) {
      for (const idx of indices) {
        const key = `${prefix}_address_index_${idx}`;
        if (obj[key] !== undefined) out.push([key, obj[key]]);
      }
    }
    return out;
  }

  function formatValue(v) {
    if (v === '' || v == null) return "''";
    return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }

  const sections = [];
  for (const [phraseKey, wordCount] of [
    ['phrase_12_words', 12],
    ['phrase_15_words', 15],
    ['phrase_18_words', 18],
    ['phrase_21_words', 21],
    ['phrase_24_words', 24],
  ]) {
    const obj = byWordCount[wordCount];
    const lines = [
      '      {',
      `        phrase: '${PHRASES[wordCount]}',`,
      ...orderedEntries(obj).map(([k, v]) => `        ${k}: ${formatValue(v)},`),
      '      }',
    ];
    sections.push(`    ${phraseKey}: [\n${lines.join('\n')}\n    ]`);
  }

  const out = `export default {\n${sections.join(',\n')}\n  }`;
  const outPath = path.join(__dirname, '../dataset/bip39_mnemonic.js');
  fs.writeFileSync(outPath, out, 'utf8');
  console.log('Written:', outPath);
}

run();
