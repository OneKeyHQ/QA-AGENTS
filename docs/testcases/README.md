# 测试用例文件夹（自动落盘）

本目录用于存放生成的结构化测试用例、Checklist 清单和测试报告文件。

## 目录结构

```
docs/testcases/
├── README.md                    # 本说明文件
├── checklist/                   # Checklist 文件目录
│   └── YYYY-MM-DD_<模块>-<主题>-Checklist.md
├── performance/                 # 冒烟测试报告目录
│   └── YYYY-MM-DD_<模块>-冒烟测试.md
├── api/                         # API 测试用例目录
│   └── {collection}-Apifox-TestCases.json
└── YYYY-MM-DD_<模块>-<主题>.md  # 测试用例文件
```

## 测试用例文件

### 命名规范
- 文件路径固定：`docs/testcases/`
- 文件名建议：`YYYY-MM-DD_<模块>-<测试主题>.md`
  - 例：`2025-12-31_Perps-限价单最优价BBO.md`

### 内容规范
- 文件内容必须遵守：`docs/qa-rules.md`
- 文件内必须可直接渲染为 Markdown 表格（禁止在最外层包裹 ``` 代码块）
- 表格单元格内多行内容必须使用 `<br>` 分隔

## Checklist 文件

### 命名规范
- 文件路径固定：`docs/testcases/checklist/`
- 文件名格式：`YYYY-MM-DD_<模块>-<测试主题>-Checklist.md`
  - 例：`2026-01-04_Perps-限价单最优价格BBO-Checklist.md`

### 内容规范
- 文件内容按 `docs/specs/checklist.md` 第 10 节标准格式
- 包含：生成时间、来源用例、前置条件、操作步骤、关键断言点
- 文件内容可直接渲染为 Markdown，禁止最外层代码块包裹
- 可直接用于冒烟测试执行：`@<checklist文件> smoke <URL>`

## 冒烟测试报告

### 命名规范
- 文件路径固定：`docs/testcases/performance/`
- 文件名格式：`YYYY-MM-DD_<模块>-冒烟测试.md`
  - 例：`2026-01-04_Perps-限价单最优价格BBO-冒烟测试.md`
