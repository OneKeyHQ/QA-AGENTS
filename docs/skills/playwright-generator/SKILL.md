# Playwright E2E 脚本生成器

> 🎭 基于 Checklist 或测试用例文件，自动生成可在 Playwright 中执行的 E2E 测试脚本

---

## 📋 功能概述

本 Skill 提供以下能力：
- 读取 Checklist 或测试用例文件
- 解析测试场景和步骤
- 生成符合项目规范的 Playwright 测试脚本
- 自动落盘到 `e2e/tests/` 目录

---

## 🎯 指令列表

| 指令 | 说明 | 示例 |
|------|------|------|
| `e2e <文件>` | 基于文件生成 Playwright 脚本 | `e2e docs/testcases/checklist/xxx.md` |
| `@<checklist> e2e` | 基于 Checklist 生成脚本 | `@docs/testcases/checklist/xxx.md e2e` |
| `@<用例文件> e2e` | 基于用例文件生成脚本 | `@docs/testcases/cases/xxx.md e2e` |

---

## 📖 详细指令说明

### `e2e <文件>` - 生成 Playwright 脚本

**用途**：基于 Checklist 或测试用例文件生成可执行的 Playwright 测试脚本

**参数**：
- `<文件>`: Checklist 文件路径或测试用例文件路径

**支持的输入文件类型**：
1. **Checklist 文件**（推荐）：`docs/testcases/checklist/*.md`
2. **测试用例文件**：`docs/testcases/cases/*.md`

**操作步骤**：
1. 读取并解析输入文件
2. 提取测试场景和步骤
3. 根据优先级筛选场景（默认 P0，可指定 P0+P1+P2）
4. 生成 Playwright 测试脚本
5. 自动落盘到 `e2e/tests/` 目录

**输出文件**：
```
e2e/tests/{模块名}-{功能名}.spec.ts
```

---

## 🔧 代码生成规则

### 1. 文件结构

生成的脚本必须包含以下部分：

```typescript
import { test, expect, Page } from '@playwright/test';

/**
 * {模块} - {功能} 自动化测试
 * 
 * 基于 Checklist: {来源文件路径}
 * 执行模式: {P0 核心场景 / 完整模式}
 * 生成时间: {YYYY-MM-DD HH:mm}
 */

// 1. 测试配置
const CONFIG = {
  baseUrl: 'https://app.onekey.so',
  // 模块相关 URL
  timeout: {
    navigation: 30000,
    action: 10000,
    assertion: 10000
  }
};

// 2. 页面元素选择器（支持中英文）
const SELECTORS = {
  // 按功能分组的选择器
};

// 3. 辅助函数
async function navigateTo...(page: Page, retries = 3) {
  // 带重试的导航函数
}

// 4. 测试套件
test.describe('{模块} - {功能}', () => {
  test.setTimeout(90000);
  
  test.describe('场景X: {场景名称} [P0]', () => {
    test('{编号} {测试名称}', async ({ page }) => {
      // 测试步骤
    });
  });
});

// 5. 性能测试（可选）
test.describe('性能测试', () => {
  test('页面加载性能', async ({ page }) => {
    // 性能采集
  });
});
```

### 2. 选择器策略

按优先级使用以下选择器策略：

| 优先级 | 策略 | 示例 | 说明 |
|--------|------|------|------|
| 1 | data-testid | `[data-testid="favorite-btn"]` | 最稳定，优先使用 |
| 2 | 语义化选择器 | `getByRole('button', { name: '收藏' })` | Playwright 推荐 |
| 3 | 文本匹配（中英文） | `text=/Favorites\|自选/` | 支持多语言 |
| 4 | 组合选择器 | `button svg`, `.class input` | 结构相对稳定时 |
| 5 | CSS 选择器 | `[placeholder*="Search"]` | 兜底方案 |

**选择器定义规范**：
```typescript
const SELECTORS = {
  // 导航元素
  tabs: {
    favorites: 'text=/Favorites|自选/',
    trending: 'text=/Trending|热门/',
  },
  // 功能元素
  buttons: {
    favorite: '[data-testid="favorite-btn"], button svg',
    submit: 'button[type="submit"]',
  },
  // 输入元素
  inputs: {
    search: 'input[placeholder*="Search"], input[placeholder*="搜索"]',
  }
};
```

