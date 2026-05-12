/**
 * 偏好设置页 - Preferences Settings Page
 * 对应 xml: xmls/settings/preferencesSettingsEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

class PreferencesSettingsPage extends Page {
  get keyElement() {
    return this.preferencesTitle;
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
   * 偏好设置标题 - Preferences Title
   * text: "Preferences"
   */
  get preferencesTitle() {
    return api.by.xpath('//android.view.View[@text="Preferences"]');
  }

  // ========== 设置选项 ==========

  /**
   * 语言选项 - Language Option
   * text: "Language"
   * resource-id: "select-item-"
   */
  get languageOption() {
    return api.by.xpath('//android.widget.TextView[@text="Language"]');
  }

  /**
   * 语言当前值 - Language Current Value
   * text: "English"
   */
  get languageValue() {
    return api.by.xpath('//android.widget.TextView[@text="English"]');
  }

  /**
   * 默认货币选项 - Default currency Option
   * text: "Default currency"
   * resource-id: "select-item-"
   */
  get defaultCurrencyOption() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Default currency"]',
    );
  }

  /**
   * 默认货币当前值 - Default currency Current Value
   * text: "USD"
   */
  get defaultCurrencyValue() {
    return api.by.xpath('//android.widget.TextView[@text="USD"]');
  }

  /**
   * 主题选项 - Theme Option
   * text: "Theme"
   * resource-id: "select-item-"
   */
  get themeOption() {
    return api.by.xpath('//android.widget.TextView[@text="Theme"]');
  }

  /**
   * 主题当前值 - Theme Current Value
   * text: "Auto"
   */
  get themeValue() {
    return api.by.xpath('//android.widget.TextView[@text="Auto"]');
  }

  /**
   * 通知选项 - Notifications Option
   * text: "Notifications"
   * resource-id: "select-item-"
   */
  get notificationsOption() {
    return api.by.xpath('//android.widget.TextView[@text="Notifications"]');
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
   * 点击语言选项
   */
  async clickLanguageOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.languageOption);
      },
      async () => {
        await api.fixInterceptedClick('Language');
      },
    );
  }

  /**
   * 点击默认货币选项
   */
  async clickDefaultCurrencyOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.defaultCurrencyOption);
      },
      async () => {
        await api.fixInterceptedClick('Default currency');
      },
    );
  }

  /**
   * 点击主题选项
   */
  async clickThemeOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.themeOption);
      },
      async () => {
        await api.fixInterceptedClick('Theme');
      },
    );
  }

  /**
   * 点击通知选项
   */
  async clickNotificationsOption() {
    await executeByPlatform(
      async () => {
        await api.tap(this.notificationsOption);
      },
      async () => {
        await api.fixInterceptedClick('Notifications');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待偏好设置页显示
   */
  async waitForPreferencesSettingsPage() {
    await api.waitPageByElement(this.preferencesTitle);
  }

  /**
   * 验证偏好设置页是否显示
   */
  async verifyPreferencesSettingsPageDisplayed() {
    const isDisplayed = await this.preferencesTitle.isDisplayed();
    return isDisplayed;
  }
}

export const preferencesSettingsPage = new PreferencesSettingsPage();
