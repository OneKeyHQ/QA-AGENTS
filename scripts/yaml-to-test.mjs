// Generate a standalone .test.mjs from a picker-generated YAML.
// Usage: node scripts/yaml-to-test.mjs <yaml-path> <output-test-path>

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, basename } from 'node:path';
import { parse as yamlParse } from 'yaml';

const [, , yamlPath, outPath] = process.argv;
if (!yamlPath || !outPath) {
  console.error('Usage: node scripts/yaml-to-test.mjs <yaml-path> <output-test-path>');
  process.exit(1);
}

const sess = yamlParse(readFileSync(yamlPath, 'utf8'));
const total = sess.steps.length;

function escStr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function specCode(step) {
  const sel = step.selectors || {};
  const parts = [];
  if (sel.resourceId) parts.push(`resourceId: '${escStr(sel.resourceId)}'`);
  if (sel.contentDesc) parts.push(`contentDesc: '${escStr(sel.contentDesc)}'`);
  if (sel.text) parts.push(`text: '${escStr(sel.text)}'`);
  if (Array.isArray(step.coords)) parts.push(`coords: [${step.coords[0]}, ${step.coords[1]}]`);
  parts.push(`name: '${escStr(step.name || 'unnamed')}'`);
  return '{ ' + parts.join(', ') + ' }';
}

const lines = [];
const push = (s = '') => lines.push(s);

push('// Android wallet creation + KeyTag backup + bind referral code');
push(`// Generated from ${basename(yamlPath)} at ${new Date().toISOString()}`);
push('//');
push('// Run: node src/tests/android/wallet/create-keytag-referral.test.mjs');
push('// Or:  node src/tests/android/runner.mjs midscene_run/picks/<source>.yaml');
push('');
push(`import 'dotenv/config';`);
push(`import { execFile } from 'node:child_process';`);
push(`import { resolve } from 'node:path';`);
push(`import { initDevice } from '../helpers/device.mjs';`);
push(`import { smartTap, smartType, smartSwipe } from '../helpers/smart-tap.mjs';`);
push('');
push(`const ADB = resolve(`);
push(`  process.env.ANDROID_HOME || \`\${process.env.HOME}/Library/Android/sdk\`,`);
push(`  'platform-tools/adb',`);
push(`);`);
push(`const sleep = (ms) => new Promise((r) => setTimeout(r, ms));`);
push('');
push(`async function detectDevice() {`);
push(`  return new Promise((res, rej) => {`);
push(`    execFile(ADB, ['devices'], (err, stdout) => {`);
push(`      if (err) return rej(err);`);
push(`      const m = stdout.match(/^(\\S+)\\s+device$/m);`);
push(`      if (!m) return rej(new Error('No Android device connected'));`);
push(`      res(m[1]);`);
push(`    });`);
push(`  });`);
push(`}`);
push('');
push(`export const TEST_ID = 'WALLET-CREATE-KEYTAG-REFERRAL-001';`);
push(`export const displayName = '创建钱包 + KeyTag 备份 + 邀请码';`);
push('');
push(`export async function run() {`);
push(`  const udid = await detectDevice();`);
push(`  initDevice(udid);`);
push(`  console.log(\`Device: \${udid}\`);`);
push(`  console.log('');`);
push('');
push(`  const steps = [`);
sess.steps.forEach((s, i) => {
  const action = s.action || 'tap';
  const wait = s.wait_after ?? 1000;
  let stepLine = `    { idx: ${i + 1}, action: '${action}', spec: ${specCode(s)}`;
  if (s.text !== undefined) stepLine += `, text: '${escStr(s.text)}'`;
  if (s.swipe) stepLine += `, swipe: { from: [${s.swipe.from.join(', ')}], to: [${s.swipe.to.join(', ')}], duration: ${s.swipe.duration || 300} }`;
  stepLine += `, wait: ${wait} },`;
  push(stepLine);
});
push(`  ];`);
push('');
push(`  let passed = 0, failed = 0;`);
push(`  for (const step of steps) {`);
push(`    const start = Date.now();`);
push(`    process.stdout.write(\`[\${String(step.idx).padStart(2)}/${total}] \${step.spec.name}... \`);`);
push(`    try {`);
push(`      if (step.action === 'type') {`);
push(`        await smartType(step.spec, step.text);`);
push(`      } else if (step.action === 'swipe') {`);
push(`        await smartSwipe({ swipe: step.swipe, name: step.spec.name });`);
push(`      } else {`);
push(`        await smartTap(step.spec);`);
push(`      }`);
push(`      console.log(\`✓ \${Date.now() - start}ms\`);`);
push(`      passed++;`);
push(`    } catch (e) {`);
push(`      console.log(\`✗ \${e.message}\`);`);
push(`      failed++;`);
push(`      break;`);
push(`    }`);
push(`    await sleep(step.wait);`);
push(`  }`);
push('');
push(`  console.log('');`);
push(`  console.log(\`═══ \${passed} passed\${failed ? \`, \${failed} failed\` : ''} ═══\`);`);
push(`  return { passed, failed, total: steps.length };`);
push(`}`);
push('');
push(`const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;`);
push(`if (isMain) run().then(r => process.exit(r.failed > 0 ? 1 : 0)).catch(e => { console.error(e); process.exit(1); });`);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, lines.join('\n') + '\n');
console.log(`Generated: ${outPath} (${lines.length} lines, ${total} steps)`);
