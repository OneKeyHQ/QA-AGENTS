import fs from 'node:fs';
import { api } from '@node-e2e/cli/api/index.js';

import {
  detectPlatform,
  PLATFORMS,
} from '@node-e2e/cli/utils/detectPlatform.js';

import util, { executeByPlatform, forEachAsync } from '../util/index.js';
import screenshotHelper from '@node-e2e/cli/utils/screenshotHelper.js';

const currentPlatform = detectPlatform();

export default class Page {
  /**
   * 将类名转换为小写开头的驼峰命名
   * 例如：AddExistingWalletPage -> addExistingWalletPage
   */
  static toCamelCase(className) {
    if (!className || className.length === 0) {
      return className;
    }
    return className.charAt(0).toLowerCase() + className.slice(1);
  }

  /**
   * 构造函数，使用 Proxy 拦截方法调用并记录步骤
   */
  constructor() {
    const _ = this;
    return new Proxy(_, {
      get(target, prop, receiver) {
        if (typeof target[prop] === 'function') {
          // Record the Fn callback stack in Allure Page
          // eg: # SetPasswordPage-savePassword with args: "12345678"
          return async function(...args) {
            const className = target.constructor.name; // 获取类名
            const argsStr = args.map(arg => JSON.stringify(arg)).join(', ');

            const fucName = `${className}-${prop}`;
            const stepName = `# ${fucName} with args: ${argsStr}`;
            
            // 方法名格式：camelCaseClassName.methodName（用于截图文件名）
            // 例如：addExistingWalletPage.clickWatchAddressCard
            const camelCaseClassName = Page.toCamelCase(className);
            const methodName = `${camelCaseClassName}.${prop}`;
            
            try {
              // 记录执行前的页面状态
              await screenshotHelper.recordBefore(methodName);
              
              let result;
              await api.reporter.step(stepName, async () => {
                result = await target[prop].apply(_, args);
                // await _.collectPerfData(fucName, 'end');
              });
              
              // 检测页面变化并保存截图
              await screenshotHelper.recordAfter(methodName);

              // if (
              //   currentPlatform === PLATFORMS.ios ||
              //   currentPlatform === PLATFORMS.android
              // ) {
              //   const res = await driver.compareScreen(`${className}/${prop}`);
              //   if (res.misMatchPercentage > 0 && res.baselineImageCreated) {
              //     api.reporter.addAttachment(
              //       'Baseline Image',
              //       fs.readFileSync(`${res.folders.baseline}/${res.fileName}`),
              //       'image/png',
              //     );
              //     api.reporter.addAttachment(
              //       'Diff Image',
              //       fs.readFileSync(`${res.folders.diff}/${res.fileName}`),
              //       'image/png',
              //     );
              //   }
              //   if (res.baselineImageCreated) {
              //     await expect(res.misMatchPercentage).toEqual(0);
              //   }
              // }

              return result;
            } catch (error) {
              console.error(`Error in ${prop}: ${error.message}`);
              throw error;
            }
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
  /**
   * 获取首页元素
   */
  get home() {
    return api.by.id('home');
  }

  /**
   * 获取密码输入框元素
   */
  get lockPasswordInput() {
    return api.by.id('enter-password');
  }
  /**
   * 获取验证密码按钮元素
   */
  get verifyingPasswordBtn() {
    return api.by.id('verifying-password');
  }

  /**
   * 获取返回图标元素
   */
  get backIcon() {
    return api.by.id('nav-header-back');
  }
  /**
   * 获取关闭图标元素
   */
  get closeIcon() {
    return api.by.id('nav-header-close');
  }
  /**
   * 获取开发按钮元素
   */
  get devButton() {
    return api.by.id('dev-button');
  }

  /**
   * 获取底部确认按钮元素
   */
  get footerConfirmBtn() {
    return api.by.id('page-footer-confirm');
  }

  /**
   * 返回上一页
   */
  async goBack() {
    await api.platformChain
      .android()
      .ios()
      .run(async () => {
        await api.tap(this.backIcon);
      });

    await api.platformChain
      .not()
      .android()
      .ios()
      .run(async () => {
        await api.tap($('[data-testid="nav-header-back"]:last-of-type'));
      });
  }

  /**
   * 关闭当前页面
   */
  async close() {
    await api.tap(this.closeIcon);
  }

  /**
   * 点击底部确认按钮
   */
  async clickFooterConfirmBtn() {
    await api.tap(this.footerConfirmBtn);
  }

  /**
   * 输入密码
   */
  async inputPassword(pass) {
    await api.setValue(this.lockPasswordInput, pass);
  }

  /**
   * 点击验证密码按钮
   */
  async clickVerifyingPasswordBtn() {
    await api.tap(this.verifyingPasswordBtn);
  }

  /**
   * 通过密码解锁应用
   */
  async unlockAppByPassword(pass) {
    await this.inputPassword(pass);
    await this.clickVerifyingPasswordBtn();
  }
  /**
   * 点击开发按钮
   */
  async clickDevBtn() {
    await api.tapOnDevBtn('dev-button');
  }

  /**
   * 重启应用
   */
  async restart() {
    await api.restartApp();
  }
  /**
   * 跳转到首页
   */
  async toHomePage() {
    await api.tapOnDevBtn('dev-button');
    await api.platformChain.ext().run(async () => {
      await api.pause(1000);
    });
    await api.tapOnDevBtn('open-home-page');
  }
  /**
   * 跳转到设置页面
   */
  async toSettingPage() {
    await api.hideKeyboard();
    await api.tap(api.by.id('dev-button'));
    await api.tapOnDevBtn('open-home-page');
    await api.tap(api.by.id('dev-button'));
    await api.tap(api.by.id('open-settings-page'));
  }

  /**
   * 等待进入页面
   * @param {number} timeout - 超时时间（毫秒），可选，默认使用 WAITE_FOR_PAGE_TIMEOUT
   */
  async waitEntryPage(timeout) {
    if (this.keyElement) {
      await api.waitPageByElement(this.keyElement, timeout);
    } else {
      await api.pause(600);
    }
  }

  /**
   * 断言当前页面
   */
  async assertCurrentPage() {
    if (this.keyElement) {
      await this.keyElement.isDisplayed();
    }
  }
  /**
   * 期望导航到首页
   */
  async expectNavToHomePage() {
    await api.platformChain
      .not()
      .ios()
      .run(async () => await this.home.waitForDisplayed({ timeout: 10000 }));

    await api.platformChain
      .ios()
      .run(async () => await this.home.waitForExist({ timeout: 20000 }));
  }

  /**
   * 收集性能数据
   */
  async collectPerfData(name, prefix) {
    await api.platformChain
      .android()
      .run(async () => {
        const types = await browser.getPerformanceDataTypes();
        await util.forEachAsync(types, async currentType => {
          const perfData = await browser.getPerformanceData(
            process.env.APPIUM_APPPACKAGE,
            currentType,
            5,
          );
          await api.globalStore.updatePerfData(
            `${currentPlatform}:${currentType}`,
            `${name}:${prefix}`,
            perfData,
          );
        })();
      })
      .catch(e => console.log(e.message));
  }
}
