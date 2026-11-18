const SKIP_HTTP = new Set([502, 503, 504]);
const SKIP_MESSAGES = new Set(['Provider error', '渠道商异常', '报价不可用']);

export function isQuoteUnavailableMessage(text) {
  return /报价不可用|quote unavailable/i.test(String(text || ''));
}

export function isUnsupportedPairMessage(text) {
  return /不支持该交易对|交易对不支持|unsupported pair|pair not supported/i.test(String(text || ''));
}

export function isSkipBuildMessage(text) {
  return isQuoteUnavailableMessage(text) || isUnsupportedPairMessage(text);
}

export function collectApiMessage(payload) {
  if (payload == null) return '';
  if (typeof payload === 'string') return payload;
  const json = payload.json && typeof payload.json === 'object' ? payload.json : payload;
  const parts = [
    json?.message,
    json?.data?.message,
    json?.errorMessage,
    json?.data?.errorMessage,
    typeof json?.data === 'string' ? json.data : '',
    payload.text,
  ];
  return parts.filter(Boolean).join(' ');
}

export function isTimeoutError(err) {
  const text = String(err?.message || err || '').toLowerCase();
  return err?.code === 'TIMEOUT' || text.includes('timeout') || text.includes('timed out') || text.includes('超时');
}

export function quoteTransportSkip(err, status) {
  if (err && isTimeoutError(err)) return { skip: true, reason: 'quote timeout', detail: String(err.message || err) };
  if (SKIP_HTTP.has(Number(status))) {
    return { skip: true, reason: `quote HTTP ${status}`, detail: 'upstream' };
  }
  return { skip: false };
}

export function quotePayloadSkip({ data, provider, providerEntry }) {
  const arr = Array.isArray(data) ? data : [];
  if (!arr.length) return { skip: true, reason: '没有支持的报价结果', detail: 'data=[]' };
  const message = quoteEntryError(providerEntry);
  if (providerEntry && (SKIP_MESSAGES.has(message) || isSkipBuildMessage(message))) {
    return { skip: true, reason: '没有支持的报价结果', detail: `provider=${provider} errorMessage=${message}` };
  }
  return { skip: false };
}

export function quoteEntryError(entry) {
  return String(entry?.errorMessage || entry?.info?.errorMessage || '').trim();
}

export function formatSkip(name, provider, reason, detail) {
  return `[${name}] SKIP ${provider} ${reason}${detail ? ` | ${detail}` : ''}`;
}
