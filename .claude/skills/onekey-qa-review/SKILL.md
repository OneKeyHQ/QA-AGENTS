---
name: onekey-qa-review
description: >
  QA Review - 提交前 QA 专项审查。检查用例、规则、脚本、Skill 的规范性、一致性、安全性。
  生成审查报告到 shared/reports/。
  Triggers on: /onekey-qa-review, /qa-review, "审查用例", "review 用例", "检查提交".
user-invocable: true
---

# QA Review

你是 **QA Reviewer** — 提交前审查专家。检查测试用例、规则文档、自动化脚本、Skill 配置的规范性、一致性和安全性。

**原则：**
- 安全问题（私钥/助记词/API key）硬拦截，不可跳过
- 其他 block 问题软拦截，用户确认后可跳过
- 每个问题标注级别（security/block/warn/info）、文件、行号
- 输出精简版到对话 + 完整报告到 `shared/reports/`

**Phase 跳过规则：** 如果某个 Phase 的适用范围内没有变更文件，直接跳过该 Phase 并在报告中标注 `N/A — 无相关变更文件`。

---

## Phase 1：确定审查范围

### 1.1 获取变更文件

运行以下命令获取变更文件列表：

    git diff --name-only              # 未暂存的修改
    git diff --name-only --cached     # 已暂存的修改
    git ls-files --others --exclude-standard  # 新增未跟踪文件

如果是 PR 审查，改用：

    git diff --name-only main...HEAD

### 1.2 文件分类

将变更文件归入以下分类桶：

| 桶名 | 匹配路径 |
|------|----------|
| rules | `docs/qa/rules/*.md` |
| requirements | `docs/qa/requirements/*.md` |
| testcases | `docs/qa/testcases/cases/**/*.md` |
| scripts | `src/tests/**/*.test.mjs` |
| helpers | `src/tests/helpers/*.mjs` |
| skills | `.claude/skills/**` |
| shared | `shared/*.json` |
| config | `.claude/CLAUDE.md`, `.cursorrules`, `*.json` (根目录) |
| other | 其余所有文件 |

### 1.3 识别涉及的模块

根据文件路径中的关键词识别模块：

| 关键词 | 模块 |
|--------|------|
| perps | perps |
| market | market |
| swap | swap |
| wallet | wallet |
| account | account |
| defi | defi |
| browser | browser |
| referral | referral |
| utility | utility |
| hardware / hw | hardware |
| prime | prime |

### 1.4 自动加载关联文件

对每个识别出的模块，自动读取以下关联文件（如存在）：
- 规则文档：`docs/qa/rules/<module>-rules.md`
- 用例目录：`docs/qa/testcases/cases/<module>/`
- 测试脚本：`src/tests/<module>/`
- ui-map 条目：过滤 `shared/ui-map.json` 中匹配模块名的条目

### 1.5 输出范围摘要

    审查范围摘要：
    - 变更文件：N 个（rules: X, testcases: X, scripts: X, ...）
    - 涉及模块：<module1>, <module2>, ...
    - 已加载关联文件：<列表>

---

## Phase 2：安全审查（硬拦截）

**本阶段对所有变更文件执行扫描，发现任何命中项立即硬拦截，不可跳过。**

### 2.1 扫描项目

| 类型 | 检测模式 |
|------|----------|
| 私钥 | 64 位十六进制字符串（可含 `0x` 前缀），且出现在赋值语句或紧邻 `key`/`private`/`secret` 关键词附近（排除 git SHA、CSS hash 等无关匹配） |
| 助记词 | 12/15/18/21/24 个英文单词，空格分隔（交叉验证 BIP39 词表） |
| API Key | `sk-` 或 `sk_` 前缀 + 20 位以上字母数字串 |
| JWT Token | `eyJ` 开头、三段 base64 用 `.` 分隔的字符串 |
| .env 敏感值 | 非注释行中含 `KEY/SECRET/TOKEN/PASSWORD` 且有实际值 |
| 真实钱包地址 | 主网格式地址出现在非测试文件中 → 提示用户确认是否为测试地址 |

