import { api } from '@node-e2e/cli/api/index.js';
import Page from './base.js';
import { executeByPlatform } from '../util/index.js';
import CopyAddressPage from './homepage/copyAddressPage.js';

/**
 * 首页 - Homepage
 * 参考：xmls/homePage/homepageNowalletEnglish.xml（无钱包）、xmls/onboarding/homepageWithAssets.xml（第一屏）、
 * homepageWithAssetsSecondScreen.xml、homepageWithAssetsThirdScreen.xml（长页滚动后可见）
 * 有资产时顶部无 setting、底部导航无 Mobile-AppTabBar/home/swap 等 id，改用 content-desc 定位。
 */
class HomePage extends Page {
  // ========== 顶部导航栏元素 ==========

  /**
   * 设置按钮 - Setting Button
   * resource-id: "setting"
   * 注意：有资产页可能无此按钮（设置在 moreActions 菜单内）
   */
  get settingBtn() {
    return api.by.id('setting');
  }

  /**
   * 账户选择器按钮 - Account Selector Trigger
   * resource-id: "AccountSelectorTriggerBase"
   * content-desc: 无钱包时为 "No account"，有资产时为账户名（如 "12345678"）
   */
  get accountSelectorBtn() {
    return api.by.id('AccountSelectorTriggerBase');
  }

  /**
   * 网络选择按钮 - Network Selector Button
   * resource-id: "account-network-trigger-button"
   * bounds: [745,101][829,185]
   */
  get networkSelectorBtn() {
    return api.by.id('account-network-trigger-button');
  }

  /**
   * 通知按钮 - Notification Button
   * resource-id: "header-right-notification"
   * bounds: [860,111][923,174]
   */
  get notificationBtn() {
    return api.by.id('header-right-notification');
  }

  /**
   * 更多操作按钮 - More Actions Button
   * resource-id: "moreActions"
   * bounds: [947,93][1047,193]
   */
  get moreActionsBtn() {
    return api.by.id('moreActions');
  }

  /**
   * 搜索框 - Search Input
   * resource-id: "nav-header-search"
   * hint: "Search anything" / "搜索任何内容"
   */
  get searchInput() {
    return api.by.id('nav-header-search');
  }

  /**
   * 钱包页面头部右侧容器 - Wallet Page Header Right
   * resource-id: "Wallet-Page-Header-Right"
   * 注意：有资产页布局不同，可能无此节点
   */
  get walletPageHeaderRight() {
    return api.by.id('Wallet-Page-Header-Right');
  }

  /**
   * 钱包标签头部 - Wallet Tab Header
   * resource-id: "Wallet-Tab-Header"
   */
  get walletTabHeader() {
    return api.by.id('Wallet-Tab-Header');
  }

  // ========== 标签页元素（Wallet-Tab-Header 内，支持中英文）==========

