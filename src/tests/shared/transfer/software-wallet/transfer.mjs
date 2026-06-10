// Software wallet transfer shared tests for desktop transfer coverage.
// Default depth is submit: validate preview fields, broadcast, then verify history.

import { Buffer } from 'node:buffer';

import {
  closeAllModals,
  dismissOverlays,
  handlePasswordPromptIfPresent,
  sleep,
  switchAccount,
  switchNetwork,
} from '../../../helpers/index.mjs';
import { createStepTracker, safeStep } from '../../../helpers/components.mjs';
import {
  assertPreviewPage,
  checkInsufficientBalance,
  enterAmount,
  enterMemo,
  ensureSingleNetworkMode,
  hasBalance,
  openSendForm,
  recoverAfterCancel,
  selectRecipientFromContacts,
  verifyFiatToggle,
  verifyHistoryRecord,
  verifyInvalidAmounts,
  waitForAmountPageAssetsReady,
} from '../../../helpers/transfer.mjs';

const DEFAULT_STRATEGIES = [
  { label: 'primary', sender: 'piggy', recipient: 'vault' },
  { label: 'reversed', sender: 'vault', recipient: 'piggy' },
];

const STELLAR_MEMO_29_BYTES = 'stellar-memo-over-28-bytes-limit';

const HASH_REQUIRED_NETWORKS = new Set([
  'Tron',
  'Polkadot AssetHub',
  'Kusama AssetHub',
  'Astar',
  'Joystream',
  'Manta Atlantic',
  'Hydration',
  'Bifrost Polkadot',
  'Bifrost Kusama',
  'Stellar',
  'BNB Chain',
  'Polygon',
  'Optimism',
  'Base',
  'Arbitrum',
  'Aptos',
  'Cardano',
  'BenFen',
]);

function buildHistoryExpectations(tc, recipientInfo = {}) {
  const requiredFields = ['token', 'type', 'status', 'recipient'];
  const optionalFields = ['fee', 'amount', 'network'];

  if (HASH_REQUIRED_NETWORKS.has(tc.network)) {
    requiredFields.push('hash');
  } else {
    optionalFields.push('hash');
  }

  if (tc.memo && ['Stellar', 'TON'].includes(tc.network)) {
    requiredFields.push('memo');
  } else if (tc.memo) {
    optionalFields.push('memo');
  }

  return {
    network: tc.network,
    token: tc.token,
    amount: tc.amount,
    memo: tc.memo,
    recipientAddress: recipientInfo.address,
    recipientLabel: recipientInfo.label,
    requiredFields,
    optionalFields,
  };
}

