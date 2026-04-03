# QA 测试用例生成 Skill

> 测试用例生成与规则维护，落在仓库里，不依赖用户粘贴 Prompt。

---

## 🎯 核心能力

| 能力 | 触发指令 | 输出 |
| --- | --- | --- |
| 生成测试用例 | `@<需求文档> 生成测试用例` | 结构化用例表格 + 自动落盘 |

---

## 📂 目录结构

```
docs/qa/
├── SKILL.md                  # 本文件
├── qa-rules.md               # 用例生成规则（唯一事实来源）
├── rules/                    # 模块测试规则
│   └── transfer-chain-rules.md
├── requirements/             # 需求文档
└── testcases/cases/          # 测试用例输出（按模块分类）
    ├── account/
    ├── wallet/
    ├── perps/
    └── ...
```

---

## 🚀 使用方法

### 生成测试用例

**输入**：需求文档（`.doc` / `.md`）或直接描述需求

**指令**：
```
@<需求文档> 生成测试用例
```

**输出**：
- 聊天窗口：完整用例（封装在 `markdown` 代码块中，便于一键复制）
- 自动落盘：`docs/qa/testcases/cases/<模块目录>/YYYY-MM-DD_<模块>-<主题>.md`

**示例**：
```
@Perps 限价单最优价格需求.doc 生成测试用例
```

---

## 📋 用例输出规范

### 格式声明
- **输出格式**：标准 Markdown（`.md`）
- **换行符**：表格内多行使用 `<br>` 标签
- **适用平台**：Markdown Preview Enhanced、GitHub、GitLab、Notion、Jira、飞书

### 结构
```
# <模块> - <测试主题>
> 生成时间：YYYY-MM-DD

## 测试场景列表

### 1. 场景名称
| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P0 | ... | ... | ... |

### 2. 场景名称
...
```

### 优先级定义
| 优先级 | 覆盖范围 |
| --- | --- |
| P0 | 资金 / 安全 / 风控 / 主流程 / 状态切换 |
| P1 | 配置 / UI / 非主路径 |
| P2 | 低频 / 文案 / 容错 |

### 输出硬性约束
- 禁止输出"模块感知分析/内部推理过程"（只做不说）
- 按 `docs/qa/qa-rules.md` 的结构输出
- 表格单元格内多行内容使用 `<br>` 标签分隔
- 禁止使用"正常 / 符合预期 / 展示正确"等不可断言表达
- 禁止渲染超链接样式

---

## 🔧 规则维护

### 公共定位参考层

生成自动化测试或补充可执行步骤时，优先参考：

1. `shared/ui-semantic-map.json` — 公共语义定位层
2. `shared/generated/app-monorepo-testid-index.json` — app-monorepo 原始 testID 索引
3. `shared/ui-map.json` — 当前执行层 selector 映射

原则：
- 新生成脚本优先引用语义元素，而不是到处散写原始 selector
- 当前阶段不要批量改历史用例；以新增参考、增量迁移为主
- 如需同步 app-monorepo 最新 testID，运行：`node scripts/sync-app-monorepo-selectors.mjs`


### 规则文档组织原则

1. **核心规则**：`docs/qa/qa-rules.md`
   - 用例生成通用规则
   - 模块垂直深度映射
   - 输出格式要求

2. **模块专项规则**：`docs/qa/rules/` 目录
   - 按模块拆分专项规则文档
   - 例如：`transfer-chain-rules.md`（转账链规则）

3. **需求文档**：`docs/qa/requirements/` 目录
   - 具体功能需求文档
   - 包含业务规则和测试要点

### 规则更新流程

当引入新需求/新规则时：
1. **通用规则**：更新 `docs/qa/qa-rules.md`
2. **模块专项规则**：更新或创建 `docs/qa/rules/<module>-rules.md`
3. **需求文档**：新增或更新 `docs/qa/requirements/<topic>.md`
4. **生成用例时**：自动引用相关规则文档

---

## 📚 规则文档索引

| 文档 | 用途 |
| --- | --- |
| `docs/qa/qa-rules.md` | 用例生成规则（唯一事实来源） |
| `docs/qa/rules/transfer-chain-rules.md` | 转账链规则 |
| `docs/qa/rules/<module>-rules.md` | 模块专项规则 |
| `docs/qa/requirements/<topic>.md` | 需求文档 |

---

## 🏷️ 支持的业务模块

| 模块 | 目录 | 包含功能 |
|-----|------|---------|
| 账户模型 | `account/` | 硬件/软件钱包、观察/外部账户、密钥派生 |
| Wallet | `wallet/` | 转账、首页、Token、历史、NFT、法币、授权 |
| Swap | `swap/` | 兑换、路由、滑点 |
| Market | `market/` | 行情、价格、图表 |
| Perps | `perps/` | 合约、保证金、强平、资金费率 |
| Prime | `prime/` | Prime 功能 |
| 返佣 | `referral/` | 返佣、推荐奖励 |
| DeFi | `defi/` | Lending、LP、Stake、Earn |
| Browser | `browser/` | DApp 授权、签名 |
| 通用业务 | `utility/` | 设置、地址簿、通知 |
| HW & App | `hardware/` | 硬件转账、设备管理 |
