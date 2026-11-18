import { flattenQuoteEntries, parseSseEvents, requestJson } from './http.mjs';
import {
  collectApiMessage,
  isSkipBuildMessage,
  quoteEntryError,
  quotePayloadSkip,
  quoteTransportSkip,
} from './skip.mjs';

export function providerName(entry) {
  return String(entry?.info?.provider || entry?.provider || '').trim();
}

export function providerMatches(actual, expected) {
  const name = String(actual || '').toLowerCase();
  const base = String(expected || '').toLowerCase();
  if (!name || !base) return false;
  const variants = [base];
  if (base.startsWith('swap')) variants.push(base.slice(4));
  return variants.some((item) => name === item || name.includes(item));
}

export function findProviderEntry(data, provider) {
  return (data || []).find((entry) => providerMatches(providerName(entry), provider));
}

export function hasQuoteAmount(entry) {
  return Boolean(
    entry?.toAmount
    || entry?.fromAmount
    || entry?.info?.toAmount
    || entry?.info?.fromAmount,
  );
}

export function quoteToAmount(entry) {
  return entry?.toAmount ?? entry?.info?.toAmount;
}

export function hasUsableToAmount(entry) {
  const raw = String(quoteToAmount(entry) ?? '').replace(/,/g, '').trim();
  if (!raw) return false;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0;
}

export function quoteResultCtxOf(entry) {
  return entry?.quoteResultCtx || entry?.info?.quoteResultCtx;
}

export async function fetchQuote({ baseUrl, headers, timeoutMs, mode, params }) {
  const path = mode === 'sse' ? '/swap/v1/quote/events' : '/swap/v1/quote';
  const res = await requestJson({
    baseUrl,
    path,
    query: params,
    headers,
    timeoutMs,
  });
  const entries = mode === 'sse'
    ? flattenQuoteEntries(parseSseEvents(res.text))
    : flattenQuoteEntries(res.json);
  return { ...res, entries };
}

export function isCloudflareBlock(status, text) {
  if (Number(status) !== 403) return false;
  return /cloudflare|cf-ray|just a moment|attention required/i.test(String(text || ''));
}

export function evaluateQuote({ caseName, provider, status, entries, needsQuoteResultCtx, bodyText }) {
  const transport = quoteTransportSkip(null, status);
  if (transport.skip) return { status: 'skipped', ...transport, providers: [] };

  if (status !== 200) {
    if (isCloudflareBlock(status, bodyText)) {
      return {
        status: 'failed',
        reason: 'quote HTTP 403 Cloudflare',
        detail: 'swap.onekeycn.com 被 Cloudflare 拦截。浏览器 curl 能过是因为带了 __cf_bm。在项目根 .env 设置 SWAP_API_COOKIE=__cf_bm=... 后重启 Dashboard（不要把 cookie 提交到 git）',
        providers: [],
      };
    }
    return {
      status: 'failed',
      reason: `quote HTTP ${status}`,
      providers: [],
    };
  }

  const target = findProviderEntry(entries, provider);
  const payloadSkip = quotePayloadSkip({ data: entries, provider, providerEntry: target });
  if (payloadSkip.skip) return { status: 'skipped', ...payloadSkip, providers: entries.map(providerName) };

  const providers = entries.map(providerName).filter(Boolean);
  if (!target) {
    return {
      status: 'skipped',
      reason: '没有支持的报价结果',
      detail: `quote did not hit ${provider}; providers=${JSON.stringify(providers)}`,
      providers,
    };
  }

  const errorMessage = quoteEntryError(target);
  if (errorMessage) {
    return {
      status: 'skipped',
      reason: '没有支持的报价结果',
      detail: `${provider} errorMessage=${errorMessage}`,
      providers,
      entry: target,
    };
  }
  if (!hasQuoteAmount(target)) {
    return {
      status: 'skipped',
      reason: '没有支持的报价结果',
      detail: `${provider} missing toAmount/fromAmount`,
      providers,
      entry: target,
    };
  }
  if (needsQuoteResultCtx && !quoteResultCtxOf(target)) {
    return {
      status: 'failed',
      reason: `${provider} missing quoteResultCtx`,
      providers,
      entry: target,
    };
  }

  return {
    status: 'passed',
    reason: `${caseName} quote hit ${provider}`,
    providers,
    entry: target,
  };
}

export async function fetchBuildTx({ baseUrl, headers, timeoutMs, body }) {
  return requestJson({
    baseUrl,
    method: 'POST',
    path: '/swap/v1/build-tx',
    headers,
    timeoutMs,
    body,
  });
}

export function evaluateBuild({ provider, needsQuoteResultCtx, requireTx = true, res }) {
  const transport = quoteTransportSkip(null, res.status);
  if (transport.skip) return { status: 'skipped', reason: transport.reason.replace('quote', 'build'), detail: transport.detail };

  const skipMsg = collectApiMessage(res);
  if (isSkipBuildMessage(skipMsg)) {
    return {
      status: 'skipped',
      reason: '没有支持的报价结果',
      detail: skipMsg.trim().slice(0, 300) || '报价不可用 / 不支持该交易对，跳过 build',
    };
  }

  if (res.status !== 200) {
    return { status: 'failed', reason: `build HTTP ${res.status}`, detail: res.text?.slice(0, 300) };
  }

  const json = res.json || {};
  if (Number(json.code) !== 0) {
    return {
      status: 'failed',
      reason: `build code=${json.code}`,
      detail: json.message || '',
    };
  }
  if (!json.data) {
    return { status: 'failed', reason: `${provider} build empty data` };
  }
  const dataKeys = json.data && typeof json.data === 'object' ? Object.keys(json.data).join(',') : String(json.data);
  if (requireTx && !json.data.tx) {
    return { status: 'failed', reason: `${provider} build missing data.tx`, detail: `dataKeys=${dataKeys}` };
  }
  if (!requireTx && !json.data.tx && !json.data.orderId && !json.data.result) {
    return { status: 'failed', reason: `${provider} build missing data.tx/orderId/result`, detail: `dataKeys=${dataKeys}` };
  }
  return {
    status: 'passed',
    reason: json.data.tx
      ? `${provider} build returned data.tx`
      : `${provider} build returned data`,
    detail: json.data.tx ? undefined : `dataKeys=${dataKeys}`,
  };
}