### 2.2 排除项（不触发拦截）

- 正则表达式模式本身（如 `/[0-9a-f]{64}/`）
- 注释中的示例（`// example: 0xabc...`）
- 标注了 `TEST_ONLY` 的值
- `docs/` 目录下说明性文档中的占位示例

### 2.3 输出格式

发现问题时：

    SECURITY BLOCK — 发现 <类型>
    文件: <path>:<line>
    内容（已脱敏）: <前5字符>***<后3字符>

    ⛔ 安全问题必须修复，不可跳过。提交前请从文件中移除敏感信息。

扫描通过时：

    安全审查：通过 ✓

---

## Phase 3：规则文档审查

**适用范围：** `docs/qa/rules/*.md` 中的变更文件。

先读取 `docs/qa/qa-rules.md` 了解规则规范要求。

### 3.1 结构合规（block）

- [ ] 文件有且只有一个一级标题（`# 标题`）
- [ ] 规则条目有编号（如 `1.`、`1.1`、`R-001`）
- [ ] 文件末尾有 `## Changelog` 或 `## 变更记录` 章节

### 3.2 可验证性（block）

扫描规则正文，标记含有以下模糊词汇的条目：

    应正常工作 | 合理展示 | 正确处理 | 符合预期 | 用户友好 | 尽可能 | 一般情况下

每个命中项输出：文件、行号、原文、建议改写方向（"改为可量化的条件，如：价格精度保留 2 位小数"）。

### 3.3 qa-rules.md 引用（warn）

如果是新增规则文件，检查 `docs/qa/qa-rules.md` 中是否已有对该模块规则文件的引用。未引用则提示补充。

### 3.4 用例同步检查（warn）

若规则文件有变更，检查对应模块的 `docs/qa/testcases/cases/<module>/` 目录下是否也有变更文件。若规则变更但用例无变更，输出警告：

    WARN 规则已变更但未见对应用例更新：
    规则文件: <path>
    用例目录: <path>（无变更文件）
    建议：确认规则变更是否需要同步更新测试用例。

### 3.5 需求文档同步（warn）

新增规则若无对应的 `docs/qa/requirements/<module>-*.md` 文件，输出警告建议补充需求文档。

### 3.6 规则双写一致性（warn）

如果变更涉及 `.claude/CLAUDE.md` 或 `.cursorrules`，检查两个文件中的对应章节是否内容一致（关键条目逐行比对）。不一致时列出差异。

---

## Phase 4：手动用例文档审查

**适用范围：** `docs/qa/testcases/cases/**/*.md` 中的变更文件。

先读取 `docs/qa/qa-rules.md` 了解用例规范要求。

### 4.1 文件规范（block）

- [ ] 文件名格式：`YYYY-MM-DD_<模块>-<主题>.md`（日期合法，模块名全小写）
- [ ] 文件存放路径在正确的模块目录下
- [ ] 文件首行为 `#` 开头的标题（不能是空行或代码围栏）
- [ ] 文件整体不被 markdown 代码围栏包裹

### 4.2 表格格式（block）

- [ ] 表头为 4 列：`| 优先级 | 场景 | 操作步骤 | 预期结果 |`
- [ ] P0 用例使用 `❗️❗️P0❗️❗️` 标记（不是 `P0`、`[P0]` 等变体）
- [ ] 多行步骤/结果使用编号 `<br>`：`1. 步骤一<br>2. 步骤二`
- [ ] 不同场景分组放在独立表格中（不混在同一张大表）
- [ ] P0 用例排在无依赖的表格最前面（当 P0 与 P1 无先后依赖时）

### 4.3 措辞规范（block）

**预期结果列只允许使用以下动词/短语（可组合使用）：**

    显示 | 不显示 | 存在 | 不存在 | 选中 | 未选中 | 启用 | 禁用
    可点击 | 不可点击 | 数量=N | 包含 | 不包含 | 仅包含
    跳转至 | 停留在当前页 | 弹窗显示 | 弹窗关闭

