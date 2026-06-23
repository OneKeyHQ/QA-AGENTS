export const MARKET_MAIN_TABS = ['自选', '热门', '股票', '合约'];
export const MARKET_WATCHLIST_SUBTABS = ['全部', '现货', '合约'];
export const MARKET_PUBLIC_TOKEN_MAIN_TAB = '热门';
export const MARKET_STOCK_MAIN_TAB = '股票';
export const MARKET_PERP_MAIN_TAB = '合约';
export const MARKET_WATCHLIST_MAIN_TAB = '自选';
export const MARKET_SPOT_WATCHLIST_SUBTAB = '现货';

const MARKET_TAB_ALIASES = {
  '自选': ['自选', '自選'],
  '热门': ['热门', '熱門'],
  '股票': ['股票'],
  '合约': ['合约', '合約'],
  '全部': ['全部'],
  '现货': ['现货', '現貨'],
};

const MARKET_LABEL_ALIASES = {
  ...MARKET_TAB_ALIASES,
  '搜索': ['搜索', '搜尋', 'Search'],
  '名称': ['名称', '名稱', 'Name'],
  '价格': ['价格', '價格', 'Price'],
  '涨跌': ['涨跌', '漲跌', '更改', 'Change'],
  '市值': ['市值', 'Market Cap'],
  '流动性': ['流动性', '流動性', 'Liquidity'],
  '交易额': ['交易额', '交易額', 'Volume'],
  '创建时间': ['创建时间', '建立時間', 'Created'],
  '合约持仓量': ['合约持仓量', '合約持倉量', 'Open Interest'],
  '资金费率': ['资金费率', '資金費率', 'Funding Rate'],
  '加密货币': ['加密货币', '加密貨幣', 'Crypto'],
  '贵金属': ['贵金属', '貴金屬', 'Metals'],
  '指数': ['指数', '指數', 'Index'],
  '大宗商品': ['大宗商品', '商品', 'Commodities'],
  '外汇': ['外汇', '外匯', 'Forex'],
  '预上市': ['预上市', '預上市', 'Pre-Market'],
};

export function marketTabLabels(tab) {
  return MARKET_TAB_ALIASES[tab] || [tab];
}

export function marketLabelAliases(label) {
  return MARKET_LABEL_ALIASES[label] || [label];
}

export function marketTextIncludesLabel(text, label) {
  const value = String(text || '');
  return marketLabelAliases(label).some((candidate) => value.includes(candidate));
}

export function countMarketLabelHits(text, labels) {
  return labels.filter((label) => marketTextIncludesLabel(text, label)).length;
}

function hasAnyLabel(text, tab) {
  return marketTabLabels(tab).some((label) => text.includes(label));
}

export function classifyMarketTabs(textContent = '') {
  const normalized = String(textContent).replace(/\s+/g, ' ').trim();
  const visibleMainTabs = MARKET_MAIN_TABS.filter((tab) => hasAnyLabel(normalized, tab));
  const visibleWatchlistSubTabs = MARKET_WATCHLIST_SUBTABS.filter((tab) => hasAnyLabel(normalized, tab));
  const firstMainIndex = Math.min(...visibleMainTabs.flatMap((tab) => marketTabLabels(tab)
    .map((label) => normalized.indexOf(label))
    .filter((index) => index >= 0)));
  const spotIndex = Math.min(...marketTabLabels(MARKET_SPOT_WATCHLIST_SUBTAB)
    .map((label) => normalized.indexOf(label))
    .filter((index) => index >= 0));
  return {
    visibleMainTabs,
    visibleWatchlistSubTabs,
    hasCurrentMainTabs: visibleMainTabs.length === MARKET_MAIN_TABS.length,
    hasLegacySpotMainTab: spotIndex >= 0 && spotIndex < firstMainIndex,
  };
}

export function resolveMarketListEntry(type = 'spot') {
  if (type === 'spot') {
    return {
      mainTab: MARKET_WATCHLIST_MAIN_TAB,
      subTab: MARKET_SPOT_WATCHLIST_SUBTAB,
      legacyMainTab: '现货',
    };
  }
  if (type === 'public-token') {
    return { mainTab: MARKET_PUBLIC_TOKEN_MAIN_TAB };
  }
  if (type === 'stock') {
    return { mainTab: MARKET_STOCK_MAIN_TAB };
  }
  if (type === 'perp') {
    return { mainTab: MARKET_PERP_MAIN_TAB };
  }
  throw new Error(`Unknown market list entry type: ${type}`);
}
