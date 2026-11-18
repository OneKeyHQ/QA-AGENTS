import { ACCOUNTS, NATIVE_AMOUNT, NETWORKS, STABLE_AMOUNT, quoteParams } from './fixtures.mjs';

/**
 * Channel matrix from docs/qa/rules/swap-rules.md.
 * quoteMode: json = GET /swap/v1/quote ; sse = GET /swap/v1/quote/events
 * Binance Web3 provider from production /providers/list: SwapBstock.
 */
export const SMOKE_CHANNELS = ['0x', '1inch', 'okx'];

/** First-batch cross-chain routes. No BTC/UTXO until wallet-derived addresses exist. */
function cexBridgeBuildFields(innerKey, defaults = {}, innerDefaults = {}) {
  return ({ params, quote }) => {
    const entry = quote.entry || {};
    const fromAmount = String(params.fromTokenAmount);
    const toAmount = String(entry.toAmount || entry.info?.toAmount || '0');
    const rawCtx = entry.quoteResultCtx || entry.info?.quoteResultCtx || {};
    const inner = rawCtx?.[innerKey] && typeof rawCtx[innerKey] === 'object' ? rawCtx[innerKey] : {};
    const rest = { ...rawCtx };
    delete rest[innerKey];
    return {
      slippagePercentage: 1,
      tradeSource: 'swapBridge',
      bindedAccountAddress: ACCOUNTS.evm,
      bindedNetworkId: 'evm--1',
      rebateAddress: ACCOUNTS.evm,
      quoteResultCtx: {
        [innerKey]: {
          ...innerDefaults,
          ...inner,
          quoteFromAmount: inner.quoteFromAmount || fromAmount,
          quoteToAmount: inner.quoteToAmount || toAmount,
        },
        ...defaults,
        ...rest,
      },
    };
  };
}

export const CROSS_EVM_SOL = [
  ['ethereum', 'arbitrum'],
  ['arbitrum', 'ethereum'],
  ['ethereum', 'bsc'],
  ['bsc', 'ethereum'],
  ['ethereum', 'solana'],
  ['solana', 'ethereum'],
];

