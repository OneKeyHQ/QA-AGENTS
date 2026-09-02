import { MobilePage } from '../../../mobile-page.mjs';

/**
 * 通讯录 / 地址簿 Page Object
 *
 * 涉及的 UI 元素：
 * - setting-address-book       设置页中的「地址簿」入口（部分布局直接可见）
 * - moreActions                钱包首页右上角「更多」按钮
 * - 文案「地址簿」              moreActions 展开菜单中的地址簿项
 * - address-book-add-icon      地址簿列表页右上角添加图标
 * - address-book-add-footer-btn  地址簿列表页底部「添加」按钮（空列表态）
 * - address-book-form-save-btn   新建/编辑地址表单「保存」按钮
 */
export class AddressBookPage extends MobilePage {
  /** 从钱包首页导航到地址簿（优先 testid，否则走更多菜单） */
  async navigateFromHome() {
    // setting-address-book：设置区域的地址簿直达入口
    if (await this.isDisplayed('setting-address-book')) {
      await this.tap('setting-address-book');
      return 'via setting-address-book testID';
    }
    // moreActions：钱包首页右上角更多操作按钮
    await this.tap('moreActions');
    // 文案「地址簿」：更多菜单列表项
    await this.tapText('地址簿');
    return 'via moreActions+地址簿';
  }

  /** 打开「添加地址」表单（兼容两种添加按钮布局） */
  async openAddForm() {
    // address-book-add-icon：列表页顶部/右上角添加图标
    if (await this.isDisplayed('address-book-add-icon')) {
      await this.tap('address-book-add-icon');
      return 'via add-icon';
    }
    // address-book-add-footer-btn：空列表时底部添加按钮
    if (await this.isDisplayed('address-book-add-footer-btn')) {
      await this.tap('address-book-add-footer-btn');
      return 'via add-footer-btn';
    }
    throw new Error('No address book add button visible');
  }

  /** 确认添加地址表单已就绪（保存按钮可见） */
  async assertFormReady() {
    // address-book-form-save-btn：表单底部保存按钮
    const visible = await this.isDisplayed('address-book-form-save-btn');
    if (!visible) throw new Error('save button not visible');
    return 'form ready';
  }
}
