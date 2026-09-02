import { MobilePage } from '../../../mobile-page.mjs';

/**
 * 设置钱包密码弹层 Page Object
 *
 * 涉及的 UI 元素：
 * - password          密码输入框（首次输入）
 * - confirm-password  确认密码输入框（部分流程会出现）
 * - set-password      「设置密码」/ 确认提交按钮
 */
export class SetPasswordPage extends MobilePage {
  /** 填写密码并提交（自动处理确认密码框） */
  async setPassword(password) {
    // password：主密码输入框
    await this.setValue('password', password);
    // confirm-password：二次确认密码输入框（存在时才填）
    if (await this.isDisplayed('confirm-password')) {
      await this.setValue('confirm-password', password);
    }
    // set-password：提交 / 完成设置按钮
    await this.tap('set-password');
    return 'password set';
  }
}
