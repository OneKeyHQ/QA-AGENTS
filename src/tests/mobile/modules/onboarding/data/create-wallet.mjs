/** 创建软件钱包 — 测试数据 */

const DEFAULT_PASSWORD = '11111111';

export function loadCreateWalletData() {
  return {
    password: process.env.WALLET_PASSWORD || DEFAULT_PASSWORD,
  };
}

export const CREATE_WALLET_CASES = [
  { id: 'MOBILE-ONBOARD-001', name: '创建软件钱包基础流程' },
];
