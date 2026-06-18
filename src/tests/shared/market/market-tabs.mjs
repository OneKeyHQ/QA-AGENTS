export const MARKET_MAIN_TABS = ['自选', '热门', '股票', '合约'];
export const MARKET_WATCHLIST_SUBTABS = ['全部', '现货', '合约'];
export const MARKET_PUBLIC_TOKEN_MAIN_TAB = '热门';
export const MARKET_STOCK_MAIN_TAB = '股票';
export const MARKET_PERP_MAIN_TAB = '合约';
export const MARKET_WATCHLIST_MAIN_TAB = '自选';
export const MARKET_SPOT_WATCHLIST_SUBTAB = '现货';

export function classifyMarketTabs(textContent = '') {
  const normalized = String(textContent).replace(/\s+/g, ' ').trim();
  const visibleMainTabs = MARKET_MAIN_TABS.filter((tab) => normalized.includes(tab));
  const visibleWatchlistSubTabs = MARKET_WATCHLIST_SUBTABS.filter((tab) => normalized.includes(tab));
  const firstMainIndex = Math.min(...visibleMainTabs.map((tab) => normalized.indexOf(tab)));
  const spotIndex = normalized.indexOf(MARKET_SPOT_WATCHLIST_SUBTAB);
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
