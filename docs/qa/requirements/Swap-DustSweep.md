# Swap - Dust Sweep 小额代币批量兑换

## 基本信息

| 项目 | 内容 |
|------|------|
| 模块 | Swap |
| 功能名称 | Dust Sweep（小额代币批量兑换） |
| App 版本 | |
| 测试端 | iOS / Android / Desktop（设计交付）；Extension / Web 同构则抽样 |

## 背景

钱包用户长期积累大量小额代币（dust），逐个 Swap 操作繁琐，多数用户放任不管，资产页观感差。

## 产品方案

### 入口（仅钱包，不放 Trade）

- 钱包页 More 菜单新增「Dust Sweep」，一次性标签 `NEW`，用户点击后消失
- 资产列表小额资产折叠行提供快捷入口

### Token 选择页

- **网络**：移动端下拉；桌面端按该网络下可清扫余额降序平铺 pills（链图标 + 余额）
- **档位**：`<$1` / `<$10` / `<$100`，默认 `<$10`，记忆上次选择
- **默认不进列表**：Ethereum 主网估值 `< $0.1`；其他所有网络 `< $0.01`
- **隐藏代币提示行**（列表底部）：主文案 `N hidden tokens under $X` + 副行 `Gas fees likely exceed their value` + 右侧 `Add anyway`；金额跟随当前链门槛。点击后所有低于门槛的代币一次性加入列表尾部，提示行消失。单向、本页不可撤销，反悔 = 退出重进。两端同构
- **排除**：链 gas token 本身、LP / 协议衍生仓位；风险币（未验证 / 可疑）默认不勾选并置灰
- **列表行**：现有 Token 组件，ticker + 全名双行 + 数量/USD；Select all 默认全选可选项
- **滑点**：入口为 Slippage 行；交互复用 Review order（移动=底部二级 sheet + 数字键盘 / 桌面=行锚 popover）。预设 `5%` / `10%` / `20%`（默认 `5%`），仅一个 Confirm；`>50%` 报错沿用 Review order 错误态；关闭不保存
- **空态**：当前链无可清扫资产时，列表区展示空态（No small balances on X / 建议换网络或档位），Convert 不可点击

### 执行进度页

- 点 Convert 直接开始执行并进入进度页；布局与选择页 1:1 连续（筛选 / Select all 置灰、checkbox 原位变状态图标）
- 移动端标题下副文本：`Converting N of M…`；暂停态 `Paused at N of M`。桌面端进度在右卡常驻，不加该副文案
- 行状态：等待（时钟）/ 暂停（⏸，仅停住的当前一笔）/ 进行中（转圈）/ 完成（绿勾）/ 失败（红叉，点击展示原因）
- `You receive` 随每笔完成实时累加；进度行展示源币堆叠（1~3 个自适应）→ 目标币 + 计数
- 转换方向圆圈（移动 ↓ / 桌面 →）执行中流动动画，完成后静止；跟随系统「减弱动态效果」降级；主按钮内不放 spinner
- **页面内暂停**：点 Stop 后停止后续未执行项（进行中一笔等落定），停住的一笔图标变暂停，主按钮变 Continue
- **执行中返回**：弹 `Leave Dust Sweep?`；离开后进度不持久化，剩余项不再执行，已完成的已在链上；重进需重新选币

### 跳过判定

凡现有单笔 Swap Review Order 需要用户二次确认的情形，批量执行时一律默认跳过。原因能确定则对号入座，不能确定用通用兜底：

| 文案 | 含义 |
|------|------|
| `Price impact exceeds slippage — skipped` | 滑点不足 |
| `High value drop — skipped` | Value drop 过高 |
| `No quote from provider — skipped` | OKX 无报价 |
| `Insufficient balance for network fee — skipped` | gas 余额不足 |
| `Transaction failed on-chain` | 链上执行失败，**不是**跳过 |
| `Unknown error — try a manual swap` | 未知错误兜底，建议去单笔 Swap |

### 完成态（分端）

全部落定后停留本页。

- **移动端**：底部结果弹层（到账金额 + Converted/Skipped 计数）。`View details` 收起弹层回页面看逐行明细。`Sweep again` 返回选择页刷新列表
- **桌面端**：无弹层。右卡顶部 `You receive` 由结果块替代（绿勾 + Dust swept + 到账金额），下接 Converted 计数，主按钮变 `Sweep again`
- 有跳过时计数写 `6/7 (1 skipped)`，括号单行跟随计数，不写 `7/7`
- 交易明细不做行内展开，去 History 查看各笔与 hash

### 后端 / 配置

- 渠道暂时统一 **OKX**，费率沿用现有 OKX 通道
- **目标币固定为链 gas token，不支持切换**
- 复用单笔 Swap 管线 + 客户端串行队列；无链上批量合约；无进度持久化

## 关联文档

- 设计稿：https://www.figma.com/design/S2GLhYwpGWI9Z5BFXvbPgX/-Swap?node-id=25872-53083
- `docs/qa/rules/swap-rules.md` §3.6
- `docs/qa/rules/wallet-rules.md` §2.3
- `docs/qa/testcases/cases/swap/2026-10-16_Swap-DustSweep小币种批量兑换.md`

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-10-16 | 初始版本：Dust Sweep 入口、选择、执行、跳过、完成态 |
