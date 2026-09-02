/** 钱包主页冒烟 — 元素与 Tab 标签数据 */

export const HEADER_ELEMENTS = [
  'Wallet-Tab-Header',
  'AccountSelectorTriggerBase',
  'header-right-notification',
];

export const TOP_BAR_ELEMENTS = [
  'nav-header-search',
  'moreActions',
];

export const BOTTOM_TAB_LABELS = ['钱包', '交易', '合约', '发现'];

export const HOME_SMOKE_CASES = [
  { id: 'MOBILE-SMOKE-001', name: '钱包主页元素可见性', kind: 'header' },
  { id: 'MOBILE-SMOKE-002', name: '主页顶部搜索与更多按钮可见', kind: 'topBar' },
  { id: 'MOBILE-SMOKE-003', name: '底部 4 个 Tab 全部可见', kind: 'bottomTabs' },
];
