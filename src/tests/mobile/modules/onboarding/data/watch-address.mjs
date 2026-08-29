/** 添加观察地址 — 测试数据 */

const DEFAULT_ADDR = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';

export function loadWatchAddressData() {
  const chain = process.env.CHAIN || 'BTC';
  return {
    address: process.env.ADDR || DEFAULT_ADDR,
    chain,
    walletName: process.env.WALLET_NAME || `Watch-${chain}`,
  };
}

export function buildWatchAddressCases() {
  const { chain } = loadWatchAddressData();
  return [
    { id: 'MOBILE-ONBOARD-WATCH-001', name: `观察地址添加 (${chain})` },
  ];
}
