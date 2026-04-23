# Market - Preset 预设配置

> 生成时间：2026-04-22
> 规则文档：`docs/qa/rules/market-rules.md` §10
> 需求文档：`docs/qa/requirements/Market-Preset配置.md`
> 测试端：Desktop / iOS / Android / Extension / Web

## 测试范围说明

**功能范围**：Market 交易面板的 Preset（滑点 / 优先费）预设配置，含 Dashboard 总开关、档位结构（Auto / P1 / P2 / P3）、按网络差异化能力（滑点可配/不可配、优先费支持/不支持、Custom 单位）、Buy/Sell 独立配置、**按网络持久化**与切网络。

**持久化粒度**：P1 / P2 / P3 以**网络**为 Key 存储；同一网络下跨账户 / 跨重启 / 跨入口共享；切到另一网络读取该网络独立保存的配置。

**入口**：Desktop 交易面板、移动端 Market Detail Chart、Swap Pro - Market。

**网络分层**：
- Tier A（SOL / EVM）：滑点可配 + 优先费 Market/Fast/Turbo/Custom；Custom 单位 SOL=SOL、EVM=Gwei
- Tier B（SUI / TRON / APT）：滑点可配 + 优先费 Auto 只读
- Tier C（保底，Dashboard 未打开网络）：滑点 Auto 只读 + 优先费 Auto 只读

---

## 前置条件

- 已登录 HD 钱包；已在 Market 中选中可进入 Preset 弹窗的代币（SOL / EVM / SUI / TRON / APT 各一条）；Dashboard 已下发对应网络的 Preset 配置。
- 交易面板 Buy / Sell 已加载报价；Dashboard 总开关默认为 ON。
- 测试前清空 P1 / P2 / P3 的自定义配置（处于默认状态）。

---

## 1. Dashboard 总开关

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Dashboard 总开关 = OFF | 1. 进入 Market 代币详情页 Buy/Sell 面板<br>2. 查看面板内档位切换区与 Edit presets 入口 | 1. 不显示 Auto / P1 / P2 / P3 档位切换器<br>2. 不显示 Edit presets 入口 |
| ❗️❗️P0❗️❗️ | 1. Dashboard 总开关 = ON | 1. 进入 Market 代币详情页 Buy/Sell 面板<br>2. 查看面板内档位切换区与 Edit presets 入口 | 1. 显示 Auto / P1 / P2 / P3 档位切换器<br>2. 显示 Edit presets 入口<br>3. 默认选中 Auto |
| P1 | 1. Dashboard 总开关 ON → OFF（运行时下发） | 1. 在面板打开状态下刷新 / 重进入代币详情 | 1. 档位切换器与 Edit presets 入口隐藏<br>2. 不残留上次选中档位 |

---

## 2. 档位结构（Auto / P1 / P2 / P3）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 交易面板已显示 Preset 档位切换器 | 1. 查看档位切换器选项 | 1. 显示 4 个档位：Auto / P1 / P2 / P3<br>2. 默认选中 Auto<br>3. P1 / P2 / P3 均为默认态（未标记「自定义」角标） |
| ❗️❗️P0❗️❗️ | 1. Preset 档位 = Auto | 1. 点击 Edit presets 打开弹窗 | 1. 弹窗头部档位 Tab 选中 Auto<br>2. 主体显示 Smarter trade settings 文案块<br>3. 主体显示 Anti-MEV 文案块<br>4. 底部仅显示 Confirm 按钮 |
| ❗️❗️P0❗️❗️ | 1. Preset 档位 = Auto<br>2. 编辑弹窗已打开 | 1. 切换到 P1 Tab | 1. 主体切换为 P1 编辑界面<br>2. 头部二级 Tab 显示 Buy settings / Sell settings，默认 Buy settings 选中<br>3. 显示 Slippage 区域<br>4. 显示 Priority fee 区域<br>5. 底部显示 Reset + Confirm 按钮 |
| ❗️❗️P0❗️❗️ | 1. 首次进入弹窗，P1 / P2 / P3 均未修改 | 1. 切换 P1 / P2 / P3 Tab | 1. 每个档位下 Buy / Sell 的 Slippage 与 Priority fee 均等同 Auto 默认值 |
| P1 | 1. 已在 P1 Buy settings 将 Slippage 改为 Custom 0.5 并 Confirm | 1. 切换到 P1 的 Sell settings | 1. Sell settings 保持默认值（不复用 Buy settings 的修改） |
| P1 | 1. 已在 P1 Buy settings 将 Slippage 改为 Custom 0.5 并 Confirm | 1. 打开 Edit presets 弹窗<br>2. 切换到 P2 | 1. P2 的 Buy / Sell settings 仍为默认值（不受 P1 修改影响） |

