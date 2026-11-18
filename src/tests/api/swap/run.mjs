#!/usr/bin/env node
/**
 * Swap API automation (local / Jenkins).
 * Not Apifox import JSON.
 *
 * Rules:
 * - docs/qa/rules/swap-rules.md
 * - docs/qa/rules/swap-network-features.md
 */

import { loadConfig } from './lib/config.mjs';
import { writeJunit } from './lib/junit.mjs';
import { createTracker, summarize } from './lib/runner.mjs';
import { SMOKE_CHANNELS, selectedChannels } from './data/channels.mjs';
import { runQuoteBuild } from './cases/quote-build.mjs';

export async function run(argv) {
  const ctx = loadConfig(argv);
  const results = createTracker();
  const channels = selectedChannels(ctx.channel).filter((key) => {
    if (ctx.channel) return true;
    if (ctx.suite === 'smoke') return SMOKE_CHANNELS.includes(key);
    return true;
  });

  console.log(`swap-api base=${ctx.baseUrl} suite=${ctx.suite} channels=${channels.join(',')}`);

  for (const channel of channels) {
    await runQuoteBuild(results, ctx, channel);
  }

  writeJunit(ctx.junitPath, results);
  console.log(`junit: ${ctx.junitPath}`);
  return summarize(results, { failOnSkip: ctx.failOnSkip });
}

const isMain = !process.argv[1] || process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  run().then(({ exitCode }) => process.exit(exitCode)).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
