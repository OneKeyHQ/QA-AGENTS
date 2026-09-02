// 移动端 Page Object 基类 — 封装 WDIO driver 与通用操作 helper。
// Page 只负责导航和元素交互，不做测试断言。

export class MobilePage {
  constructor(driver) {
    this.driver = driver;
    this._helpersPromise = null;
  }

  /** 懒加载 helpers/index.mjs（tap / waitFor / setValue 等） */
  helpers() {
    if (!this._helpersPromise) {
      this._helpersPromise = import('./helpers/index.mjs');
    }
    return this._helpersPromise;
  }

  /** 按 data-testid 点击元素 */
  async tap(testId) {
    const { tap } = await this.helpers();
    return tap(this.driver, testId);
  }

  /** 等待指定 testid 元素出现 */
  async waitFor(testId, opts = {}) {
    const { waitFor } = await this.helpers();
    return waitFor(this.driver, testId, opts);
  }

  /** 判断 testid 元素是否可见 */
  async isDisplayed(testId) {
    const { isDisplayed } = await this.helpers();
    return isDisplayed(this.driver, testId);
  }

  /** 向 testid 对应输入框写入文本 */
  async setValue(testId, value) {
    const { setValue } = await this.helpers();
    return setValue(this.driver, testId, value);
  }

  /** 按可见文案定位元素（无障碍文本 / label） */
  async byText(text) {
    const { byText } = await this.helpers();
    return byText(this.driver, text);
  }

  /** 按可见文案点击 */
  async tapText(text) {
    const el = await this.byText(text);
    await el.click();
    return text;
  }

  /** 判断可见文案是否出现在屏幕上 */
  async isTextVisible(text) {
    const { isTextVisible } = await this.helpers();
    return isTextVisible(this.driver, text);
  }

  /** 返回当前平台：'ios' | 'android' */
  async platform() {
    const { platformOf } = await this.helpers();
    return platformOf(this.driver);
  }

  /** 保存当前屏幕截图到指定路径 */
  async screenshot(filePath) {
    const { mkdirSync } = await import('node:fs');
    const { dirname } = await import('node:path');
    mkdirSync(dirname(filePath), { recursive: true });
    await this.driver.saveScreenshot(filePath);
    return filePath;
  }
}