export const SOFTWARE_WALLET_TRANSFER_AUTOMATION_CASES = {
  tron: [
    {
      id: 'TRON-001',
      name: 'TRX 小额转账预览 + 法币切换',
      type: 'preview',
      network: 'Tron',
      token: 'TRX',
      amount: '0.001',
      verifyFiat: true,
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'TRON-002',
      name: 'TRX Max 金额预览',
      type: 'preview',
      network: 'Tron',
      token: 'TRX',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'TRON-003',
      name: 'TRX 金额 0 拦截',
      type: 'invalid-amount',
      network: 'Tron',
      token: 'TRX',
      amount: '0',
      expectedTextGroups: [['无法发送 0', '不能发送 0', '0 金额', 'cannot send 0']],
    },
    {
      id: 'TRON-004',
      name: 'USDT-TRC20 转账预览 + 资源字段',
      type: 'preview',
      network: 'Tron',
      token: 'USDT',
      amount: '0.0002',
      optionalPreviewTextGroups: [
        ['网络费用', '网络费', '手续费', 'Fee'],
        ['能量', 'Energy'],
        ['带宽', 'Bandwidth'],
      ],
    },
  ],
  polkadot: [
    { id: 'POLKADOT-001', name: 'Polkadot AssetHub DOT 小额预览', type: 'preview', network: 'Polkadot AssetHub', token: 'DOT', amount: '0.001' },
    { id: 'POLKADOT-002', name: 'Kusama AssetHub KSM 小额预览', type: 'preview', network: 'Kusama AssetHub', token: 'KSM', amount: '0.0001' },
    { id: 'POLKADOT-003', name: 'Astar ASTR Max 预览', type: 'preview', network: 'Astar', token: 'ASTR', amount: 'Max' },
    { id: 'POLKADOT-004', name: 'Joystream JOY 小额预览', type: 'preview', network: 'Joystream', token: 'JOY', amount: '0.0001' },
    { id: 'POLKADOT-005', name: 'Manta Atlantic MANTA 小额预览', type: 'preview', network: 'Manta Atlantic', token: 'MANTA', amount: '0.001' },
    { id: 'POLKADOT-006', name: 'Hydration HDX 小额预览', type: 'preview', network: 'Hydration', token: 'HDX', amount: '0.1' },
    { id: 'POLKADOT-007', name: 'Bifrost Polkadot BNC 小额预览', type: 'preview', network: 'Bifrost Polkadot', token: 'BNC', amount: '0.01' },
    { id: 'POLKADOT-008', name: 'Bifrost Kusama BNC 小额预览', type: 'preview', network: 'Bifrost Kusama', token: 'BNC', amount: '0.0001' },
    {
      id: 'POLKADOT-009',
      name: 'Polkadot AssetHub USDT 预览',
      type: 'preview',
      network: 'Polkadot AssetHub',
      token: 'USDT',
      amount: '0.01',
      feeToken: 'DOT',
      skipAutomation: '当前默认测试账户无 Polkadot AssetHub USDT 资产，按要求不执行',
    },
    {
      id: 'POLKADOT-010',
      name: 'Kusama AssetHub USDT 预览',
      type: 'preview',
      network: 'Kusama AssetHub',
      token: 'USDT',
      amount: '0.01',
      feeToken: 'KSM',
      skipAutomation: '当前默认测试账户无 Kusama AssetHub USDT 资产，按要求不执行',
    },
    {
      id: 'POLKADOT-011',
      name: 'Polkadot AssetHub DOT 非法金额拦截',
      type: 'invalid-amounts',
      network: 'Polkadot AssetHub',
      token: 'DOT',
    },
  ],
  stellar: [
    {
      id: 'STELLAR-001',
      name: 'XLM 老账户最小金额 + 文本 Memo 预览',
      type: 'preview',
      network: 'Stellar',
      token: 'XLM',
      amount: '0.0000001',
      memo: 'test123',
      assertPreviewMemo: false,
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'STELLAR-002',
      name: 'XLM 纯数字 Memo 预览',
      type: 'preview',
      network: 'Stellar',
      token: 'XLM',
      amount: '0.0000001',
      memo: '123456',
      assertPreviewMemo: false,
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'STELLAR-003',
      name: 'Memo 超 28 字节拦截',
      type: 'memo-limit',
      network: 'Stellar',
      token: 'XLM',
      memo: STELLAR_MEMO_29_BYTES,
      expectedTextGroups: [['28', '超过', '最大', '长度', 'limit', 'too long']],
    },
    {
      id: 'STELLAR-004',
      name: 'XLM 老账户 Max 预览',
      type: 'preview',
      network: 'Stellar',
      token: 'XLM',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'STELLAR-005',
      name: 'XLM 新账户 0.9 小于激活金额拦截',
      type: 'raw-recipient-boundary',
      network: 'Stellar',
      token: 'XLM',
      amount: '0.9',
      recipientEnv: 'STELLAR_NEW_ACCOUNT_ADDRESS',
      expectedTextGroups: [['1 XLM', '1.0 XLM'], ['激活', 'activate', 'reserve', '保留']],
      skipAutomation: '新账户激活边界按要求暂不执行',
    },
    {
      id: 'STELLAR-006',
      name: 'USDC Asset 转账预览',
      type: 'preview',
      network: 'Stellar',
      token: 'USDC',
      amount: '0.0000001',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
  ],
  evm: [
    {
      id: 'EVM-001',
      name: 'BNB Chain BNB 小额预览 + 法币切换',
      type: 'preview',
      network: 'BNB Chain',
      token: 'BNB',
      amount: '0.000001',
      verifyFiat: true,
      optionalPreviewTextGroups: [
        ['网络费用', '网络费', '手续费', 'Fee'],
        ['Slow', 'Standard', 'Fast', 'Custom', '进阶设置'],
      ],
    },
    {
      id: 'EVM-002',
      name: 'BNB Chain BNB Max 预览',
      type: 'preview',
      network: 'BNB Chain',
      token: 'BNB',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-003',
      name: 'BNB Chain BNB 非法金额拦截',
      type: 'invalid-amounts',
      network: 'BNB Chain',
      token: 'BNB',
    },
    {
      id: 'EVM-004',
      name: 'BNB Chain USDT 0 金额拦截',
      type: 'invalid-amount',
      network: 'BNB Chain',
      token: 'USDT',
      amount: '0',
      expectedTextGroups: [['无法发送 0', '不能发送 0', '0 金额', 'cannot send 0']],
    },
    {
      id: 'EVM-005',
      name: 'BNB Chain USD1 小额预览',
      type: 'preview',
      network: 'BNB Chain',
      token: 'USD1',
      amount: '0.000001',
      optionalPreviewTextGroups: [
        ['网络费用', '网络费', '手续费', 'Fee'],
        ['0 BNB', '免费', 'Free'],
      ],
    },
    {
      id: 'EVM-006',
      name: 'BNB Chain USDT 免 Gas 边界金额预览',
      type: 'preview',
      network: 'BNB Chain',
      token: 'USDT',
      amount: '0.1',
      optionalPreviewTextGroups: [['BNB'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-007',
      name: 'Polygon POL 最小精度预览',
      type: 'preview',
      network: 'Polygon',
      token: 'POL',
      amount: '0.000000000000000001',
      verifyFiat: true,
      optionalPreviewTextGroups: [
        ['网络费用', '网络费', '手续费', 'Fee'],
        ['Max Fee', 'Priority Fee', '进阶设置'],
      ],
    },
    {
      id: 'EVM-008',
      name: 'Polygon POL Max 预览',
      type: 'preview',
      network: 'Polygon',
      token: 'POL',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-009',
      name: 'Polygon USDC 小额预览',
      type: 'preview',
      network: 'Polygon',
      token: 'USDC',
      amount: '0.000001',
      optionalPreviewTextGroups: [['MATIC'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-010',
      name: 'Polygon USDC Max 预览',
      type: 'preview',
      network: 'Polygon',
      token: 'USDC',
      amount: 'Max',
      optionalPreviewTextGroups: [['MATIC'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-011',
      name: 'Optimism ETH Max 预览',
      type: 'preview',
      network: 'Optimism',
      token: 'ETH',
      amount: 'Max',
      optionalPreviewTextGroups: [
        ['网络费用', '网络费', '手续费', 'Fee'],
        ['L1', 'L2', 'Max Fee', 'Priority Fee'],
      ],
    },
    {
      id: 'EVM-012',
      name: 'Optimism OP 0 金额拦截',
      type: 'invalid-amount',
      network: 'Optimism',
      token: 'OP',
      amount: '0',
      expectedTextGroups: [['无法发送 0', '不能发送 0', '0 金额', 'cannot send 0']],
    },
    {
      id: 'EVM-013',
      name: 'Base ETH Max 预览',
      type: 'preview',
      network: 'Base',
      token: 'ETH',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-014',
      name: 'Base USDC Max 预览',
      type: 'preview',
      network: 'Base',
      token: 'USDC',
      amount: 'Max',
      optionalPreviewTextGroups: [['ETH'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-015',
      name: 'Arbitrum ETH Max 预览',
      type: 'preview',
      network: 'Arbitrum',
      token: 'ETH',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'EVM-016',
      name: 'Arbitrum ARB 小额预览',
      type: 'preview',
      network: 'Arbitrum',
      token: 'ARB',
      amount: '0.0001',
      optionalPreviewTextGroups: [['ETH'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
  ],
  ton: [
    {
      id: 'TON-001',
      name: 'TON USDt Jetton 小额 + Comment 预览',
      type: 'preview',
      network: 'TON',
      token: 'USD₮',
      amount: '0.000000001',
      memo: 'onekey',
      optionalPreviewTextGroups: [['Comment', '标签', '备注'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'TON-002',
      name: 'TON AKITA Jetton Max + 数字 Comment 预览',
      type: 'preview',
      network: 'TON',
      token: 'AKITA',
      amount: 'Max',
      memo: '123456',
      optionalPreviewTextGroups: [['Comment', '标签', '备注'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'TON-003',
      name: 'TON 主币最小精度 + Comment 预览',
      type: 'preview',
      network: 'TON',
      token: 'TON',
      amount: '0.000000001',
      memo: 'onekey',
      optionalPreviewTextGroups: [['Comment', '标签', '备注'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'TON-004',
      name: 'TON 主币 Max + 数字 Comment 预览',
      type: 'preview',
      network: 'TON',
      token: 'TON',
      amount: 'Max',
      memo: '123456',
      optionalPreviewTextGroups: [['Comment', '标签', '备注'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
  ],
  aptos: [
    {
      id: 'APTOS-001',
      name: 'Aptos USDC 小额预览',
      type: 'preview',
      network: 'Aptos',
      token: 'USDC',
      amount: '0.0002',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'APTOS-002',
      name: 'Aptos USDt Max 预览',
      type: 'preview',
      network: 'Aptos',
      token: 'USDt',
      amount: 'Max',
      optionalPreviewTextGroups: [['APT'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'APTOS-003',
      name: 'Aptos APT 小额预览',
      type: 'preview',
      network: 'Aptos',
      token: 'APT',
      amount: '0.0001',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'APTOS-004',
      name: 'Aptos APT 0 金额拦截',
      type: 'invalid-amount',
      network: 'Aptos',
      token: 'APT',
      amount: '0',
      expectedTextGroups: [['无法发送 0', '不能发送 0', '0 金额', 'cannot send 0']],
    },
    {
      id: 'APTOS-005',
      name: 'Aptos APT Max 预览',
      type: 'preview',
      network: 'Aptos',
      token: 'APT',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
  ],
  ada: [
    {
      id: 'ADA-001',
      name: 'Cardano MELD 代币预览',
      type: 'preview',
      network: 'Cardano',
      token: 'MELD',
      amount: '1',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'ADA-002',
      name: 'Cardano BANK 代币预览',
      type: 'preview',
      network: 'Cardano',
      token: 'BANK',
      amount: '1',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'ADA-003',
      name: 'Cardano ADA 主币预览',
      type: 'preview',
      network: 'Cardano',
      token: 'ADA',
      amount: '1',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'ADA-004',
      name: 'Cardano ADA Max 预览',
      type: 'preview',
      network: 'Cardano',
      token: 'ADA',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
  ],
  benfen: [
    {
      id: 'BENFEN-001',
      name: 'BenFen BFC 最小精度预览',
      type: 'preview',
      network: 'BenFen',
      token: 'BFC',
      amount: '0.000000001',
      verifyFiat: true,
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'BENFEN-002',
      name: 'BenFen BFC Max 预览',
      type: 'preview',
      network: 'BenFen',
      token: 'BFC',
      amount: 'Max',
      optionalPreviewTextGroups: [['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'BENFEN-003',
      name: 'BenFen BFC 非法金额拦截',
      type: 'invalid-amounts',
      network: 'BenFen',
      token: 'BFC',
    },
    {
      id: 'BENFEN-004',
      name: 'BenFen BUSD 最小精度预览',
      type: 'preview',
      network: 'BenFen',
      token: 'BUSD',
      amount: '0.000000001',
      optionalPreviewTextGroups: [['BFC'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
    {
      id: 'BENFEN-005',
      name: 'BenFen LONG 0 金额拦截',
      type: 'invalid-amount',
      network: 'BenFen',
      token: 'LONG',
      amount: '0',
      expectedTextGroups: [['无法发送 0', '不能发送 0', '0 金额', 'cannot send 0']],
    },
    {
      id: 'BENFEN-006',
      name: 'BenFen BF_USDC Max 预览',
      type: 'preview',
      network: 'BenFen',
      token: 'BF_USDC',
      amount: 'Max',
      optionalPreviewTextGroups: [['BFC'], ['网络费用', '网络费', '手续费', 'Fee']],
    },
  ],
};

function withPrefix(prefix, id) {
  if (!prefix) return id;
  const [, numeric] = id.split('-');
  return `${prefix}-${numeric || id}`;
}

async function clearBlockingOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    const selectors = [
      '[data-testid="ovelay-popover"]',
      '[data-testid="overlay-popover"]',
      '[data-testid="app-modal-stacks-backdrop"]',
    ];
    for (const selector of selectors) {
      for (const el of document.querySelectorAll(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          el.click();
        }
        if (el.getAttribute('aria-hidden') === 'true' || el.getAttribute('data-aria-hidden') === 'true') {
          el.style.pointerEvents = 'none';
        }
      }
    }
  }).catch(() => {});
  await sleep(300);
}

async function clickFooterConfirm(page) {
  const btn = page.locator('[data-testid="page-footer-confirm"]').last();
  const text = (await btn.textContent({ timeout: 3000 }).catch(() => '')).trim();
  const box = await btn.boundingBox().catch(() => null);
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await btn.click({ force: true, timeout: 5000 });
  }
  await sleep(1500);
  return text || 'confirm';
}

async function clickCancelOrEscape(page) {
  const selectors = [
    '[data-testid="send-cancel-button"]',
    '[data-testid="page-footer-cancel"]',
    'text=取消',
    'text=Cancel',
  ];
  for (const selector of selectors) {
    const loc = page.locator(selector).last();
    const visible = await loc.isVisible({ timeout: 800 }).catch(() => false);
    if (visible) {
      await loc.click({ force: true, timeout: 3000 }).catch(() => {});
      await sleep(800);
      return;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await sleep(800);
}

async function getVisibleText(page) {
  return page.evaluate(() => {
    const modals = document.querySelectorAll('[data-testid="APP-Modal-Screen"]');
    const modal = modals[modals.length - 1];
    const confirm = document.querySelector('[data-testid="tx-confirmation-body"]');
    const container = confirm || modal || document.body;
    return container.textContent?.substring(0, 8000) || '';
  });
}

function findMissingGroups(text, groups = []) {
  return groups.filter((group) => !group.some((needle) => text.includes(needle)));
}

async function assertTextGroups(page, groups = []) {
  if (!groups.length) return 'no extra text assertions';
  const text = await getVisibleText(page);
  const missing = findMissingGroups(text, groups);
  if (missing.length) {
    throw new Error(`缺少预期文案: ${missing.map((g) => g.join('/')).join(', ')}`);
  }
  return `matched ${groups.length}/${groups.length}`;
}

async function checkOptionalTextGroups(page, groups = []) {
  if (!groups.length) return [];
  const text = await getVisibleText(page);
  return findMissingGroups(text, groups);
}

async function waitForSubmitResult(page, timeout = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await sleep(1000);
    const state = await page.evaluate(() => {
      const visible = (el) => {
        if (!el) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      };
      const text = document.body?.textContent || '';
      const passwordVisible = Array.from(document.querySelectorAll('[data-testid="password-input"], input[type="password"], input[placeholder*="密码"]'))
        .some(visible);
      if (passwordVisible) return 'password';
      if (text.includes('失败') || text.includes('Failed') || text.includes('Error')) return 'failed';
      if (text.includes('成功') || text.includes('已发送') || text.includes('Submitted') || text.includes('Success')) return 'success';

      const modal = document.querySelector('[data-testid="APP-Modal-Screen"]');
      const confirmVisible = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="send-confirm-button"]'))
        .some(visible);
      const walletHome = document.querySelector('[data-testid="AccountSelectorTriggerBase"]');
      if (visible(walletHome) && !visible(modal) && !confirmVisible) return 'success';
      return 'waiting';
    });

    if (state === 'password') {
      await handlePasswordPromptIfPresent(page);
      continue;
    }
    if (state === 'success') return `submitted (${Math.round((Date.now() - started) / 1000)}s)`;
    if (state === 'failed') throw new Error('交易提交失败');
  }
  throw new Error(`交易提交后 ${Math.round(timeout / 1000)}s 内未完成`);
}

async function isFooterConfirmDisabled(page) {
  return page.evaluate(() => {
    const btns = document.querySelectorAll('[data-testid="page-footer-confirm"]');
    const btn = btns[btns.length - 1];
    if (!btn) return true;
    const style = window.getComputedStyle(btn);
    return (
      btn.disabled ||
      btn.getAttribute('aria-disabled') === 'true' ||
      style.pointerEvents === 'none' ||
      Number(style.opacity) < 0.65
    );
  });
}

async function selectRawRecipient(page, address) {
  const selectors = [
    '[data-testid="send-recipient-input"] textarea',
    '[data-testid="send-recipient-input"] input',
    '[data-testid="base-input-shared-styles-textarea"]',
    'textarea[placeholder*="搜索或粘贴"]',
    'textarea[placeholder*="地址"]',
    'textarea',
  ];

  for (const selector of selectors) {
    const input = page.locator(selector).first();
    const visible = await input.isVisible({ timeout: 1000 }).catch(() => false);
    if (!visible) continue;
    await input.click();
    await input.evaluate((el) => {
      if ('select' in el) el.select();
    }).catch(() => {});
    await page.keyboard.press('Meta+A').catch(() => {});
    await page.keyboard.press('Backspace').catch(() => {});
    await input.fill(address).catch(async () => {
      await input.pressSequentially(address, { delay: 20 });
    });
    await sleep(2500);
    return `raw=${address.slice(0, 8)}...${address.slice(-6)}`;
  }
  throw new Error('收款地址输入框未找到');
}

async function openAmountPage(page, tc, recipientName) {
  let recipientInfo;
  if (tc.rawRecipient) {
    await selectRawRecipient(page, tc.rawRecipient);
    recipientInfo = {
      label: 'raw address',
      address: tc.rawRecipient,
    };
  } else {
    recipientInfo = await selectRecipientFromContacts(page, recipientName);
  }

  if (tc.memo) {
    await enterMemo(page, tc.memo);
  }

  await clickFooterConfirm(page);
  await sleep(2000);

  const started = Date.now();
  let amountPageState = null;
  while (Date.now() - started < 10000) {
    amountPageState = await page.evaluate((token) => {
      const text = document.body?.textContent || '';
      const hasAmountContext = text.includes('选择币种') && text.includes('收款方');
      const hasTokenBalance = token
        ? new RegExp(`${String(token).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]{0,80}\\d[\\d.,]*`, 'i').test(text)
        : false;
      const visibleInput = Array.from(document.querySelectorAll('[data-testid="send-amount-input"], [data-testid="amount-input-input-element-input"], input[placeholder="0"]'))
        .some((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
      return { ready: visibleInput || (hasAmountContext && hasTokenBalance), text: text.substring(0, 500) };
    }, tc.token);
    if (amountPageState.ready) return recipientInfo;
    await sleep(500);
  }
  throw new Error(`未进入金额页: ${(amountPageState?.text || '').substring(0, 160)}`);
}

async function previewAndCancel(page, tc, verifyDepth, recipientInfo = {}) {
  if (await checkInsufficientBalance(page)) return 'insufficient before preview';

  if (await isFooterConfirmDisabled(page)) {
    await waitForAmountPageAssetsReady(page, { timeout: 10000, token: tc.token });
    const text = await getVisibleText(page);
    throw new Error(`预览按钮不可提交: ${text.substring(0, 240)}`);
  }

  await clickFooterConfirm(page);

  let ready = false;
  let lastText = '';
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const state = await page.evaluate(() => {
      const body = document.body.textContent || '';
      const confirm = document.querySelector('[data-testid="tx-confirmation-body"]');
      const hasFee = body.includes('网络费用') || body.includes('网络费') || body.includes('Fee') || body.includes('手续费');
      const hasConfirmBtn = Array.from(document.querySelectorAll('[data-testid="page-footer-confirm"], [data-testid="send-confirm-button"]'))
        .some((btn) => btn.getBoundingClientRect().width > 0);
      if (confirm && confirm.getBoundingClientRect().width > 0) return 'ready';
      if (hasFee && hasConfirmBtn) return 'ready';
      if (body.includes('不足') || body.includes('Insufficient')) return 'insufficient';
      return 'loading';
    });
    if (i % 6 === 0) {
      lastText = await getVisibleText(page);
    }
    if (state === 'ready') {
      ready = true;
      break;
    }
    if (state === 'insufficient') return 'insufficient on preview';
  }
  if (!ready) throw new Error(`预览页未在 20 秒内完成渲染: ${lastText.substring(0, 240)}`);

  await assertPreviewPage(page, {
    network: tc.network,
    token: tc.token,
    amount: tc.amount,
    recipientAddress: recipientInfo.address,
    memo: tc.assertPreviewMemo === false ? undefined : tc.memo,
  });
  await assertTextGroups(page, [
    ...(tc.requiredPreviewTextGroups || []),
  ]);
  const optionalMissing = await checkOptionalTextGroups(page, [
    ...(tc.optionalPreviewTextGroups || []),
    ...(tc.feeToken ? [[tc.feeToken]] : []),
  ]);

  if (verifyDepth !== 'submit') {
    await clickCancelOrEscape(page);
    await recoverAfterCancel(page);
    return optionalMissing.length
      ? `preview verified and canceled; optional missing: ${optionalMissing.map((g) => g.join('/')).join(', ')}`
      : 'preview verified and canceled';
  }

  await clickFooterConfirm(page);
  await handlePasswordPromptIfPresent(page);
  const submitResult = await waitForSubmitResult(page);
  await sleep(2000);
  await closeAllModals(page).catch(() => {});
  const history = await verifyHistoryRecord(page, buildHistoryExpectations(tc, recipientInfo));
  return `${submitResult}; history verified: ${history.fields.join(', ')}`;
}

async function prepareCase(page, tc, goToWallet, t, screenshotDir, accountStrategies) {
  const _ss = (name, fn) => safeStep(page, t, name, fn, screenshotDir);

  await _ss('回到钱包首页', async () => {
    await clearBlockingOverlays(page);
    await dismissOverlays(page);
    await handlePasswordPromptIfPresent(page);
    await goToWallet(page);
    await clearBlockingOverlays(page);
    return 'wallet home';
  });

  await _ss(`切换到 ${tc.network}`, async () => {
    await clearBlockingOverlays(page);
    await ensureSingleNetworkMode(page);
    await switchNetwork(page, tc.network);
    await clearBlockingOverlays(page);
    return tc.network;
  });

  let usedStrategy = null;
  for (const strategy of accountStrategies) {
    const switched = await _ss(`切换到 ${strategy.sender} 账户`, async () => {
      await clearBlockingOverlays(page);
      await switchAccount(page, strategy.sender);
      await clearBlockingOverlays(page);
      return strategy.sender;
    });
    if (!switched) continue;
    if (await hasBalance(page)) {
      usedStrategy = strategy;
      t.add(`${strategy.sender} 有余额`, 'passed', '可以继续');
      break;
    }
    t.add(`${strategy.sender} 余额不足`, 'skipped', '尝试下一个账户');
  }

  if (!usedStrategy) throw new Error('两个默认账户都未检测到余额');

  await _ss(`打开 ${tc.token} 发送页`, async () => {
    await openSendForm(page, tc.token);
    return tc.token;
  });

  return usedStrategy;
}

async function runPreviewCase(page, tc, opts) {
  const t = createStepTracker(tc.id);
  const _ss = (name, fn) => safeStep(page, t, name, fn, opts.screenshotDir);
  const verifyStepName = opts.verifyDepth === 'submit'
    ? '预览页字段校验并提交 + 历史校验'
    : '预览页字段校验并取消';

  let lastInsufficient = null;
  for (const strategy of opts.accountStrategies) {
    let usedStrategy = null;
    try {
      usedStrategy = await prepareCase(page, tc, opts.goToWallet, t, opts.screenshotDir, [strategy]);
    } catch (error) {
      t.add(`${strategy.sender} 准备转账`, 'skipped', error.message);
      await closeAllModals(page).catch(() => {});
      await opts.goToWallet(page).catch(() => {});
      continue;
    }

    let selectedRecipientInfo = null;
    const recipientSelected = await _ss(`选择收款人 ${tc.rawRecipient ? 'raw address' : usedStrategy.recipient}`, async () => {
      selectedRecipientInfo = await openAmountPage(page, tc, usedStrategy.recipient);
      return selectedRecipientInfo?.address
        ? `${selectedRecipientInfo.label || usedStrategy.recipient} ${selectedRecipientInfo.address.slice(0, 6)}...${selectedRecipientInfo.address.slice(-4)}`
        : (tc.rawRecipient ? 'raw address' : usedStrategy.recipient);
    });
    if (!recipientSelected) return t.result();

    const assetsReady = await _ss('等待金额页资产加载', async () => {
      const state = await waitForAmountPageAssetsReady(page, { timeout: 10000, token: tc.token });
      return `loaded in ${state.waitedMs}ms`;
    });
    if (!assetsReady) return t.result();

    await _ss(`输入金额 ${tc.amount}`, async () => {
      await enterAmount(page, tc.amount);
      await sleep(800);
      return String(tc.amount);
    });

    if (tc.verifyFiat) {
      try {
        const fiat = await verifyFiatToggle(page);
        await enterAmount(page, tc.amount);
        await sleep(800);
        t.add('切换法币展示', 'passed', fiat);
      } catch (error) {
        t.add('切换法币展示', 'skipped', `未稳定定位法币切换控件: ${error.message}`);
      }
    }

    try {
      const previewResult = await previewAndCancel(page, tc, opts.verifyDepth, selectedRecipientInfo);
      if (String(previewResult).startsWith('insufficient')) {
        lastInsufficient = previewResult;
        t.add(`${verifyStepName} (${usedStrategy.sender})`, 'skipped', `余额不足: ${previewResult}; 尝试下一个账户`);
        try {
          const { mkdirSync } = await import('node:fs');
          mkdirSync(opts.screenshotDir, { recursive: true });
          await page.screenshot({ path: `${opts.screenshotDir}/${tc.id}-${usedStrategy.sender}-insufficient.png` });
        } catch {}
        await closeAllModals(page).catch(() => {});
        await opts.goToWallet(page).catch(() => {});
        continue;
      }
      t.add(verifyStepName, 'passed', previewResult);
      return t.result();
    } catch (error) {
      t.add(verifyStepName, 'failed', error.message || String(error));
      try {
        const { mkdirSync } = await import('node:fs');
        mkdirSync(opts.screenshotDir, { recursive: true });
        await page.screenshot({ path: `${opts.screenshotDir}/${tc.id}-preview-fail.png` });
      } catch {}
      return t.result();
    }
  }

  if (lastInsufficient) {
    t.add(verifyStepName, 'failed', `两个默认账户均余额不足: ${lastInsufficient}`);
  }

  return t.result();
}

async function runInvalidAmountCase(page, tc, opts) {
  const t = createStepTracker(tc.id);
  const _ss = (name, fn) => safeStep(page, t, name, fn, opts.screenshotDir);
  const usedStrategy = await prepareCase(page, tc, opts.goToWallet, t, opts.screenshotDir, opts.accountStrategies);

  await _ss('进入金额页', async () => {
    await openAmountPage(page, tc, usedStrategy.recipient);
    await waitForAmountPageAssetsReady(page, { timeout: 10000, token: tc.token });
    return 'amount page';
  });

  await _ss(`输入非法金额 ${tc.amount}`, async () => {
    await enterAmount(page, tc.amount);
    await sleep(1200);
    const disabled = await isFooterConfirmDisabled(page);
    let textMatched = true;
    try {
      await assertTextGroups(page, tc.expectedTextGroups || []);
    } catch {
      textMatched = false;
    }
    if (!disabled && !textMatched) throw new Error('未显示错误文案，预览按钮也未置灰');
    if (!disabled) throw new Error('预览按钮未置灰');
    return textMatched ? 'error shown and preview disabled' : 'preview disabled without explicit error text';
  });

  await closeAllModals(page).catch(() => {});
  return t.result();
}

async function runInvalidAmountsCase(page, tc, opts) {
  const t = createStepTracker(tc.id);
  const _ss = (name, fn) => safeStep(page, t, name, fn, opts.screenshotDir);
  const usedStrategy = await prepareCase(page, tc, opts.goToWallet, t, opts.screenshotDir, opts.accountStrategies);

  await _ss('进入金额页', async () => {
    await openAmountPage(page, tc, usedStrategy.recipient);
    await waitForAmountPageAssetsReady(page, { timeout: 10000, token: tc.token });
    return 'amount page';
  });

  await _ss('负数 / 0 / 超余额校验', async () => {
    const result = await verifyInvalidAmounts(page);
    return JSON.stringify(result);
  });

  await closeAllModals(page).catch(() => {});
  return t.result();
}

async function runMemoLimitCase(page, tc, opts) {
  const t = createStepTracker(tc.id);
  const _ss = (name, fn) => safeStep(page, t, name, fn, opts.screenshotDir);
  const usedStrategy = await prepareCase(page, tc, opts.goToWallet, t, opts.screenshotDir, opts.accountStrategies);

  await _ss('选择收款人并输入超长 Memo', async () => {
    await selectRecipientFromContacts(page, usedStrategy.recipient);
    await enterMemo(page, tc.memo);
    await sleep(1200);
    const memoBytes = Buffer.byteLength(tc.memo, 'utf8');
    return `${memoBytes} bytes`;
  });

  await _ss('验证 Memo 长度拦截', async () => {
    await assertTextGroups(page, tc.expectedTextGroups || []);
    const disabled = await isFooterConfirmDisabled(page);
    if (!disabled) throw new Error('下一步按钮未置灰');
    return 'limit shown and next disabled';
  });

  await closeAllModals(page).catch(() => {});
  return t.result();
}

async function runRawRecipientBoundaryCase(page, tc, opts) {
  const t = createStepTracker(tc.id);
  const _ss = (name, fn) => safeStep(page, t, name, fn, opts.screenshotDir);
  const rawRecipient = process.env[tc.recipientEnv];
  if (!rawRecipient) {
    t.skip('缺少新账户地址', `设置 ${tc.recipientEnv} 后执行该用例`);
    return t.result();
  }
  const usedStrategy = await prepareCase(
    page,
    { ...tc, rawRecipient },
    opts.goToWallet,
    t,
    opts.screenshotDir,
    opts.accountStrategies,
  );

  await _ss('输入新账户地址并进入金额页', async () => {
    await openAmountPage(page, { ...tc, rawRecipient }, usedStrategy.recipient);
    await waitForAmountPageAssetsReady(page, { timeout: 10000, token: tc.token });
    return `${tc.recipientEnv}=set`;
  });

  await _ss(`输入金额 ${tc.amount} 并验证激活拦截`, async () => {
    await enterAmount(page, tc.amount);
    await sleep(1500);
    const text = await getVisibleText(page);
    const missing = findMissingGroups(text, tc.expectedTextGroups || []);
    if (missing.length) {
      await clickFooterConfirm(page);
      await sleep(1500);
    }
    await assertTextGroups(page, tc.expectedTextGroups || []);
    return 'activation boundary shown';
  });

  await closeAllModals(page).catch(() => {});
  return t.result();
}

function cloneCase(tc, prefix, namePrefix) {
  return {
    ...tc,
    id: withPrefix(prefix, tc.id),
    name: `${namePrefix}${tc.name}`,
  };
}

export function createSoftwareWalletTransferTests({
  chain,
  prefix,
  namePrefix = '',
  goToWallet,
  screenshotDir,
  accountStrategies = DEFAULT_STRATEGIES,
  verifyDepth = process.env.TRANSFER_VERIFY_DEPTH || 'submit',
}) {
  if (!chain || !SOFTWARE_WALLET_TRANSFER_AUTOMATION_CASES[chain]) {
    throw new Error(`Unknown software-wallet transfer chain: ${chain}`);
  }
  if (!goToWallet) throw new Error('createSoftwareWalletTransferTests: goToWallet is required');

  const opts = { goToWallet, screenshotDir, accountStrategies, verifyDepth };
  const sourceCases = SOFTWARE_WALLET_TRANSFER_AUTOMATION_CASES[chain].map((tc) =>
    cloneCase(tc, prefix, namePrefix),
  );

  const testCases = sourceCases.map((tc) => ({
    id: tc.id,
    name: tc.name,
    fn: async (page) => {
      if (tc.skipAutomation) {
        const t = createStepTracker(tc.id);
        t.skip('自动化跳过', tc.skipAutomation);
        return t.result();
      }
      if (tc.type === 'preview') return runPreviewCase(page, tc, opts);
      if (tc.type === 'invalid-amount') return runInvalidAmountCase(page, tc, opts);
      if (tc.type === 'invalid-amounts') return runInvalidAmountsCase(page, tc, opts);
      if (tc.type === 'memo-limit') return runMemoLimitCase(page, tc, opts);
      if (tc.type === 'raw-recipient-boundary') return runRawRecipientBoundaryCase(page, tc, opts);
      throw new Error(`Unsupported transfer case type: ${tc.type}`);
    },
  }));

  async function setup() {
    return undefined;
  }

  return { testCases, setup };
}
