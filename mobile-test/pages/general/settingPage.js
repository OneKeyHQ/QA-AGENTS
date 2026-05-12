/**
 * 设置页 - Settings Page
 * 对应 xml: xmls/settings/settingsEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import util from '../../util/index.js';
import { executeByPlatform } from '../../util/index.js';

class SettingPage extends Page {
  get keyElement() {
    return api.by.id('setting-version');
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 关闭按钮 - Close Button
   * resource-id: "nav-header-close"
   */
  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  /**
   * 设置标题 - Settings Title
   * text: "Settings"
   */
  get settingsTitle() {
    return api.by.xpath('//android.view.View[@text="Settings"]');
  }

  /**
   * 搜索框 - Search Input
   * resource-id: "nav-header-search"
   * hint: "Search"
   */
  get searchInput() {
    return api.by.id('nav-header-search');
  }

  // ========== 设置选项 ==========

  /**
   * 备份选项 - Backup Option
   * text: "Backup"
   * resource-id: "select-item-"
   */
  get backupBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Backup"]');
  }

  /**
   * 偏好设置选项 - Preferences Option
   * text: "Preferences"
   * resource-id: "select-item-"
   */
  get preferencesBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Preferences"]');
  }

  /**
   * 钱包选项 - Wallet Option
   * text: "Wallet"
   * resource-id: "select-item-"
   */
  get walletBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Wallet"]');
  }

  /**
   * 安全选项 - Security Option
   * text: "Security"
   * resource-id: "select-item-"
   */
  get securityBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Security"]');
  }

  /**
   * 网络选项 - Network Option
   * text: "Network"
   * resource-id: "select-item-"
   */
  get networkBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Network"]');
  }

  /**
   * 关于选项 - About Option
   * text: "About"
   * resource-id: "select-item-"
   */
  get aboutBtn() {
    return api.by.xpath('//android.widget.TextView[@text="About"]');
  }

  /**
   * 地址簿按钮 - Address Book Button
   * resource-id: "setting-address-book"
   */
  get addressBookBtn() {
    return api.by.id('setting-address-book');
  }

  /**
   * 版本信息 - Version Info
   * resource-id: "setting-version"
   */
  get versionBtn() {
    return api.by.id('setting-version');
  }

  /**
   * 版本文本 - Version Text
   * text: "Version 5.20.0 2026012729"
   */
  get versionText() {
    return api.by.xpath('//android.widget.TextView[contains(@text, "Version")]');
  }

  /**
   * 版本说明文本 - Version Description Text
   * text: "You've got the latest version of OneKey..."
   */
  get versionDescriptionText() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "You\'ve got the latest version")]',
    );
  }

  get devOverlayBtn() {
    return api.by.xpath('enable-dev-overlay');
  }

  get clearDataMenuBtn() {
    return api.by.id('clear-data-menu');
  }

  // ========== 操作方法 ==========

  /**
   * 点击关闭按钮
   */
  async clickCloseBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.closeBtn);
      },
      async () => {
        await api.fixInterceptedClick('nav-header-close');
      },
    );
  }

  /**
   * 在搜索框中输入文本
   */
  async inputSearch(text) {
    await api.setValue(this.searchInput, text);
  }

  /**
   * 点击备份选项
   */
  async clickBackupBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.backupBtn);
      },
      async () => {
        await api.fixInterceptedClick('Backup');
      },
    );
  }

  /**
   * 点击偏好设置选项
   */
  async clickPreferencesBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.preferencesBtn);
      },
      async () => {
        await api.fixInterceptedClick('Preferences');
      },
    );
  }

  /**
   * 点击钱包选项
   */
  async clickWalletBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.walletBtn);
      },
      async () => {
        await api.fixInterceptedClick('Wallet');
      },
    );
  }

  /**
   * 点击安全选项
   */
  async clickSecurityBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.securityBtn);
      },
      async () => {
        await api.fixInterceptedClick('Security');
      },
    );
  }

  /**
   * 点击网络选项
   */
  async clickNetworkBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.networkBtn);
      },
      async () => {
        await api.fixInterceptedClick('Network');
      },
    );
  }

  /**
   * 点击关于选项
   */
  async clickAboutBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.aboutBtn);
      },
      async () => {
        await api.fixInterceptedClick('About');
      },
    );
  }

  async clickClearDataMenuBtn() {
    await api.scrollToId('clear-data-menu');
    await api.tapOnDevBtn('clear-data-menu');
  }

  async clickAddressBookBtn() {
    await api.tap(this.addressBookBtn);
  }

  /**
   * @description Continuous click 'version' area, open devtools
   */
  async enableDev() {
    let isDisplayed = await this.versionBtn.isDisplayed();
    if (!isDisplayed) {
      await api.scrollToId('setting-version');
    }
    const versionBtn = await this.versionBtn;
    for (const _ of new Array(10).fill(' ')) {
      await versionBtn.click();
    }
  }

  /**
   * @description  Click 'show dev overlay window' button in devtools
   */
  async enableDevOverLay() {
    await api.scrollToId('show-dev-overlay');
    await api.platformChain.android().run(async () => {
      await api.by
        .xpath(
          `//android.view.ViewGroup[@resource-id="show-dev-overlay"]/android.widget.Switch`,
        )
        .click();
    });

    await api.platformChain.ios().run(async () => {
      await api.by
        .xpath(
          `//XCUIElementTypeOther[@name="show-dev-overlay"]/XCUIElementTypeSwitch`,
        )
        .click();
    });

    await api.platformChain
      .not()
      .ios()
      .android()
      .run(async () => {
        await api.by
          .xpath(`//div[@data-testid="show-dev-overlay"]/button`)
          .click();
      });
  }
}

export const settingPage = new SettingPage();
