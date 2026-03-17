/**
 * Swap OKX 渠道 - SSE 询价测试
 * 支持网络：Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Fantom、zkSync Era、Base、Solana、Tron、TON、SUI
 * 来源：docs/qa/rules/swap-rules.md
 *
 * 使用：复制到 Postman/Apifox 请求的 Tests 脚本中执行
 */

/****************************************************
 * 0. 测试用例定义：name + params
 ****************************************************/
const testCases = [
  {
    name: "Ethereum.ETH 1 → USDC",
    params: {
      fromTokenAddress: "",
      toTokenAddress: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      fromTokenAmount: "1",
      fromNetworkId: "evm--1",
      toNetworkId: "evm--1",
      protocol: "Swap",
      userAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      slippagePercentage: "0.5",
      autoSlippage: "true",
      receivingAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      kind: "sell",
      toTokenAmount: "",
    },
  },
  {
    name: "Polygon 10 POL → USDC",
    params: {
      fromTokenAddress: "",
      toTokenAddress: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359",
      fromTokenAmount: "10",
      fromNetworkId: "evm--137",
      toNetworkId: "evm--137",
      protocol: "Swap",
      userAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      slippagePercentage: "0.5",
      autoSlippage: "true",
      receivingAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      kind: "sell",
      toTokenAmount: "",
    },
  },
  {
    name: "Arbitrum.ETH 1 → USDC",
    params: {
      fromTokenAddress: "",
      toTokenAddress: "0xaf88d065e77c8cc2239327c5edb3a432268e5831",
      fromTokenAmount: "1",
      fromNetworkId: "evm--42161",
      toNetworkId: "evm--42161",
      protocol: "Swap",
      userAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      slippagePercentage: "0.5",
      autoSlippage: "true",
      receivingAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      kind: "sell",
      toTokenAmount: "",
    },
  },
  {
    name: "BSC.BNB 1 → USDC",
    params: {
      fromTokenAddress: "",
      toTokenAddress: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      fromTokenAmount: "1",
      fromNetworkId: "evm--56",
      toNetworkId: "evm--56",
      protocol: "Swap",
      userAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      slippagePercentage: "0.5",
      autoSlippage: "true",
      receivingAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      kind: "sell",
      toTokenAmount: "",
    },
  },
  {
    name: "Base.ETH 1 → USDC",
    params: {
      fromTokenAddress: "",
      toTokenAddress: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
      fromTokenAmount: "1",
      fromNetworkId: "evm--8453",
      toNetworkId: "evm--8453",
      protocol: "Swap",
      userAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      slippagePercentage: "0.5",
      autoSlippage: "true",
      receivingAddress: "0x4EF880525383ab4E3d94b7689e3146bF899A296e",
      kind: "sell",
      toTokenAmount: "",
    },
  },
  {
    name: "Solana.SOL 0.1 → USDC",
    params: {
      fromTokenAddress: "",
      toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      fromTokenAmount: "0.1",
      fromNetworkId: "sol--101",
      toNetworkId: "sol--101",
      protocol: "Swap",
      userAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      slippagePercentage: "0.5",
      autoSlippage: "true",
      receivingAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      kind: "sell",
      toTokenAmount: "",
      denySingleSwapProvider: "",
    },
  },
];

/****************************************************
 * 1. 基础配置
 ****************************************************/
const BASE_URL = "https://swap.onekeytest.com/swap/v1/quote/events";
const PROVIDER_ASSERT = "SwapOKX"; // 统一写法：Swap+渠道名

