# Market - Preset 预设配置 需求文档

> 模块：Market（Swap Pro Mode / 交易面板）
> 功能：Market 交易面板的 Preset（滑点 / 优先费）预设配置
> 版本：
> 测试端：Desktop / iOS / Android / Extension / Web

---

## 需求背景

不同网络（公链）对滑点与优先费的支持程度不同，现有交易面板中 Preset 档位对所有网络使用同一套配置，无法按网络差异化地提供正确的能力集合（如 EVM 需要 Gwei 单位、SOL 需要 SOL 单位、SUI/TRON/APT 不支持优先费等）。

本次改造通过后台 Dashboard 下发按网络的 Preset 能力清单，由前端按网络能力渲染 Preset 编辑弹窗与交易面板档位切换区。

入口涵盖三个：
- Desktop 交易面板（Market 列表 → Detail → Chart 旁的 Buy/Sell 面板）
- 移动端 Market Detail Chart 下方 Buy/Sell 面板
- Swap Pro - Market 页面右侧 Buy/Sell 面板

---

## 功能描述

### 1. Dashboard 总开关与网络清单

- 提供**总开关**，控制是否向交易面板提供 Preset 入口
- 提供**按网络的配置列表**，逐个网络显式打开
  - 未打开的网络：**维持线上默认**（走保底配置）
  - 已打开的网络：按 Dashboard 下发的能力配置渲染

### 2. 档位结构

- Preset 档位共 4 个：**Auto / P1 / P2 / P3**
  - Auto：默认档位，展示智能推荐说明（Smarter trade settings / Anti-MEV）
  - P1 / P2 / P3：3 个可配置档位，用户修改前均**使用默认设置**（等同 Auto）
- 每个可配置档位（P1 / P2 / P3）内部再分 **Buy settings** 与 **Sell settings** 两套互相独立的配置
- 编辑弹窗底部提供：可配置档位显示 **Reset + Confirm**；Auto / 保底档位仅显示 **Confirm** 或 **OK**

### 3. 滑点（Slippage）配置能力

| 网络能力 | 交互 | 展示 |
|--------|------|------|
| 可配置 | 支持 Auto ↔ Custom 切换，Custom 支持数字百分比输入 + 0.1% / 0.5% / 1% 快捷档位 | 复用现有 Slippage 输入组件与报错信息（过高 / 过低 / 非法） |
| 不可配置 | 仅展示，不可切换 | 结果显示为 **Auto** |

### 4. 优先费（Priority Fee）配置能力

| 网络能力 | 档位 | 说明 |
|--------|------|------|
| 不支持配置 | — | 展示为 **Auto**，不可更改 |
| 支持配置 | **Market / Fast / Turbo / Custom** | 前三档由 App 交易确认页当前网络的实时估算数据提交，用户不可输入；Custom 档允许用户手动输入数值 |

### 5. 优先费自定义单位（按网络差异）

| 网络 | Custom 单位 |
|------|-----------|
| Solana | SOL |
| EVM（Ethereum / BSC / Polygon / Arbitrum / Optimism / Base / Avalanche …） | Gwei |
| SUI / TRON / APT | 不支持 Custom（Priority fee 固定 Auto） |
| 其他支持 Custom 的网络 | 按 **App 交易确认页当前网络的单位** 读取并展示 |

### 6. 保底配置（未打开网络 / 默认回退）

- Slippage：Auto 只读
- Priority fee：Auto 只读
- 底部按钮仅显示 **OK**，不出现 Reset / Confirm

---

## UI 规格

### 图示来源

- 入口位置：Desktop 交易面板、Market Detail Chart 面板、Swap Pro - Market 面板
- 编辑弹窗：`Edit presets`，头部档位切换 `Auto / P1 / P2 / P3`
- 档位 = Auto：展示 `Smarter trade settings` 与 `Anti-MEV` 文案块，底部 `Confirm`
- 档位 = P1 / P2 / P3：
  - 头部二级切换 `Buy settings` / `Sell settings`
  - `Slippage` 区域：Auto / Custom 二选一
  - `Priority fee` 区域：Market / Fast / Turbo / Custom 四选一
  - 底部 `Reset` + `Confirm`
- 保底弹窗：`Slippage = Auto`，`Priority fee = Auto`，底部仅 `OK`

---

## 业务规则

| 规则 | 描述 |
|------|------|
| 总开关 OFF | 交易面板不展示 Preset 入口（档位切换器与 Edit presets 入口均隐藏） |
| 档位默认值 | 用户未修改前，P1 / P2 / P3 的 Buy / Sell 均等同 Auto 的默认值 |
| Buy / Sell 独立 | 同一 Preset 档位下，Buy 与 Sell 配置互不影响 |
| 网络切换 | 切换到新网络后，Preset 弹窗按新网络的能力重新渲染（Slippage 或 Priority fee 可能退回 Auto 只读） |
| 持久化 | P1 / P2 / P3 的用户自定义配置**按网络**持久化：同一网络下跨账户 / 跨重启 / 跨入口共享；切换到另一网络时读取该网络独立保存的配置 |
| Reset | 点击 Reset 后恢复当前档位到默认值（等同 Auto），不影响其他档位 |
| 实时估算 | Market / Fast / Turbo 三档展示的数值来自 App 交易确认页当前网络的实时 Gas / Fee 估算，不由用户输入 |
| 单位动态 | Custom 单位随网络变化；EVM=Gwei，SOL=SOL，其他按交易确认页单位读取 |
| Dashboard 未打开 | 走保底（Slippage Auto + Priority fee Auto 只读） |

---

## 已知风险

- **单位错配风险**：EVM / SOL 以外网络的 Custom 单位取自交易确认页，若交易确认页尚未加载或该网络未接入 Gas 估算能力，需 fallback 到 Auto 或给出明确提示
- **档位默认值与 Auto 一致性**：用户未修改前 P1 / P2 / P3 显示内容需与 Auto 完全一致，避免误导
- **Dashboard 配置刷新时效**：Dashboard 配置变更后，前端拉取时机（冷启动 / 切网络 / 强刷）需要明确
- **Buy / Sell 隔离**：修改 Sell settings 不应污染 Buy settings，反之亦然
- **按网络持久化边界**：同一网络下的自定义在不同账户间共享，需确认是否符合产品隐私口径；切网络时需按新网络能力重新校验已存配置的合法性（如原 Custom 档在新网络不支持则回退展示 Auto）

---

## 关联资源

- 规则文档：`docs/qa/rules/market-rules.md` §13
- 规则文档（Confirm Page V2 关联）：`docs/qa/rules/market-rules.md` §9
- 入口 1（Desktop 交易面板）：Market → 代币详情 → Chart + 右侧交易面板
- 入口 2（移动端 Market Detail）：Market → 代币详情 → Chart 下方 Buy/Sell
- 入口 3（Swap Pro - Market）：Swap → Pro mode → Market

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-22 | 初版：Market Preset 预设配置，覆盖 Dashboard 总开关 / 档位结构 / 滑点配置 / 优先费配置 / Custom 单位 / 保底配置 |
| 2026-04-22 | 明确持久化口径为「按网络持久化」（同一网络跨账户 / 跨重启 / 跨入口共享） |
