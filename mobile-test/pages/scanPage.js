/**
 * 扫描二维码页 - Scan QR Code Page
 * 对应 xml: xmls/settings/scanEnglish.xml
 */
import { api } from '@node-e2e/cli/api/index.js';
import Page from './base.js';
import { executeByPlatform } from '../util/index.js';

class ScanPage extends Page {
  get keyElement() {
    return this.scanQrCodeTitle;
  }

  // ========== 顶部导航栏元素 ==========

  /**
   * 关闭按钮 - Close Button
   * resource-id: "nav-header-close"
   */
  get closeBtn() {
    return api.by.id('nav-header-close');
  }

  /**
   * 扫描二维码标题 - Scan QR code Title
   * text: "Scan QR code"
   */
  get scanQrCodeTitle() {
    return api.by.xpath('//android.view.View[@text="Scan QR code"]');
  }

  /**
   * 打开相册按钮 - Open Photo Button
   * resource-id: "scan-open-photo"
   */
  get photoBtn() {
    return api.by.id('scan-open-photo');
  }

  // ========== 扫描区域 ==========

  /**
   * 扫描视图 - Scan View
   * SurfaceView for camera preview
   */
  get scanView() {
    return api.by.xpath('//android.view.SurfaceView');
  }

  // ========== 提示文本 ==========

  /**
   * 扫描地址码提示 - Scan address codes hint
   * text: "Scan address codes to copy address"
   */
  get scanAddressCodesHint() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Scan address codes to copy address"]',
    );
  }

  /**
   * 扫描WalletConnect码提示 - Scan WalletConnect code hint
   * text: "Scan WalletConnect code to connect to sites"
   */
  get scanWalletConnectHint() {
    return api.by.xpath(
      '//android.widget.TextView[@text="Scan WalletConnect code to connect to sites"]',
    );
  }

  // ========== 相册选择相关 ==========

  /**
   * 第一张图片 - First Image
   * 用于从相册选择图片
   */
  get firstImage() {
    return api.by.xpath(
      '(//android.widget.ImageView[@resource-id="com.android.providers.media.module:id/icon_thumbnail"])[1]',
    );
  }

  // ========== 操作方法 ==========

  /**
   * 点击关闭按钮
   */
  async clickCloseBtn() {
    await executeByPlatform(
      async () => {
        await api.tap(this.closeBtn);
      },
      async () => {
        await api.fixInterceptedClick('nav-header-close');
      },
    );
  }

  /**
   * 点击打开相册按钮
   */
  async clickOpenPhoto() {
    await executeByPlatform(
      async () => {
        await api.tap(this.photoBtn);
      },
      async () => {
        await api.fixInterceptedClick('scan-open-photo');
      },
    );
  }

  /**
   * 选择第一张图片
   */
  async selectFirstImage() {
    await api.tap(this.firstImage);
  }

  // ========== 验证方法 ==========

  /**
   * 等待扫描页显示
   */
  async waitForScanPage() {
    await api.waitPageByElement(this.scanQrCodeTitle);
  }

  /**
   * 验证扫描页是否显示
   */
  async verifyScanPageDisplayed() {
    const isDisplayed = await this.scanQrCodeTitle.isDisplayed();
    return isDisplayed;
  }
}

export const scanPage = new ScanPage();
