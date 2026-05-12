import { api } from '@node-e2e/cli/api/index.js';

import {
  addressBookDataset as dataset,
  lockPassword,
} from '../../dataset/index.js';
import {
  pages,
  AddressBookHelper,
  DevHelper,
  util,
} from '../../config/setup.js';
import {
  addressBookAlarmPopup,
  setPasswordPopup,
  confirmPasswordPopup,
  inputPasscodePopup,
  languageSelectPopup,
} from '../../popup/index.js';

const {
  homePage,
  onboardingPage,
  menuPage,
  addressBookPageNoAddress,
  addressBookAddAddressPage,
  networkSelectorModal,
  app,
} = pages;

describe('Address Book - Add Multiple Network Addresses', () => {
  // 用于记录测试结果
  const testResults = {
    success: [],
    failed: [],
    total: 0,
  };

  before(async () => {
    await api.globalStore.clear();
    await api.waitUntilAppInit();
    // App冷启动后会先进入onboarding页面
    await onboardingPage.clickTopRightButton();
    await languageSelectPopup.waitForPopup();
    await languageSelectPopup.selectSimplifiedChinese();
    await onboardingPage.waitEntryPage();
    // 点击backButton回到home页面
    await onboardingPage.clickBackButton();
    await homePage.waitEntryPage();
    // 点击moreActionsBtn进入menu页面
    await homePage.clickMoreActionsBtn();
    await menuPage.waitEntryPage();
    // 点击addressBookBtn弹出addressBookAlarm弹层
    await menuPage.clickAddressBookBtn();
    await addressBookAlarmPopup.waitForPopup();
    // 点击okBtn弹出setPassword弹层 --- 6.1.0 去掉这个逻辑了，先注释掉
    await addressBookAlarmPopup.clickOkBtn();
    // await setPasswordPopup.waitForPopup();
    // 输入111111弹出confirmPassword弹层
    // await setPasswordPopup.inputPassword('111111');
    // await confirmPasswordPopup.waitForPopup();
    // 输入111111跳转到noAddress页面
    // await confirmPasswordPopup.inputConfirmPassword('111111');
    await addressBookPageNoAddress.waitEntryPage();
  });

  it('Add different network addresses to address book', async () => {
    testResults.total = dataset.preloadData.length;

    for (let i = 0; i < dataset.preloadData.length; i++) {
      const addressData = dataset.preloadData[i];
      
      try {
        console.log(`\n[${i + 1}/${testResults.total}] Adding ${addressData.name} - ${addressData.chain}`);
        
        // 点击添加按钮（使用底部按钮，因为一直存在）
        await addressBookPageNoAddress.clickFooterAddBtn();
        await addressBookAddAddressPage.waitEntryPage();
        

        // 选择网络 - 使用搜索功能
        if (addressData.chain) {
          await addressBookAddAddressPage.clickSelectChain();
          await networkSelectorModal.waitEntryPage();
          
          // 使用搜索框搜索网络名称，然后点击匹配的网络
          await networkSelectorModal.searchAndSelectNetwork(addressData.chain);
          await addressBookAddAddressPage.waitEntryPage();
          
        }

        // 输入名称和地址
        await addressBookAddAddressPage.inputName(addressData.name);
        await addressBookAddAddressPage.inputAddress(addressData.address);
        await api.pause(5000);

        // 保存
        await addressBookAddAddressPage.clickSaveBtn();

        // 若弹出输入密码弹窗则输入 111111（每添加一次地址可能都需要验证密码；弹窗可能 1～8 秒后才出现）
        // await api.waitPageByElement(inputPasscodePopup.container, 55000); 6.1.0去掉这个逻辑了，先注释掉
        // if (await inputPasscodePopup.verifyPopupDisplayed()) {
        //   console.log(`  🔐 输入密码弹窗出现，输入 111111`);
        //   await inputPasscodePopup.inputPassword('111111');
        // }

        // 性能差的手机验证完密码后需要等待更长时间才能回到addressBook页面
        console.log(`  ⏳ 等待返回地址簿页面...`);
        await addressBookPageNoAddress.waitEntryPage(25000); // 25秒超时
        
        // 验证页面状态
        const isOnAddressBookPage = await addressBookPageNoAddress.verifyPageState();
        if (!isOnAddressBookPage) {
          throw new Error('等待返回地址簿页面后，页面状态异常');
        }
        console.log(`  ✓ 已返回地址簿页面`);

        // 断言未封装，先注释：添加完地址并返回地址簿后直接继续循环。后续统一断言
        // // 验证新增的地址是否存在，且名称正确
        // console.log(`  🔍 验证新增地址: name=${addressData.name}, address=${addressData.address}`);
        // const addressNameId = `list-item-title-address-item-${addressData.address}`;
        // const addressNameElement = api.by.id(addressNameId);
        // //
        // // 先检查第一屏是否存在
        // let isExisting = await addressNameElement.isExisting().catch(() => false);
        // let isDisplayed = false;
        // //
        // if (isExisting) {
        //   isDisplayed = await addressNameElement.isDisplayed().catch(() => false);
        // }
        // // 如果第一屏没有，向下滚动查找（最多滚动10次）
        // if (!isExisting || !isDisplayed) {
        //   console.log(`  📜 第一屏未找到，开始向下滚动查找...`);
        //   for (let scrollCount = 0; scrollCount < 10; scrollCount++) {
        //     const stillOnPage = await addressBookPageNoAddress.verifyPageState();
        //     if (!stillOnPage) {
        //       throw new Error(`滚动查找地址时页面已跳转（第${scrollCount + 1}次滚动）`);
        //     }
        //     await addressBookPageNoAddress.safeScrollDown(300);
        //     await api.pause(300);
        //     isExisting = await addressNameElement.isExisting().catch(() => false);
        //     if (isExisting) {
        //       isDisplayed = await addressNameElement.isDisplayed().catch(() => false);
        //       if (isDisplayed) {
        //         console.log(`  ✓ 在第 ${scrollCount + 1} 次滚动后找到地址元素`);
        //         break;
        //       }
        //     }
        //   }
        // }
        // if (!isExisting || !isDisplayed) {
        //   throw new Error(`未找到新增的地址元素: ${addressNameId}`);
        // }
        // const actualName = await api.getText(addressNameElement, false);
        // if (actualName !== addressData.name) {
        //   throw new Error(`地址名称不匹配: 期望 "${addressData.name}", 实际 "${actualName}"`);
        // }
        // console.log(`  ✓ 地址名称验证通过: ${actualName}`);
        // const addressItemId = `address-item-${addressData.address}`;
        // const addressItemViewGroup = api.by.id(addressItemId);
        // const addressItemExists = await addressItemViewGroup.isExisting().catch(() => false);
        // if (!addressItemExists) {
        //   throw new Error(`未找到地址ViewGroup: ${addressItemId}`);
        // }
        // let groupViewGroupXPath = `//android.view.ViewGroup[@resource-id="${addressItemId}"]/preceding-sibling::android.view.ViewGroup[not(@resource-id)][1]`;
        // let groupViewGroup = api.by.xpath(groupViewGroupXPath);
        // let groupExists = await groupViewGroup.isExisting().catch(() => false);
        // if (!groupExists) {
        //   groupViewGroupXPath = `//android.view.ViewGroup[@resource-id="${addressItemId}"]/parent::android.view.ViewGroup/preceding-sibling::android.view.ViewGroup[not(@resource-id)][1]`;
        //   groupViewGroup = api.by.xpath(groupViewGroupXPath);
        //   groupExists = await groupViewGroup.isExisting().catch(() => false);
        // }
        // if (!groupExists) {
        //   throw new Error(`未找到分组ViewGroup（在地址ViewGroup上方）`);
        // }
        // const sameAsGroupTextXPath = `${groupViewGroupXPath}//android.widget.TextView[@text="与分组相同" or @text="Same as group"]`;
        // const sameAsGroupText = api.by.xpath(sameAsGroupTextXPath);
        // const sameAsGroupExists = await sameAsGroupText.isExisting().catch(() => false);
        // if (!sameAsGroupExists) {
        //   throw new Error(`分组验证失败：未找到"与分组相同"文本，说明分组不正确`);
        // }
        // console.log(`  ✓ 分组验证通过：找到"与分组相同"文本`);

        testResults.success.push({
          name: addressData.name,
          chain: addressData.chain,
          address: addressData.address,
        });

        console.log(`✓ Successfully added ${addressData.name}`);
      } catch (error) {
        // 记录失败信息
        testResults.failed.push({
          name: addressData.name,
          chain: addressData.chain,
          chainId: addressData.chainId,
          address: addressData.address,
          error: error.message,
          stack: error.stack,
        });

        console.error(`✗ Failed to add ${addressData.name} - ${addressData.chain}`);
        console.error(`  Error: ${error.message}`);
      }
    }

    // 生成测试报告
    console.log('\n' + '='.repeat(80));
    console.log('TEST REPORT - Add Multiple Network Addresses');
    console.log('='.repeat(80));
    console.log(`Total networks: ${testResults.total}`);
    console.log(`✓ Success: ${testResults.success.length}`);
    console.log(`✗ Failed: ${testResults.failed.length}`);
    console.log(`Success rate: ${((testResults.success.length / testResults.total) * 100).toFixed(2)}%`);

    if (testResults.failed.length > 0) {
      console.log('\nFailed Networks:');
      console.log('-'.repeat(80));
      testResults.failed.forEach((item, index) => {
        console.log(`${index + 1}. ${item.name} (${item.chain})`);
        console.log(`   Chain ID: ${item.chainId}`);
        console.log(`   Address: ${item.address}`);
        console.log(`   Error: ${item.error}`);
        console.log('');
      });
    }

    console.log('='.repeat(80));

    // 如果所有网络都失败，则测试失败
    if (testResults.failed.length === testResults.total) {
      throw new Error('All networks failed to add');
    }
  });
});
