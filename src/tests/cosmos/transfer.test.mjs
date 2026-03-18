// Cosmos Transfer Tests — 9 data-driven transfer cases (COSMOS-001 through COSMOS-009)
// Each case: switch account -> switch network -> send form -> recipient -> amount -> preview -> confirm submit -> assert success
// Supports CLI filtering: node src/tests/cosmos/transfer.test.mjs COSMOS-003

import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  connectCDP, sleep, screenshot, RESULTS_DIR,
  dismissOverlays, closeAllModals, goToWalletHome,
  unlockWalletIfNeeded, handlePasswordPromptIfPresent,
  dismissErrorDialogs,
  switchAccount, switchNetwork,
  executeTransferFlow,
} from '../helpers/index.mjs';

mkdirSync(RESULTS_DIR, { recursive: true });

// ── Transfer definitions (from test_cases.json) ──────────────

const TRANSFERS = [
  {
    id: 'COSMOS-001', network: 'Akash', token: 'AKT', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.001', amount_fallback: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.001', amount_fallback: 'Max' },
    ],
  },
  {
    id: 'COSMOS-002', network: 'Cosmos', token: 'ATOM', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '1', amount_fallback: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '1', amount_fallback: 'Max' },
    ],
  },
  {
    id: 'COSMOS-003', network: 'Crypto.org', token: 'CRO', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: 'Max' },
    ],
  },
  {
    id: 'COSMOS-004', network: 'Fetch.ai', token: 'FET', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.0001', amount_fallback: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.0001', amount_fallback: 'Max' },
    ],
  },
  {
    id: 'COSMOS-005', network: 'Juno', token: 'JUNO', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.0002', amount_fallback: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.0002', amount_fallback: 'Max' },
    ],
  },
  {
    id: 'COSMOS-006', network: 'Osmosis', token: 'OSMO', memo: 'onekey',
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.01', amount_fallback: 'Max', memo: 'onekey' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.01', amount_fallback: 'Max', memo: 'onekey' },
    ],
  },
  {
    id: 'COSMOS-007', network: 'Osmosis', token: 'ATOM', memo: '123456',
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.001', amount_fallback: 'Max', memo: '123456' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.001', amount_fallback: 'Max', memo: '123456' },
    ],
  },
  {
    id: 'COSMOS-008', network: 'Secret Network', token: 'SCRT', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.0001', amount_fallback: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.0001', amount_fallback: 'Max' },
    ],
  },
  {
    id: 'COSMOS-009', network: 'Celestia', token: 'TIA', memo: null,
    strategies: [
      { label: 'primary', sender: 'piggy', recipient: 'vault', amount: '0.0002', amount_fallback: 'Max' },
      { label: 'reversed', sender: 'vault', recipient: 'piggy', amount: '0.0002', amount_fallback: 'Max' },
    ],
  },
];

export const testCases = TRANSFERS.map(t => ({
  id: t.id,
  name: `${t.network} (${t.token}) transfer`,
}));

// ── Single transfer execution ────────────────────────────────

async function runTransfer(page, transfer) {
  const { id, network, token, strategies } = transfer;
  const attemptLog = [];

  for (const strategy of strategies) {
    const amount = strategy.amount;
    const amount_fallback = strategy.amount_fallback || null;
    const memo = strategy.memo !== undefined ? strategy.memo : transfer.memo;

    console.log(`[${id}] Strategy: "${strategy.label}" (${strategy.sender} -> ${strategy.recipient}, amount: ${amount}${amount_fallback ? `, fallback: ${amount_fallback}` : ''})`);

    await dismissOverlays(page);
    await handlePasswordPromptIfPresent(page);

    await goToWalletHome(page);
    await switchAccount(page, strategy.sender);
    await switchNetwork(page, network);

    const flowResult = await executeTransferFlow(page, {
      testId: id, network, token, amount, amount_fallback, memo,
      sender: strategy.sender, recipient: strategy.recipient,
      verifyDepth: 'submit',
    });

    attemptLog.push({
      strategy: strategy.label,
      sender: strategy.sender,
      recipient: strategy.recipient,
      amount_tried: amount,
      amount_fallback,
      amount_used: flowResult.amount_used,
      status: flowResult.status,
      reason: flowResult.reason,
    });

    if (flowResult.status === 'success') {
      console.log(`[${id}] Strategy "${strategy.label}" succeeded (amount: ${flowResult.amount_used})`);
      return { status: 'passed', strategy: strategy.label, amount_used: flowResult.amount_used, attemptLog };
    }

    if (flowResult.status === 'insufficient') {
      console.log(`[${id}] Strategy "${strategy.label}" insufficient (${flowResult.reason}), trying next...`);
      await closeAllModals(page);
      await sleep(1000);
      continue;
    }

    return { status: 'failed', strategy: strategy.label, attemptLog };
  }

  console.log(`[${id}] All strategies exhausted`);
  await screenshot(page, RESULTS_DIR, `${id}-all-insufficient`);

  return {
    status: 'failed',
    strategy: 'all_exhausted',
    failure_reason: 'insufficient_balance',
    failure_detail: attemptLog.map(a => `${a.sender}->${a.recipient}: ${a.reason}`).join('; '),
    attemptLog,
  };
}