---

## 3. 滑点 Slippage — 可配置网络（SOL / EVM / SUI / TRON / APT）

> 参数化网络：SOL / Ethereum / BSC / Polygon / Arbitrum / SUI / TRON / APT

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = 可配置网络<br>2. P1 → Buy settings | 1. 打开 Edit presets<br>2. 查看 Slippage 区域 | 1. 显示 Auto / Custom 二选一控件<br>2. 默认选中 Auto |
| ❗️❗️P0❗️❗️ | 1. Slippage 当前选中 Auto | 1. 切换到 Custom | 1. 显示数字百分比输入框<br>2. 显示 0.1% / 0.5% / 1% 快捷档位按钮<br>3. 输入框可聚焦编辑 |
| ❗️❗️P0❗️❗️ | 1. Slippage = Custom | 1. 点击 0.1% / 0.5% / 1% 快捷按钮 | 1. 输入框数值同步为 0.1 / 0.5 / 1<br>2. 快捷按钮高亮当前所选档位 |
| ❗️❗️P0❗️❗️ | 1. Slippage = Custom<br>2. 依次输入：空 / `0` / 负数 `-1` / 超大值 `51` / 非数字 `abc` / 特殊字符 `!@#` | 1. 在输入框逐一输入 | 1. 输入框不接受非数字字符<br>2. 触发与主交易表单 Slippage 一致的报错信息（复用现有校验与报错组件） |
| ❗️❗️P0❗️❗️ | 1. Slippage = Custom<br>2. 输入有效值（0.5） | 1. 点击 Confirm | 1. 弹窗关闭<br>2. 档位切换器 P1 标记为已自定义<br>3. 再次打开弹窗，P1 → Buy settings → Slippage = Custom（0.5） |
| P1 | 1. Slippage = Custom（0.5） | 1. 切回 Auto | 1. Custom 输入值在视觉上不再生效<br>2. 选中状态回到 Auto |
| P1 | 1. P1 已修改 Slippage 为 Custom 0.5 | 1. 点击 Reset 按钮<br>2. 查看 Slippage | 1. Slippage 回到 Auto<br>2. P1 标记从「已自定义」回到默认 |

---

## 4. 滑点 Slippage — 不可配置网络（Dashboard 标记不可配）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = Dashboard 标记 Slippage 不可配置<br>2. P1 → Buy settings | 1. 打开 Edit presets<br>2. 查看 Slippage 区域 | 1. 显示 Slippage 标签<br>2. 右侧固定显示 `Auto` 只读字样<br>3. 不显示 Auto / Custom 切换控件<br>4. 不显示数字输入框与快捷档位 |
| P1 | 同上 | 1. 点击 Slippage 区域（只读文字） | 1. 不触发任何编辑交互<br>2. 弹窗保持当前状态 |

---

## 5. 优先费 Priority fee — 支持配置网络（SOL / EVM）

