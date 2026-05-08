# QA 项目工作流规则

> 本文档定义 QA-AGENTS 项目中三条 QA 线的完整闭环流程。
> 适用于所有参与用例编写、自动化脚本开发、测试执行的人和 AI 工具。
> **本文档是流程规范，`docs/qa/qa-rules.md` 是手动用例格式规范，两者互补。**

---

## 项目全局规则

### 核心原则

1. **规范先行**：任何生成、修改、review 操作，必须先读取对应的规范文件，不可凭记忆替代
2. **沉淀闭环**：每次操作中发现的新规则、新问题，必须回写到项目文档，不存 AI 私有记忆
3. **三线联动**：手动用例、API 用例、UI 脚本之间有引用关系，修改一方时需检查对另外两方的影响

### 三条 QA 线总览

| 线路 | 入口规范 | 输出位置 | 沉淀位置 |
|------|---------|---------|---------|
| ① 手动 QA 用例 | `docs/qa/qa-rules.md` | `docs/qa/testcases/cases/<module>/` | `docs/qa/rules/<module>-rules.md` |
| ② API 自动化用例 | `docs/skills/apifox-testcase-generator/SKILL.md` | `docs/skills/apifox-testcase-generator/output/` | `docs/qa/rules/swap-network-features.md` 等 |
| ③ UI 自动化脚本 | `.claude/CLAUDE.md` §Test Script Rules | `src/tests/<platform>/<module>/` | `shared/knowledge.json`、`shared/ui-map.json` |

### 三线引用关系

```
① 手动用例 ──────→ ② API 用例（接口验证下沉）
     │                    │
     │                    ↓
     └──────→ ③ UI 脚本（1:1 对照用例文档编写断言）
                         │
                         ↓
              shared/knowledge.json（执行中发现的经验回写）
                         │
                         ↓
              docs/qa/rules/（经验沉淀为规则，反哺 ① 和 ②）
```

---

## 线路 ① 手动 QA 用例

### 必读规范

| 顺序 | 文件 | 读取内容 |
|------|------|---------|
| 1 | `docs/qa/qa-rules.md` | 表格格式、优先级标记、措辞允许/禁止词、文件路径、模块映射 |
| 2 | `docs/qa/rules/<module>-rules.md` | 当前模块业务规则 |
| 3 | 本文档 | 流程规范 |

### 闭环流程

```
①读规范 → ②读上下文 → ③生成 → ④自检 → ⑤沉淀 → ⑥进化
```

**① 读规范**：读 qa-rules.md，确认格式要求。不读不写。

**② 读上下文**：
- 读用户需求（PRD / 截图 / 口述）
- 读 app-monorepo 源码（理解实现逻辑）
- 读 git bug 修复历史（`git log x --oneline --grep="fix" -- packages/kit/src/views/<Module>/ -20`）
- 读同模块已有用例（避免重复）

**③ 生成**：严格按 qa-rules.md 输出（4 列表头、❗️❗️P0❗️❗️ 标记、禁止词检查、参数化消冗余）

**④ 自检**：
- 预期结果列扫描禁止词（正常/成功/合理/符合预期/尝试）
- 同文件格式一致性（不能新旧格式混合）
- 标题与目录匹配
- P0 占比不超过 30%

**⑤ 沉淀**：
- 新业务规则 → 回写 `docs/qa/rules/<module>-rules.md`
- 新需求 → 检查/创建 `docs/qa/requirements/`
- 接口可验证的逻辑 → 标注「接口自动化覆盖」，通知线路 ②

**⑥ 进化**：
- 格式问题 → 检查 qa-rules.md 是否已覆盖，未覆盖则补充
- 业务问题 → 补充 module-rules.md
- 流程问题 → 补充本文档

---

## 线路 ② API 自动化用例

### 必读规范

| 顺序 | 文件 | 读取内容 |
|------|------|---------|
| 1 | `docs/skills/apifox-testcase-generator/SKILL.md` | API 用例生成规范、模板结构 |
| 2 | `docs/qa/rules/<module>-rules.md` | 业务规则（如合约地址、网络特性） |
| 3 | `docs/qa/rules/swap-network-features.md` | Swap 相关的网络特性、代币合约地址（source of truth） |

### 闭环流程

```
①读规范 → ②读接口定义 → ③生成 → ④自检 → ⑤验证 → ⑥沉淀
```

**① 读规范**：读 SKILL.md + 模板文件

**② 读接口定义**：通过 Apifox MCP 读取 OpenAPI spec

**③ 生成**：按模板输出 Apifox-compatible JSON

**④ 自检**：
- 请求参数完整性：必填字段是否都有值，地址格式是否正确（如 EVM 全小写、Cosmos bech32）
- 断言覆盖：每个接口至少断言状态码 + 关键响应字段，不能只断言 `status: 200`
- 测试数据来源：合约地址/账户地址是否引用了 `swap-network-features.md` 等 source of truth，而非硬编码
- 边界值覆盖：涉及金额/数量的接口是否有 0 / 负数 / 超大值 / 精度极限场景
- 重复检查：同一接口同一参数组合不出现多条用例