### 3. 断言模式

| 场景 | 断言方法 | 示例 |
|------|----------|------|
| 元素可见 | `toBeVisible()` | `await expect(locator).toBeVisible()` |
| 文本内容 | `toContainText()` | `await expect(locator).toContainText('成功')` |
| URL 变化 | `waitForURL()` | `await page.waitForURL(/\/detail\//)` |
| 元素状态 | `toHaveClass()` | `await expect(locator).toHaveClass(/active/)` |
| 数量验证 | `toHaveCount()` | `await expect(locator).toHaveCount(5)` |

### 4. 超时配置

```typescript
const TIMEOUTS = {
  navigation: 30000,  // 页面导航
  action: 10000,      // 点击、输入等操作
  assertion: 10000,   // 断言等待
  animation: 500,     // 动画等待
};
```

### 5. 重试机制

```typescript
async function navigateWithRetry(page: Page, url: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await page.waitForTimeout(Math.random() * 1000 + 500); // 随机延迟
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.timeout.navigation 
      });
      return;
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`导航失败，重试 ${i + 1}/${retries}...`);
      await page.waitForTimeout(2000);
    }
  }
}
```

---

## 📁 输出规范

### 文件命名

```
e2e/tests/{模块名}-{功能名}.spec.ts
```

**示例**：
- `market-watchlist.spec.ts` - 行情模块自选列表
- `perps-limit-order.spec.ts` - 合约模块限价单
- `wallet-transfer.spec.ts` - 钱包模块转账

### 目录结构

```
e2e/
├── playwright.config.ts     # Playwright 配置（已存在）
├── reporters/
│   └── chinese-reporter.ts  # 中文报告器（已存在）
└── tests/
    ├── market-watchlist.spec.ts     # 生成的测试脚本
    ├── perps-limit-order.spec.ts
    └── ...
```

---

## 🚀 使用示例

### 示例 1：基于 Checklist 生成脚本

```
用户: @docs/testcases/checklist/2026-01-04_Market-Token收藏取消收藏-Checklist.md e2e

AI: 正在基于 Checklist 生成 Playwright 脚本...

✅ 已生成测试脚本：
- e2e/tests/market-watchlist.spec.ts

包含场景：
- 场景1: 观察列表收藏/取消收藏测试 [P0] (2 个用例)
- 场景2: 分类列表收藏/取消收藏测试 [P0] (2 个用例)
- 场景3: Token 详情页收藏测试 [P0] (1 个用例)
- 场景4: 搜索列表收藏测试 [P0] (2 个用例)
- 场景5: 数据一致性测试 [P0] (1 个用例)
- 性能测试 (1 个用例)

运行命令：
cd e2e && npx playwright test market-watchlist.spec.ts
```

### 示例 2：基于用例文件生成脚本

```
用户: e2e docs/testcases/cases/2026-01-04_Market-Token收藏取消收藏.md

AI: 正在基于用例文件生成 Playwright 脚本...

✅ 已生成测试脚本：
- e2e/tests/market-token-favorite.spec.ts
```

### 示例 3：生成完整模式脚本

```
用户: @docs/testcases/checklist/xxx.md e2e --full

AI: 正在生成完整模式脚本（包含 P0/P1/P2 所有场景）...
```

---

## ⚙️ 配置项

### 默认配置

```json
{
  "baseUrl": "https://app.onekey.so",
  "defaultTimeout": {
    "navigation": 30000,
    "action": 10000,
    "assertion": 10000
  },
  "retries": 3,
  "priorityFilter": ["P0"],
  "includePerformanceTest": true
}
```

### 可选参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--full` | 生成完整模式（包含 P0/P1/P2） | false |
| `--no-perf` | 不生成性能测试 | false |
| `--output <path>` | 指定输出路径 | e2e/tests/ |

---

## 📚 与现有配置集成

生成的脚本自动兼容现有的 `e2e/playwright.config.ts` 配置：

- 使用相同的浏览器配置
- 使用中文报告器
- 遵循重试和超时设置
- 支持失败截图和视频录制

---

## 🔄 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-01-08 | 初始版本，支持基于 Checklist 和用例文件生成脚本 |
