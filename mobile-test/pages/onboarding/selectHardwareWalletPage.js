import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 选择硬件钱包页面 - 用户选择硬件钱包设备的页面
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup
 */
class SelectHardwareWalletPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - "选择您的设备" / "Select your device"
   * text: "选择您的设备" / "Select your device"
   * bounds: [397,89][685,152]
   * 定位方式：使用文本内容定位，更稳定，支持中英文
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="选择您的设备" or @text="Select your device"]',
    );
  }

  /**
   * 返回按钮 - 左上角返回图标按钮
   * bounds: [35,71][135,171]
   * 定位方式：使用相对xpath从指定层级开始定位Button[5]
   */
  get backButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.widget.Button[5]',
    );
  }

  /**
   * 关闭按钮 - 右上角关闭图标按钮
   * bounds: [947,89][1029,152]
   * 定位方式：使用相对xpath从指定层级开始定位ViewGroup[6]下的Button
   */
  get closeButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[6]/android.widget.Button',
    );
  }

  // ========== 硬件钱包选项卡片 ==========

  /**
   * OneKey Pro 卡片 - 第一个硬件钱包选项
   * text: "OneKey Pro"
   * bounds: [54,205][1029,793]
   * 定位方式：通过文本定位父容器ViewGroup
   */
  get oneKeyProCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="OneKey Pro"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  /**
   * OneKey Classic 卡片 - 第二个硬件钱包选项
   * text: "OneKey Classic"
   * bounds: [54,846][1029,1434]
   * 定位方式：通过文本定位父容器ViewGroup
   */
  get oneKeyClassicCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="OneKey Classic"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  /**
   * OneKey Touch 卡片 - 第三个硬件钱包选项
   * text: "OneKey Touch"
   * bounds: [54,1486][1029,2074]
   * 定位方式：通过文本定位父容器ViewGroup
   */
  get oneKeyTouchCard() {
    return api.by.xpath(
      '(//android.widget.TextView[@text="OneKey Touch"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
    );
  }

  // ========== 底部链接 ==========

  /**
   * 购买链接 - "购买 ↗" / "Buy ↗"
   * content-desc: "购买 ↗" / "Buy ↗"
   * text: "购买 ↗" / "Buy ↗"
   * bounds: [617,2264][721,2306]
   * 定位方式：优先使用content-desc，更稳定，支持中英文
   */
  get purchaseLink() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="购买 ↗" or @content-desc="Buy ↗" or @text="购买 ↗" or @text="Buy ↗"]',
    );
  }

  /**
   * 还没有 OneKey 文本 - "还没有 OneKey？" / "Don't have OneKey?"
   * text: "还没有 OneKey？" / "Don't have OneKey?"
   * bounds: [361,2264][606,2306]
   * 定位方式：使用文本内容定位，支持中英文
   */
  get noOneKeyText() {
    return api.by.xpath(
      '//android.widget.TextView[@text="还没有 OneKey？" or @text="Don\'t have OneKey?"]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击返回按钮
   */
  async clickBackButton() {
    await api.tap(this.backButton);
  }

  /**
   * 点击关闭按钮
   */
  async clickCloseButton() {
    await api.tap(this.closeButton);
  }

  /**
   * 点击 OneKey Pro 卡片
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickOneKeyProCard() {
    const selectors = [
      // 策略1: 通过文本定位卡片 - 中文
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="OneKey Pro"]])[1]',
      // 策略2: 通过文本定位父容器
      '(//android.widget.TextView[@text="OneKey Pro"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
      // 策略3: 绝对路径定位
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[7]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[0]',
    ];

    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);

        try {
          await api.platformChain
            .not()
            .ios()
            .run(async () => {
              await element.waitForDisplayed({ timeout: 2000 });
            });
          await api.platformChain
            .ios()
            .run(async () => {
              await element.waitForExist({ timeout: 2000 });
            });

          await api.tap(element);
          return;
        } catch (waitError) {
          continue;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('无法找到 OneKey Pro 卡片，已尝试所有定位策略');
  }

  /**
   * 点击 OneKey Classic 卡片
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickOneKeyClassicCard() {
    const selectors = [
      // 策略1: 通过文本定位卡片
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="OneKey Classic"]])[1]',
      // 策略2: 通过文本定位父容器
      '(//android.widget.TextView[@text="OneKey Classic"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
      // 策略3: 绝对路径定位
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[7]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[1]',
    ];

    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);

        try {
          await api.platformChain
            .not()
            .ios()
            .run(async () => {
              await element.waitForDisplayed({ timeout: 2000 });
            });
          await api.platformChain
            .ios()
            .run(async () => {
              await element.waitForExist({ timeout: 2000 });
            });

          await api.tap(element);
          return;
        } catch (waitError) {
          continue;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('无法找到 OneKey Classic 卡片，已尝试所有定位策略');
  }

  /**
   * 点击 OneKey Touch 卡片
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickOneKeyTouchCard() {
    const selectors = [
      // 策略1: 通过文本定位卡片
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="OneKey Touch"]])[1]',
      // 策略2: 通过文本定位父容器
      '(//android.widget.TextView[@text="OneKey Touch"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
      // 策略3: 绝对路径定位
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[7]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]',
    ];

    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);

        try {
          await api.platformChain
            .not()
            .ios()
            .run(async () => {
              await element.waitForDisplayed({ timeout: 2000 });
            });
          await api.platformChain
            .ios()
            .run(async () => {
              await element.waitForExist({ timeout: 2000 });
            });

          await api.tap(element);
          return;
        } catch (waitError) {
          continue;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('无法找到 OneKey Touch 卡片，已尝试所有定位策略');
  }

  /**
   * 点击购买链接
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickPurchaseLink() {
    const selectors = [
      // 策略1: 通过 content-desc 定位 - 中文
      '//android.widget.Button[@content-desc="购买 ↗"]',
      // 策略2: 通过 content-desc 定位 - 英文
      '//android.widget.Button[@content-desc="Buy ↗"]',
      // 策略3: 通过文本定位
      '//android.widget.Button[.//android.widget.TextView[@text="购买 ↗" or @text="Buy ↗"]]',
      // 策略4: 通过 View 下的 Button 定位
      '//android.view.View[@text="购买 ↗" or @text="Buy ↗"]/android.widget.Button',
    ];

    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);

        try {
          await api.platformChain
            .not()
            .ios()
            .run(async () => {
              await element.waitForDisplayed({ timeout: 2000 });
            });
          await api.platformChain
            .ios()
            .run(async () => {
              await element.waitForExist({ timeout: 2000 });
            });

          await api.tap(element);
          return;
        } catch (waitError) {
          continue;
        }
      } catch (error) {
        continue;
      }
    }

    throw new Error('无法找到购买链接，已尝试所有定位策略');
  }

  /**
   * 验证页面是否已加载
   * 通过检查关键元素是否存在来判断
   */
  async verifyPageLoaded() {
    await this.waitEntryPage();
    await this.assertCurrentPage();
  }
}

export const selectHardwareWalletPage = new SelectHardwareWalletPage();
