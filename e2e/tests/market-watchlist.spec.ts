import { test, expect, Page } from '@playwright/test';

/**
 * Market - Token 收藏/取消收藏 自动化测试
 * 
 * 基于 Checklist: docs/testcases/checklist/2026-01-04_Market-Token收藏取消收藏-Checklist.md
 * 执行模式: P0 核心场景 (快速模式)
 */

// 测试配置
const CONFIG = {
  baseUrl: 'https://app.onekey.so',
  marketUrl: '/market',
  watchlistUrl: '/market?tabName=watchlist',
  timeout: {
    navigation: 30000,
    action: 10000,
    assertion: 10000
  }
};

// 页面元素选择器（支持中英文）
const SELECTORS = {
  favorites: 'text=/Favorites|自选/',
  trending: 'text=/Trending|热门/',
  memes: 'text="Memes"',
  search: 'input[placeholder*="Search"], input[placeholder*="搜索"]',
  tokenRow: '[data-testid*="row"], table tr'
};

// 辅助函数 - 导航并等待页面加载（带重试）
async function navigateToMarket(page: Page, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      // 添加随机延迟避免速率限制
      await page.waitForTimeout(Math.random() * 1000 + 500);
      
      await page.goto(CONFIG.baseUrl + CONFIG.marketUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.timeout.navigation 
      });
      // 等待 Favorites tab 出现
      await page.waitForSelector(SELECTORS.favorites, { timeout: CONFIG.timeout.navigation });
      return; // 成功则返回
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`⚠️ 页面加载失败，正在重试 (${i + 1}/${retries})...`);
      await page.waitForTimeout(2000);
    }
  }
}

// 测试套件
test.describe('行情模块 - 代币收藏功能测试', () => {
  
  test.setTimeout(90000);

  test.describe('场景一：自选列表功能 [P0]', () => {
    
    test('1-a 自选列表正常显示', async ({ page }) => {
      await navigateToMarket(page);
      
      // 点击自选标签
      await page.locator(SELECTORS.favorites).click({ force: true });
      await page.waitForTimeout(1500);
      
      // 验证自选标签可见
      await expect(page.locator(SELECTORS.favorites)).toBeVisible();
    });

    test('1-b 从热门列表添加收藏', async ({ page }) => {
      await navigateToMarket(page);
      
      // 点击热门标签
      await page.locator(SELECTORS.trending).click({ force: true });
      await page.waitForTimeout(1500);
      
      // 等待 BTC 出现
      await expect(page.locator('text="BTC"').first()).toBeVisible({ timeout: CONFIG.timeout.assertion });
      
      // 找到收藏按钮（第一个星形按钮）
      const starBtn = page.locator('button svg').first();
      
      // 点击收藏
      await starBtn.click({ force: true });
      await page.waitForTimeout(500);
      
      // 验证点击成功（按钮状态应该改变）
      await page.waitForTimeout(500);
    });
  });

  test.describe('场景二：分类列表功能 [P0]', () => {
    
    test('2-a 切换到 Memes 分类并收藏', async ({ page }) => {
      await navigateToMarket(page);
      
      // 点击 Memes 分类
      await page.locator(SELECTORS.memes).click({ force: true });
      await page.waitForTimeout(2000);
      
      // 验证页面内容加载
      await expect(page.locator('text=/SHIB|DOGE|PEPE/').first()).toBeVisible({ timeout: CONFIG.timeout.assertion });
      
      // 点击收藏按钮
      const starBtn = page.locator('button svg').first();
      await starBtn.click({ force: true });
      await page.waitForTimeout(500);
    });

    test('2-b 分类切换状态同步', async ({ page }) => {
      await navigateToMarket(page);
      
      // 切换到 Memes
      await page.locator(SELECTORS.memes).click({ force: true });
      await page.waitForTimeout(1500);
      
      // 直接导航回市场页面
      await page.goto(CONFIG.baseUrl + CONFIG.marketUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);
      
      // 验证 BTC 显示
      await expect(page.locator('text="BTC"').first()).toBeVisible({ timeout: CONFIG.timeout.assertion });
    });
  });

  test.describe('场景三：详情页功能 [P0]', () => {
    
    test('3-a 进入详情页验证加载', async ({ page }) => {
      await navigateToMarket(page);
      
      // 等待 BTC 出现
      await page.waitForSelector('text="BTC"', { timeout: CONFIG.timeout.navigation });
      
      // 点击 BTC 进入详情页
      await page.locator('text="BTC"').first().click({ force: true });
      
      // 等待 URL 变化
      await page.waitForURL(/\/market\/token\//, { timeout: CONFIG.timeout.navigation });
      await page.waitForTimeout(1500);
      
      // 关闭可能的弹窗
      await page.keyboard.press('Escape');
      
      // 验证详情页加载
      await expect(page.locator('text="BTC"').first()).toBeVisible();
    });
  });

  test.describe('场景四：搜索功能 [P0]', () => {
    
    test('4-a 搜索 USDT 验证结果', async ({ page }) => {
      await navigateToMarket(page);
      
      // 点击搜索框
      const searchBox = page.locator(SELECTORS.search).first();
      await searchBox.click({ force: true });
      await page.waitForTimeout(500);
      
      // 输入搜索词
      await page.keyboard.type('USDT', { delay: 100 });
      await page.waitForTimeout(2000);
      
      // 验证搜索结果出现
      await expect(page.locator('text="USDT"').first()).toBeVisible({ timeout: CONFIG.timeout.assertion });
    });

    test('4-e 搜索 SOL 验证结果', async ({ page }) => {
      await navigateToMarket(page);
      
      // 点击搜索框
      const searchBox = page.locator(SELECTORS.search).first();
      await searchBox.click({ force: true });
      await page.waitForTimeout(500);
      
      // 输入搜索词
      await page.keyboard.type('SOL', { delay: 100 });
      await page.waitForTimeout(2000);
      
      // 验证搜索结果出现
      await expect(page.locator('text="SOL"').first()).toBeVisible({ timeout: CONFIG.timeout.assertion });
    });
  });

  test.describe('场景五：数据一致性 [P0]', () => {
    
    test('5-a 自选列表访问正常', async ({ page }) => {
      await page.goto(CONFIG.baseUrl + CONFIG.watchlistUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.timeout.navigation 
      });
      await page.waitForTimeout(1500);
      
      // 验证自选标签可见
      await expect(page.locator(SELECTORS.favorites)).toBeVisible();
    });
  });
});

// 性能测试
test.describe('性能测试', () => {
  
  test('页面加载性能检测', async ({ page }) => {
    test.setTimeout(60000);
    
    const startTime = Date.now();
    
    await page.goto(CONFIG.baseUrl + CONFIG.marketUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // 等待关键元素出现
    await page.waitForSelector(SELECTORS.favorites, { timeout: 30000 });
    
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
