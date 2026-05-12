import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

/**
 * 菜单页 - Menu Page
 * 参考：xmls/settings/menuEnglish.xml
 */
class MenuPage extends Page {
  // ========== 顶部导航栏元素 ==========

  /**
   * 返回按钮 - Back Button
   * resource-id: "nav-header-back"
   * bounds: [34,87][134,186]
   */
  get backBtn() {
    return api.by.id('nav-header-back');
  }

  // ========== 用户信息区域 ==========

  /**
   * OneKey ID文本 - OneKey ID Text
   * text: "OneKey ID"
   * bounds: [189,263][409,326]
   */
  get oneKeyIdText() {
    return api.by.xpath('//android.widget.TextView[@text="OneKey ID"]');
  }

  /**
   * 注册/登录按钮 - Sign up / Login Button
   * text: "Sign up / Login" | "注册 / 登录"
   * bounds: [718,267][964,320]
   */
  get signUpLoginBtn() {
    return api.by.text(['Sign up / Login', '注册 / 登录']);
  }

  /**
   * 连接硬件钱包 - Connect hardware wallet
   * text: "Connect hardware wallet" | "连接硬件钱包"
   * bounds: [232,463][856,516]
   */
  get connectHardwareWalletText() {
    return api.by.text(['Connect hardware wallet', '连接硬件钱包']);
  }

  /**
   * 添加按钮 - Add Button
   * text: "Add" | "添加"
   * bounds: [919,462][985,515]
   */
  get addBtn() {
    return api.by.text(['Add', '添加']);
  }

  // ========== General 区域 ==========

  /**
   * General标题 - General Title
   * text: "General" | "通用"
   * bounds: [0,644][1080,718]
   */
  get generalTitle() {
    return api.by.text(['General', '通用']);
  }

  /**
   * 设置 - Settings
   * text: "Settings" | "设置"
   * bounds: [108,817][225,859]
   */
  get settingsBtn() {
    return api.by.text(['Settings', '设置']);
  }

  /**
   * 扫描二维码 - Scan QR code
   * text: "Scan QR code" | "扫描二维码"
   * bounds: [316,817][515,859]
   */
  get scanQrCodeBtn() {
    return api.by.text(['Scan QR code', '扫描二维码']);
  }