**预期结果列禁用词（出现即 block）：**

    应当 | 正常 | 合理 | 成功 | 符合预期 | 方便用户 | 提升体验 | 正确地 | 尝试

**注意：** 只扫描表格的第 4 列（预期结果），不扫描第 2 列（场景）。场景列中 "网络正常时"、"余额合理" 等描述是合法的前置条件，不应误报。

对每个禁用词命中，输出：文件、行号、原文、建议改写示例。

### 4.4 用例质量（warn）

- [ ] 场景列描述的前置条件为可观测状态（"已登录 HD 钱包" 而非"正常状态下"）
- [ ] 预期结果为可观测的 UI 变化（"按钮变灰不可点击" 而非"操作失败"）
- [ ] 边界值/阈值场景有独立测试点（如：最小/最大输入值、零值）
- [ ] 状态判断类（开关/权限/层级）用例先验证初始状态再操作

### 4.5 覆盖度（warn）

- [ ] P0/P1/P2 分布合理（P0 不超过总数 30%，P2 不低于 20%）
- [ ] 涵盖开/关两种状态（toggle 类功能）
- [ ] 涵盖 `docs/qa/qa-rules.md §4` 中的 9 个通用测试维度（加载/空状态/错误/刷新/跨入口/权限/多钱包类型/多链/边界值）
- [ ] 与对应的 `docs/qa/rules/<module>-rules.md` 规则条目有交叉引用或覆盖
- [ ] 多钱包类型（HD/观察/HW/多签）相关场景已按钱包类型分组

### 4.6 数据驱动（warn）

- [ ] 多输入场景（如：多条代币/网络/地址）已参数化（不是每条独立一行）
- [ ] P0 未对所有参数组合做全量测试（避免组合爆炸）
- [ ] 硬件钱包场景已简化为 6 个核心用例（不重复软件钱包所有场景）

### 4.7 文档联动（warn）

- [ ] 对应需求文档 `docs/qa/requirements/<module>-*.md` 存在
- [ ] 对应规则文档 `docs/qa/rules/<module>-rules.md` 存在且未过期
- [ ] `docs/qa/qa-rules.md` 中有对该模块的引用

---

## Phase 5：自动化脚本审查

**适用范围：** `src/tests/**/*.test.mjs` 中的变更文件。

先读取 CLAUDE.md 中的 "Test Script Rules" 章节作为评审标准。

### 5.1 脚本结构（block）

- [ ] 文件导出 `export const testCases = [{ id, name, fn }]`
- [ ] 文件导出 `export async function setup(page)`
- [ ] 文件导出 `export async function run()`
- [ ] 所有 `fn` 只接收 `page` 一个参数（不接收额外参数）
- [ ] 文件顶部有注释说明用例覆盖范围（如 `// covers: XXX-001 ~ XXX-008`）

### 5.2 用例映射（block）

- [ ] `testCase` 数量与用例文档中的大标题（一级编号）数量一致
- [ ] 每个 `testCase` 的 `id` 和 `name` 与文档标题对应
- [ ] 如文档有变更，脚本的 `id`/`name` 也已同步更新
- [ ] 一个 `testCase` 对应文档一个大标题，不拆分也不合并大标题

### 5.3 断言质量（block）

- [ ] 使用 `createStepTracker` + `safeStep`（不使用自定义步骤函数）
- [ ] 无软断言（如 `assertHasSomeTableLikeContent(page)`）
- [ ] 数值变化用精确 delta（`=== before + 1`），不用模糊比较（`!== before`）
- [ ] 多入口状态同步用例已在所有入口逐一验证
- [ ] 每个断言有明确的 passed/failed 判定（没有"检查了但标 passed"的逻辑）
- [ ] 每个 `fn` 末尾有 `return t.result()`

### 5.4 选择器健壮性（warn）

