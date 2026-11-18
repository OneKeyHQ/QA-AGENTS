import { requestJson } from './http.mjs';

const tokenPriceCache = new Map();

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function roundFiat(value) {
  return Math.round(value * 100) / 100;
}

function tokenCacheKey(networkId, contractAddress) {
  const addr = String(contractAddress || '');
  const normalized = addr.startsWith('0x') ? addr.toLowerCase() : addr;
  return `${networkId}|${normalized}`;
}

async function loadTokenPrices({ baseUrl, headers, timeoutMs, networkId }) {
  if (tokenPriceCache.has(networkId)) return tokenPriceCache.get(networkId);
  const prices = new Map();
  try {
    const res = await requestJson({
      baseUrl,
      path: '/swap/v1/tokens',
      query: { protocol: 'Swap', networkId },
      headers,
      timeoutMs,
    });
    const list = Array.isArray(res.json?.data) ? res.json.data : [];
    for (const token of list) {
      const price = num(token.price);
      if (price == null) continue;
      prices.set(tokenCacheKey(token.networkId || networkId, token.contractAddress), price);
    }
  } catch {
    // Missing prices → do not skip build.
  }
  tokenPriceCache.set(networkId, prices);
  return prices;
}

async function tokenPrice({ baseUrl, headers, timeoutMs, networkId, contractAddress }) {
  const prices = await loadTokenPrices({ baseUrl, headers, timeoutMs, networkId });
  return prices.get(tokenCacheKey(networkId, contractAddress)) ?? null;
}

function explicitFiat(entry) {
  const from = num(
    entry?.fromAmountFiatValue
    ?? entry?.fromTokenFiatValue
    ?? entry?.fromFiatValue
    ?? entry?.info?.fromAmountFiatValue,
  );
  const to = num(
    entry?.toAmountFiatValue
    ?? entry?.toTokenFiatValue
    ?? entry?.toFiatValue
    ?? entry?.info?.toAmountFiatValue,
  );
  if (from == null || to == null) return null;
  return { fromFiat: roundFiat(from), toFiat: roundFiat(to), source: 'quote' };
}

/**
 * Skip build when from-token fiat value is less than to-token fiat value.
 * Prices come from quote fields when present, otherwise GET /swap/v1/tokens.
 */
export async function evaluateFiatDrop({ baseUrl, headers, timeoutMs, entry, params }) {
  const fromAmount = num(entry?.fromAmount ?? entry?.info?.fromAmount ?? params.fromTokenAmount);
  const toAmount = num(entry?.toAmount ?? entry?.info?.toAmount);
  const quoted = explicitFiat(entry);
  let fromFiat = quoted?.fromFiat ?? null;
  let toFiat = quoted?.toFiat ?? null;
  let source = quoted?.source || 'tokens';

  if (fromFiat == null || toFiat == null) {
    if (fromAmount == null || toAmount == null) {
      return { skipBuild: false, reason: 'missing amounts' };
    }
    const fromPrice = await tokenPrice({
      baseUrl,
      headers,
      timeoutMs,
      networkId: params.fromNetworkId,
      contractAddress: params.fromTokenAddress,
    });
    const toPrice = await tokenPrice({
      baseUrl,
      headers,
      timeoutMs,
      networkId: params.toNetworkId,
      contractAddress: params.toTokenAddress,
    });
    if (fromPrice == null || toPrice == null) {
      return { skipBuild: false, reason: 'missing token price', fromPrice, toPrice };
    }
    fromFiat = roundFiat(fromAmount * fromPrice);
    toFiat = roundFiat(toAmount * toPrice);
  }

  if (fromFiat < toFiat) {
    const gainPct = fromFiat === 0 ? 100 : roundFiat(((toFiat - fromFiat) / fromFiat) * 100);
    return {
      skipBuild: true,
      fromFiat,
      toFiat,
      source,
      reason: `from 法币价值 < to 法币价值`,
      detail: `fromFiat=${fromFiat} < toFiat=${toFiat} (gain ${gainPct}%, source=${source})`,
    };
  }
  return { skipBuild: false, fromFiat, toFiat, source };
}
