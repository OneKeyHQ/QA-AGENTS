/** 添加公钥账户 — 测试数据 */

const DEFAULT_XPUB =
  'xpub6CUGRUonZSQ4TWtTMmzXdrXDtypWKiKrhko4egpiMZbpiaQL2jkwSB1icqYh2cfDfVxdx4df189oLKnC5fSwqPfgyP3hooxujYzAu3fDVmz';

export function loadPublicKeyData() {
  return {
    xpub: process.env.XPUB || DEFAULT_XPUB,
    chain: process.env.CHAIN || 'BTC',
  };
}

export function buildPublicKeyCases() {
  const { chain } = loadPublicKeyData();
  return [
    { id: 'MOBILE-ONBOARD-XPUB-001', name: `公钥账户添加 (${chain} xpub)` },
  ];
}