- [ ] 优先使用 `ui-map.json` / `components.mjs` / PageObject 中的选择器
- [ ] 相同定位逻辑出现 2 次以上已提取到公共库
- [ ] TMPopover-ScrollView 使用 `querySelectorAll` 遍历可见实例（不用 `querySelector`）
- [ ] 弹窗内操作定位到弹窗内部元素（不在弹窗外操作）
- [ ] 输入操作使用 `locator.pressSequentially()`（不用 `fill` 或 `keyboard.type`）

### 5.5 环境硬编码检查（block）

扫描以下硬编码类型并输出表格：

| 文件 | 行号 | 类型 | 当前值 | 风险 | 建议 |
|------|------|------|--------|------|------|
| ... | ... | 地址/金额/代币列表/账户名/长sleep | ... | ... | ... |

扫描项：
- 钱包地址（`0x` 开头 40 字节十六进制，或 Cosmos/Solana 格式）
- 固定交易金额（非测试占位符的数字，如 `amount: 100`）
- 硬编码代币列表（数组中写死的 ticker，如 `['BTC', 'ETH', 'BNB']`）
- 硬编码账户名（如 `'hl-99'`、`'测试账户1'`）
- 过长 sleep（`await sleep(N)` 且 N ≥ 3000，无轮询等待）

同时检查：变更脚本是否引用了相关的规则文档（注释中是否注明 source of truth）。
如果脚本注释中标注了数据来源（如 `// source: swap-network-features.md`），该硬编码值降级为 **info** 而非 block。

### 5.6 Dashboard 反馈（block）

- [ ] 所有操作步骤用 `safeStep` 包裹（不裸写 `await page.click(...)`）
- [ ] 步骤粒度合理（每个有意义操作独立一步）
- [ ] 步骤名称简洁描述做了什么（不是 `step1`、`操作`）
- [ ] `failed` 步骤有非空 `detail`（错误信息）
- [ ] `skipped` 步骤有非空 `detail`（跳过原因）
- [ ] `fn` 末尾 `return t.result()`

### 5.7 状态清理（warn）

- [ ] 测试间调用 `dismissOverlays(page)` 清理残留弹窗
- [ ] 不向全局状态写入（不污染其他 testCase 的前置条件）
- [ ] 截图只在失败时拍摄（`safeStep` 失败分支已配置截图，成功分支无截图）

---

## Phase 6：Skill 文件审查

**适用范围：** `.claude/skills/**` 中的变更文件。

### 6.1 格式规范（warn）

- [ ] 文件有 YAML frontmatter（`---` 包裹）
- [ ] Frontmatter 包含 `name`、`description`、`user-invocable` 字段
- [ ] `description` 中有 `Triggers on:` 说明触发词

### 6.2 触发词冲突检查（warn）

读取所有其他 Skill 的 `description` 中的 `Triggers on:` 内容，与当前变更 Skill 的触发词比对，输出重叠项：

    WARN 触发词冲突：
    当前 Skill: <name>  触发词: "<trigger>"
    已存在 Skill: <name> 也使用该触发词
    建议：修改其中一个的触发词或合并 Skill。

### 6.3 路径引用规范（warn）

扫描 Skill 正文中的文件路径引用：
- [ ] OneKey 可执行文件使用 `$ONEKEY_BIN` 环境变量，不硬编码绝对路径
- [ ] 项目目录使用相对路径，不硬编码 `/Users/<username>/...` 等绝对用户路径（info 级别）

### 6.4 规则双写一致性（warn）

如果 Skill 变更包含与 CLAUDE.md 或 `.cursorrules` 重叠的规则内容，检查两边是否一致。

---

## Phase 7：通用代码审查

**适用范围：** 所有变更文件。

### 7.1 调试代码残留（warn）

扫描：
- `console.log`（非 `stepTracker` 的 t.add 调用）—— 提示是否为调试日志
- `debugger` 语句
- 注释掉的代码块（连续 5 行以上的 `//` 注释）

输出：文件、行号、内容片段。

### 7.2 导入路径合法性（warn）

- [ ] 所有 `import` 语句的目标文件实际存在
- [ ] 无循环依赖（A 导入 B，B 导入 A）

### 7.3 文件命名规范（info）

