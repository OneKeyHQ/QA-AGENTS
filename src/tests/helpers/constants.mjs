// Shared constants and tiny utilities — leaf module, no internal imports
// All helpers import from here instead of index.mjs to avoid circular deps
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';

const RUNTIME_CFG_PATH = resolve(import.meta.dirname, '../../../shared/runtime-config.json');

/**
 * 读取 wallet 密码（优先级：runtime-config.json > 环境变量 > 默认值）。
 * 用 getter 而非常量，让 Dashboard 配置改动即时生效（不需重启脚本）。
 */
function readWalletPassword() {
  try {
    if (existsSync(RUNTIME_CFG_PATH)) {
      const cfg = JSON.parse(readFileSync(RUNTIME_CFG_PATH, 'utf-8'));
      if (cfg?.walletPassword && typeof cfg.walletPassword === 'string' && cfg.walletPassword.length > 0) {
        return cfg.walletPassword;
      }
    }
  } catch {}
  return process.env.WALLET_PASSWORD || '1234567890-=';
}

export const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
export const ONEKEY_BIN = process.env.ONEKEY_BIN || '/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey';
export const RESULTS_DIR = resolve(import.meta.dirname, '../../../shared/results');
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// WALLET_PASSWORD 用 getter，每次读时动态从 runtime-config 取最新值
// 兼容旧代码用 `import { WALLET_PASSWORD }`：保留同名导出（但是只在 import 时读一次，不会动态）
// 新代码建议用 `import { getWalletPassword } from './runtime-config.mjs'`
export const WALLET_PASSWORD = readWalletPassword();