export const CHANNELS = {
  '0x': {
    provider: 'Swap0x',
    quoteMode: 'json',
    needsQuoteResultCtx: false,
    networks: ['ethereum', 'arbitrum', 'optimism', 'bsc', 'polygon', 'avalanche', 'base'],
  },
  '1inch': {
    provider: 'Swap1inch',
    quoteMode: 'json',
    needsQuoteResultCtx: false,
    networks: ['ethereum', 'arbitrum', 'optimism', 'bsc', 'polygon', 'avalanche', 'zksync', 'base'],
  },
  okx: {
    provider: 'SwapOKX',
    quoteMode: 'json',
    quoteModeByNetwork: { solana: 'sse' },
    needsQuoteResultCtx: false,
    buildRequiresTx: false,
    extraQuoteParamsByNetwork: { solana: { slippagePercentage: '1' } },
    nativeAmounts: { 'sol--101': '0.4' },
    extraBuildFields: (args) => {
      if (args.params.fromNetworkId !== 'sol--101') return {};
      return cexBridgeBuildFields('okxQuoteResultCtx', {}, { slippageType: 'UnSupported' })(args);
    },
    networks: ['ethereum', 'arbitrum', 'optimism', 'bsc', 'polygon', 'avalanche', 'base', 'solana'],
  },
  jupiter: {
    provider: 'SwapJupiter',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    networks: ['solana'],
  },
  fusion: {
    provider: 'Swap1inchFusion',
    displayName: '1inch Fusion',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    skipBuild: true,
    pairs: ['usdc-native', 'usdc-usdt'],
    networks: ['ethereum', 'arbitrum', 'optimism', 'bsc', 'polygon', 'avalanche'],
  },
  cow: {
    provider: 'SwapCow',
    displayName: 'CowSwap',
    quoteMode: 'json',
    needsQuoteResultCtx: true,
    skipBuild: true,
    networks: ['ethereum', 'arbitrum', 'base'],
  },
  lifi: {
    provider: 'SwapLifi',
    displayName: 'LiFi',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    networks: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'avalanche', 'zksync', 'base', 'optimism', 'solana'],
    crossRoutes: CROSS_EVM_SOL,
  },
  liquidmesh: {
    provider: 'SwapLiquidMesh',
    displayName: 'LiquidMesh',
    quoteMode: 'json',
    needsQuoteResultCtx: true,
    nativeAmounts: { 'sol--101': '0.1' },
    networks: ['ethereum', 'bsc', 'base', 'solana'],
  },
  rocketx: {
    provider: 'SwapRocketX',
    displayName: 'RocketX',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    buildRequiresTx: false,
    extraQuoteParams: { slippagePercentage: '1' },
    extraBuildFields: ({ params, quote }) => {
      const entry = quote.entry || {};
      const fromAmount = String(params.fromTokenAmount);
      const toAmount = String(entry.toAmount || entry.info?.toAmount || '0');
      const rawCtx = entry.quoteResultCtx || entry.info?.quoteResultCtx;
      const inner = rawCtx?.rocketXQuoteResultCtx || rawCtx || {};
      return {
        slippagePercentage: 1,
        tradeSource: 'swapBridge',
        bindedAccountAddress: params.userAddress,
        bindedNetworkId: params.fromNetworkId,
        rebateAddress: params.userAddress,
        quoteResultCtx: {
          rocketXQuoteResultCtx: {
            ...inner,
            quoteFromAmount: inner.quoteFromAmount || fromAmount,
            quoteToAmount: inner.quoteToAmount || toAmount,
          },
        },
      };
    },
    networks: ['ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum', 'optimism', 'base', 'solana', 'sui', 'tron'],
    crossRoutes: CROSS_EVM_SOL,
  },
  houdini: {
    provider: 'SwapHoudi',
    displayName: 'Houdini',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    buildRequiresTx: false,
    extraQuoteParams: { incognito: 'true', slippagePercentage: '2' },
    nativeAmounts: {
      'evm--1': '0.03',
      'evm--42161': '0.03',
      'evm--10': '0.03',
      'evm--8453': '0.03',
    },
    extraBuildFields: ({ params, quote }) => {
      const entry = quote.entry || {};
      const fromAmount = String(params.fromTokenAmount);
      const toAmount = String(entry.toAmount || entry.info?.toAmount || '0');
      const rawCtx = entry.quoteResultCtx || entry.info?.quoteResultCtx;
      const inner = rawCtx?.houdiQuoteResultCtx || rawCtx || {};
      return {
        slippagePercentage: 1,
        tradeSource: 'swapBridge',
        bindedAccountAddress: params.userAddress,
        bindedNetworkId: params.fromNetworkId,
        rebateAddress: params.userAddress,
        quoteResultCtx: {
          houdiQuoteResultCtx: {
            ...inner,
            quoteId: inner.quoteId || inner.id,
            quoteFromAmount: inner.quoteFromAmount || fromAmount,
            quoteToAmount: inner.quoteToAmount || toAmount,
          },
        },
      };
    },
    networks: ['ethereum', 'bsc', 'polygon', 'avalanche', 'arbitrum', 'optimism', 'base', 'solana', 'sui', 'tron'],
    crossRoutes: CROSS_EVM_SOL,
  },
  hifi: {
    provider: 'SwapHifiSwap',
    displayName: 'HiFi',
    quoteMode: 'json',
    needsQuoteResultCtx: true,
    buildRequiresTx: false,
    extraQuoteParams: { slippagePercentage: '1' },
    extraBuildFields: ({ params, quote }) => {
      const entry = quote.entry || {};
      const fromAmount = String(params.fromTokenAmount);
      const toAmount = String(entry.toAmount || entry.info?.toAmount || '0');
      const rawCtx = entry.quoteResultCtx || entry.info?.quoteResultCtx;
      const quoteResultCtx = rawCtx?.hifiSwapQuoteResultCtx
        ? rawCtx
        : {
          hifiSwapQuoteResultCtx: {
            slippageType: 'Hardcoded',
            quoteFromAmount: fromAmount,
            quoteToAmount: toAmount,
            ...(rawCtx && !rawCtx.hifiSwapQuoteResultCtx ? rawCtx : {}),
          },
        };
      return {
        slippagePercentage: 1,
        tradeSource: 'swapBridge',
        bindedAccountAddress: params.userAddress,
        bindedNetworkId: params.fromNetworkId,
        rebateAddress: params.userAddress,
        quoteResultCtx,
      };
    },
    networks: ['ethereum', 'bsc', 'polygon', 'arbitrum', 'base', 'solana', 'tron'],
  },
  swft: {
    provider: 'SwapSwft',
    displayName: 'Swft',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    buildRequiresTx: false,
    stableToken: 'usdt',
    extraQuoteParams: { slippagePercentage: '1' },
    extraBuildFields: ({ params, quote }) => {
      const entry = quote.entry || {};
      const fromAmount = String(params.fromTokenAmount);
      const toAmount = String(entry.toAmount || entry.info?.toAmount || '0');
      const rawCtx = entry.quoteResultCtx || entry.info?.quoteResultCtx;
      const inner = rawCtx?.swftQuoteResultCtx || rawCtx || {};
      return {
        slippagePercentage: 1,
        tradeSource: 'swapBridge',
        bindedAccountAddress: ACCOUNTS.evm,
        bindedNetworkId: 'evm--1',
        rebateAddress: ACCOUNTS.evm,
        quoteResultCtx: {
          swftQuoteResultCtx: {
            ...inner,
            quoteFromAmount: inner.quoteFromAmount || fromAmount,
            quoteToAmount: inner.quoteToAmount || toAmount,
          },
        },
      };
    },
    networks: ['tron', 'sui', 'ton'],
  },
  changelly: {
    provider: 'SwapChangelly',
    displayName: 'Changelly',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    buildRequiresTx: false,
    extraQuoteParams: { slippagePercentage: '1' },
    extraBuildFields: cexBridgeBuildFields('changellyQuoteResultCtx', {
      changellyModel: 'float',
      changellyProtocolFee: '0.000000',
    }),
    networks: ['tron', 'solana', 'ton'],
  },
  changehero: {
    provider: 'SwapChangeHero',
    displayName: 'ChangeHero',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    buildRequiresTx: false,
    extraQuoteParams: { slippagePercentage: '1' },
    extraBuildFields: cexBridgeBuildFields('changeHeroQuoteResultCtx', {
      changeHeroMode: 'float',
      changeHeroNetworkFee: '2.0000000000000000000000',
    }),
    networks: ['tron', 'solana', 'ton'],
  },
  panora: {
    provider: 'SwapPanora',
    displayName: 'Panora',
    quoteMode: 'sse',
    needsQuoteResultCtx: true,
    networks: ['aptos'],
  },
  binance: {
    provider: 'SwapBstock',
    displayName: 'Binance Web3',
    quoteMode: 'json',
    needsQuoteResultCtx: true,
    networks: [
      'bsc', 'ethereum', 'arbitrum', 'base', 'polygon', 'optimism',
      'linea', 'avalanche', 'scroll', 'sonic', 'solana',
    ],
  },
};