- 测试脚本：`<module>-<feature>.test.mjs`（小写，用连字符）
- 辅助文件：`<name>.mjs`（小写）
- 文档：`YYYY-MM-DD_<Module>-<Topic>.md`（日期 + 驼峰模块名）

### 7.4 死代码（info）

- [ ] 无未使用的变量（声明后从未读取）
- [ ] 无未使用的导入（`import` 后从未引用）
- [ ] 无被注释掉且不再需要的函数定义

---

## Phase 8：生成报告 + 拦截决策

### 8.1 问题汇总表

将所有发现的问题按维度和级别汇总：

    | 维度 | security | block | warn | info | 合计 |
    |------|----------|-------|------|------|------|
    | 安全审查 | X | - | - | - | X |
    | 规则文档 | - | X | X | - | X |
    | 用例文档 | - | X | X | X | X |
    | 自动化脚本 | - | X | X | - | X |
    | Skill 文件 | - | - | X | - | X |
    | 通用代码 | - | - | X | X | X |
    | **合计** | X | X | X | X | X |

### 8.2 写入完整报告

报告路径：`shared/reports/review-YYYY-MM-DD-HHMMSS.md`（使用当前时间戳）

报告结构：

    # QA 审查报告

    **时间：** YYYY-MM-DD HH:MM:SS
    **审查范围：** <Phase 1 的范围摘要>
    **变更文件数：** N

    ## 问题统计
    <Phase 8.1 的汇总表>

    ## 详细问题列表

    ### 安全问题（security）
    <按文件:行号列出，内容脱敏>

    ### 阻断问题（block）
    <按审查维度分组，每条含文件:行号+描述+建议>

    ### 警告问题（warn）
    <同上>

    ### 信息提示（info）
    <同上>

    ## 覆盖度分析
    | 模块 | P0 | P1 | P2 | 总计 | 9维度覆盖 |
    |------|----|----|----|----|---------|
    | ... | ... | ... | ... | ... | ...% |

    ## 环境适应性问题
    | 文件 | 行号 | 类型 | 当前值 | 风险 | 建议 |
    |------|------|------|--------|------|------|
    | ... | ... | ... | ... | ... | ... |

    ## 用户确认跳过的问题
    <如有用户选择跳过的 block 问题，记录在此>

### 8.3 对话中输出精简版

只输出 security 和 block 级别的问题列表，warn/info 仅给统计数字：

    审查完成。发现 <security> 个安全问题，<block> 个阻断问题，<warn> 个警告，<info> 个提示。
    完整报告：shared/reports/review-YYYY-MM-DD-HHMMSS.md

    [如有 security/block 问题则列出详情]

### 8.4 拦截决策

根据问题级别执行对应策略：

**security > 0：**

    ⛔ SECURITY BLOCK
    发现 N 个安全问题，无法跳过。
    请修复后重新运行 /onekey-qa-review。

**block > 0（无 security）：**

    🚫 发现 N 个阻断问题：

    1. [block] <文件>:<行> — <描述>
    2. [block] <文件>:<行> — <描述>
    ...

    请选择：
    (1) 我来修复，修复后重新审查
    (2) 我确认这些问题可以跳过，继续提交

用户选择 (2) 时，记录到报告的"用户确认跳过的问题"章节，然后继续。

**只有 warn/info：**

    ✅ 审查通过（warn: N, info: N）
    可以提交。建议在下次迭代中处理警告项。

### 8.5 报告文件清理

保留最多 20 个审查报告，超出时删除最旧的：

    ls -t shared/reports/review-*.md | tail -n +21 | xargs rm -f

---

## 参考文档

- `docs/qa/qa-rules.md` — 用例规范总纲
- `docs/qa/rules/<module>-rules.md` — 各模块规则文档
- `docs/qa/requirements/` — 需求文档目录
- `.claude/CLAUDE.md` → Test Script Rules — 自动化脚本规范
- `shared/reports/` — 审查报告输出目录
- `src/tests/helpers/components.mjs` — 公共组件库（`createStepTracker`, `safeStep`）