**⑤ 验证**：导入 Apifox 执行，确认断言通过

**⑥ 沉淀**：
- 新发现的接口行为 → 回写 module-rules.md
- 手动用例中标注了「接口自动化覆盖」的场景 → 确认已覆盖
- 合约地址/网络参数变更 → 更新 swap-network-features.md

### 与线路 ① 的联动

- 手动用例中纯服务端逻辑（过滤、排序、去重、条数上限）应下沉到 API 用例
- 手动用例顶部标注「接口自动化覆盖」说明，表格中不重复展开
- API 用例发现的接口行为不一致 → 反馈到手动用例更新预期结果

---

## 线路 ③ UI 自动化脚本

### 必读规范

| 顺序 | 文件 | 读取内容 |
|------|------|---------|
| 1 | `.claude/CLAUDE.md` §Test Script Rules | 脚本结构、断言标准、Dashboard 日志、弹窗规则、元素定位策略 |
| 2 | `docs/qa/testcases/cases/<module>/` | 对应手动用例文档（1:1 对照编写断言） |
| 3 | `shared/knowledge.json` | 已知的坑（选择器失效、CDP 断连、时序问题） |
| 4 | `shared/ui-semantic-map.json` + `shared/generated/app-monorepo-testid-index.json` | 可用选择器 |

### 闭环流程

```
①读规范 → ②读用例文档 → ③录制/生成 → ④自检 → ⑤执行验证 → ⑥沉淀
```

**① 读规范**：读 CLAUDE.md Test Script Rules + knowledge.json

**② 读用例文档**：逐条对照手动用例的「预期结果」列编写断言

**③ 录制/生成**：
- 录制器捕获操作 → 用户确认步骤清单 → 生成脚本
- 脚本使用 `createStepTracker` + `safeStep`
- 每个 testCase 对应用例文档一个大标题

**④ 自检**：
- 用例映射：testCase 数量与用例文档大标题数量一致，id/name 对应
- 断言质量：每个 safeStep 有具体断言，无软断言（如 `assertHasSomeContent`）；数值用精确 delta（`=== before + 1`）
- 步骤完整：每个有意义操作独立一个 safeStep，名称描述具体动作，failed/skipped 有非空 detail
- 选择器来源：优先用 ui-semantic-map / app-monorepo-testid-index / ui-map，相同定位逻辑出现 2 次以上已提取到公共库
- 硬编码检查：无硬编码地址/金额/账户名（应引用规则文档或配置）
- fn 签名：所有 fn 只接收 `page` 一个参数，末尾有 `return t.result()`

**⑤ 执行验证**：Dashboard 实时日志，确认 passed/failed/skipped

**⑥ 沉淀**：
- 选择器失效/时序问题 → 自动追加 `shared/knowledge.json`
- 新可复用元素 → 提取到 `components.mjs` + 更新 `ui-map.json`
- 用例文档与实际行为不一致 → 反馈到线路 ① 更新用例

### 与线路 ① 的联动

- 脚本断言必须 1:1 对照用例文档的预期结果列
- 用例文档更新后，脚本的 id/name 必须同步更新
- 执行中发现用例描述有误 → 更新手动用例文档 + module-rules.md

---

## 用户纠正自动沉淀机制（强制）

> AI 必须主动识别用户的纠正行为，并主动询问是否写入规范。这是保证规范持续进化的关键机制。

### 触发条件

当用户在会话中做了以下任何一种行为时触发：
- 手动修改了 AI 生成的用例内容（格式、术语、结构、措辞）
- 口头纠正了 AI 的做法（"不要这样写"、"改成 XX"、"太啰嗦了"）
- 指出了格式或内容上的问题（"这里不对"、"按规范来"）
- 确认了某种非显而易见的写法（"对，就这样写"）

### AI 必须执行的动作

**步骤 1：识别纠正点**
在任务完成后（或用户纠正后），AI 逐条列出本次会话中被用户纠正或确认的具体内容。

**步骤 2：按线路分类 + 检查规范覆盖**
对每条纠正点，先判断属于哪条线路，再检查对应规范文件是否已覆盖：

#### 线路 ① 手动用例 — 沉淀目标映射

| 纠正类型 | 示例 | 沉淀目标文件 |
|---------|------|------------|
| 表格格式/列数/标记 | "不要自动化层级这列"、"P0 要用 ❗️❗️" | `docs/qa/qa-rules.md` §7.3 |
| 预期结果措辞 | "不要写正常/成功" | `docs/qa/qa-rules.md` §7.5 禁止词表 |
| 术语/命名 | "叫 Keyless Wallet 不叫无私钥钱包" | `docs/qa/qa-rules.md` §7.45 术语统一表 |
| 写作风格 | "前置条件太啰嗦"、"不用逐一列举路径" | `docs/qa/qa-rules.md` §7.45 精简规则 |
| 软硬件侧重 | "硬件用例不需要验 App 确认页" | `docs/qa/qa-rules.md` §7.45 / §7.3.1 |
| 业务规则 | "观察账户不显示在账户 Tab" | `docs/qa/rules/<module>-rules.md` |
| 文件组织 | "Cosmos 转账应该放 transfer/ 不是 wallet/" | `docs/qa/qa-rules.md` §7.0 模块映射表 |

