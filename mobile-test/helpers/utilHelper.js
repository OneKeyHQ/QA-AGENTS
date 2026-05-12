/**
 * @typedef {Object} AddressType
 * @property {string} name
 * @property {string} address
 */

import {
  onboardingPage,
  setPasswordPage,
  addressBookPageNoAddress,
  addressBookAddAddressPage,
  scanPage,
  networkSelectorModal,
} from '../pages/index.js';
import util from '../util/index.js';

class UtilHelper {
  static async onTestStart() {}
  static async onTestEnd() {}
  static async expectAddressesExist(addresses) {}
}

export const UtilHelper = UtilHelper;
