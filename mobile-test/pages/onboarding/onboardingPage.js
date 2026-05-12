import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * Onboarding页面 - 用户引导页面
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup
 */
class OnboardingPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.connectHardwareWalletBtn;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 返回按钮 - 左上角返回图标按钮
   * bounds: [35,71][135,171]
   * 定位方式：使用相对xpath从指定层级开始定位Button[4]（更新后的DOM结构）
   */
  get backButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.widget.Button',
    );
  }

  /**
   * 右上角按钮 - 右上角功能按钮（唤起语言选择等）
   * bounds: [947,89][1029,152]
   * 定位方式：使用相对 xpath 从指定层级开始定位，路径末尾为 ViewGroup[5]/android.widget.Button
   */
  get topRightButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[5]/android.widget.Button',
    );
  }

  // ========== 主要内容区域元素 ==========

  /**
   * 连接硬件钱包按钮 - 主要的操作按钮（第一个大按钮）
   * content-desc: "连接硬件钱包" / "Connect hardware wallet"
   * text: "连接硬件钱包" / "Connect hardware wallet"
   * bounds: [122,948][962,1079]
   * 定位方式：优先使用content-desc，更稳定，支持中英文
   */
  get connectHardwareWalletBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="连接硬件钱包" or @text="连接硬件钱包" or @content-desc="Connect hardware wallet" or @text="Connect hardware wallet"]',
    );
  }

  /**
   * 使用Google继续按钮 - Google登录按钮（第二个大按钮）
   * content-desc: "使用 Google 继续" / "Continue with Google"
   * text: "使用 Google 继续" / "Continue with Google"
   * bounds: [122,1121][962,1253]
   * 定位方式：优先使用content-desc，更稳定，支持中英文
   */
  get continueWithGoogleBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="使用 Google 继续" or @text="使用 Google 继续" or @content-desc="Continue with Google" or @text="Continue with Google"]',
    );
  }

  /**
   * 使用Apple继续按钮 - Apple登录按钮（第三个大按钮）
   * content-desc: "使用 Apple 继续" / "Continue with Apple"
   * text: "使用 Apple 继续" / "Continue with Apple"
   * bounds: [122,1295][962,1426]
   * 定位方式：优先使用content-desc，更稳定，支持中英文
   */
  get continueWithAppleBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="使用 Apple 继续" or @text="使用 Apple 继续" or @content-desc="Continue with Apple" or @text="Continue with Apple"]',
    );
  }

  /**
   * 更多选项按钮 - 第四个按钮
   * content-desc: "更多选项" / "More options"
   * text: "更多选项" / "More options"
   * bounds: [122,1455][962,1531]
   * 定位方式：优先使用content-desc，更稳定，支持中英文
   */
  get moreOptionsBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="更多选项" or @text="更多选项" or @content-desc="More options" or @text="More options"]',
    );
  }

  /**
   * 协议文本 - 页面底部的使用条款和隐私政策文本
   * text: "继续操作即表示您确认已年满18岁，并同意我们的使用条款 ↗和隐私政策 ↗" / "By continuing, you confirm that you are 18+ and agree to our Terms ↗ & Privacy ↗"
   * bounds: [121,2227][961,2311]
   * 定位方式：使用文本内容定位，更稳定，支持中英文
   */
  get agreementText() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "继续操作即表示您确认已年满18岁") or contains(@text, "By continuing, you confirm that you are 18+")]',
    );
  }

  // ========== 按钮内部文本元素 ==========

  /**
   * 连接硬件钱包按钮文本 - 按钮内的文本内容
   * 用于验证按钮文本是否正确显示，支持中英文
   */
  get connectHardwareWalletText() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="连接硬件钱包" or @text="连接硬件钱包" or @content-desc="Connect hardware wallet" or @text="Connect hardware wallet"]/android.widget.TextView',
    );
  }

  /**
   * 使用Google继续按钮文本 - 按钮内的文本内容
   * 用于验证按钮文本是否正确显示，支持中英文
   */
  get continueWithGoogleText() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="使用 Google 继续" or @text="使用 Google 继续" or @content-desc="Continue with Google" or @text="Continue with Google"]/android.widget.TextView',
    );
  }

  /**
   * 使用Apple继续按钮文本 - 按钮内的文本内容
   * 用于验证按钮文本是否正确显示，支持中英文
   */
  get continueWithAppleText() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="使用 Apple 继续" or @text="使用 Apple 继续" or @content-desc="Continue with Apple" or @text="Continue with Apple"]/android.widget.TextView',
    );
  }

  /**
   * 更多选项按钮文本 - 按钮内的文本内容
   * 用于验证按钮文本是否正确显示，支持中英文
   */
  get moreOptionsText() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="更多选项" or @text="更多选项" or @content-desc="More options" or @text="More options"]/android.widget.TextView',
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
   * 点击右上角按钮
   */
  async clickTopRightButton() {
    await api.tap(this.topRightButton);
  }

  /**
   * 点击连接硬件钱包按钮
   */
  async clickConnectHardwareWalletBtn() {
    await api.tap(this.connectHardwareWalletBtn);
  }

  /**
   * 点击使用Google继续按钮
   */
  async clickContinueWithGoogleBtn() {
    await api.tap(this.continueWithGoogleBtn);
  }

  /**
   * 点击使用Apple继续按钮
   */
  async clickContinueWithAppleBtn() {
    await api.tap(this.continueWithAppleBtn);
  }

  /**
   * 点击更多选项按钮
   */
  async clickMoreOptionsBtn() {
    await api.tap(this.moreOptionsBtn);
  }


  /**
   * 获取协议文本内容
   * @returns {Promise<string>} 协议文本内容
   */
  async getAgreementText() {
    return await api.getText(this.agreementText);
  }

  /**
   * 获取连接硬件钱包按钮文本
   * @returns {Promise<string>} 按钮文本内容
   */
  async getConnectHardwareWalletText() {
    return await api.getText(this.connectHardwareWalletText);
  }

  /**
   * 获取使用Google继续按钮文本
   * @returns {Promise<string>} 按钮文本内容
   */
  async getContinueWithGoogleText() {
    return await api.getText(this.continueWithGoogleText);
  }

  /**
   * 获取使用Apple继续按钮文本
   * @returns {Promise<string>} 按钮文本内容
   */
  async getContinueWithAppleText() {
    return await api.getText(this.continueWithAppleText);
  }

  /**
   * 获取更多选项按钮文本
   * @returns {Promise<string>} 按钮文本内容
   */
  async getMoreOptionsText() {
    return await api.getText(this.moreOptionsText);
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

export const onboardingPage = new OnboardingPage();