#### 线路 ② API 自动化 — 沉淀目标映射

| 纠正类型 | 示例 | 沉淀目标文件 |
|---------|------|------------|
| JSON 结构/格式 | "断言要放 tests 数组里不是 events" | `docs/skills/apifox-testcase-generator/SKILL.md` 或模板文件 |
| 断言逻辑 | "状态码要断言 200 不是 2xx" | `docs/skills/apifox-testcase-generator/templates/assertions-library.json` |
| 请求参数 | "vault 地址要全小写" | `docs/qa/rules/<module>-rules.md`（如 defi-rules.md §2.15） |
| 合约地址/网络参数 | "用这个合约地址" | `docs/qa/rules/swap-network-features.md` |
| 测试数据 | "用这个账户/这条链测" | `docs/skills/apifox-testcase-generator/SKILL.md` 测试数据章节 |
| 覆盖范围 | "这个接口也要覆盖边界值" | `docs/skills/apifox-testcase-generator/templates/boundary-tests.json` |

#### 线路 ③ UI 自动化 — 沉淀目标映射

| 纠正类型 | 示例 | 沉淀目标文件 |
|---------|------|------------|
| 脚本结构 | "fn 只接收 page 一个参数" | `.claude/CLAUDE.md` §Test Script Rules → 脚本结构规则 |
| 断言写法 | "不要用软断言" | `.claude/CLAUDE.md` §Test Script Rules → 断言编写标准 |
| 步骤粒度 | "每个操作独立一个 safeStep" | `.claude/CLAUDE.md` §Dashboard 实时日志规则 |
| 选择器策略 | "弹窗里要定位弹窗内部元素" | `.claude/CLAUDE.md` §弹窗/Modal 交互规则 |
| 输入方式 | "用 pressSequentially 不用 fill" | `.claude/CLAUDE.md` §弹窗/Modal 交互规则 |
| 运行时经验 | "这个元素要等 4 秒重绘" | `shared/knowledge.json`（K-NNN 条目） |
| 可复用组件 | "这个定位逻辑提取到公共库" | `src/tests/helpers/components.mjs` + `shared/ui-map.json` |
| 录制流程 | "录完要列步骤让我确认" | `.claude/CLAUDE.md` §Recording Rules |

**步骤 3：主动询问**
对于尚未写入规范的纠正点，AI 必须主动向用户确认：

```
本次会话中发现以下纠正点尚未写入规范：

线路 ①（手动用例）：
1. [具体纠正内容] → 建议写入 [目标文件 + 章节]

线路 ③（UI 自动化）：
2. [具体纠正内容] → 建议写入 [目标文件 + 章节]

是否需要将这些写入规范文件？这样下次生成时会自动遵循。
```

**步骤 4：用户确认后写入**
- 用户确认 → 写入对应规范文件 + 更新变更记录
- 用户拒绝 → 不写入，本次纠正仅在当前会话生效
- 涉及 `.claude/CLAUDE.md` 的修改 → `.cursorrules` / `AGENTS.md` 是软链，自动同步，**无需手动双写**。修改后用 `readlink .cursorrules AGENTS.md` 验证软链依然指向 `.claude/CLAUDE.md`

### 禁止行为

- 识别到纠正点但不询问，默默忽略
- 把纠正点存到 AI 私有记忆而不写入项目文档
- 在用户没确认的情况下自行写入规范
- 只更新一条线路的规范，忽略对其他线路的影响

---

## 跨线路修改影响检查

当修改任一线路的文件时，检查是否影响其他线路：

| 修改内容 | 检查影响 |
|---------|---------|
| 修改 `docs/qa/rules/<module>-rules.md` | ① 对应用例是否需更新？② API 用例的断言是否需调整？③ UI 脚本的断言是否需调整？ |
| 修改手动用例文档 | ③ UI 脚本是否需同步更新 id/name/断言？ |
| 修改 `swap-network-features.md` 合约地址 | ② API 用例的请求参数是否需更新？ |
| UI 脚本执行发现行为变化 | ① 手动用例的预期结果是否需修正？规则文档是否需更新？ |
| 新增模块规则 | `qa-rules.md` 的模块映射表是否需补充？ |

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-04-11 | 初始版本：沉淀「读代码和 bug 历史」与「用例后同步更新规则文档」 |
| 2026-04-11 | 重构为三线闭环架构：手动用例 / API 自动化 / UI 自动化各有独立流程 + 跨线路联动规则 |