> 参数化网络：Solana / Ethereum / BSC / Polygon / Arbitrum / Optimism / Base / Avalanche

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = SOL 或 EVM<br>2. P1 → Buy settings | 1. 打开 Edit presets<br>2. 查看 Priority fee 区域 | 1. 显示 Market / Fast / Turbo / Custom 四档切换<br>2. 默认选中档位与 Dashboard 下发一致 |
| ❗️❗️P0❗️❗️ | 1. Priority fee = Market / Fast / Turbo 任一档 | 1. 查看档位展示形态 | 1. 不显示用户输入框<br>2. 档位按钮可切换但不可输入 |
| ❗️❗️P0❗️❗️ | 1. Priority fee 切换到 Custom（网络=SOL） | 1. 查看 Custom 档展示 | 1. 显示数字输入框<br>2. 输入框右侧单位 = `SOL`<br>3. 输入框可聚焦编辑 |
| ❗️❗️P0❗️❗️ | 1. Priority fee 切换到 Custom（网络=EVM，如 Ethereum） | 1. 查看 Custom 档展示 | 1. 显示数字输入框<br>2. 输入框右侧单位 = `Gwei`<br>3. 输入框可聚焦编辑 |
| ❗️❗️P0❗️❗️ | 1. Priority fee = Custom<br>2. 依次输入：空 / `0` / 负数 `-1` / 非数字 `abc` / 特殊字符 `!@#` | 1. 在输入框逐一输入 | 1. 输入框不接受非数字字符<br>2. 空值 / 0 / 负数时给出对应报错或禁用 Confirm（与主交易表单 Priority fee 校验一致） |
| ❗️❗️P0❗️❗️ | 1. Priority fee = Custom<br>2. 输入有效数值 | 1. 点击 Confirm | 1. 弹窗关闭<br>2. P1 标记为已自定义<br>3. 再次打开 P1 → Buy settings，Priority fee = Custom 且数值保留 |
| ❗️❗️P0❗️❗️ | 1. Priority fee = Market / Fast / Turbo | 1. 提交 Swap 交易 | 1. 提交时使用 App 交易确认页当前网络的实时估算数值<br>2. 不使用上一次缓存值 |
| P1 | 1. P1 已配置 Priority fee = Custom 5 Gwei（EVM） | 1. 点击 Reset | 1. Priority fee 回到默认档位<br>2. Custom 输入值清空 |

---

## 6. 优先费 Priority fee — 不支持配置网络（SUI / TRON / APT）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = SUI / TRON / APT<br>2. P1 → Buy settings | 1. 打开 Edit presets<br>2. 查看 Priority fee 区域 | 1. 显示 Priority fee 标签<br>2. 右侧固定显示 `Auto` 只读字样<br>3. 不显示 Market / Fast / Turbo / Custom 档位<br>4. 不显示输入框与单位 |
| P1 | 同上 | 1. 点击 Priority fee 区域 | 1. 不触发任何编辑交互 |

---

## 7. 保底配置（Dashboard 未打开网络）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = Dashboard 未打开网络 | 1. 打开 Edit presets<br>2. 查看 P1 / P2 / P3 任一档位 | 1. Slippage = `Auto` 只读<br>2. Priority fee = `Auto` 只读<br>3. 不显示 Auto/Custom 切换、四档切换、任何输入框<br>4. 底部仅显示 `OK` 按钮（不显示 Reset / Confirm） |
| ❗️❗️P0❗️❗️ | 同上 | 1. 点击 OK 按钮 | 1. 弹窗关闭<br>2. 档位不标记为自定义<br>3. 下次打开弹窗状态一致 |

---

## 8. Custom 单位按网络动态显示

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = Solana<br>2. Priority fee = Custom | 1. 查看输入框单位 | 1. 单位文字 = `SOL` |
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = Ethereum / BSC / Polygon / Arbitrum / Optimism / Base / Avalanche 任一<br>2. Priority fee = Custom | 1. 查看输入框单位 | 1. 单位文字 = `Gwei` |
| ❗️❗️P0❗️❗️ | 1. 当前代币网络 = 非 SOL / EVM / SUI / TRON / APT 的 Dashboard 已打开网络<br>2. Priority fee = Custom | 1. 查看输入框单位 | 1. 单位文字 = 该网络在 App 交易确认页当前展示的单位<br>2. 与交易确认页单位一致 |
| P1 | 1. Priority fee = Custom<br>2. 切换到其他网络的代币详情后重进入弹窗 | 1. 再次查看 Priority fee → Custom 单位 | 1. 单位按新网络刷新<br>2. 不沿用上一网络单位 |

---

## 9. Buy / Sell settings 独立性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. P1 档位，已在 Buy settings 修改 Slippage = 0.5、Priority fee = Custom 5 Gwei | 1. 切换到 Sell settings Tab | 1. Sell settings 下 Slippage = Auto<br>2. Sell settings 下 Priority fee = 默认档位<br>3. 不复用 Buy settings 的修改 |
| ❗️❗️P0❗️❗️ | 1. Buy 与 Sell 均已修改并 Confirm<br>2. 档位 = P1 | 1. 交易面板切换买卖方向（Buy → Sell） | 1. 当前档位显示的 Slippage / Priority fee 来自 Sell settings<br>2. 切回 Buy 方向时显示 Buy settings 的值 |
| P1 | 1. 档位 = P1，仅 Sell settings 被修改 | 1. 点击 Reset（在 Sell settings Tab） | 1. Sell settings 回到默认<br>2. Buy settings 不受影响 |

