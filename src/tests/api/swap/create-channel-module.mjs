import { CHANNELS, pairCases } from './data/channels.mjs';
import { loadConfig } from './lib/config.mjs';
import { runOneQuoteBuild } from './cases/quote-build.mjs';
import { createStepTracker } from '../../helpers/components.mjs';

/**
 * One Dashboard group per Swap channel.
 * Add a channel: 1) CHANNELS in data/channels.mjs  2) one-line *.test.mjs calling this.
 */
export function createChannelTestModule(channelKey) {
  const channel = CHANNELS[channelKey];
  if (!channel) throw new Error(`Unknown swap channel: ${channelKey}`);
  const ctx = loadConfig([]);
  ctx.suite = 'full';

  return {
    platform: 'api',
    categoryTitle: 'Swap API',
    displayName: channel.displayName || channel.provider.replace(/^Swap/, ''),
    testCases: pairCases(channelKey, { suite: 'full' }).map((testCase) => ({
      id: testCase.id,
      name: testCase.name,
      channel: testCase.channel,
      network: testCase.network,
      ...(testCase.fromNetwork ? { fromNetwork: testCase.fromNetwork } : {}),
      ...(testCase.toNetwork ? { toNetwork: testCase.toNetwork } : {}),
      pair: testCase.pair,
      amount: testCase.amount,
      fn: async () => {
        const t = createStepTracker(testCase.id);
        const outcome = await runOneQuoteBuild(ctx, channel, testCase, t);
        const summary = {
          passed: t.steps.filter((s) => s.status === 'passed').length,
          failed: t.steps.filter((s) => s.status === 'failed').length,
          skipped: t.steps.filter((s) => s.status === 'skipped').length,
          total: t.steps.length,
        };
        return {
          status: outcome.status,
          error: outcome.status === 'passed' ? undefined : (outcome.detail || outcome.reason),
          reason: outcome.reason,
          steps: t.steps,
          summary,
        };
      },
    })),
  };
}