  /**
   * Prime - Prime
   * text: "Prime"
   * bounds: [622,817][706,859]
   */
  get primeBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Prime"]');
  }

  /**
   * 立即锁定 - Lock now
   * text: "Lock now" | "立即锁定"
   * bounds: [845,817][981,859]
   */
  get lockNowBtn() {
    return api.by.text(['Lock now', '立即锁定']);
  }

  // ========== Wallet 区域 ==========

  /**
   * Wallet标题 - Wallet Title
   * text: "Wallet" | "钱包"
   * bounds: [0,928][1080,1002]
   */
  get walletTitle() {
    return api.by.text(['Wallet', '钱包']);
  }

  /**
   * 备份 - Backup
   * text: "Backup" | "备份"
   * bounds: [113,1101][219,1143]
   */
  get backupBtn() {
    return api.by.text(['Backup', '备份']);
  }

  /**
   * 地址簿 - Address book
   * text: "Address book" | "地址簿"
   * bounds: [317,1101][514,1143]
   */
  get addressBookBtn() {
    return api.by.text(['Address book', '地址簿']);
  }

  /**
   * 网络 - Network
   * text: "Network" | "网络"
   * bounds: [605,1101][724,1143]
   */
  get networkBtn() {
    return api.by.text(['Network', '网络']);
  }

  /**
   * 偏好设置 - Preferences
   * text: "Preferences"
   * bounds: [827,1101][1000,1143]
   */
  get preferencesBtn() {
    return api.by.xpath('//android.widget.TextView[@text="Preferences"]');
  }

  // ========== Security 区域 ==========

  /**
   * 安全 - Security
   * text: "Security" | "安全"
   * bounds: [109,1290][224,1332]
   */
  get securityBtn() {
    return api.by.text(['Security', '安全']);
  }

  /**
   * 批量复制地址 - Bulk copy addresses
   * text: "Bulk copy addresses" | "批量复制地址"
   * bounds: [291,1290][539,1374]
   */
  get bulkCopyAddressesBtn() {
    return api.by.text(['Bulk copy addresses', '批量复制地址']);
  }

  // ========== More 区域 ==========

  /**
   * More标题 - More Title
   * text: "More" | "更多"
   * bounds: [0,1444][1080,1518]
   */
  get moreTitle() {
    return api.by.text(['More', '更多']);
  }

  /**
   * 联系我们 - Contact us
   * text: "Contact us" | "联系我们"
   * bounds: [89,1617][243,1659]
   */
  get contactUsBtn() {
    return api.by.text(['Contact us', '联系我们']);
  }

  /**
   * 推荐 - Referral
   * resource-id: "referral"
   * text: "Referral"
   * bounds: [291,1518][540,1685]
   */
  get referralBtn() {
    return api.by.id('referral');
  }

  /**
   * 兑换 - Redeem
   * text: "Redeem" | "兑换"
   * bounds: [606,1617][723,1659]
   */
  get redeemBtn() {
    return api.by.text(['Redeem', '兑换']);
  }

  // ========== 底部信息 ==========

  /**
   * 关于OneKey - About OneKey
   * text: "About OneKey" | "关于 OneKey"
   * bounds: [105,2253][338,2306]
   */
  get aboutOneKeyText() {
    return api.by.text(['About OneKey', '关于 OneKey']);
  }

  /**
   * 版本信息 - Version Info
   * text: "Version 5.20.0 2026012729"
   * bounds: [518,2253][976,2306]
   */
  get versionText() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "Version")]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击返回按钮
   */
  async clickBackBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.backBtn);
      },
      async () => {
        await api.fixInterceptedClick('nav-header-back');
      },
    );
  }

  /**
   * 点击设置按钮
   */
  async clickSettingsBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.settingsBtn);
      },
      async () => {
        await api.fixInterceptedClick('Settings');
      },
    );
  }

  /**
   * 点击扫描二维码按钮
   */
  async clickScanQrCodeBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.scanQrCodeBtn);
      },
      async () => {
        await api.fixInterceptedClick('Scan QR code');
      },
    );
  }

  /**
   * 点击Prime按钮
   */
  async clickPrimeBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.primeBtn);
      },
      async () => {
        await api.fixInterceptedClick('Prime');
      },
    );
  }

  /**
   * 点击立即锁定按钮
   */
  async clickLockNowBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.lockNowBtn);
      },
      async () => {
        await api.fixInterceptedClick('Lock now');
      },
    );
  }

  /**
   * 点击备份按钮
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
   * 点击地址簿按钮
   */
  async clickAddressBookBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.addressBookBtn);
      },
      async () => {
        await api.fixInterceptedClick('Address book');
      },
    );
  }

  /**
   * 点击网络按钮
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
   * 点击偏好设置按钮
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
   * 点击安全按钮
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
   * 点击批量复制地址按钮
   */
  async clickBulkCopyAddressesBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.bulkCopyAddressesBtn);
      },
      async () => {
        await api.fixInterceptedClick('Bulk copy addresses');
      },
    );
  }

  /**
   * 点击联系我们按钮
   */
  async clickContactUsBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.contactUsBtn);
      },
      async () => {
        await api.fixInterceptedClick('Contact us');
      },
    );
  }

  /**
   * 点击推荐按钮
   */
  async clickReferralBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.referralBtn);
      },
      async () => {
        await api.fixInterceptedClick('referral');
      },
    );
  }

  /**
   * 点击兑换按钮
   */
  async clickRedeemBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.redeemBtn);
      },
      async () => {
        await api.fixInterceptedClick('Redeem');
      },
    );
  }

  /**
   * 点击添加按钮（连接硬件钱包）
   */
  async clickAddBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.addBtn);
      },
      async () => {
        await api.fixInterceptedClick('Add');
      },
    );
  }

  /**
   * 点击注册/登录按钮
   */
  async clickSignUpLoginBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.signUpLoginBtn);
      },
      async () => {
        await api.fixInterceptedClick('Sign up / Login');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待菜单页显示
   */
  async waitForMenuPage() {
    await api.waitPageByElement(this.generalTitle);
  }

  /**
   * 验证菜单页是否显示
   */
  async verifyMenuPageDisplayed() {
    const isDisplayed = await this.generalTitle.isDisplayed();
    return isDisplayed;
  }
}

export const menuPage = new MenuPage();