  /**
   * Portfolio/代币 标签 - Portfolio Tab
   * text: "Portfolio" / "代币"
   */
  get portfolioTab() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Portfolio" or @text="代币"]',
    );
  }

  /**
   * Spot/现货 标签 - Spot Tab（有资产第二屏/第三屏）
   * text: "Spot" / "现货"
   */
  get spotTab() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Spot" or @text="现货"]',
    );
  }

  /**
   * DeFi 标签 - DeFi Tab（有资产第三屏）
   * text: "DeFi"
   */
  get defiTab() {
    return api.by.xpath('//android.widget.TextView[@text="DeFi"]');
  }

  /**
   * NFT标签 - NFT Tab
   * text: "NFT"
   */
  get nftTab() {
    return api.by.xpath('//android.widget.TextView[@text="NFT"]');
  }

  /**
   * History/历史 标签 - History Tab
   * text: "History" / "历史" / "历史记录"
   */
  get historyTab() {
    return api.by.xpath(
      '//android.widget.TextView[@text="History" or @text="历史" or @text="历史记录"]',
    );
  }

  /**
   * Approval/授权 标签 - Approval Tab
   * text: "Approval" / "授权"
   */
  get approvalTab() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Approval" or @text="授权"]',
    );
  }

  // ========== 内容区域元素 ==========

  /**
   * View more/查看更多 按钮 - View More Button（第一屏/第三屏）
   * content-desc: "View more" / "查看更多"
   */
  get viewMoreBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="View more" or @content-desc="查看更多" or .//android.widget.TextView[@text="View more" or @text="查看更多"]]',
    );
  }

  /**
   * Show more按钮 - Show More Button
   * content-desc: "Show more" / "查看更多"
   */
  get showMoreBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Show more" or @content-desc="查看更多" or .//android.widget.TextView[@text="Show more" or @text="查看更多"]]',
    );
  }

  /**
   * Get Prime/获取 Prime 按钮 - Get Prime Button（第三屏）
   * content-desc: "Get Prime" / "获取 Prime"
   */
  get getPrimeBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Get Prime" or @content-desc="获取 Prime" or .//android.widget.TextView[@text="Get Prime" or @text="获取 Prime"]]',
    );
  }

  /**
   * Add money按钮 - Add Money Button
   * content-desc: "Add money"
   */
  get addMoneyBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Add money"]',
    );
  }

  /**
   * Add 4 tokens/添加 4 个代币 按钮 - Add 4 Tokens Button（第二屏自选区块）
   * content-desc: "Add 4 tokens" / "添加 4 个代币"
   */
  get add4TokensBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Add 4 tokens" or @content-desc="添加 4 个代币" or .//android.widget.TextView[@text="Add 4 tokens" or @text="添加 4 个代币"]]',
    );
  }

  /**
   * Add token/添加代币 按钮 - Add Token Button（第二屏代币列表底部）
   * content-desc: "Add token" / "添加代币"
   */
  get addTokenBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Add token" or @content-desc="添加代币" or .//android.widget.TextView[@text="Add token" or @text="添加代币"]]',
    );
  }

  /**
   * Join按钮 - Join Button
   * content-desc: "Join"
   */
  get joinBtn() {
    return api.by.xpath('//android.widget.Button[@content-desc="Join"]');
  }

  /**
   * Referral code输入框 - Referral Code Input
   * text: "Referral code"
   * hint: "Referral code"
   */
  get referralCodeInput() {
    return api.by.xpath(
      '//android.widget.EditText[@text="Referral code" or @hint="Referral code"]',
    );
  }

  /**
   * Earn/赚币 区块标题 - Earn Section Title（第三屏）
   * text: "Earn" / "赚币"
   */
  get earnTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Earn" or @text="赚币"]',
    );
  }

  /**
   * Upgrade/升级 区块标题 - Upgrade Section Title（第三屏）
   * text: "Upgrade" / "升级"
   */
  get upgradeTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Upgrade" or @text="升级"]',
    );
  }

  /**
   * Prime 区块标题 - Prime Section Title（第三屏）
   * text: "Prime"
   */
  get primeTitle() {
    return api.by.xpath('//android.widget.TextView[@text="Prime"]');
  }

  /**
   * Support hub/支持中心 区块标题 - Support Hub Section Title（第三屏）
   * text: "Support hub" / "支持中心"
   */
  get supportHubTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Support hub" or @text="支持中心"]',
    );
  }

  /**
   * 未找到代币？ 提示文案 - No tokens found hint（第二屏）
   * text: "No tokens found?" / "未找到代币？"
   */
  get noTokensHint() {
    return api.by.xpath(
      '//android.widget.TextView[@text="No tokens found?" or @text="未找到代币？"]',
    );
  }

  /**
   * Watchlist/自选 区块标题 - Watchlist Section Title（第二屏）
   * text: "Watchlist" / "自选"
   */
  get watchlistSectionTitle() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Watchlist" or @text="自选"]',
    );
  }

  /**
   * Contact us/联系我们 入口 - Contact Us Link（第三屏支持中心下）
   * text: "Contact us" / "联系我们"
   */
  get contactUsLink() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Contact us" or @text="联系我们"]',
    );
  }

  /**
   * Help center/帮助中心 入口 - Help Center Link（第三屏支持中心下）
   * text: "Help center" / "帮助中心"
   */
  get helpCenterLink() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Help center" or @text="帮助中心"]',
    );
  }

  /**
   * 复制地址按钮 - Copy Address Button
   * 点击后进入「账户地址」页（CopyAddressPage）
   * 布局：账户行 [账户选择器, 复制地址图标, 网络选择器]。复制按钮无 resource-id，网络选择器有 account-network-trigger-button。
   * 用「排除法」：取账户行右侧第一个「可点击且 resource-id 不包含 account-network」的兄弟，避免点到网络选择器。
   */
  get copyAddressBtn() {
    return api.by.xpath(
      '//*[contains(@resource-id,"AccountSelectorTriggerBase")]/../following-sibling::*[@clickable="true" and not(contains(@resource-id,"account-network"))][1]',
    );
  }

  /** 复制地址按钮的多种 XPath 兜底（均排除 network 按钮） */
  get _copyAddressBtnXpaths() {
    return [
      // 账户行右侧第一个可点击且非网络选择器的兄弟
      '//*[contains(@resource-id,"AccountSelectorTriggerBase")]/../following-sibling::*[@clickable="true" and not(contains(@resource-id,"account-network"))][1]',
      // 账户行右侧第一个 Button 且非网络选择器（复制按钮无 resource-id）
      '//*[contains(@resource-id,"AccountSelectorTriggerBase")]/../following-sibling::android.widget.Button[not(contains(@resource-id,"account-network"))][1]',
      // 网络选择器左侧、且不是账户行：取 preceding 里无 AccountSelectorTriggerBase 的可点击节点（即复制按钮）
      '//*[contains(@resource-id,"account-network-trigger-button")]/preceding-sibling::android.widget.Button[not(contains(@resource-id,"account-network"))][last()]',
    ];
  }

  // ========== 底部导航栏元素 ==========

  /**
   * 底部导航栏容器 - Bottom Navigation Bar Container
   * resource-id: "Mobile-AppTabBar"
   * 注意：有资产页可能无此 id，底部为 FrameLayout + content-desc（钱包/交易/合约/发现）
   */
  get bottomNavBar() {
    return api.by.id('Mobile-AppTabBar');
  }

  /**
   * Home/钱包 标签 - Home Tab
   * 无钱包: resource-id "home"；有资产: content-desc "钱包" / "Home"
   */
  get homeTab() {
    return api.by.xpath(
      '//*[contains(@resource-id,"home") or @content-desc="Home" or @content-desc="钱包"]',
    );
  }

  /**
   * Swap/交易 标签 - Swap Tab
   * 无钱包: resource-id "swap"；有资产: content-desc "交易" / "Swap"
   */
  get swapTab() {
    return api.by.xpath(
      '//*[contains(@resource-id,"swap") or @content-desc="Swap" or @content-desc="交易"]',
    );
  }

  /**
   * Perp/合约 标签 - Perp Tab
   * 无钱包: resource-id "perp"；有资产: content-desc "合约" / "Perp"
   */
  get perpTab() {
    return api.by.xpath(
      '//*[contains(@resource-id,"perp") or @content-desc="Perp" or @content-desc="合约"]',
    );
  }

  /**
   * Discovery/发现 标签 - Discovery Tab
   * 无钱包: resource-id "discovery"；有资产: content-desc "发现" / "Discovery"
   */
  get discoveryTab() {
    return api.by.xpath(
      '//*[contains(@resource-id,"discovery") or @content-desc="Discovery" or @content-desc="发现"]',
    );
  }

  // ========== 无钱包空状态元素 ==========

  /**
   * 无钱包空状态容器 - No Wallet Empty State Container
   * resource-id: "Wallet-No-Wallet-Empty"
   * bounds: [0,892][1080,1612]
   */
  get noWalletEmptyContainer() {
    return api.by.id('Wallet-No-Wallet-Empty');
  }

  /**
   * 创建钱包按钮 - Create Wallet Button
   * content-desc: "Create wallet"
   * text: "Create wallet"
   * bounds: [379,1460][701,1560]
   * 定位方式：使用xpath定位，同时支持content-desc和text以提高兼容性
   */
  get createWalletBtn() {
    return api.by.xpath(
      '//android.widget.Button[@content-desc="Create wallet" or @text="Create wallet"]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击设置按钮
   */
  async clickSettingBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.settingBtn);
      },
      async () => {
        await api.fixInterceptedClick('setting');
      },
    );
  }

  /**
   * 点击账户选择器按钮
   */
  async clickAccountSelectorBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.accountSelectorBtn);
      },
      async () => {
        await api.fixInterceptedClick('AccountSelectorTriggerBase');
      },
    );
  }

  /**
   * 点击网络选择按钮
   */
  async clickNetworkSelectorBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.networkSelectorBtn);
      },
      async () => {
        await api.fixInterceptedClick('account-network-trigger-button');
      },
    );
  }

  /**
   * 点击通知按钮
   */
  async clickNotificationBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.notificationBtn);
      },
      async () => {
        await api.fixInterceptedClick('header-right-notification');
      },
    );
  }

  /**
   * 点击更多操作按钮
   */
  async clickMoreActionsBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.moreActionsBtn);
      },
      async () => {
        await api.fixInterceptedClick('moreActions');
      },
    );
  }

  /**
   * 点击搜索框
   */
  async clickSearchInput() {
    await executeByPlatform(
      async () => {
        await api.tap(this.searchInput);
      },
      async () => {
        await api.fixInterceptedClick('nav-header-search');
      },
    );
  }

  /**
   * 在搜索框中输入文本
   * @param {string} text - 要搜索的文本
   */
  async inputSearchText(text) {
    await this.clickSearchInput();
    await api.setValue(this.searchInput, text);
  }

  /**
   * 点击创建钱包按钮
   */
  async clickCreateWalletBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.createWalletBtn);
      },
      async () => {
        // 对于Web端，使用text定位
        await api.tap(
          api.by.xpath('//button[contains(text(), "Create wallet")]'),
        );
      },
    );
  }

  /**
   * 等待无钱包空状态显示
   */
  async waitForNoWalletState() {
    await api.waitPageByElement(this.noWalletEmptyContainer);
  }

  /**
   * 验证是否处于无钱包状态
   */
  async verifyNoWalletState() {
    const isDisplayed = await this.noWalletEmptyContainer.isDisplayed();
    return isDisplayed;
  }

  // ========== 标签页操作方法 ==========

  /**
   * 点击Portfolio标签
   */
  async clickPortfolioTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.portfolioTab);
      },
      async () => {
        await api.fixInterceptedClick('Portfolio');
      },
    );
  }

  /**
   * 点击NFT标签
   */
  async clickNftTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.nftTab);
      },
      async () => {
        await api.fixInterceptedClick('NFT');
      },
    );
  }

  /**
   * 点击History标签
   */
  async clickHistoryTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.historyTab);
      },
      async () => {
        await api.fixInterceptedClick('History');
      },
    );
  }

  /**
   * 点击Approval标签
   */
  async clickApprovalTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.approvalTab);
      },
      async () => {
        await api.fixInterceptedClick('Approval');
      },
    );
  }

  /**
   * 点击 Spot/现货 标签
   */
  async clickSpotTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.spotTab);
      },
      async () => {
        await api.fixInterceptedClick('Spot');
      },
    );
  }

  /**
   * 点击 DeFi 标签
   */
  async clickDefiTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.defiTab);
      },
      async () => {
        await api.fixInterceptedClick('DeFi');
      },
    );
  }

  // ========== 内容区域操作方法 ==========

  /**
   * 点击 View more/查看更多 按钮
   */
  async clickViewMoreBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.viewMoreBtn);
      },
      async () => {
        await api.tap(
          api.by.xpath(
            '//button[contains(text(), "View more") or contains(text(), "查看更多")]',
          ),
        );
      },
    );
  }

  /**
   * 点击 Add token/添加代币 按钮（第二屏）
   */
  async clickAddTokenBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.addTokenBtn);
      },
      async () => {
        await api.tap(
          api.by.xpath(
            '//button[contains(text(), "Add token") or contains(text(), "添加代币")]',
          ),
        );
      },
    );
  }

  /**
   * 点击 联系我们 入口（第三屏支持中心）
   */
  async clickContactUsLink() {
    await executeByPlatform(
      async () => {
        await api.tap(this.contactUsLink);
      },
      async () => {
        await api.tap(
          api.by.xpath(
            '//*[contains(text(), "Contact us") or contains(text(), "联系我们")]',
          ),
        );
      },
    );
  }

  /**
   * 点击 帮助中心 入口（第三屏支持中心）
   */
  async clickHelpCenterLink() {
    await executeByPlatform(
      async () => {
        await api.tap(this.helpCenterLink);
      },
      async () => {
        await api.tap(
          api.by.xpath(
            '//*[contains(text(), "Help center") or contains(text(), "帮助中心")]',
          ),
        );
      },
    );
  }

  /**
   * 点击复制地址按钮，进入「账户地址」页（CopyAddressPage）
   * 策略：(1) 若网络选择器已显示，用其位置按比例算复制按钮坐标并点击；(2) 否则用账户选择器右侧偏移点击；(3) 再失败则用 XPath 点复制按钮。
   * @returns {Promise<CopyAddressPage>} 复制地址页实例，便于链式操作
   */
  async clickCopyAddressBtn() {
    const performTap = (x, y) =>
      browser.performActions([
        {
          type: 'pointer',
          id: 'finger1',
          parameters: { pointerType: 'touch' },
          actions: [
            { type: 'pointerMove', duration: 0, x, y },
            { type: 'pointerDown', button: 0 },
            { type: 'pause', duration: 50 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]).then(() => browser.releaseActions());

    const tapCopyByCoordinate = async () => {
      // (1) 优先用网络选择器：复制按钮在其左侧，tapX = networkLeft * (439/902)
      try {
        const networkEl = this.networkSelectorBtn;
        await networkEl.waitForDisplayed({ timeout: 8000 });
        const loc = await networkEl.getLocation();
        const size = await networkEl.getSize();
        const tapX = Math.round(loc.x * (439 / 902));
        const tapY = loc.y + Math.round(size.height / 2);
        await performTap(tapX, tapY);
        return;
      } catch {
        // 网络选择器未显示，用账户选择器
      }
      // (2) 用账户选择器：复制按钮在其右侧，参考 XML 账户右缘 381、复制中心 439 → 右偏约 58
      const accountEl = this.accountSelectorBtn;
      await accountEl.waitForDisplayed({ timeout: 10000 });
      const loc = await accountEl.getLocation();
      const size = await accountEl.getSize();
      const tapX = loc.x + size.width + 58;
      const tapY = loc.y + Math.round(size.height / 2);
      await performTap(tapX, tapY);
    };

    const tapCopyByXpath = async () => {
      for (const xpath of this._copyAddressBtnXpaths) {
        try {
          const el = api.by.xpath(xpath);
          await el.waitForDisplayed({ timeout: 3000 });
          await api.tap(el);
          return;
        } catch {
          continue;
        }
      }
      throw new Error(
        '复制地址按钮未找到（坐标与 XPath 均已尝试）。请确认当前在首页且账户行可见。',
      );
    };

    const run = async () => {
      try {
        await tapCopyByCoordinate();
      } catch {
        await tapCopyByXpath();
      }
    };
    await executeByPlatform(run, run);
    return new CopyAddressPage();
  }

  /**
   * 点击Show more按钮
   */
  async clickShowMoreBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.showMoreBtn);
      },
      async () => {
        await api.tap(
          api.by.xpath('//button[contains(text(), "Show more")]'),
        );
      },
    );
  }

  /**
   * 点击Get Prime按钮
   */
  async clickGetPrimeBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.getPrimeBtn);
      },
      async () => {
        await api.tap(
          api.by.xpath('//button[contains(text(), "Get Prime")]'),
        );
      },
    );
  }

  /**
   * 点击Add money按钮
   */
  async clickAddMoneyBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.addMoneyBtn);
      },
      async () => {
        await api.tap(
          api.by.xpath('//button[contains(text(), "Add money")]'),
        );
      },
    );
  }

  /**
   * 点击 Add 4 tokens/添加 4 个代币 按钮
   */
  async clickAdd4TokensBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.add4TokensBtn);
      },
      async () => {
        await api.tap(
          api.by.xpath(
            '//button[contains(text(), "Add 4 tokens") or contains(text(), "添加 4 个代币")]',
          ),
        );
      },
    );
  }

  /**
   * 点击Join按钮
   */
  async clickJoinBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.joinBtn);
      },
      async () => {
        await api.tap(api.by.xpath('//button[contains(text(), "Join")]'));
      },
    );
  }

  /**
   * 在Referral code输入框中输入文本
   * @param {string} code - 推荐码
   */
  async inputReferralCode(code) {
    await executeByPlatform(
      async () => {
        await api.tap(this.referralCodeInput);
        await api.setValue(this.referralCodeInput, code);
      },
      async () => {
        const input = api.by.xpath(
          '//input[@placeholder="Referral code" or @name="Referral code"]',
        );
        await api.tap(input);
        await api.setValue(input, code);
      },
    );
  }

  // ========== 底部导航栏操作方法 ==========

  /**
   * 点击Home标签
   */
  async clickHomeTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.homeTab);
      },
      async () => {
        await api.fixInterceptedClick('home');
      },
    );
  }

  /**
   * 点击Swap标签
   */
  async clickSwapTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.swapTab);
      },
      async () => {
        await api.fixInterceptedClick('swap');
      },
    );
  }

  /**
   * 点击Perp标签
   */
  async clickPerpTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.perpTab);
      },
      async () => {
        await api.fixInterceptedClick('perp');
      },
    );
  }

  /**
   * 点击Discovery标签
   */
  async clickDiscoveryTab() {
    await executeByPlatform(
      async () => {
        await api.tap(this.discoveryTab);
      },
      async () => {
        await api.fixInterceptedClick('discovery');
      },
    );
  }

  // ========== 验证方法 ==========

  /**
   * 等待底部导航栏显示
   */
  async waitForBottomNavBar() {
    await api.waitPageByElement(this.bottomNavBar);
  }

  /**
   * 验证底部导航栏是否显示
   */
  async verifyBottomNavBarDisplayed() {
    const isDisplayed = await this.bottomNavBar.isDisplayed();
    return isDisplayed;
  }

  /**
   * 等待Earn标题显示
   */
  async waitForEarnTitle() {
    await api.waitPageByElement(this.earnTitle);
  }

  /**
   * 等待Upgrade标题显示
   */
  async waitForUpgradeTitle() {
    await api.waitPageByElement(this.upgradeTitle);
  }

  /**
   * 等待Support hub标题显示
   */
  async waitForSupportHubTitle() {
    await api.waitPageByElement(this.supportHubTitle);
  }

  /**
   * 等待自选/Watchlist 区块标题显示（第二屏）
   */
  async waitForWatchlistSection() {
    await api.waitPageByElement(this.watchlistSectionTitle);
  }

  /**
   * 等待「未找到代币？」提示显示（第二屏）
   */
  async waitForNoTokensHint() {
    await api.waitPageByElement(this.noTokensHint);
  }
}

export const homePage = new HomePage();
