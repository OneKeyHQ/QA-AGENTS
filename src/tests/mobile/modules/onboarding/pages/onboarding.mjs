import { MobilePage } from '../../../mobile-page.mjs';
import { SetPasswordPage } from './set-password.mjs';

/**
 * 引导页 / 添加钱包流程 Page Object
 *
 * 涉及的 UI 元素（data-testid 或可见文案）：
 * - APP-OnBoarding-Screen          引导页根容器
 * - onboarding-create-or-import-wallet  「创建或导入钱包」主按钮
 * - onboarding-add-existing-wallet-page  「添加现有钱包」子页面容器
 * - onboardingv2-handle-import-custom-mnemonic-input  助记词输入框
 * - onboarding-watch-address-input   观察地址输入框
 * - import-address-input             公钥 / 扩展公钥输入框
 * - 文案「添加现有钱包」「导入助记词」「观察地址」「公钥」「确认」  无 testid 时用 tapText 点击
 */
export class OnboardingPage extends MobilePage {
  /** 等待引导页加载完成 */
  async waitForReady(opts = {}) {
    // APP-OnBoarding-Screen：引导页根 Screen
    await this.waitFor('APP-OnBoarding-Screen', { timeout: opts.timeout ?? 15000 });
    return 'onboarding visible';
  }

  /** 点击「创建或导入钱包」入口 */
  async tapCreateOrImport() {
    // onboarding-create-or-import-wallet：首页主 CTA 按钮
    await this.tap('onboarding-create-or-import-wallet');
    return 'create/import tapped';
  }

  /** 进入「添加现有钱包」子页（已在页内则跳过） */
  async goToAddExistingWallet() {
    // onboarding-add-existing-wallet-page：添加现有钱包页面容器
    if (await this.isDisplayed('onboarding-add-existing-wallet-page')) {
      return 'on add-existing-wallet page';
    }
    // 文案「添加现有钱包」：列表项 / 入口按钮
    await this.tapText('添加现有钱包');
    return 'navigated to add-existing-wallet';
  }

  /** 点击「导入助记词」选项 */
  async tapImportMnemonic() {
    // 文案「导入助记词」：添加现有钱包页中的导入选项
    await this.tapText('导入助记词');
    return 'import mnemonic tapped';
  }

  /** 输入助记词（空格分隔） */
  async enterMnemonic(mnemonic) {
    // onboardingv2-handle-import-custom-mnemonic-input：自定义助记词多行输入框
    await this.setValue('onboardingv2-handle-import-custom-mnemonic-input', mnemonic);
    return `${mnemonic.split(/\s+/).length} words entered`;
  }

  /** 设置钱包密码（委托 SetPasswordPage） */
  async setWalletPassword(password) {
    const pwdPage = new SetPasswordPage(this.driver);
    return pwdPage.setPassword(password);
  }

  /** 点击「观察地址」选项 */
  async tapWatchAddress() {
    // 文案「观察地址」：添加现有钱包页中的观察钱包入口
    await this.tapText('观察地址');
    return 'watch address tapped';
  }

  /** 选择目标网络（按链名称文案点击，如 Ethereum / Bitcoin） */
  async selectNetwork(chain) {
    await this.tapText(chain);
    return `network ${chain} selected`;
  }

  /** 输入要观察的链上地址 */
  async enterWatchAddress(address) {
    // onboarding-watch-address-input：观察地址输入框
    await this.setValue('onboarding-watch-address-input', address);
    return `${address.slice(0, 12)}...`;
  }

  /** 输入扩展公钥（xpub 等） */
  async enterPublicKey(xpub) {
    // import-address-input：公钥导入输入框
    await this.setValue('import-address-input', xpub);
    return `${xpub.slice(0, 16)}...`;
  }

  /** 切换到「公钥」Tab */
  async tapPublicKeyTab() {
    // 文案「公钥」：导入页 Tab 切换
    await this.tapText('公钥');
    return 'public key tab selected';
  }

  /** 点击「确认」提交当前步骤 */
  async confirm() {
    // 文案「确认」：通用确认按钮
    await this.tapText('确认');
    return 'confirmed';
  }
}
