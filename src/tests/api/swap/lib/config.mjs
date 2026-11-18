import { randomUUID } from 'node:crypto';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

loadDotenv({ path: resolve(process.cwd(), '.env') });

export const DEFAULT_BASE_URL = 'https://swap.onekeytest.com';

export function loadConfig(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  return {
    baseUrl: (args.baseUrl || process.env.SWAP_API_BASE || DEFAULT_BASE_URL).replace(/\/$/, ''),
    suite: args.suite || process.env.SWAP_SUITE || 'smoke',
    channel: args.channel || process.env.SWAP_CHANNEL || '',
    timeoutMs: Number(args.timeout || process.env.SWAP_TIMEOUT_MS || 45000),
    junitPath: args.junit || process.env.SWAP_JUNIT || 'shared/results/api/swap-junit.xml',
    failOnSkip: String(args.failOnSkip || process.env.SWAP_FAIL_ON_SKIP || '') === '1',
  };
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

export function clientHeaders({ sse = false } = {}) {
  const requestId = randomUUID();
  const cookie = String(process.env.SWAP_API_COOKIE || '').trim();
  return {
    accept: sse ? 'text/event-stream' : 'application/json, text/plain, */*',
    'accept-language': 'zh-CN',
    'cache-control': 'no-cache',
    'x-onekey-hide-asset-details': 'false',
    'x-onekey-instance-id': 'qa-agents-swap-api',
    'x-onekey-request-build-number': '2026103008',
    'x-onekey-request-currency': 'usd',
    'x-onekey-request-device-name': 'OneKey Desktop',
    'x-onekey-request-id': requestId,
    'x-onekey-request-jsbundle-version': '26097516',
    'x-onekey-request-locale': 'zh-cn',
    'x-onekey-request-platform': 'desktop-macosStore',
    'x-onekey-request-theme': 'light',
    'x-onekey-request-version': '6.7.0',
    'x-onekey-wallet-type': 'hd',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) OneKeyWallet/6.7.0 Chrome/152.0.7977.130 Electron/44.5.1 Safari/537.36',
    ...(cookie ? { cookie } : {}),
  };
}
