import {
  detectPlatform,
  PLATFORMS,
} from '@node-e2e/cli/utils/detectPlatform.js';

const currentPlatform = detectPlatform();

const PHRASE_INPUT_INTERVAL_ALL = {
  [PLATFORMS.android]: 100,
  [PLATFORMS.ios]: 100,
  [PLATFORMS.web]: 100,
  [PLATFORMS.electron]: 100,
  [PLATFORMS.ext]: 100,
};

const SAVE_PASSWORD_ALL = {
  [PLATFORMS.android]: 10000,
  [PLATFORMS.ios]: 10000,
  [PLATFORMS.web]: 3000,
  [PLATFORMS.electron]: 3000,
  [PLATFORMS.ext]: 3000,
};

const FINALIZE_WALLET_SETUP_ALL = {
  [PLATFORMS.android]: 5000,
  [PLATFORMS.ios]: 3000,
  [PLATFORMS.web]: 1000,
  [PLATFORMS.electron]: 1000,
  [PLATFORMS.ext]: 1000,
};

const ADDRESS_BOOK_AFTER_INPUT_NAME_ALL = {
  [PLATFORMS.android]: 3000,
  [PLATFORMS.ios]: 3000,
  [PLATFORMS.web]: 1000,
  [PLATFORMS.electron]: 1000,
  [PLATFORMS.ext]: 1000,
};

const ADDRESS_BOOK_AFTER_INPUT_ADDRESS_ALL = {
  [PLATFORMS.android]: 10000,
  [PLATFORMS.ios]: 10000,
  [PLATFORMS.web]: 10000,
  [PLATFORMS.electron]: 10000,
  [PLATFORMS.ext]: 10000,
};

const ADDRESS_BOOK_AFTER_CLICK_SAVE_ALL = {
  [PLATFORMS.android]: 10000,
  [PLATFORMS.ios]: 10000,
  [PLATFORMS.web]: 3000,
  [PLATFORMS.electron]: 3000,
  [PLATFORMS.ext]: 3000,
};

const WEBVIEW_LOAD_TIMEOUT_ALL = {
  [PLATFORMS.android]: 10000,
  [PLATFORMS.ios]: 10000,
  [PLATFORMS.web]: 3000,
  [PLATFORMS.electron]: 3000,
  [PLATFORMS.ext]: 3000,
};
const WEBPAGE_LOAD_COMPLETE_TIMEOUT_ALL = {
  [PLATFORMS.android]: 10000,
  [PLATFORMS.ios]: 10000,
  [PLATFORMS.web]: 3000,
  [PLATFORMS.electron]: 3000,
  [PLATFORMS.ext]: 3000,
};

const WAITE_FN_COMPLETE_TIMEOUT_ALL = {
  [PLATFORMS.android]: 2000,
  [PLATFORMS.ios]: 2000,
  [PLATFORMS.web]: 1000,
  [PLATFORMS.electron]: 1000,
  [PLATFORMS.ext]: 1000,
};

export const ADDRESS_BOOK_AFTER_INPUT_NAME =
  ADDRESS_BOOK_AFTER_INPUT_NAME_ALL[currentPlatform];

export const ADDRESS_BOOK_AFTER_INPUT_ADDRESS =
  ADDRESS_BOOK_AFTER_INPUT_ADDRESS_ALL[currentPlatform];

export const ADDRESS_BOOK_AFTER_CLICK_SAVE =
  ADDRESS_BOOK_AFTER_CLICK_SAVE_ALL[currentPlatform];

export const FINALIZE_WALLET_SETUP = FINALIZE_WALLET_SETUP_ALL[currentPlatform];

export const SAVE_PASSWORD = SAVE_PASSWORD_ALL[currentPlatform];

export const PHRASE_INPUT_INTERVAL = PHRASE_INPUT_INTERVAL_ALL[currentPlatform];

export const WEBVIEW_LOAD_TIMEOUT = WEBVIEW_LOAD_TIMEOUT_ALL[currentPlatform];

export const WEBPAGE_LOAD_COMPLETE_TIMEOUT =
  WEBPAGE_LOAD_COMPLETE_TIMEOUT_ALL[currentPlatform];

export const WAITE_FN_COMPLETE_TIMEOUT =
  WAITE_FN_COMPLETE_TIMEOUT_ALL[currentPlatform];

export {
  intercomElements,
  backupElements,
  bulkCopyAddressElements,
} from './xmlPageElements.js';
