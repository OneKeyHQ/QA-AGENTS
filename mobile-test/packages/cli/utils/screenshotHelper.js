import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * 截图助手类
 * 用于管理测试过程中的截图保存
 */
class ScreenshotHelper {
  constructor() {
    this.resultDir = null;
    this.beforeScreenshot = null;
    this.enabled = false;
  }

  /**
   * 初始化截图目录
   * 创建以北京时间（精确到秒）命名的文件夹
   */
  initResultDir() {
    if (this.resultDir) {
      return this.resultDir;
    }

    // 获取北京时间（UTC+8）
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    
    // 格式化：YYYYMMDD_HHmmss
    const year = beijingTime.getUTCFullYear();
    const month = String(beijingTime.getUTCMonth() + 1).padStart(2, '0');
    const day = String(beijingTime.getUTCDate()).padStart(2, '0');
    const hours = String(beijingTime.getUTCHours()).padStart(2, '0');
    const minutes = String(beijingTime.getUTCMinutes()).padStart(2, '0');
    const seconds = String(beijingTime.getUTCSeconds()).padStart(2, '0');
    
    const timestamp = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    // 创建 Result_imgs 目录
    const baseDir = path.join(process.cwd(), 'Result_imgs');
    this.resultDir = path.join(baseDir, timestamp);
    
    // 确保目录存在
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.resultDir)) {
      fs.mkdirSync(this.resultDir, { recursive: true });
    }
    
    return this.resultDir;
  }

  /**
   * 启用截图功能
   */
  enable() {
    this.enabled = true;
    this.initResultDir();
  }

  /**
   * 禁用截图功能
   */
  disable() {
    this.enabled = false;
  }

  /**
   * 计算图片的哈希值（用于比较）
   */
  async getImageHash(imageBase64) {
    const buffer = Buffer.from(imageBase64, 'base64');
    return crypto.createHash('md5').update(buffer).digest('hex');
  }

  /**
   * 保存截图
   * @param {string} imageBase64 - base64格式的截图数据
   * @param {string} filename - 文件名（不含扩展名）
   * @returns {string} 保存的文件路径
   */
  async saveScreenshot(imageBase64, filename) {
    if (!this.enabled || !this.resultDir) {
      return null;
    }

    try {
      const filePath = path.join(this.resultDir, `${filename}.png`);
      const buffer = Buffer.from(imageBase64, 'base64');
      fs.writeFileSync(filePath, buffer);
      return filePath;
    } catch (error) {
      console.error(`Failed to save screenshot ${filename}:`, error);
      return null;
    }
  }

  /**
   * 获取当前页面截图
   */
  async takeScreenshot() {
    try {
      return await browser.takeScreenshot();
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return null;
    }
  }

  /**
   * 检测页面是否有变化
   * @param {string} beforeBase64 - 之前的截图（base64）
   * @param {string} afterBase64 - 之后的截图（base64）
   * @returns {boolean} 是否有变化
   */
  async hasPageChanged(beforeBase64, afterBase64) {
    if (!beforeBase64 || !afterBase64) {
      return true; // 如果没有之前的截图，认为有变化
    }

    try {
      const beforeHash = await this.getImageHash(beforeBase64);
      const afterHash = await this.getImageHash(afterBase64);
      return beforeHash !== afterHash;
    } catch (error) {
      console.error('Failed to compare screenshots:', error);
      return true; // 出错时认为有变化，保存截图
    }
  }

  /**
   * 在方法执行前记录页面状态
   */
  async recordBefore(methodName) {
    if (!this.enabled) {
      return;
    }
    
    // 等待页面稳定后再截图（执行前通常页面已经稳定，所以等待时间可以短一些）
    await new Promise(resolve => setTimeout(resolve, 200));
    this.beforeScreenshot = await this.takeScreenshot();
  }

  /**
   * 等待页面渲染完成（通过连续截图比较判断页面是否稳定）
   * @param {number} maxWaitTime - 最大等待时间（毫秒），默认3000ms
   * @param {number} stabilityCheckInterval - 稳定性检查间隔（毫秒），默认200ms
   * @returns {Promise<string>} 稳定的截图（base64）
   */
  async waitForPageStable(maxWaitTime = 3000, stabilityCheckInterval = 200) {
    const startTime = Date.now();
    let lastScreenshot = null;
    let stableCount = 0;
    const requiredStableChecks = 2; // 需要连续2次截图相同才认为稳定

    while (Date.now() - startTime < maxWaitTime) {
      const currentScreenshot = await this.takeScreenshot();
      
      if (!currentScreenshot) {
        await new Promise(resolve => setTimeout(resolve, stabilityCheckInterval));
        continue;
      }

      if (lastScreenshot) {
        const changed = await this.hasPageChanged(lastScreenshot, currentScreenshot);
        if (!changed) {
          stableCount++;
          // 如果连续多次截图相同，认为页面已稳定
          if (stableCount >= requiredStableChecks) {
            return currentScreenshot;
          }
        } else {
          stableCount = 0; // 页面还在变化，重置计数
        }
      }
      
      lastScreenshot = currentScreenshot;
      await new Promise(resolve => setTimeout(resolve, stabilityCheckInterval));
    }

    // 超时后返回最后一次截图
    return lastScreenshot || await this.takeScreenshot();
  }

  /**
   * 在方法执行后检测页面变化并保存截图
   * 仅在实际发生页面切换时保存（即仅对 waitEntryPage 保存），避免每个步骤都截图
   * @param {string} methodName - 方法名，格式如 "addExistingWalletPage.clickWatchAddressCard"
   * @returns {Promise<string|null>} 保存的截图路径，如果没有变化或保存失败则返回null
   */
  async recordAfter(methodName) {
    if (!this.enabled) {
      return null;
    }

    // 仅在页面切换后截图：只有 waitEntryPage 表示已进入新页面，此时才保存
    if (!methodName.endsWith('.waitEntryPage')) {
      return null;
    }

    // 等待页面渲染完成（通过连续截图比较判断页面是否稳定）
    const afterScreenshot = await this.waitForPageStable();
    
    if (!afterScreenshot) {
      return null;
    }

    // 检测页面是否有变化
    const changed = await this.hasPageChanged(this.beforeScreenshot, afterScreenshot);
    
    if (changed) {
      const filePath = await this.saveScreenshot(afterScreenshot, methodName);
      if (filePath) {
        console.log(`Screenshot saved: ${filePath}`);
      }
      // 更新 beforeScreenshot 为当前截图，用于下一次比较
      this.beforeScreenshot = afterScreenshot;
      return filePath;
    }
    
    return null;
  }

  /**
   * 重置状态（用于新的测试用例）
   */
  reset() {
    this.beforeScreenshot = null;
  }
}

// 导出单例
export default new ScreenshotHelper();
