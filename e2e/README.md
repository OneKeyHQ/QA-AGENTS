# E2E 自动化测试

> 基于 Playwright 的 Web 端到端自动化测试框架

---

## 快速开始

```bash
# 1. 进入 e2e 目录
cd e2e

# 2. 安装依赖
npm install

# 3. 安装浏览器
npx playwright install chromium

# 4. 运行测试
npm test
```

---

## 目录结构

```
e2e/
├── package.json              # 依赖管理
├── playwright.config.ts      # Playwright 配置
├── tsconfig.json             # TypeScript 配置
├── reporters/                # 自定义报告器
│   ├── chinese-reporter.ts   # 中文报告器 (TS)
│   └── chinese-reporter.js   # 中文报告器 (JS)
├── tests/                    # 测试用例
│   └── market-watchlist.spec.ts
└── playwright-report/        # HTML 报告（运行后生成）
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `npm test` | 运行所有测试（无头模式） |
| `npm run test:headed` | 有头模式运行 |
| `npm run test:debug` | 调试模式 |
| `npm run test:ui` | UI 交互模式 |
| `npm run report` | 查看 HTML 报告 |

---

## 运行特定测试

```bash
# 按文件名运行
npx playwright test market-watchlist

# 按测试标题运行
npx playwright test -g "观察列表"

# 只运行 P0 场景
npx playwright test -g "\[P0\]"
```

---

## 测试报告

测试报告全部使用中文输出，包含：
- 执行时间、用例数量、浏览器信息
- 每个用例的执行状态和耗时
- 通过率进度条和总耗时
- 失败用例详情（如有）

---

## 参考链接

- [Playwright 官方文档](https://playwright.dev/docs/intro)
