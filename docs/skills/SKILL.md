# QA 执行能力 Skill

> 测试执行能力：冒烟测试、Checklist 生成、E2E 脚本、API 测试用例、性能分析。

---

## 🎯 核心能力

| 能力 | 触发指令 | 输出 |
| --- | --- | --- |
| Checklist 生成 | `@<用例文件> checklist` | 精细化步骤清单 |
| 冒烟测试执行 | `smoke <URL>` | 功能验证 + 性能采集报告 |
| E2E 脚本生成 | `@<文件> e2e` | Playwright 测试脚本 |
| API 测试用例 | `/api-testcase <collection>` | Postman Collection 格式 |
| 性能分析 | `perf <URL>` | 性能数据采集 |
| WS 数据验证 | `ws <URL>` | 交互式 WS 数据验证 |
| 综合分析 | `analyze <URL>` | 性能 + WS 综合分析 |

---

## 📂 目录结构

```
docs/skills/
├── SKILL.md                          # 本文件
├── specs/                            # 规范文档
│   ├── smoke-test.md
│   ├── checklist.md
│   ├── performance.md
│   └── chrome-mcp.md
├── smoke-test/reports/               # 冒烟测试报告
├── checklist-generator/output/       # Checklist 清单
├── apifox-testcase-generator/output/ # API 测试用例
├── playwright-generator/output/      # E2E 脚本
└── scripts/                          # 脚本文件
```

---

## 🚀 使用方法

### 1. Checklist 生成

**输入**：已生成的测试用例文件

**指令**：
```
@<用例文件> checklist
```

**输出**：
- 自动落盘：`docs/skills/checklist-generator/output/YYYY-MM-DD_<模块>-<主题>-Checklist.md`

**文件格式**：
- 包含：生成时间、来源用例、前置条件、操作步骤、关键断言点
- 标准 Markdown checkbox 格式

**详细规范**：`docs/skills/specs/checklist.md`

---

### 2. 冒烟测试执行

**核心逻辑**：功能验证 + 性能采集一体化。性能指标达标是冒烟通过的必要条件。

**指令**：
| 指令 | 说明 |
| --- | --- |
| `smoke <URL>` + 用户指令 | 按用户指令执行（最高优先级） |
| `@<checklist文件> smoke <URL>` | 按 checklist 文件执行 |
| `@<用例文件> smoke <URL>` | 按用例文件执行 |

**执行优先级**：
```
1. 用户直接指令（最高）
2. Checklist 文件
3. 用例文件
4. 等待用户输入
```

**输出**：
- 聊天窗口：一体化测试报告
- 自动落盘：`docs/skills/smoke-test/reports/YYYY-MM-DD_<模块>-冒烟测试.md`

**性能指标**：
- Core Web Vitals：LCP、FID、CLS（必须达标）
- 加载性能：FCP、TTI、TBT
- 运行时性能：FPS、内存占用

**示例**：
```
smoke https://app.onekey.so/perps
```
```
@docs/skills/checklist-generator/output/2026-01-04_Perps-Checklist.md smoke https://app.onekey.so/perps
```

**详细规范**：`docs/skills/specs/smoke-test.md`

---

### 3. E2E 脚本生成（Playwright）

**输入**：Checklist 文件或测试用例文件

**指令**：
```
@<checklist文件> e2e
```
或
```
@<用例文件> e2e
```

**输出**：
- 自动落盘：`docs/skills/playwright-generator/output/{模块名}-{功能名}.spec.ts`

**可选参数**：
| 参数 | 说明 |
| --- | --- |
| `--full` | 包含 P0/P1/P2 所有场景 |
| `--no-perf` | 不生成性能测试 |

**运行脚本**：
```bash
cd e2e && npx playwright test {脚本名}.spec.ts
```

**详细文档**：`docs/skills/playwright-generator/SKILL.md`

---

### 4. API 测试用例生成

**指令**：
| 指令 | 说明 |
| --- | --- |
| `/api-list` | 列出所有 API 接口 |
| `/api-read <path>` | 读取指定接口详情 |
| `/api-testcase <collection>` | 批量生成用例集合 |
| `/api-testcase-single <path>` | 单接口生成用例 |
| `/api-refresh` | 刷新 API 文档缓存 |

**输出**：
- 自动落盘：`docs/skills/apifox-testcase-generator/output/{collection}-Apifox-TestCases.json`

**详细文档**：`docs/skills/apifox-testcase-generator/SKILL.md`

---

### 5. 独立分析指令

| 指令 | 功能验证 | 性能采集 | WS 验证 | 适用场景 |
| --- | :---: | :---: | :---: | --- |
| `smoke <URL>` | ✅ | ✅ | 按需 | 完整冒烟测试 |
| `perf <URL>` | ❌ | ✅ | ❌ | 快速检查页面加载性能 |
| `ws <URL>` | ❌ | ❌ | ✅ | WS 数据与 UI 一致性验证 |
| `analyze <URL>` | ❌ | ✅ | ✅ | 全面诊断页面问题 |

**perf 指令**：
```
perf https://app.onekey.so/perps
```
- 仅采集性能数据，不执行任何操作
- 输出：Core Web Vitals、加载性能、资源分析

**ws 指令（交互式）**：
```
ws https://app.onekey.so/perps
```
- 交互式验证 WS 数据与 UI 一致性
- 输出：`docs/skills/smoke-test/reports/YYYY-MM-DD_<模块>-数据验证测试报告.md`

**analyze 指令**：
```
analyze https://app.onekey.so/perps
```
- 同时采集性能 + WebSocket 数据
- 输出：综合分析报告

---

## 📚 规范文档索引

| 文档 | 用途 | 何时读取 |
| --- | --- | --- |
| `docs/skills/specs/smoke-test.md` | 冒烟测试规范 | 执行 smoke/perf/ws/analyze 时 |
| `docs/skills/specs/checklist.md` | Checklist 标准 | 生成 checklist 时 |
| `docs/skills/specs/performance.md` | 性能指标定义 | 需要性能报告时 |
| `docs/skills/specs/chrome-mcp.md` | MCP 工具规范 | 执行自动化时 |

---

## 🔧 脚本文件

| 文件 | 用途 |
| --- | --- |
| `scripts/start-mcp-chrome.sh` | 启动 Chrome MCP |
| `scripts/inject/performance-collector.js` | 性能采集脚本 |
| `scripts/inject/websocket-monitor.js` | WS 监听脚本 |
| `scripts/inject/perps-data-validator.js` | Perps 数据验证脚本 |
