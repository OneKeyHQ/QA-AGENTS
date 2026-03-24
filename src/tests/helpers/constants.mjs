// Shared constants and tiny utilities — leaf module, no internal imports
// All helpers import from here instead of index.mjs to avoid circular deps
import { resolve } from 'node:path';

export const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9222';
export const WALLET_PASSWORD = process.env.WALLET_PASSWORD || '1234567890-=';
export const ONEKEY_BIN = '/Applications/OneKey-3.localized/OneKey.app/Contents/MacOS/OneKey';
export const RESULTS_DIR = resolve(import.meta.dirname, '../../../shared/results');
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
