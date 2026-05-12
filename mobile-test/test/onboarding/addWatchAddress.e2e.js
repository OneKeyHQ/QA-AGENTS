import { api } from '@node-e2e/cli/api/index.js';
import screenshotHelper from '@node-e2e/cli/utils/screenshotHelper.js';

import { pages } from '../../config/setup.js';
import { languageSelectPopup } from '../../popup/index.js';
import { networkSelectPage } from '../../pages/general/networkSelectPage.js';
import watchAddressDataset from '../../dataset/watchaddress.js';

const {
  homePage,
  onboardingPage,
  addWalletPage,
  addExistingWalletPage,
  importAddressPage,
  walletSelectorPage,
} = pages;

/** 从数组中随机取 n 个不重复项 */
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

describe('Add Watch Address', () => {
  before(async () => {
    await api.waitUntilAppInit();
    // 启用截图功能
    screenshotHelper.enable();
  });

  after(async () => {
    // 测试结束后重置截图状态
    screenshotHelper.reset();
  });


  // 随机取一条数据，避免多用例时应用状态不一致（每个用例都需从 onboarding 开始）
  const item = pickRandom(watchAddressDataset.preloadData, 1)[0];

  it(`Add watch address: ${item.name}`, async () => {
    // 从onboarding页面开始
    await onboardingPage.waitEntryPage();
    await onboardingPage.clickTopRightButton();
    await languageSelectPopup.waitForPopup();
    await languageSelectPopup.selectSimplifiedChinese();
    await onboardingPage.waitEntryPage();
    // 添加钱包 - 点击更多选项进入添加钱包页面
    await onboardingPage.clickMoreOptionsBtn();

    // 进入添加钱包页面 - 点击添加现有钱包卡片
    await addWalletPage.waitEntryPage();
    await addWalletPage.clickAddExistingWalletCard();

    // 进入添加现有钱包页面 - 点击观察地址卡片
    await addExistingWalletPage.waitEntryPage();
    await addExistingWalletPage.clickWatchAddressCard();

    // 进入导入观察地址页面
    await importAddressPage.waitEntryPage();

    // 选择网络 - 使用搜索定位（通过 search 框 + browser.$ 确保可点击）
    await importAddressPage.clickChooseChainBtn();
    await networkSelectPage.waitEntryPage();
    await networkSelectPage.selectNetworkBySearch(item.chain, item.chainId);

    // 填入地址与账户名称（来自 dataset）
    await importAddressPage.inputAddress(item.address);
    await importAddressPage.inputName(item.name);

    // 点击确认
    await importAddressPage.clickConfirmButton();

    // 已跳到 Homepage：点击账户选择器 -> 钱包选择器 -> 添加钱包 -> Onboarding，再走一次导入观察账户流程，额外加两个随机地址（共 3 个）
    const extraItems = pickRandom(watchAddressDataset.preloadData, 3);
    for (const extraItem of extraItems) {
      await homePage.clickAccountSelectorBtn();
      await walletSelectorPage.waitEntryPage();
      await walletSelectorPage.clickAddWallet();

      await addWalletPage.waitEntryPage();
      await addWalletPage.clickAddExistingWalletCard();
      await addExistingWalletPage.waitEntryPage();
      await addExistingWalletPage.clickWatchAddressCard();

      await importAddressPage.waitEntryPage();
      await importAddressPage.clickChooseChainBtn();
      await networkSelectPage.waitEntryPage();
      await networkSelectPage.selectNetworkBySearch(extraItem.chain, extraItem.chainId);
      await importAddressPage.inputAddress(extraItem.address);
      await importAddressPage.inputName(extraItem.name);
      await importAddressPage.clickConfirmButton();
    }
  });
});
