import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { executeByPlatform } from '../../util/index.js';

/**
 * 底部导航栏 - 全局通用 TabBar（除个别页面外均存在）
 * 从层级开始：//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[3]
 * 底部导航栏 (Mobile-AppTabBar) 与该层级同属布局，为兄弟节点，resource-id: "Mobile-AppTabBar"
 * 参考：xmls/homePage/homepageNowalletEnglish.xml
 */
class BottomNavBarPage extends Page {
  // ========== 底部导航栏 (Bottom Navigation Bar) ==========

  /**
   * 底部导航栏容器 - TabBar 整体容器
   * resource-id: "Mobile-AppTabBar"
   * bounds: [0,2194][1080,2337]
   * 定位方式：使用 resource-id 定位
   */
  get bottomNavBar() {
    return api.by.id('Mobile-AppTabBar');
  }

  /**
   * Wallet 标签 - 钱包 Tab
   * resource-id: "home"
   * text: "Wallet"
   * bounds: [0,2195][270,2337]
   */
  get homeBtn() {
    return api.by.id('home');
  }

  /**
   * Trade 标签 - 交易 Tab
   * resource-id: "swap"
   * text: "Trade"
   * bounds: [270,2195][540,2337]
   */
  get swapBtn() {
    return api.by.id('swap');
  }

  /**
   * Perps 标签 - 合约 Tab
   * resource-id: "perp"
   * text: "Perps"
   * bounds: [540,2195][810,2337]
   */
  get perpBtn() {
    return api.by.id('perp');
  }

  /**
   * Discover 标签 - 发现 Tab
   * resource-id: "discovery"
   * text: "Discover"
   * bounds: [810,2195][1080,2337]
   */
  get discoveryBtn() {
    return api.by.id('discovery');
  }

  async clickHomeBtn() {
    await executeByPlatform(
      async () => await api.tap(this.homeBtn),
      async () => await api.fixInterceptedClick('home'),
    );
  }

  async clickSwapBtn() {
    await executeByPlatform(
      async () => await api.tap(this.swapBtn),
      async () => await api.fixInterceptedClick('swap'),
    );
  }

  async clickPerpBtn() {
    await executeByPlatform(
      async () => await api.tap(this.perpBtn),
      async () => await api.fixInterceptedClick('perp'),
    );
  }

  async clickDiscoveryBtn() {
    await executeByPlatform(
      async () => await api.tap(this.discoveryBtn),
      async () => await api.fixInterceptedClick('discovery'),
    );
  }
}

export const bottomNavBarPage = new BottomNavBarPage();
