/**
 * Swap 各渠道 SSE 询价测试 - 渠道配置
 * 来源：docs/qa/rules/swap-rules.md 渠道网络支持矩阵
 *
 * 每个渠道包含：
 * - channelId: 渠道标识
 * - providerAssert: SSE 返回的 info.provider 期望值（支持多种格式时用数组）
 * - testCases: 该渠道支持的网络测试用例
 */

const USER_ADDRESS_EVM = "0x4EF880525383ab4E3d94b7689e3146bF899A296e";
const USER_ADDRESS_SOL = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";
const USER_ADDRESS_APT = "0x4ef880525383ab4e3d94b7689e3146bf899a296e";

const TOKENS = {
  "evm--1": { to: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", toSymbol: "USDC" },
  "evm--56": { to: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", toSymbol: "USDC" },
  "evm--137": { to: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", toSymbol: "USDC" },
  "evm--324": { to: "0x1d17cbcf0d6d143135ae902365d2e5e2a16538d4", toSymbol: "USDC" },
  "evm--42161": { to: "0xaf88d065e77c8cc2239327c5edb3a432268e5831", toSymbol: "USDC" },
  "evm--10": { to: "0x0b2c639c533813f4aa9d7837caf62653d097ff85", toSymbol: "USDT" },
  "evm--8453": { to: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", toSymbol: "USDC" },
  "evm--43114": { to: "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", toSymbol: "USDC" },
  "sol--101": { to: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", toSymbol: "USDC" },
  "aptos--1": { to: "0x5e156f1207d0ebfa19a9eeff00d62a282278fb8719f4fab3a586a0a2c0fffbea", toSymbol: "USDC" },
};

function buildParams(networkId, fromAmount, userAddress) {
  const toToken = TOKENS[networkId];
  if (!toToken) throw new Error(`Unknown network: ${networkId}`);
  const addr = networkId.startsWith("sol") ? USER_ADDRESS_SOL : networkId.startsWith("aptos") ? USER_ADDRESS_APT : userAddress || USER_ADDRESS_EVM;
  return {
    fromTokenAddress: "",
    toTokenAddress: toToken.to,
    fromTokenAmount: String(fromAmount),
    fromNetworkId: networkId,
    toNetworkId: networkId,
    protocol: "Swap",
    userAddress: addr,
    slippagePercentage: "0.5",
    autoSlippage: "true",
    receivingAddress: addr,
    kind: "sell",
    toTokenAmount: "",
  };
}

const CHANNELS = {
  "0x": {
    channelId: "0x",
    providerAssert: ["Swap0x", "0x"],
    testCases: [
      { name: "Ethereum.ETH 1 → USDC", params: buildParams("evm--1", "1") },
      { name: "Avalanche.AVAX 100 → USDC", params: buildParams("evm--43114", "100") },
      { name: "BSC.BNB 1 → USDC", params: buildParams("evm--56", "1") },
      { name: "Base.ETH 1 → USDC", params: buildParams("evm--8453", "1") },
      { name: "Polygon 10 POL → USDC", params: buildParams("evm--137", "10") },
      { name: "Arbitrum.ETH 1 → USDC", params: buildParams("evm--42161", "1") },
      { name: "Optimism.ETH 1 → USDT", params: { ...buildParams("evm--10", "1"), toTokenAddress: TOKENS["evm--10"].to, toTokenAmount: "0.317388" } },
    ],
  },
  "1inch": {
    channelId: "1inch",
    providerAssert: ["Swap1inch", "1inch", "1inch fusion"],
    testCases: [
      { name: "Ethereum.ETH 1 → USDC", params: buildParams("evm--1", "1") },
      { name: "Avalanche.AVAX 100 → USDC", params: buildParams("evm--43114", "100") },
      { name: "BSC.BNB 1 → USDC", params: buildParams("evm--56", "1") },
      { name: "Base.ETH 1 → USDC", params: buildParams("evm--8453", "1") },
      { name: "Polygon 10 POL → USDC", params: buildParams("evm--137", "10") },
      { name: "Arbitrum.ETH 1 → USDC", params: buildParams("evm--42161", "1") },
      { name: "Optimism.ETH 1 → USDT", params: { ...buildParams("evm--10", "1"), toTokenAddress: TOKENS["evm--10"].to, toTokenAmount: "0.317388" } },
      { name: "zkSync Era.ETH 0.01 → USDC", params: buildParams("evm--324", "0.01") },
    ],
  },
  jupiter: {
    channelId: "jupiter",
    providerAssert: ["SwapJupiter", "Jupiter", "jupiter"],
    testCases: [
      { name: "Solana.SOL 0.1 → USDC", params: buildParams("sol--101", "0.1") },
    ],
  },
  cowswap: {
    channelId: "cowswap",
    providerAssert: ["CowSwap", "cowswap", "CoWSwap"],
    testCases: [
      { name: "Ethereum.ETH 0.01 → USDC", params: buildParams("evm--1", "0.01") },
      { name: "Arbitrum.ETH 0.01 → USDC", params: buildParams("evm--42161", "0.01") },
      { name: "Base.ETH 0.01 → USDC", params: buildParams("evm--8453", "0.01") },
    ],
  },
  okx: {
    channelId: "okx",
    providerAssert: ["SwapOKX", "OKX", "okx"],
    testCases: [
      { name: "Ethereum.ETH 1 → USDC", params: buildParams("evm--1", "1") },
      { name: "Polygon 10 POL → USDC", params: buildParams("evm--137", "10") },
      { name: "Arbitrum.ETH 1 → USDC", params: buildParams("evm--42161", "1") },
      { name: "BSC.BNB 1 → USDC", params: buildParams("evm--56", "1") },
      { name: "Base.ETH 1 → USDC", params: buildParams("evm--8453", "1") },
      { name: "Solana.SOL 0.1 → USDC", params: buildParams("sol--101", "0.1") },
    ],
  },
  panora: {
    channelId: "panora",
    providerAssert: ["SwapPanora", "Panora", "panora"],
    testCases: [
      { name: "Aptos.APT 0.1 → USDC", params: buildParams("aptos--1", "0.1") },
    ],
  },
};

// 供 Postman/Apifox 使用：设置当前要测试的渠道（需在 Postman 环境中设置 swap_test_channel）
// const CURRENT_CHANNEL = pm && pm.environment ? (pm.environment.get("swap_test_channel") || "0x") : "0x";