---

## 10. 持久化（按网络）与切网络

> **持久化粒度**：P1 / P2 / P3 的自定义配置以**网络**为 Key 存储；同一网络下跨账户 / 跨重启 / 跨入口共享；切到另一网络时读取该网络独立保存的配置。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前网络 = Solana<br>2. P1 / P2 / P3 在 Solana 下均已自定义（Slippage + Priority fee + Buy/Sell） | 1. 杀进程或重启 App<br>2. 重新进入 Market 同一 Solana 代币详情 | 1. 档位切换器默认选中与关闭前一致<br>2. 打开弹窗，P1 / P2 / P3 的 Buy / Sell 配置保留 |
| ❗️❗️P0❗️❗️ | 1. 账户 A 在 Solana 将 P1 Buy Slippage 改为 Custom 0.5、Priority fee Custom 0.01 SOL 并 Confirm | 1. 切换到账户 B（同设备，已登录）<br>2. 进入 Solana 代币详情<br>3. 打开 P1 Edit presets | 1. P1 → Buy settings → Slippage = Custom 0.5<br>2. P1 → Buy settings → Priority fee = Custom 0.01 SOL<br>3. 账户 B 读取的是 Solana 网络同一份配置 |
| ❗️❗️P0❗️❗️ | 1. 当前网络 = Solana（P1 已配置 Custom）<br>2. Ethereum 下 P1 从未被配置 | 1. 切换到 Ethereum 代币详情<br>2. 打开 P1 Edit presets | 1. P1 → Buy / Sell 均为默认值（等同 Auto）<br>2. 档位切换器 P1 不标记为已自定义<br>3. 不复用 Solana 的 P1 自定义 |
| ❗️❗️P0❗️❗️ | 1. Ethereum 的 P1 Priority fee = Custom 5 Gwei（Tier A，Gwei 单位）<br>2. Solana 的 P1 Priority fee = Custom 0.01 SOL（Tier A，SOL 单位） | 1. 在 Ethereum 与 Solana 代币详情之间来回切换 | 1. Ethereum 下 P1 单位 = Gwei、值 = 5<br>2. Solana 下 P1 单位 = SOL、值 = 0.01<br>3. 数值与单位互不污染 |
| ❗️❗️P0❗️❗️ | 1. Solana 下 P1 已配置 Priority fee = Custom 0.01 SOL | 1. 切换到 SUI 代币详情（Tier B，Priority fee 不支持） | 1. P1 Slippage 按 SUI 能力渲染（可配）<br>2. P1 Priority fee 区域退回 `Auto` 只读<br>3. Solana 侧已存的 Custom 值**不被删除**（切回 Solana 时仍可见 0.01 SOL） |
| ❗️❗️P0❗️❗️ | 1. Solana 下 P1 已配置完整自定义（Slippage + Priority fee） | 1. 切换到 Dashboard 未打开网络（Tier C） | 1. Slippage 与 Priority fee 均退回 `Auto` 只读<br>2. 底部按钮仅显示 OK<br>3. 切回 Solana 时，P1 仍显示已保存的自定义值 |
| ❗️❗️P0❗️❗️ | 1. Ethereum 下 P1 已配置 Custom Slippage 0.5 | 1. 同账户下打开以下入口并查看 P1：<br>- Desktop 交易面板<br>- 移动端 Market Detail<br>- Swap Pro - Market | 1. 三个入口下 Ethereum 的 P1 Buy Slippage 均 = Custom 0.5<br>2. 任一入口修改并 Confirm 后，其他入口打开时即时同步（同一网络共享一份） |
| P1 | 1. 同一网络（Ethereum）下 P1 已自定义<br>2. 在 Ethereum 下点击 Reset | 1. 点击当前档位的 Reset | 1. Ethereum 下 P1 回到默认值<br>2. Solana 等其他网络下的 P1 自定义不受影响 |

---

