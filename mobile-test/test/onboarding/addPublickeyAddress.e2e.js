import { api } from '@node-e2e/cli/api/index.js';
import screenshotHelper from '@node-e2e/cli/utils/screenshotHelper.js';

import { pages } from '../../config/setup.js';
import {
  languageSelectPopup,
  importBTCPublickeyChooseXpubPathPopup,
} from '../../popup/index.js';
import { networkSelectPage } from '../../pages/general/networkSelectPage.js';
import publickeyDataset from '../../dataset/publickey.js';

const {
  homePage,
  onboardingPage,
  addWalletPage,
  addExistingWalletPage,
  importAddressPage,
  walletSelectorPage,
} = pages;

/** 合并 publickey 所有 phrase 数据为扁平数组，供随机选取 */
const preloadData = [
  ...(publickeyDataset.phrase_12_words || []),
  ...(publickeyDataset.phrase_15_words || []),
  ...(publickeyDataset.phrase_18_words || []),
  ...(publickeyDataset.phrase_21_words || []),
  ...(publickeyDataset.phrase_24_words || []),
];

/** 从数组中随机取 n 个不重复项 */
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

describe('Add Public Key Address', () => {
  before(async () => {
    await api.waitUntilAppInit();
    screenshotHelper.enable();
  });

  after(async () => {
    screenshotHelper.reset();
  });

  const item = pickRandom(preloadData, 1)[0];

  it(`Add public key address: ${item.name}`, async () => {
    await onboardingPage.waitEntryPage();
    await onboardingPage.clickTopRightButton();
    await languageSelectPopup.waitForPopup();
    await languageSelectPopup.selectSimplifiedChinese();
    await onboardingPage.waitEntryPage();

    await onboardingPage.clickMoreOptionsBtn();

    await addWalletPage.waitEntryPage();
    await addWalletPage.clickAddExistingWalletCard();

    await addExistingWalletPage.waitEntryPage();
    await addExistingWalletPage.clickWatchAddressCard();

    await importAddressPage.waitEntryPage();
    await importAddressPage.clickPublicKeyTab();

    await importAddressPage.clickChooseChainBtn();
    await networkSelectPage.waitEntryPage();
    await networkSelectPage.selectNetworkBySearch(item.chain, item.chainId);

    await importAddressPage.inputPublicKey(item.xpub);
    await importAddressPage.inputName(item.name);

    await importAddressPage.clickConfirmButton();

    const extraItems = pickRandom(preloadData, 2);
    for (const extraItem of extraItems) {
      await homePage.clickAccountSelectorBtn();
      await walletSelectorPage.waitEntryPage();
      await walletSelectorPage.clickAddWallet();

      await addWalletPage.waitEntryPage();
      await addWalletPage.clickAddExistingWalletCard();
      await addExistingWalletPage.waitEntryPage();
      await addExistingWalletPage.clickWatchAddressCard();

      await importAddressPage.waitEntryPage();
      await importAddressPage.clickPublicKeyTab();
      await importAddressPage.clickChooseChainBtn();
      await networkSelectPage.waitEntryPage();
      await networkSelectPage.selectNetworkBySearch(extraItem.chain, extraItem.chainId);

      if (extraItem.chainId?.startsWith('btc')) {
        await importAddressPage.clickDerivePathSelectorDropdown();
        await importBTCPublickeyChooseXpubPathPopup.waitForPopup();
        await importBTCPublickeyChooseXpubPathPopup.selectPathByType(extraItem.pathType);
      }

      await importAddressPage.inputPublicKey(extraItem.xpub);
      await importAddressPage.inputName(extraItem.name);
      await importAddressPage.clickConfirmButton();
    }
  });
});
