/**
 * Addresses and token contracts copied from
 * docs/qa/rules/swap-network-features.md (source of truth).
 * Update that document first, then sync this file.
 */

export const ACCOUNTS = {
  evm: '0x99f2c780ffCF94f6Fb5B8C38c6cFaE7E12b0d0B0',
  sol: '5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52',
  tron: 'TTZMu9v3cxs3dGhoUABBmE672MN8hsNfb8',
  sui: '0xe9f30f8341a465e854063ea7ae4d94ad1403164d37b0c72839e952b313d3db29',
  ton: 'UQADRchuTBUsiEEtGow4z9Uc33l4dz0nhuNz-7S_8jwCE7oP',
  aptos: '0x1b8e3ea235b70deb8317fa5a81b9908873c19619598895291e557564eb71b6cc',
};

export const NETWORKS = {
  ethereum: { id: 'evm--1', symbol: 'ETH', native: '', usdc: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', usdt: '0xdac17f958d2ee523a2206206994597c13d831ec7', account: 'evm' },
  arbitrum: { id: 'evm--42161', symbol: 'ETH', native: '', usdc: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', usdt: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', account: 'evm' },
  optimism: { id: 'evm--10', symbol: 'ETH', native: '', usdc: '0x0b2c639c533813f4aa9d7837caf62653d097ff85', usdt: '0x94b008aa00579c1307b0ef2c499ad98a8ce58e58', account: 'evm' },
  bsc: { id: 'evm--56', symbol: 'BNB', native: '', usdc: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', usdt: '0x55d398326f99059ff775485246999027b3197955', account: 'evm' },
  polygon: { id: 'evm--137', symbol: 'POL', native: '', usdc: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', usdt: '0xc2132d05d31c914a87c6611c10748aeb04b58e8f', account: 'evm' },
  avalanche: { id: 'evm--43114', symbol: 'AVAX', native: '', usdc: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', usdt: '0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7', account: 'evm' },
  base: { id: 'evm--8453', symbol: 'ETH', native: '', usdc: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', usdt: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', account: 'evm' },
  zksync: { id: 'evm--324', symbol: 'ETH', native: '', usdc: '0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4', usdt: '0x493257fd37edb34451f62edf8d2a0c418852ba4c', account: 'evm' },
  linea: { id: 'evm--59144', symbol: 'ETH', native: '', usdc: '0x176211869ca2b568f2a7d4ee941e073a821ee1ff', usdt: '0xa219439258ca9da29e9cc4ce5596924745e12b93', account: 'evm' },
  scroll: { id: 'evm--534352', symbol: 'ETH', native: '', usdc: '0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4', usdt: '0xf55bec9cafdbe8730f096aa55dad6d22d44099df', account: 'evm' },
  sonic: { id: 'evm--146', symbol: 'S', native: '', usdc: '0x29219dd400f2bf60e5a23d13be72b486d4038894', usdt: '0x6047828dc181963ba44974801ff68e538da5eaf9', account: 'evm' },
  solana: { id: 'sol--101', symbol: 'SOL', native: '', usdc: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', usdt: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', account: 'sol' },
  tron: { id: 'tron--0x2b6653dc', symbol: 'TRX', native: '', usdc: 'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8', usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', account: 'tron' },
  sui: { id: 'sui--mainnet', symbol: 'SUI', native: '0x2::sui::SUI', usdc: '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC', usdt: '0x375f70cf2ae4c00bf37117d0c85a2c71545e6ee05c4a5c7d282cd66a4504b068::usdt::USDT', account: 'sui' },
  ton: { id: 'ton--mainnet', symbol: 'TON', native: '', usdc: '', usdt: 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs', account: 'ton' },
  aptos: { id: 'aptos--1', symbol: 'APT', native: '0x1::aptos_coin::AptosCoin', usdc: '0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b', usdt: '0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b', account: 'aptos' },
};

/**
 * From-token amounts. Too small → provider min-amount / empty quote.
 * Native: raised above the old ~100U probe so DEX min-amount is less likely.
 * Token (USDC as from): ~100U.
 * Edit here, then refresh Dashboard 接口列表 and re-run.
 */
export const NATIVE_AMOUNT = {
  'evm--1': '0.2',
  'evm--42161': '0.2',
  'evm--10': '0.2',
  'evm--56': '0.5',
  'evm--137': '1500',
  'evm--43114': '20',
  'evm--8453': '0.2',
  'evm--324': '0.2',
  'evm--59144': '0.2',
  'evm--534352': '0.2',
  'evm--146': '2600',
  'sol--101': '1',
  'tron--0x2b6653dc': '500',
  'sui--mainnet': '1000',
  'ton--mainnet': '20',
  'aptos--1': '1',
};

export const STABLE_AMOUNT = {
  evm: '100',
  sol: '100',
  tron: '100',
  sui: '100',
  ton: '100',
  aptos: '100',
};

export function userAddress(network) {
  return ACCOUNTS[network.account];
}

export function quoteParams({ network, fromNetwork, toNetwork, fromToken, toToken, amount }) {
  const from = fromNetwork || network;
  const to = toNetwork || network;
  return {
    fromTokenAddress: fromToken,
    toTokenAddress: toToken,
    fromTokenAmount: String(amount),
    fromNetworkId: from.id,
    toNetworkId: to.id,
    protocol: 'Swap',
    userAddress: userAddress(from),
    slippagePercentage: '0.5',
    autoSlippage: 'true',
    receivingAddress: userAddress(to),
    kind: 'sell',
    toTokenAmount: '',
    denySingleSwapProvider: '',
  };
}
