/**
 * Playwright E2E 测试脚本模板
 * 
 * 使用方式：
 * 1. 复制此模板
 * 2. 替换 {{变量}} 占位符
 * 3. 根据实际场景调整选择器和断言
 * 
 * 占位符说明：
 * - {{MODULE}}: 模块名称（如 Market）
 * - {{FEATURE}}: 功能名称（如 Token收藏）
 * - {{SOURCE_FILE}}: 来源文件路径
 * - {{EXECUTION_MODE}}: 执行模式（P0 核心场景 / 完整模式）
 * - {{GENERATE_TIME}}: 生成时间
 * - {{BASE_URL}}: 基础 URL
 * - {{MODULE_URL}}: 模块 URL
 * - {{SELECTORS}}: 选择器定义
 * - {{TEST_SUITES}}: 测试套件
 */

import { test, expect, Page } from '@playwright/test';

/**
 * {{MODULE}} - {{FEATURE}} 自动化测试
 * 
 * 基于 Checklist: {{SOURCE_FILE}}
 * 执行模式: {{EXECUTION_MODE}}
 * 生成时间: {{GENERATE_TIME}}
 */

// ============================================================================
// 测试配置
// ============================================================================

const CONFIG = {
  baseUrl: '{{BASE_URL}}',
  moduleUrl: '{{MODULE_URL}}',
  timeout: {
    navigation: 30000,
    action: 10000,
    assertion: 10000
  }
};

// ============================================================================
// 页面元素选择器（支持中英文）
// ============================================================================

const SELECTORS = {
  // 示例选择器结构 - 根据实际页面调整
  tabs: {
    // 标签页选择器
    // example: 'text=/TabName|标签名/',
  },
  buttons: {
    // 按钮选择器
    // example: '[data-testid="btn-name"], button.class-name',
  },
  inputs: {
    // 输入框选择器
    // example: 'input[placeholder*="Search"], input[placeholder*="搜索"]',
  },
  lists: {
    // 列表选择器
    // example: '[data-testid="list-item"], .list-item',
  }
};

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 导航到指定页面（带重试机制）
 */
async function navigateToModule(page: Page, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // 添加随机延迟避免速率限制
      await page.waitForTimeout(Math.random() * 1000 + 500);
      
      await page.goto(CONFIG.baseUrl + CONFIG.moduleUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.timeout.navigation 
      });
      
      // 等待关键元素出现 - 根据实际页面调整
      // await page.waitForSelector(SELECTORS.xxx, { timeout: CONFIG.timeout.navigation });
      
      return; // 成功则返回
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`⚠️ 页面加载失败，正在重试 (${i + 1}/${retries})...`);
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * 等待元素可见并点击
 */
async function clickElement(page: Page, selector: string, options?: { force?: boolean }) {
  await page.waitForSelector(selector, { timeout: CONFIG.timeout.action });
  await page.locator(selector).first().click({ force: options?.force });
}

/**
 * 安全地输入文本
 */
async function typeText(page: Page, selector: string, text: string, delay = 100) {
  const element = page.locator(selector).first();
  await element.click({ force: true });
  await page.waitForTimeout(300);
  await page.keyboard.type(text, { delay });
}

// ============================================================================
// 测试套件
// ============================================================================

test.describe('{{MODULE}} - {{FEATURE}}', () => {
  
  // 设置超时时间
  test.setTimeout(90000);

  // -------------------------------------------------------------------------
  // 场景 1: [场景名称] [P0]
  // -------------------------------------------------------------------------
  test.describe('场景1: [场景名称] [P0]', () => {
    
    test('1(a) [测试名称]', async ({ page }) => {
      await navigateToModule(page);
      
      // TODO: 添加测试步骤
      // 1. 执行操作
      // 2. 验证结果
      
      // 示例断言
      // await expect(page.locator('selector')).toBeVisible();
    });

    test('1(b) [测试名称]', async ({ page }) => {
      await navigateToModule(page);
      
      // TODO: 添加测试步骤
    });
  });

  // -------------------------------------------------------------------------
  // 场景 2: [场景名称] [P0]
  // -------------------------------------------------------------------------
  test.describe('场景2: [场景名称] [P0]', () => {
    
    test('2(a) [测试名称]', async ({ page }) => {
      await navigateToModule(page);
      
      // TODO: 添加测试步骤
    });
  });

  // 更多场景...
});

// ============================================================================
// 性能测试
// ============================================================================

test.describe('性能测试', () => {
  
  test('页面加载性能检测', async ({ page }) => {
    test.setTimeout(60000);
    
    const startTime = Date.now();
    
    await page.goto(CONFIG.baseUrl + CONFIG.moduleUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 等待关键元素出现
    // await page.waitForSelector(SELECTORS.xxx, { timeout: 30000 });
    
    const loadTime = Date.now() - startTime;
    
    // 采集性能数据
    const metrics = await page.evaluate(() => {
      const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      const nav = entries[0];
      
      return {
        domComplete: nav?.domComplete || 0,
        loadEventEnd: nav?.loadEventEnd || 0,
        domInteractive: nav?.domInteractive || 0
      };
    });
    
    console.log(`\n📊 性能指标:`);
    console.log(`   ├─ 页面可交互时间: ${loadTime}ms`);
    console.log(`   ├─ DOM 可交互: ${Math.round(metrics.domInteractive)}ms`);
    console.log(`   └─ DOM 完成: ${Math.round(metrics.domComplete)}ms`);
    
    // 断言：页面可交互时间应小于 15 秒
    expect(loadTime).toBeLessThan(15000);
  });
});