function pairDefs(channelKey, networkKey) {
  const channel = CHANNELS[channelKey];
  const network = NETWORKS[networkKey];
  if (!network) throw new Error(`Unknown network ${networkKey} for ${channelKey}`);
  const nativeAmount = channel.nativeAmounts?.[network.id] ?? NATIVE_AMOUNT[network.id];
  const stableAmount = STABLE_AMOUNT[network.account];
  const nativeLabel = `${nativeAmount} ${network.symbol}`;
  const usdcLabel = `${stableAmount} USDC`;
  const usdtLabel = `${stableAmount} USDT`;
  const extra = {
    ...(channel.extraQuoteParams || {}),
    ...(channel.extraQuoteParamsByNetwork?.[networkKey] || {}),
  };
  const preferUsdt = channel.stableToken === 'usdt' || !network.usdc;
  const defs = [];

  const push = ({ pair, name, amountLabel, fromToken, toToken, amount }) => {
    defs.push({
      id: `${channelKey}-${networkKey}-${pair}`,
      name: `${channel.provider} ${networkKey} ${name} | ${amountLabel}`,
      channel: channelKey,
      network: networkKey,
      pair,
      amount: amountLabel,
      params: {
        ...quoteParams({ network, fromToken, toToken, amount }),
        ...extra,
      },
    });
  };

  if (!preferUsdt && network.usdc && nativeAmount != null) {
    push({
      pair: 'native-usdc',
      name: 'native -> USDC',
      amountLabel: nativeLabel,
      fromToken: network.native,
      toToken: network.usdc,
      amount: nativeAmount,
    });
    push({
      pair: 'usdc-native',
      name: 'USDC -> native',
      amountLabel: usdcLabel,
      fromToken: network.usdc,
      toToken: network.native,
      amount: stableAmount,
    });
  }
  if (!preferUsdt && network.usdc && network.usdt) {
    push({
      pair: 'usdc-usdt',
      name: 'USDC -> USDT',
      amountLabel: usdcLabel,
      fromToken: network.usdc,
      toToken: network.usdt,
      amount: stableAmount,
    });
  }
  if (preferUsdt && network.usdt && nativeAmount != null) {
    push({
      pair: 'native-usdt',
      name: 'native -> USDT',
      amountLabel: nativeLabel,
      fromToken: network.native,
      toToken: network.usdt,
      amount: nativeAmount,
    });
    push({
      pair: 'usdt-native',
      name: 'USDT -> native',
      amountLabel: usdtLabel,
      fromToken: network.usdt,
      toToken: network.native,
      amount: stableAmount,
    });
  }
  return defs;
}

