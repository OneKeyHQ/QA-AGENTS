import { CHANNELS, pairCases } from '../data/channels.mjs';
import { clientHeaders } from '../lib/config.mjs';
import { evaluateFiatDrop } from '../lib/fiat.mjs';
import { evaluateBuild, evaluateQuote, fetchBuildTx, fetchQuote } from '../lib/quote.mjs';
import { formatSkip } from '../lib/skip.mjs';
import { runCase } from '../lib/runner.mjs';

export async function runQuoteBuild(results, ctx, channelKey) {
  const channel = CHANNELS[channelKey];
  const cases = pairCases(channelKey, { suite: ctx.suite });
  for (const testCase of cases) {
    await runCase(results, {
      id: testCase.id,
      name: testCase.name,
      classname: `swap.api.${channel.provider}`,
      fn: async () => runOneQuoteBuild(ctx, channel, testCase),
    });
  }
}

export async function runOneQuoteBuild(ctx, channel, testCase, tracker) {
  const headers = clientHeaders({ sse: channel.quoteMode === 'sse' });
  let quoteRes;
  try {
    quoteRes = await fetchQuote({
      baseUrl: ctx.baseUrl,
      headers,
      timeoutMs: ctx.timeoutMs,
      mode: channel.quoteMode,
      params: testCase.params,
    });
  } catch (err) {
    if (String(err.code) === 'TIMEOUT' || /timeout|超时/i.test(err.message)) {
      const reason = formatSkip(testCase.name, channel.provider, 'quote timeout', err.message);
      tracker?.skip('询价', reason);
      return { status: 'skipped', reason };
    }
    tracker?.add('询价', 'failed', err.message);
    throw err;
  }

  if ([502, 503, 504].includes(quoteRes.status)) {
    tracker?.skip('询价', `HTTP ${quoteRes.status}`);
  } else {
    tracker?.add(
      '询价',
      quoteRes.status === 200 ? 'passed' : 'failed',
      `amount=${testCase.params.fromTokenAmount} HTTP ${quoteRes.status} entries=${quoteRes.entries.length}`,
    );
  }

  const quote = evaluateQuote({
    caseName: testCase.name,
    provider: channel.provider,
    status: quoteRes.status,
    entries: quoteRes.entries,
    needsQuoteResultCtx: channel.skipBuild ? false : channel.needsQuoteResultCtx,
    bodyText: quoteRes.text,
  });
  if (quote.status !== 'passed') {
    if (quote.status === 'skipped') {
      const reason = formatSkip(testCase.name, channel.provider, quote.reason, quote.detail);
      tracker?.skip(quote.reason === '没有支持的报价结果' ? '询价' : '命中渠道', reason);
      return { status: 'skipped', reason };
    }
    tracker?.add('命中渠道', 'failed', quote.detail || quote.reason);
    return quote;
  }
  tracker?.add('命中渠道', 'passed', `${channel.provider} toAmount=${quote.entry.toAmount || quote.entry.info?.toAmount || ''}`);

  if (channel.skipBuild) {
    return { status: 'passed', reason: `${channel.provider} quote only` };
  }

  const fiat = await evaluateFiatDrop({
    baseUrl: ctx.baseUrl,
    headers: clientHeaders(),
    timeoutMs: ctx.timeoutMs,
    entry: quote.entry,
    params: testCase.params,
  });
  if (fiat.skipBuild) {
    const reason = formatSkip(testCase.name, channel.provider, '跳过 build：from 法币价值 < to 法币价值', fiat.detail);
    tracker?.skip('构建', reason);
    return { status: 'skipped', reason };
  }

  const buildBody = {
    fromTokenAddress: testCase.params.fromTokenAddress,
    toTokenAddress: testCase.params.toTokenAddress,
    fromTokenAmount: String(testCase.params.fromTokenAmount),
    toTokenAmount: String(quote.entry.toAmount || quote.entry.info?.toAmount || '0'),
    fromNetworkId: testCase.params.fromNetworkId,
    toNetworkId: testCase.params.toNetworkId,
    protocol: 'Swap',
    provider: channel.provider,
    userAddress: testCase.params.userAddress,
    receivingAddress: testCase.params.receivingAddress,
    slippagePercentage: testCase.params.slippagePercentage,
    kind: testCase.params.kind,
    walletType: 'hd',
  };
  if (channel.needsQuoteResultCtx) {
    buildBody.quoteResultCtx = quote.entry.quoteResultCtx || quote.entry.info?.quoteResultCtx;
  }
  if (typeof channel.extraBuildFields === 'function') {
    Object.assign(buildBody, channel.extraBuildFields({ params: testCase.params, quote }));
  } else if (channel.extraBuildFields) {
    Object.assign(buildBody, channel.extraBuildFields);
  }

  const buildRes = await fetchBuildTx({
    baseUrl: ctx.baseUrl,
    headers: clientHeaders(),
    timeoutMs: ctx.timeoutMs,
    body: buildBody,
  });
  const built = evaluateBuild({
    provider: channel.provider,
    needsQuoteResultCtx: channel.needsQuoteResultCtx,
    requireTx: channel.buildRequiresTx !== false,
    res: buildRes,
  });
  if (built.status === 'skipped') tracker?.skip('构建', built.reason);
  else tracker?.add('构建', built.status === 'passed' ? 'passed' : 'failed', built.detail || built.reason);
  return built;
}