// ── Main entry ───────────────────────────────────────────────

export async function run() {
  const filter = process.argv.slice(2).find(a => a.startsWith('COSMOS-'));
  const transfers = filter
    ? TRANSFERS.filter(t => t.id === filter)
    : TRANSFERS;

  if (transfers.length === 0) {
    console.error(`No transfers matching "${filter}"`);
    console.error('Available:', TRANSFERS.map(t => t.id).join(', '));
    return { status: 'error', error: `No match: ${filter}` };
  }

  const { page } = await connectCDP();

  console.log('\n' + '='.repeat(60));
  console.log(`  Cosmos Transfer Tests - ${transfers.length} case(s)`);
  console.log('='.repeat(60));

  await unlockWalletIfNeeded(page);

  const results = [];
  for (const transfer of transfers) {
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${transfer.id} - ${transfer.network} / ${transfer.token}`);
    console.log(`Strategies: ${transfer.strategies.map(s => s.label).join(', ')}`);
    console.log('='.repeat(60));

    try {
      const result = await runTransfer(page, transfer);
      const duration = Date.now() - startTime;

      const r = {
        testId: transfer.id,
        status: result.status,
        duration,
        error: result.status !== 'passed'
          ? (result.failure_reason
              ? `${result.failure_reason}: ${result.failure_detail}`
              : `Strategy "${result.strategy}" failed`)
          : null,
        attemptLog: result.attemptLog || [],
        amount_used: result.amount_used || null,
        timestamp: new Date().toISOString(),
      };

      console.log(`[${transfer.id}] ${r.status.toUpperCase()} (${(duration / 1000).toFixed(1)}s)`);
      writeFileSync(resolve(RESULTS_DIR, `${transfer.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);

    } catch (error) {
      const duration = Date.now() - startTime;
      const r = {
        testId: transfer.id,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
      console.error(`[${transfer.id}] FAILED (${(duration / 1000).toFixed(1)}s): ${error.message}`);
      writeFileSync(resolve(RESULTS_DIR, `${transfer.id}.json`), JSON.stringify(r, null, 2));
      results.push(r);
    }

    // Cleanup between tests
    try {
      await dismissErrorDialogs(page);
      await closeAllModals(page);
      await goToWalletHome(page);
    } catch (e) {
      console.log(`  Cleanup warning: ${e.message}`);
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Escape').catch(() => {});
        await sleep(200);
      }
    }
    await sleep(1000);
  }

  // Summary
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status !== 'passed').length;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);
  console.log('='.repeat(60));
  results.forEach(r => {
    const icon = r.status === 'passed' ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.testId} (${(r.duration / 1000).toFixed(1)}s)${r.error ? ' - ' + r.error.substring(0, 80) : ''}`);
  });

  const summary = { timestamp: new Date().toISOString(), total: results.length, passed, failed, results };
  writeFileSync(resolve(RESULTS_DIR, 'cosmos-summary.json'), JSON.stringify(summary, null, 2));

  return { status: failed === 0 ? 'passed' : 'failed', passed, failed, total: results.length };
}

// Allow standalone execution
if (import.meta.url === `file://${process.argv[1]}`) {
  run().then(r => process.exit(r.status === 'passed' ? 0 : 1))
    .catch(e => { console.error('Fatal:', e); process.exit(2); });
}