## 11. 入口覆盖（三入口一致性）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Desktop 端，同一网络（Ethereum）<br>2. P1 已配置 Slippage = Custom 0.5 | 1. 从 Desktop 交易面板打开 Edit presets<br>2. 关闭后从同一网络另一 Ethereum 代币的 Swap Pro - Market 面板打开 Edit presets | 1. P1 → Buy settings Slippage 均显示 Custom 0.5<br>2. 两个入口的弹窗字段与能力渲染一致<br>3. 按网络持久化生效：同网络跨代币 / 跨入口共享 |
| ❗️❗️P0❗️❗️ | 1. 移动端 Market Detail Chart 面板 | 1. 逐一打开 Auto / P1 / P2 / P3 弹窗<br>2. 对比 Desktop / Swap Pro 入口 | 1. 档位结构一致（Auto / P1 / P2 / P3）<br>2. Buy / Sell 二级 Tab 一致<br>3. 滑点与优先费区域按同一网络能力渲染 |
| P1 | 1. Extension / Web 入口 | 1. 进入 Swap Pro - Market 打开 Edit presets | 1. 功能覆盖与 Desktop 一致<br>2. 窗口尺寸较小的端下弹窗布局自适应，所有字段显示且未被截断<br>3. Slippage 输入框可聚焦<br>4. Priority fee 档位按钮可点击切换 |

---

## 12. 异常与容错

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| P1 | 1. Dashboard 配置拉取失败（网络异常） | 1. 进入代币详情打开 Edit presets | 1. 按保底配置渲染（Slippage Auto 只读 + Priority fee Auto 只读 + OK 按钮）<br>2. 不显示弹出异常对话框阻塞交易主流程 |
| P1 | 1. 非 SOL / EVM 的 Custom 单位从交易确认页读取<br>2. 交易确认页估算尚未就绪 | 1. 打开 Edit presets<br>2. 切换 Priority fee 到 Custom | 1. 单位占位符显示 loading 或回退为 `Auto`<br>2. 估算就绪后单位刷新为实际值 |
| P1 | 1. 弹窗打开时，Dashboard 配置被后台更新 | 1. 关闭弹窗后再次打开 | 1. Slippage / Priority fee 的可用档位与能力标记按 Dashboard 下发的最新配置展示<br>2. 已自定义的 P1 / P2 / P3 在能力仍然允许时保留；能力收紧时（例如从 Tier A 收紧到 Tier B）Priority fee 显示为 `Auto` 只读 |
| P2 | 1. Slippage Custom 输入框聚焦状态下切换档位 Tab（P1 → P2） | 1. 在输入中途切换 Tab | 1. 未 Confirm 的输入不保存<br>2. 切回 P1 后恢复切换前的已保存值 |

---

## 产品体验建议（QA 视角）

> 以下建议基于测试体验，非功能缺陷，供产品/设计参考。

### 易用性
- 【建议】P1 / P2 / P3 被自定义后，在档位切换器上加视觉角标（如小圆点）并在弹窗内标注「已自定义」，便于用户快速辨识哪些档位已被自己修改。
- 【建议】Tier B（SUI / TRON / APT）下 Priority fee 只读 `Auto` 的右侧可加一个问号 Tooltip，解释「该网络当前不支持自定义优先费」，避免用户误以为是 UI Bug。

### 操作效率
- 【建议】Priority fee 的 Market / Fast / Turbo 档位可同时展示该档的实时估算数值（而非仅文字标签），帮助用户在不进入确认页前就对比档位差异。

### 信息层级
- 【建议】Custom 单位在 SOL / Gwei 固定单位网络可直接硬编码展示，在其他网络走交易确认页动态读取；当读取未就绪时统一用占位符避免出现单位缺失的视觉跳动。

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-22 | 初版：Market Preset 预设配置，覆盖 Dashboard 总开关 / 档位结构 / 滑点可配与不可配 / 优先费支持与不支持 / Custom 单位分网络 / 保底配置 / Buy 与 Sell 独立 / 持久化切网络 / 三入口一致性 / 异常容错 |
| 2026-04-22 | 明确持久化粒度 = 按网络：§10 补充跨账户共享、跨网络独立存储、跨 Tier 能力降级不删除存储值、Reset 仅影响当前网络；§11 入口一致性改为「同网络跨代币 / 跨入口共享」 |
| 2026-04-22 | QA Review 修复：§2 场景写明「P1 Buy Slippage Custom 0.5 并 Confirm」；§11 将「可操作」改为可观测表述；§12 Dashboard 更新后预期改为字段与档位展示口径 |