const headers = {
  accept: "text/event-stream",
  "accept-language": "zh-CN",
  "cache-control": "no-cache",
  "x-onekey-hide-asset-details": "false",
  "x-onekey-instance-id": "d0a55f07-5fa9-419e-a041-b847642a9de0",
  "x-onekey-request-build-number": "2026022727",
  "x-onekey-request-currency": "usd",
  "x-onekey-request-device-name": "OneKey Desktop",
  "x-onekey-request-id": "1bf4ad0d-50d3-4660-bf43-3fb67e06dd8d",
  "x-onekey-request-jsbundle-version": "2",
  "x-onekey-request-locale": "zh-cn",
  "x-onekey-request-platform": "desktop-macosStore",
  "x-onekey-request-platform-name": "MacBook Pro (14-inch, M4 Max, 2024)",
  "x-onekey-request-theme": "light",
  "x-onekey-request-version": "6.1.0",
  "x-onekey-wallet-type": "hd",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) OneKeyWallet/6.1.0 Chrome/142.0.7444.265 Electron/39.5.1 Safari/537.36",
};

/****************************************************
 * 2. 工具函数
 ****************************************************/
function buildQuery(params) {
  return Object.entries(params)
    .filter(([k, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

function extractEventsFromSSE(body) {
  const lines = body.split(/\r?\n/);
  const events = [];
  for (const line of lines) {
    if (!line.startsWith("data:")) continue;
    const jsonStr = line.replace("data:", "").trim();
    if (!jsonStr) continue;
    try {
      events.push(JSON.parse(jsonStr));
    } catch (e) {
      console.error("❌ SSE JSON 解析失败:", jsonStr);
    }
  }
  return events;
}

function matchProvider(item, expected) {
  const p = (item && item.info && item.info.provider) || "";
  return p === expected || p.toLowerCase().includes(expected.toLowerCase());
}

/****************************************************
 * 3. 断言
 ****************************************************/
function assertBasic(res, caseName) {
  pm.test(`[${caseName}] HTTP 状态码为 200`, () => {
    pm.expect(res.code || res.status).to.equal(200);
  });
}

function assertProvider(events, caseName, expected) {
  const hit = events.some((ev) => {
    if (!ev || !Array.isArray(ev.data)) return false;
    return ev.data.some((item) => matchProvider(item, expected));
  });
  pm.test(`[${caseName}] 任意事件中 info.provider 包含 "${expected}"`, () => {
    pm.expect(hit, `未在 SSE 流中找到 info.provider 包含 "${expected}"`).to.equal(true);
  });
}

/****************************************************
 * 4. 汇总
 ****************************************************/
const summary = [];
function pushSummary(caseName, events, hasProvider) {
  summary.push({ name: caseName, eventCount: events.length, hasEvents: events.length > 0, hasProvider });
}
function printSummary() {
  console.log("\n===== [OKX] SSE 测试汇总 =====");
  summary.forEach((item, idx) => {
    console.log(`#${idx + 1} ${item.name} | events=${item.eventCount} | hasProvider=${item.hasProvider}`);
  });
}

/****************************************************
 * 5. 执行
 ****************************************************/
function runCase(index) {
  if (index >= testCases.length) {
    printSummary();
    console.log("🎉 [OKX] 所有 SSE 用例执行完成");
    return;
  }

  const c = testCases[index];
  const caseName = c.name || `Case ${index + 1}`;
  const url = `${BASE_URL}?${buildQuery(c.params)}`;

  console.log(`\n===== [OKX] ${caseName} (${index + 1}/${testCases.length}) =====`);
  console.log("请求 URL:", url);

  pm.sendRequest({ url, method: "GET", header: headers }, (err, res) => {
    if (err) throw new Error(`❌ 请求失败: ${err}`);

    const rawBody = res.text();
    const events = extractEventsFromSSE(rawBody);

    console.log("解析出的 events 数量:", events.length);

    assertBasic(res, caseName);

    const hasProvider = events.some((ev) => {
      if (!ev || !Array.isArray(ev.data)) return false;
      return ev.data.some((item) => matchProvider(item, PROVIDER_ASSERT));
    });
    assertProvider(events, caseName, PROVIDER_ASSERT);

    pushSummary(caseName, events, hasProvider);
    runCase(index + 1);
  });
}

runCase(0);