function crossPairDefs(channelKey, fromKey, toKey) {
  const channel = CHANNELS[channelKey];
  const from = NETWORKS[fromKey];
  const to = NETWORKS[toKey];
  if (!from || !to) throw new Error(`Unknown cross route ${fromKey}->${toKey} for ${channelKey}`);
  const nativeAmount = channel.nativeAmounts?.[from.id] ?? NATIVE_AMOUNT[from.id];
  const stableAmount = STABLE_AMOUNT[from.account];
  const nativeLabel = `${nativeAmount} ${from.symbol}`;
  const usdcLabel = `${stableAmount} USDC`;
  const extra = channel.extraQuoteParams || {};
  const route = `${fromKey}->${toKey}`;
  const defs = [];

  const push = ({ pair, name, amountLabel, fromToken, toToken, amount }) => {
    defs.push({
      id: `${channelKey}-${fromKey}-${toKey}-${pair}`,
      name: `${channel.provider} ${route} ${name} | ${amountLabel}`,
      channel: channelKey,
      network: route,
      fromNetwork: fromKey,
      toNetwork: toKey,
      pair,
      amount: amountLabel,
      params: {
        ...quoteParams({
          fromNetwork: from,
          toNetwork: to,
          fromToken,
          toToken,
          amount,
        }),
        ...extra,
      },
    });
  };

  if (nativeAmount != null) {
    push({
      pair: 'x-native-native',
      name: `${from.symbol} -> ${to.symbol}`,
      amountLabel: nativeLabel,
      fromToken: from.native,
      toToken: to.native,
      amount: nativeAmount,
    });
  }
  if (nativeAmount != null && to.usdc) {
    push({
      pair: 'x-native-usdc',
      name: `${from.symbol} -> ${toKey} USDC`,
      amountLabel: nativeLabel,
      fromToken: from.native,
      toToken: to.usdc,
      amount: nativeAmount,
    });
  }
  if (from.usdc && nativeAmount != null) {
    push({
      pair: 'x-usdc-native',
      name: `${fromKey} USDC -> ${to.symbol}`,
      amountLabel: usdcLabel,
      fromToken: from.usdc,
      toToken: to.native,
      amount: stableAmount,
    });
  }
  if (from.usdc && to.usdc) {
    push({
      pair: 'x-usdc-usdc',
      name: `${fromKey} USDC -> ${toKey} USDC`,
      amountLabel: usdcLabel,
      fromToken: from.usdc,
      toToken: to.usdc,
      amount: stableAmount,
    });
  }
  return defs;
}

export function pairCases(channelKey, { suite = 'smoke' } = {}) {
  const channel = CHANNELS[channelKey];
  const networkKeys = suite === 'smoke' ? [channel.networks[0]] : channel.networks;
  const allow = channel.pairs || null;
  const cases = [];
  for (const networkKey of networkKeys) {
    let defs = pairDefs(channelKey, networkKey);
    if (allow) defs = defs.filter((item) => allow.includes(item.pair));
    if (suite === 'smoke') defs = defs.slice(0, 1);
    cases.push(...defs);
  }
  if (suite !== 'smoke') {
    for (const [fromKey, toKey] of channel.crossRoutes || []) {
      cases.push(...crossPairDefs(channelKey, fromKey, toKey));
    }
  }
  return cases;
}

export function selectedChannels(filter) {
  const keys = Object.keys(CHANNELS);
  if (!filter) return keys;
  const wanted = filter.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  return keys.filter((key) => wanted.includes(key.toLowerCase()));
}
