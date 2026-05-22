# Wallet - BTC 多地址 / Address List / Coins (UTXO)

> 模块：Wallet
> App 版本：v6.3.0
> 测试端：iOS / Android / Desktop / Extension
> 关联 PR：`https://github.com/OneKeyHQ/app-monorepo/pull/11716`
> Jira：
> - [OK-54985](https://onekeyhq.atlassian.net/browse/OK-54985) — Address list 模态
> - [OK-54986](https://onekeyhq.atlassian.net/browse/OK-54986) — Coins (UTXO) 模态

---

## 1. 需求背景

BTC 钱包默认基于固定首地址收发，存在两个问题：
1. **隐私层面**：所有接收资金集中在同一地址，外部可关联用户全部资产
2. **找零层面**：转账找零回流到固定地址，进一步暴露用户身份与持仓

v6.3.0 引入 **BTC 多地址模式**：每笔接收 / 找零都由钱包派生**新鲜地址**，使外部地址无法轻易关联到同一账户。同时在 BTC 资产 More 菜单中提供两个**只读浏览**入口：
- **Address list** — 浏览当前账户全部 Receive / Change 方向地址
- **Coins (UTXO)** — 浏览当前账户全部未花费 UTXO

发送时 BTC 仍可进入「选币功能（Coin Control）」手动选择 UTXO，沿用既有交互。

---

## 2. 功能描述

### 2.1 多地址模式开关

| 项 | 规则 |
|---|---|
| 开关位置 | `设置 - 钱包 - BTC 多地址模式` |
| 控制开关 | `enableBTCFreshAddress`（`useSettingsPersistAtom`，**本端本地存储**） |
| 默认值（老用户升级到 v6.3.0） | **默认关闭**，保持升级前的固定单地址行为 |
| 默认值（全新安装） | **默认开启** |
| 同步范围 | **单端独立**：桌面端 / 插件端 / 移动端各自独立，**不**通过 OneKey ID / iCloud / Prime 跨端同步 |
| 不支持账户类型 | 观察账户、私钥账户、Keyless Wallet（均无 xpub 派生能力，开关对其不生效；More 菜单不展示 Address list / Coins 入口） |

### 2.2 开启多地址 — UI 与行为

| 入口 | 行为 |
|---|---|
| 接收页 | 顶部 Banner：「每笔交易都会生成新地址」；地址栏展示**下一个新鲜接收地址**；QR Code 同步 |
| 代币详情页 | **隐藏「我的地址」栏**（避免与多地址语义冲突） |
| 钱包选择器 - 管理账户 | 仍展示**账户层级固定地址**（不受多地址影响） |
| 转账后 | 接收页地址**本地立即刷新**到下一个新鲜地址，无需等待链上确认；不同端短暂不一致属预期 |
| 找零 | 触发找零时生成**新的找零地址**（path 倒数第二位 = `1`） |
| 总余额 | 仅含前 **20 个找零地址合计**；超过部分通过 Address List 查看 |
| More 菜单新增入口 | **Address list** + **Coins (UTXO)**（仅 BTC HD 且开关开启时可见） |

### 2.3 关闭多地址 — UI 与行为

| 入口 | 行为 |
|---|---|
| 接收页 | 不显示 Address List 入口提示；展示账户**固定首地址** |
| 代币详情页 | 恢复显示「我的地址」栏 |
| More 菜单 | **不展示** Address list 入口；**仍展示** Coins (UTXO) 入口（UTXO 浏览与多地址功能无关） |
| 转账找零 | 找零回流到**原固定地址**，不再生成新地址 |
| 历史地址联想 | 关闭后仍可搜索到历史新鲜/找零地址（联想数据保留，仅"生成新地址"逻辑停止） |

---

## 3. Address List 模态（OK-54985）

### 3.1 基本规则

| 项 | 规则 |
|---|---|
| 入口 | 钱包首页 More（…）→ Address list |
| 可见性条件 | 仅 BTC 系链 + HD 钱包 + 多地址开启（`enableBTCFreshAddress=true`）三者同时满足；关闭多地址后该入口隐藏 |
| 视图模式 | **只读浏览**；不提供选择代入 |
| 路由 | `EModalReceiveRoutes.BtcAddresses` |
| Tab | 顶部 SegmentControl：**Receive / Change**，默认 Receive |
| 服务端方法 | `serviceFreshAddress.getBtcNextFreshAddress` / `getBtcNextChangeAddress` / `getBtcUsedAddressesByPage` / `getBtcChangeAddressesByPage` |

### 3.2 Next 卡片

| 项 | 规则 |
|---|---|
| 样式 | 独立带边框卡片 |
| 徽标 | 左侧蓝色 Info「Next」徽标 |
| 地址 | 中间缩略地址（前 8 后 6） |
| 复制按钮 | 右侧 IconButton |
| 行点击（Receive Tab） | HD 钱包：直接复制；HW 钱包：跳转设备核对流程 |
| 行点击（Change Tab） | 仅复制（找零地址不向外展示，不向硬件请求显示） |

### 3.3 USED 区域

| 项 | 规则 |
|---|---|
| 区域标题 | `USED · <数量>`（N = 该方向已用地址总数）|
| 分页大小 | **7 条 / 页**（固定） |
| 列字段 | 缩略地址 + TOTAL RECEIVED（BTC，最多 8 位小数） + 复制按钮 |
| 行点击 | 仅复制完整地址，不触发硬件设备显示 |
| 分页器 | 总数 > 7 时显示；≤ 7 不显示 |
| Receive / Change 页码独立 | 切 Tab 时各自页码状态保留；切派生路径后页码重置 |

### 3.4 派生路径切换器

| 项 | 规则 |
|---|---|
| 位置 | 模态标题栏右上角 |
| 出现条件 | 已创建多个 BIP44 / 49 / 84 / 86 路径地址 |
| 选项 | Native SegWit（`bc1q`）/ Nested SegWit（`3`）/ Legacy（`1`）/ Taproot（`bc1p`） |
| 切换行为 | 不关闭模态；Receive + Change Tab 数据全部刷新；页码重置 |
| 仅单路径时 | 不显示切换器 |

### 3.5 空状态 / 加载中 / 关闭

| 场景 | 行为 |
|---|---|
| Next 数据为空 | 显示 `—` |
| Used 列表为空 | 显示 QuestionMark 插图 + 「No results」+ 描述 |
| 初次拉取 | 显示 Spinner |
| 关闭模态后再打开 | Tab 与页码重置为默认（Receive Tab / 第 1 页），不持久化 |

---

## 4. Coins (UTXO) 模态（OK-54986）

### 4.1 基本规则

| 项 | 规则 |
|---|---|
| 入口 | 钱包首页 More（…）→ Coins (UTXO) |
| 可见性条件 | 仅与「网络为 BTC 系链」「账户为 HD 钱包」相关；**与多地址开关无关**——开启或关闭多地址均展示入口 |
| 视图模式 | **只读浏览**；不展示 Checkbox |
| 路由 | `EModalReceiveRoutes.BtcCoins` |
| 数据源 | `serviceAccountProfile.getAccountUtxos`（与 Send → Coin Control 数据一致） |
| 列表组件 | 复用 `UTXOListItem`，传入 `readOnly` 属性 |

### 4.2 字段展示

| 字段 | 来源 / 格式 |
|---|---|
| 顶部总额 | 所有 UTXO `value` 之和；BTC，最多 8 位小数 |
| 行 - 序号 | 按当前排序的次序（1, 2, 3...） |
| 行 - 金额 | `value` 转 BTC（`shiftedBy(-decimals)`） + 单位 BTC |
| 行 - 地址 | 缩略地址（前 8 后 6） |
| 行 - 时间 | `formatDate(new Date(blockTime))` 或「Pending」（`confirmations === 0`）或 `-` |
| Change 徽标 | `isChangeUtxoPath(path)` 为真时展示（path 倒数第二位 = `1`） |

### 4.3 排序

| 选项 | 行为 | 来源 |
|---|---|---|
| 最新（默认） | 按 `height` 降序 | `EUtxoSortType.NewestFirst` |
| 最旧 | 按 `height` 升序 | `EUtxoSortType.OldestFirst` |
| 最小 | 按 `value` 升序 | `EUtxoSortType.SmallestFirst` |
| 最大 | 按 `value` 降序 | `EUtxoSortType.LargestFirst` |

### 4.4 派生路径切换器

同 Address list — 多路径时可切换，UTXO 列表按选定路径刷新。

---

## 5. 选币功能（Coin Control）

> Coin Control 是发送 BTC 的子流程，本 PR 仅做了组件抽离（`UTXOListItem.tsx` 抽离 + 复用），核心交互不变。

### 5.1 基本规则

| 项 | 规则 |
|---|---|
| 入口 | 发送页 → BTC → 输入金额 → 「选币」/「选币功能」/「Coin Control」按钮 |
| 视图模式 | **可勾选 + 代入**；每行带 Checkbox |
| 列表组件 | 复用 `UTXOListItem`，不传 `readOnly` |
| 默认策略 | **最小化手续费（Minimize fees）** |
| 备选策略 | 合并硬币（Merge coins） |
| 默认排序 | 最新 |
| 选币算法 | 以官方实现为准（`EUtxoSelectionStrategy`）|

### 5.2 策略说明

| 策略 | 文案 |
|---|---|
| 最小化手续费（Minimize fees） | 使用更少的币以减小交易体积并降低网络费用 |
| 合并硬币（Merge coins） | 立即合并小额币，以免日后手续费更高 |
| 了解更多 | 跳转 OneKey 帮助中心 |

### 5.3 勾选与代入

| 项 | 规则 |
|---|---|
| 自动勾选 | 进入模态时按当前策略自动勾选满足转账金额的 UTXO |
| 策略切换 | 重置为新策略下的系统默认勾选，**覆盖**用户手动调整 |
| 排序切换 | 仅影响展示顺序，不改变勾选状态（按 `txid:vout` 标识） |
| 勾选状态统计 | 底部「已选择 N」+ 「X BTC」实时更新 |
| 完成按钮 | 已选金额 < 转账金额时置灰；≥ 时高亮 |
| 完成代入 | 关闭模态；勾选的 UTXO 作为转账输入 |
| 持久化 | 完成代入后再次进入模态保留上次选择 |

---

## 6. dApp / Swap 单一地址连接

| 场景 | 规则 |
|---|---|
| 触发条件 | 多地址模式开启状态下，连接仅支持单一地址的 BTC dApp（如 `https://dapp-example.onekeytest.com/btcUnitsat`） |
| iOS / Android / Desktop | 弹出提示弹窗：**「仅支持单一地址」**，两个按钮：取消 / 切换 |
| 插件端 | 仅显示提示文案，**不弹窗**；具体连接行为以产品实现为准 |
| 「取消」 | 关闭弹窗；dApp 保持未连接；多地址开关不变 |
| 「切换」 | **仅关闭当前端**的多地址模式；其他端不同步；dApp 以单一固定地址连接 |
| Swap | 多地址关闭后正常询价提交交易；多地址开启时的 Swap 行为以实现为准（btcUnitsat 类拦截，常规 Swap 不受影响） |

---

## 7. 用例覆盖参考

| 用例文件 | 覆盖内容 |
|---|---|
| `docs/qa/testcases/cases/wallet/2026-05-20_Wallet-BTC新鲜与找零地址.md` | §1 ~ §3 / §6（开关 + 多地址 UI + 转账行为 + 关闭恢复） |
| `docs/qa/testcases/cases/wallet/2026-05-20_Wallet-BTC-地址列表与UTXO.md` | §3 + §4（Address list + Coins UTXO 字段、Tab、分页、派生路径切换器） |
| `docs/qa/testcases/cases/wallet/2026-05-20_Wallet-BTC选币功能.md` | §5（选币策略 + 排序 + 勾选 + 代入） |

关联规则文档：`docs/qa/rules/wallet-rules.md` §11

---

## 8. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-05-20 | v1 | 首版，整合 PR #11716（OK-54985 + OK-54986）需求：BTC 多地址开关 + Address List + Coins (UTXO) + 选币策略 + dApp 单地址连接拦截 |
