/** 导入助记词 — 测试数据 */

const DEFAULT_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

export function loadImportMnemonicData() {
  const mnemonic = process.env.PHRASE || DEFAULT_MNEMONIC;
  return {
    mnemonic,
    password: process.env.WALLET_PASSWORD || '11111111',
    wordCount: mnemonic.split(/\s+/).length,
  };
}

export function buildImportMnemonicCases() {
  const { wordCount } = loadImportMnemonicData();
  return [
    {
      id: 'MOBILE-ONBOARD-IMPORT-001',
      name: `助记词导入流程 (${wordCount} 词)`,
    },
  ];
}
