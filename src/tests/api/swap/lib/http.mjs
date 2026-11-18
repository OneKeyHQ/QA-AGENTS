export function toQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
}

export async function requestJson({
  baseUrl,
  method = 'GET',
  path,
  query,
  body,
  headers,
  timeoutMs,
}) {
  const url = `${baseUrl}${path}${query ? `?${toQuery(query)}` : ''}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        ...headers,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { url, status: res.status, text, json };
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error(`timeout after ${timeoutMs}ms`);
      timeoutError.code = 'TIMEOUT';
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function parseSseEvents(body) {
  const events = [];
  for (const line of String(body || '').split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const jsonStr = line.replace(/^data:\s*/, '').trim();
    if (!jsonStr) continue;
    try {
      events.push(JSON.parse(jsonStr));
    } catch {
      // ignore incomplete SSE chunks
    }
  }
  return events;
}

export function flattenQuoteEntries(payload) {
  if (payload && !Array.isArray(payload) && Array.isArray(payload.data)) {
    return payload.data.filter((item) => item && (item.info || item.provider));
  }
  const events = Array.isArray(payload) ? payload : [];
  const fromEvents = [];
  for (const event of events) {
    if (Array.isArray(event?.data)) {
      fromEvents.push(...event.data);
    } else if (event?.info || event?.provider) {
      fromEvents.push(event);
    }
  }
  return fromEvents;
}
