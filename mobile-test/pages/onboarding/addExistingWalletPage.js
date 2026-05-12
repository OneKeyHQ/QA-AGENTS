import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

/**
 * 导入现有钱包页面 - 用户选择导入现有钱包方式的页面
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup
 */
class AddExistingWalletPage extends Page {
  /**
   * 页面关键元素 - 用于判断页面是否加载完成
   */
  get keyElement() {
    return this.pageTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 页面标题 - "导入现有钱包" / "Add existing wallet"
   * text: "导入现有钱包" / "Add existing wallet"
   * bounds: [397,89][685,152]
   * 定位方式：使用文本内容定位，更稳定，支持中英文
   */
  get pageTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入现有钱包" or @text="Add existing wallet"]',
    );
  }

  /**
   * 返回按钮 - 左上角返回图标按钮
   * bounds: [35,71][135,171]
   * 定位方式：使用相对xpath从指定层级开始定位第一个Button
   */
  get backButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.widget.Button[1]',
    );
  }

  /**
   * 右上角按钮 - 右上角功能按钮（可能是设置或更多选项）
   * bounds: [947,89][1029,152]
   * 定位方式：使用相对xpath从指定层级开始定位ViewGroup[6]下的Button
   */
  get topRightButton() {
    return api.by.xpath(
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[6]/android.widget.Button',
    );
  }

  // ========== 主要内容区域 - 钱包选项卡片 ==========

  /**
   * 传输卡片 - 第一个选项卡片（可点击）
   * text: "传输"
   * bounds: [54,205][1029,380]
   * 定位方式：使用文本内容定位，更稳定
   */
  get transferCard() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="传输"]/..',
    );
  }

  /**
   * 传输标题 - 卡片内的标题文本
   * text: "传输"
   * bounds: [225,238][902,301]
   * 定位方式：使用文本内容定位
   */
  get transferTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="传输"]',
    );
  }

  /**
   * 传输副标题 - 卡片内的副标题文本
   * text: "在设备之间安全地转移钱包"
   * bounds: [225,306][902,348]
   * 定位方式：使用文本内容定位
   */
  get transferSubtitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="在设备之间安全地转移钱包"]',
    );
  }

  /**
   * 导入助记词或私钥卡片 - 第二个选项卡片（可点击）
   * text: "导入助记词或私钥"
   * bounds: [54,433][1029,605]
   * 定位方式：使用文本内容定位，更稳定
   */
  get importMnemonicOrPrivateKeyCard() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="导入助记词或私钥"]/..',
    );
  }

  /**
   * 导入助记词或私钥标题 - 卡片内的标题文本
   * text: "导入助记词或私钥"
   * bounds: [225,488][902,551]
   * 定位方式：使用文本内容定位
   */
  get importMnemonicOrPrivateKeyTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="导入助记词或私钥"]',
    );
  }

  /**
   * OneKey KeyTag卡片 - 第三个选项卡片（可点击）
   * text: "OneKey KeyTag"
   * bounds: [54,657][1029,829]
   * 定位方式：使用文本内容定位，更稳定
   */
  get oneKeyKeyTagCard() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="OneKey KeyTag"]/..',
    );
  }

  /**
   * OneKey KeyTag标题 - 卡片内的标题文本
   * text: "OneKey KeyTag"
   * bounds: [225,712][902,775]
   * 定位方式：使用文本内容定位
   */
  get oneKeyKeyTagTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="OneKey KeyTag"]',
    );
  }

  /**
   * OneKey Lite卡片 - 第四个选项卡片（可点击）
   * text: "OneKey Lite"
   * bounds: [54,882][1029,1054]
   * 定位方式：使用文本内容定位，更稳定
   */
  get oneKeyLiteCard() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="OneKey Lite"]/..',
    );
  }

  /**
   * OneKey Lite标题 - 卡片内的标题文本
   * text: "OneKey Lite"
   * bounds: [225,937][902,1000]
   * 定位方式：使用文本内容定位
   */
  get oneKeyLiteTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="OneKey Lite"]',
    );
  }

  /**
   * Google Drive卡片 - 第五个选项卡片（可点击）
   * text: "Google Drive"
   * bounds: [54,1106][1029,1278]
   * 定位方式：使用文本内容定位，更稳定
   */
  get googleDriveCard() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="Google Drive"]/..',
    );
  }

  /**
   * Google Drive标题 - 卡片内的标题文本
   * text: "Google Drive"
   * bounds: [225,1161][902,1224]
   * 定位方式：使用文本内容定位
   */
  get googleDriveTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Google Drive"]',
    );
  }

  /**
   * 观察地址卡片 - 第六个选项卡片（可点击）
   * text: "观察地址" / "Watch-only address"
   * bounds: [54,1331][1029,1548]
   * 定位方式：使用文本内容定位，更稳定，支持中英文
   */
  get watchAddressCard() {
    return api.by.xpath(
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="观察地址" or @text="Watch-only address"]/..',
    );
  }

  /**
   * 观察地址标题 - 卡片内的标题文本
   * text: "观察地址" / "Watch-only address"
   * bounds: [225,1364][902,1427]
   * 定位方式：使用文本内容定位，支持中英文
   */
  get watchAddressTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="观察地址" or @text="Watch-only address"]',
    );
  }

  /**
   * 观察地址描述 - 卡片内的描述文本
   * text: "👀 查看他人的交易。🚶 您无法管理该钱包。" / "Watch-Only wallet in OneKey allows monitoring of a specific address..."
   * bounds: [225,1432][902,1516]
   * 定位方式：使用文本内容定位（部分匹配），支持中英文
   */
  get watchAddressDescription() {
    return api.by.xpath(
      '//android.widget.TextView[contains(@text, "查看他人的交易") or contains(@text, "monitoring of a specific address")]',
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
   * 点击传输卡片
   */
  async clickTransferCard() {
    await api.tap(this.transferCard);
  }

  /**
   * 点击导入助记词或私钥卡片
   */
  async clickImportMnemonicOrPrivateKeyCard() {
    await api.tap(this.importMnemonicOrPrivateKeyCard);
  }

  /**
   * 点击OneKey KeyTag卡片
   */
  async clickOneKeyKeyTagCard() {
    await api.tap(this.oneKeyKeyTagCard);
  }

  /**
   * 点击OneKey Lite卡片
   */
  async clickOneKeyLiteCard() {
    await api.tap(this.oneKeyLiteCard);
  }

  /**
   * 点击Google Drive卡片
   */
  async clickGoogleDriveCard() {
    await api.tap(this.googleDriveCard);
  }

  /**
   * 点击观察地址卡片
   * 尝试多个定位策略，找到第一个存在的元素就点击
   */
  async clickWatchAddressCard() {
    // 定义多个定位策略
    const selectors = [
      // 策略1: 原来的定位方式 - 通过文本定位卡片
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="观察地址"]/..',
      // 策略2: 通过文本定位卡片 - 英文
      '//android.view.ViewGroup[@clickable="true"]/android.widget.TextView[@text="Watch-only address"]/..',
      // 策略3: 通过文本定位卡片 - 中英文混合
      '//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="观察地址" or @text="Watch-only address"]]',
      // 策略4: 通过标题文本定位父容器
      '(//android.widget.TextView[@text="观察地址" or @text="Watch-only address"])[1]/ancestor::android.view.ViewGroup[@clickable="true"][1]',
      // 策略5: 通过描述文本定位 - 包含"查看他人的交易"
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[contains(@text, "查看他人的交易") or contains(@text, "monitoring of a specific address")]])[1]',
      // 策略6: 通过描述文本定位 - 包含"👀"
      '(//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[contains(@text, "👀")]])[1]',
      // 策略7: ScrollView 下包含"观察地址"文本的最后一个可点击 ViewGroup
      '(//android.widget.ScrollView//android.view.ViewGroup[@clickable="true"][.//android.widget.TextView[@text="观察地址" or @text="Watch-only address"]])[last()]',
    ];

    // 依次尝试每个定位策略
    for (let i = 0; i < selectors.length; i++) {
      try {
        const selector = selectors[i];
        const element = api.by.xpath(selector);
        
        // 尝试等待元素显示（短超时）
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
          
          // 元素找到了，点击它
          await api.tap(element);
          return; // 成功点击，退出方法
        } catch (waitError) {
          // 元素不存在，继续尝试下一个策略
          continue;
        }
      } catch (error) {
        // 定位失败，继续尝试下一个策略
        continue;
      }
    }

    // 所有策略都失败了，抛出错误
    throw new Error('无法找到观察地址卡片，已尝试所有定位策略');
  }

  /**
   * 获取页面标题文本
   * @returns {Promise<string>} 页面标题文本
   */
  async getPageTitle() {
    return await api.getText(this.pageTitle);
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

export const addExistingWalletPage = new AddExistingWalletPage();
