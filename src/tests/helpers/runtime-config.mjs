// Runtime config helper — reads shared/runtime-config.json on demand.
//
// Each tester configures their own wallet accounts via the Dashboard ⚙️ Settings panel.
// Only used by transfer-class tests. Other modules (Swap / DeFi / etc.) will get their
// own config entries when needed.
//
// Default direction: primary -> secondary.
// If primary balance is insufficient at runtime, scripts may call resolveTransferDirection()
// to flip roles (secondary becomes sender, primary becomes receiver).
//
// Addresses are NOT stored — different chains have different formats, so scripts derive
// them per-chain at runtime by switching to the chosen account and reading its current address.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CONFIG_PATH = resolve(__dirname, '..', '..', '..', 'shared', 'runtime-config.json');

const EMPTY_ACCOUNT = { walletName: '', accountName: '' };

function readConfig() {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Load wallet accounts from shared/runtime-config.json.
 * Returns { primary, secondary } where each is { walletName, accountName }.
 * Empty strings if config missing or unset — caller must validate before use.
 */
export function loadAccounts() {
  const cfg = readConfig();
  const wa = cfg?.walletAccounts || {};
  return {
    primary:   { ...EMPTY_ACCOUNT, ...(wa.primary   || {}) },
    secondary: { ...EMPTY_ACCOUNT, ...(wa.secondary || {}) },
  };
}

/**
 * Throw a descriptive error if any required account fields are missing.
 * @param {{required?: ('primary'|'secondary')[], fields?: ('walletName'|'accountName')[]}} opts
 */
export function requireAccounts({ required = ['primary', 'secondary'], fields = ['walletName', 'accountName'] } = {}) {
  const accounts = loadAccounts();
  const missing = [];
  for (const role of required) {
    for (const field of fields) {
      if (!accounts[role]?.[field]) missing.push(`${role}.${field}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `Runtime config incomplete. Missing: ${missing.join(', ')}. ` +
      `Open the Dashboard (http://localhost:5050) → ⚙️ 设置 to fill in 账户1/账户2.`,
    );
  }
  return accounts;
}

/**
 * Resolve transfer direction based on sender balance.
 *
 * Default: primary = sender, secondary = receiver.
 * If `getBalance(account)` returns < `minBalance` for the primary, roles are flipped.
 *
 * SKELETON: callers must supply `getBalance` (chain-specific) and `minBalance`.
 * Returns { sender, receiver, flipped }.
 *
 * @param {object} opts
 * @param {(account: {walletName:string,accountName:string}) => Promise<number>} opts.getBalance
 *   Async function that returns the spendable balance of an account in the unit being
 *   compared against `minBalance` (e.g. number of tokens, not wei). The balance lookup
 *   must navigate to the account first (since address is chain-derived).
 * @param {number} opts.minBalance
 *   Minimum balance the primary must hold to remain the sender.
 */
export async function resolveTransferDirection({ getBalance, minBalance }) {
  const { primary, secondary } = requireAccounts();
  if (typeof getBalance !== 'function' || typeof minBalance !== 'number') {
    // Caller didn't supply balance check — return default direction without flipping.
    return { sender: primary, receiver: secondary, flipped: false };
  }
  const balance = await getBalance(primary);
  if (balance >= minBalance) {
    return { sender: primary, receiver: secondary, flipped: false };
  }
  return { sender: secondary, receiver: primary, flipped: true };
}
