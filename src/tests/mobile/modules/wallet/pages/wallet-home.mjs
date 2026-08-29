import { MobilePage } from '../../../mobile-page.mjs';

/**
 * 钱包主页 Page Object
 *
 * 涉及的 UI 元素：
 * - Wallet-Tab-Header  钱包 Tab 顶部栏（账户名、网络等），作为首页就绪标志
 * - moreActions        右上角「更多」操作按钮（展开菜单：地址簿、设置等）
 * - 任意 testid / 文案   assertElementVisible / assertTextVisible 用于场景内断言
 */
export class WalletHomePage extends MobilePage {
  /** 等待钱包首页顶部栏出现，表示已进入主界面 */
  async waitForReady(opts = {}) {
    // Wallet-Tab-Header：钱包 Tab 页头容器
    await this.waitFor('Wallet-Tab-Header', { timeout: opts.timeout ?? 10000 });
    return 'wallet home ready';
  }

  /** 断言指定 testid 元素可见（不可见则抛错） */
  async assertElementVisible(testId) {
    const visible = await this.isDisplayed(testId);
    if (!visible) throw new Error(`${testId} not displayed`);
    return `${testId} visible`;
  }

  /** 断言指定文案在屏幕上可见 */
  async assertTextVisible(text) {
    const visible = await this.isTextVisible(text);
    if (!visible) throw new Error(`"${text}" not displayed`);
    return `${text} visible`;
  }

  /** 点击右上角「更多」按钮 */
  async openMoreActions() {
    // moreActions：钱包首页更多操作入口
    await this.tap('moreActions');
    return 'moreActions opened';
  }
}
