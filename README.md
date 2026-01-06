# QA Skill - Cursor 自动化测试能力

> 让测试用例生成与规则维护"落在仓库里"。
---

## 🎯 核心能力

| 能力 | 触发指令 | 输出 |
|------|----------|------|
| 生成测试用例 | `@<需求文档> 生成测试用例` | 结构化用例表格 + 自动落盘 |
| 冒烟测试清单 | `@<用例文件> checklist` | 精细化步骤 Checkbox 列表 |
| 冒烟测试执行 | `smoke <URL>` | 功能验证 + 性能采集一体化报告 |
| 性能分析 | `perf <URL>` | 仅采集性能数据 |
| WS 监听 | `ws <URL>` | 仅监听 WebSocket 数据 |
| 综合分析 | `analyze <URL>` | 性能 + WS 综合分析 |

---

## 🚀 快速开始

### 1. 安装依赖

```bash
# Node.js（用于 Playwright MCP）
brew install node

# Chrome 浏览器
# 手动安装：https://www.google.com/chrome/
```

### 2. 配置 Cursor MCP

在 Cursor 设置中添加 Playwright MCP：

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic-ai/mcp-server-playwright", "--cdp-endpoint", "http://127.0.0.1:9222"]
    }
  }
}
```

### 3. 启动 Chrome 调试模式

```bash
# 默认端口 9222
./docs/scripts/start-mcp-chrome.sh

# 指定端口
./docs/scripts/start-mcp-chrome.sh 12306

# 无头模式
HEADLESS=1 ./docs/scripts/start-mcp-chrome.sh
```

### 4. 开始使用

```bash
# 在 Cursor 中执行冒烟测试
smoke https://app.onekey.so/perps
```

---

## 📖 指令详解

### 用例生成

```bash
# 根据需求文档生成用例
@Perps限价单需求.doc 生成测试用例

# 输出精细化步骤清单
@docs/testcases/2026-01-03_Perps-限价单.md checklist
```

### 冒烟测试

```bash
# 带用例文件执行
@docs/testcases/2026-01-03_Perps-限价单.md smoke https://app.onekey.so/perps

# 直接指令执行（最高优先级）
smoke https://app.onekey.so/perps 点击「最优价」按钮，选择「对手价1」

# 等待输入
smoke https://app.onekey.so/perps
```

**执行优先级**：
1. 用户直接指令（最高）→ 直接按指令执行
2. 用例文件 → 按用例步骤执行
3. 混合模式 → 用户指令覆盖用例
4. 无任何输入 → 提示用户提供测试步骤

### 独立分析

```bash
# 仅性能分析（快速检查页面加载性能）
perf https://app.onekey.so

# 仅 WS 监听（调试实时数据推送）
ws https://app.onekey.so/perps

# 综合分析（性能 + WS）
analyze https://app.onekey.so/perps
```

| 指令 | 功能验证 | 性能采集 | WS 监听 | 适用场景 |
|------|:---:|:---:|:---:|----------|
| `smoke` | ✅ | ✅ | ✅（按需） | 完整冒烟测试 |
| `perf` | ❌ | ✅ | ❌ | 快速检查页面性能 |
| `ws` | ❌ | ❌ | ✅ | 调试实时数据推送 |
| `analyze` | ❌ | ✅ | ✅ | 全面诊断页面问题 |

---

## 📂 目录结构

```
QA SKILL/
├── .cursorrules                          # Cursor 入口规则
├── README.md                             # 本文件
├── docs/
│   ├── qa-rules.md                       # 核心规则（唯一事实来源）
│   ├── SKILL.md                          # 能力说明
│   │
│   ├── specs/                            # 📦 能力规范（按需读取）
│   │   ├── smoke-test.md                 # 冒烟测试 + perf/ws/analyze
│   │   ├── checklist.md                  # Checklist 标准
│   │   ├── performance.md                # 性能指标 + 报告模板
│   │   └── chrome-mcp.md                 # MCP 工具规范
│   │
│   ├── scripts/                          # 📦 脚本文件
│   │   ├── start-mcp-chrome.sh           # 启动 Chrome MCP
│   │   └── inject/                       # 注入脚本（自动执行）
│   │       ├── performance-collector.js  # 性能采集
│   │       └── websocket-monitor.js      # WS 监听
│   │
│   ├── requirements/                     # 需求文档目录
│   │   └── *.doc / *.md / *.pdf
│   │
│   └── testcases/                        # 用例文件（自动落盘）
│       ├── README.md
│       ├── YYYY-MM-DD_<模块>-<主题>.md
│       └── performance/                  # 冒烟测试报告
│           └── YYYY-MM-DD_<模块>-冒烟测试.md
```

---

## 🔧 Chrome 启动脚本参数

```bash
# 环境变量
PORT=9222              # 调试端口（默认: 9222）
PROFILE="Profile 2"    # Chrome Profile 目录名
HEADLESS=0             # 1=无头模式
COPY_PROFILE=1         # 1=复制配置
CDP_CHECK=1            # 1=等待 CDP 就绪
KILL_CHROME=0          # 1=启动前关闭现有 Chrome

# 使用示例
PORT=12306 PROFILE="Profile 9" ./docs/scripts/start-mcp-chrome.sh
HEADLESS=1 ./docs/scripts/start-mcp-chrome.sh
KILL_CHROME=1 ./docs/scripts/start-mcp-chrome.sh 12306
```

---

## 📊 性能指标

### Core Web Vitals（必须达标）

| 指标 | 说明 | 目标值 |
|------|------|--------|
| LCP | 最大内容绘制 | < 2.5s |
| FID | 首次输入延迟 | < 100ms |
| CLS | 累积布局偏移 | < 0.1 |

### 加载性能

| 指标 | 说明 |
|------|------|
| FCP | 首次内容绘制 |
| TTI | 可交互时间 |
| TBT | 总阻塞时间 |

### WebSocket 监听（按需）

| 模块 | 需要 WS | 原因 |
|------|:---:|------|
| Perps | ✅ | BBO 实时报价、仓位更新 |
| Market | ✅ | K线数据、实时价格 |
| Swap | ⚠️ | 部分场景有实时报价 |
| Transfer | ❌ | 无实时数据需求 |

---

## 🏷️ 支持的业务模块

- 钱包账户（软件钱包 / 硬件钱包 / 地址管理）
- 转账（Transfer）
- Swap（兑换 / 路由 / 滑点）
- Market（行情 / 价格 / 代币风险 / 持仓信息 / 图表）
- DeFi（Lending / LP / Stake / Reward / Earn）
- Perps（合约 / 保证金 / 强平 / 资金费率）
- DApp（授权 / 签名 / 合约交互）
- 返佣 / 推荐奖励
- 通知 / 消息中心
- 风控 / 安全（封禁 / 拦截 / 限制）
- NFT / 数字藏品

---

## 📝 规则维护

当引入新需求/新规则时：

1. 优先把规则固化到 `docs/qa-rules.md`
2. 或新增 `docs/requirements/<topic>.md`
3. 生成用例时会自动引用

---

## 📚 文档索引

| 文档 | 用途 | 何时读取 |
|------|------|----------|
| `docs/qa-rules.md` | 用例生成规则 | 生成用例时 |
| `docs/specs/smoke-test.md` | 冒烟测试规范 | 执行测试时 |
| `docs/specs/checklist.md` | Checklist 标准 | 生成 checklist 时 |
| `docs/specs/performance.md` | 性能指标定义 | 需要性能报告时 |
| `docs/specs/chrome-mcp.md` | MCP 工具规范 | 执行自动化时 |
