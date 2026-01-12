import { defineConfig, devices } from '@playwright/test';

/**
 * QA Skill Playwright 配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // 测试目录
  testDir: './tests',
  
  // 串行执行（避免连接被关闭）
  fullyParallel: false,
  
  // CI 环境禁止 test.only
  forbidOnly: !!process.env.CI,
  
  // 失败重试次数
  retries: 2,
  
  // 使用单个 worker 避免连接问题
  workers: 1,
  
  // 报告器配置 - 使用自定义中文报告器
  reporter: [
    ['./reporters/chinese-reporter.js'],
    ['html', { 
      outputFolder: 'playwright-report',
      open: 'never'
    }],
  ],
  
  // 全局配置
  use: {
    // 基础 URL
    baseURL: 'https://app.onekey.so',
    
    // 追踪配置（失败时保留）
    trace: 'on-first-retry',
    
    // 截图配置
    screenshot: 'only-on-failure',
    
    // 视频录制
    video: 'on-first-retry',
    
    // 默认超时
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 全局超时
  timeout: 60000,
  
  // 期望超时
  expect: {
    timeout: 10000
  },

  // 浏览器项目配置
  projects: [
    {
      name: 'Chrome 桌面版',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // 添加更真实的用户代理
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        // 禁用自动化检测
        launchOptions: {
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--no-sandbox'
          ]
        }
      },
    },
  ],
});
