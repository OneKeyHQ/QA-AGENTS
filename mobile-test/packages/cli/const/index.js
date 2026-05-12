import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const currentPlatform = detectPlatform();

const TAP_WAIT_ALL = {
  [PLATFORMS.android]: 0,
  [PLATFORMS.ios]: 0,
  [PLATFORMS.web]: 100,
  [PLATFORMS.electron]: 100,
  [PLATFORMS.ext]: 100,
};

const APP_START_TIMEOUT_ALL = {
  [PLATFORMS.android]: 20000,
  [PLATFORMS.ios]: 20000,
  [PLATFORMS.web]: 10000,
  [PLATFORMS.electron]: 10000,
  [PLATFORMS.ext]: 10000,
};

const WAITE_FOR_ELEMENT_TIMEOUT_ALL = {
  [PLATFORMS.android]: 3000,
  [PLATFORMS.ios]: 3000,
  [PLATFORMS.web]: 3000,
  [PLATFORMS.electron]: 3000,
};

const WAITE_FOR_PAGE_TIMEOUT_ALL = {
  [PLATFORMS.android]: 5000,
  [PLATFORMS.ios]: 5000,
  [PLATFORMS.web]: 1000,
  [PLATFORMS.electron]: 1000,
};
const WAITE_FOR_REQ_TIMEOUT_ALL = {
  [PLATFORMS.android]: 5000,
  [PLATFORMS.ios]: 5000,
  [PLATFORMS.web]: 1000,
  [PLATFORMS.electron]: 1000,
};

export const TAP_WAIT = TAP_WAIT_ALL[currentPlatform];

export const APP_START_TIMEOUT = APP_START_TIMEOUT_ALL[currentPlatform];

export const WAITE_FOR_ELEMENT_TIMEOUT =
  WAITE_FOR_ELEMENT_TIMEOUT_ALL[currentPlatform];

export const WAITE_FOR_PAGE_TIMEOUT =
  WAITE_FOR_PAGE_TIMEOUT_ALL[currentPlatform];

export const WAITE_FOR_REQ_TIMEOUT = WAITE_FOR_REQ_TIMEOUT_ALL[currentPlatform];
