import { api } from '@node-e2e/cli';

import { lockPassword } from '../dataset/index.js';

import {
  onboardingPage,
  beforeYouProceedPage,
  writeDownYourPhrasesPage,
  verifyYourRecoveryPhrasePage,
  importWalletPage,
  importRecoveryPhrase,
  importPrivateKeyPage,
  importAddressPage,
  settingPage,
  setPasswordPage,
  finalizeWalletSetupPage,
  clearDataMenuPage,
} from '../pages/index.js';
import util from '../util/index.js';

class OnboardingHelperClass {
  static async createWallet() {
    await onboardingPage.clickCreateWalletBtn();
    const hasSetPass = await api.globalStore.get(
      api.globalStore.constStr.password,
    );

    if (!hasSetPass) {
      await setPasswordPage.savePassword(lockPassword);
    }
    await beforeYouProceedPage.waitEntryPage();
    await beforeYouProceedPage.clickConfirmBtn();
    await writeDownYourPhrasesPage.waitEntryPage();
    const phrases = await writeDownYourPhrasesPage.getPhrases();
    expect(phrases.length).toEqual(12);
    await writeDownYourPhrasesPage.clickConfirmBtn();
    await verifyYourRecoveryPhrasePage.inputPhrases(phrases);
    await verifyYourRecoveryPhrasePage.clickFooterConfirmBtn();

    await finalizeWalletSetupPage.waitForSetup();
    await api.globalStore.set(api.globalStore.constStr.hasWallet, 1);
  }

  static async importWalletByPhrases(phrases) {
    await onboardingPage.clickImportWalletBtn();
    await importWalletPage.waitEntryPage();
    await importWalletPage.clickImportRecoveryPhraseBtn();
    await importWalletPage.clickSecurityAlertAcknowledgedBtn();
    const hasSetPass = await api.globalStore.get(
      api.globalStore.constStr.password,
    );

    if (!hasSetPass) {
      await setPasswordPage.savePassword(lockPassword);
    }
    await importRecoveryPhrase.waitEntryPage();
    await importRecoveryPhrase.inputPhrases(phrases.split(' '));
    await importRecoveryPhrase.clickClearAllBtn();
    await importRecoveryPhrase.inputPhrases(phrases.split(' '));
    await importRecoveryPhrase.clickFooterConfirmBtn();
    const hasWallet = await api.globalStore.get(
      api.globalStore.constStr.password,
    );
    if (!hasWallet) {
      await setPasswordPage.savePassword(lockPassword);
    }
    await finalizeWalletSetupPage.waitForSetup();
    await api.globalStore.set(api.globalStore.constStr.hasWallet, 1);
  }

  static async importWalletByPrivatekey({ chainId, privatekey }) {
    await onboardingPage.clickImportWalletBtn();
    await importWalletPage.clickImportPrivatekeyBtn();
    await importPrivateKeyPage.chooseNetwork(chainId);
    await importPrivateKeyPage.inputPrivatekey(privatekey);
    await importPrivateKeyPage.clickFooterConfirmBtn();
    const hasWallet = await api.globalStore.get(
      api.globalStore.constStr.password,
    );
    if (!hasWallet) {
      await setPasswordPage.savePassword(lockPassword);
    }
    await finalizeWalletSetupPage.waitForSetup();
    await api.globalStore.set(api.globalStore.constStr.hasWallet, 1);
  }

  static async importAddress({ chainId, address }) {
    await onboardingPage.clickImportWalletBtn();
    await importWalletPage.clickImportAddressBtn();
    await importAddressPage.chooseNetwork(chainId);
    await importAddressPage.inputAddress(address);
    await importAddressPage.clickFooterConfirmBtn();
    const hasWallet = await api.globalStore.get(
      api.globalStore.constStr.password,
    );
    if (!hasWallet) {
      await setPasswordPage.savePassword(lockPassword);
    }
    await finalizeWalletSetupPage.waitForSetup();
    await api.globalStore.set(api.globalStore.constStr.hasWallet, 1);
  }

  static async clearWalletData() {
    await settingPage.toSettingPage();
    await settingPage.waitEntryPage();
    await settingPage.clickClearDataMenuBtn();
    await clearDataMenuPage.waitEntryPage();
    await clearDataMenuPage.clickClearWalletsDataBtn();
    await api.restartApp(lockPassword);
  }
}

export const OnboardingHelper = OnboardingHelperClass;
