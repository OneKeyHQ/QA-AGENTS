# Hardware - Pro2 我的地址（My Address）

> 模块：HW & App / Pro2
> 设备版本：Pro2
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension）
> 关联规则：`docs/qa/rules/hardware-rules.md` §13 Pro2 我的地址
> 关联用例目录：`docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-我的地址/`

---

## 1. 需求背景

Pro2「我的地址」是设备端的地址展示与核对功能，允许用户在不连接 App 的情况下直接在设备上查看任意账户、任意网络的接收地址，便于打印 / 抄录 / 二维码扫描收款。

5.20.0 改版后新增 / 调整以下能力：

- 入口与「选择网络」页布局升级（账户选择器置顶 + 网络横向滚动列表 + Title 开关）
- Account 选择器升级（每页 5 个 + 数字键盘输入跳转 + 有效范围 `1 ~ 1,000,000,000`）
- 派生路径独立选择页（BTC：Nested Segwit / Taproot / Native Segwit / Legacy；ETH / SOL / LTC 各自路径）
- QR Code 独立按钮 + 网络 icon
- EVM 多链地址提示卡片
- Passphrase 钱包入口 + 切换 Passphrase 按钮 + 同会话保持 + 锁屏重置
- 一期支持 27 个网络（暂不支持 Cosmos / Polkadot 子链）

---

## 2. 功能描述

### 2.1 入口与「选择网络」页

| 字段 | 描述 |
|------|------|
| 入口路径 | 应用菜单 → 我的地址 |
| 账户选择器（顶部） | 显示当前选中 Account，默认 `Account #1`，可点击进入「选择账户」页 |
| 网络列表 | 横向滚动，主链（Bitcoin / Ethereum / Solana / Tron / TON）置前 |
| Title 开关 | 列表底部，控制账户标题展示 |
| 右上角「切换 Passphrase」 | 仅在 Passphrase 启用时显示 |

### 2.2 网络清单（27 个）

Bitcoin / Ethereum / Solana / Tron / TON / Kaspa / Sui / Dogecoin / Cardano / Ripple / Aptos / Alephium / Algorand / Benfen / Bitcoin Cash / Conflux / Cosmos / Filecoin / Litecoin / NEAR / Nervos / Neo N3 / Neurai / Nexa / Nostr / Polkadot / SCDO。

一期暂不支持 Cosmos / Polkadot 的子链。

### 2.3 账户选择器

| 行为 | 规则 |
|------|------|
| 默认选中 | 首次进入 / 重新进入 / 退出回归默认值均为 `Account #1` |
| 每页展示数 | 5 个 Account |
| 翻页按钮 | 「上一页」「下一页」；首页前翻置灰 / 尾页后翻置灰 |
| 再次进入保留 | 同一会话内再次进入「选择账户」页保留上次选中 Account 与所在页 |
| 退出 / 锁屏 | 退出「我的地址」或锁屏后再进入回归 `Account #1` |

### 2.4 Go To Account 数字键盘

| 行为 | 规则 |
|------|------|
| 入口 | 「选择账户」页右上角「前往账户」按钮 |
| 键盘布局 | 数字 0-9 + `X`（退出）+ `✓`（提交） |
| 有效范围 | `1 ~ 1,000,000,000`（闭区间） |
| 非法输入 | `0` / `> 1,000,000,000` 提交后清空输入并提示「输入格式错误」 |
| 边界翻页置灰 | `1` → 「上一页」置灰；`1,000,000,000` → 「下一页」置灰 |

### 2.5 地址详情页

| 字段 | 显示规则 |
|------|---------|
| 顶部标题 | `<Network> Address` |
| 派生路径标签 | 仅 BTC / ETH / SOL / LTC 显示 |
| Account 标识 | 显示当前选中 Account |
| 地址 | 分段显示 |
| EVM 多链提示卡 | 仅 Ethereum（及其他 EVM 兼容链）显示 |
| QR Code 按钮 | 底部固定按钮，点击弹出全屏二维码 |

### 2.6 派生路径

| 链 | 可选派生路径 |
|----|-------------|
| BTC | Nested Segwit / Taproot / Native Segwit / Legacy |
| ETH | BIP44 Standard 及该链支持的其他路径 |
| SOL | Ledger Live 及该链支持的其他路径 |
| LTC | OneKey Extended 及该链支持的其他路径 |
| 其他链 | 不显示派生路径切换入口 |

### 2.7 二维码

| 行为 | 规则 |
|------|------|
| 入口 | 地址详情页底部 QR Code 按钮 |
| 中央 icon | 对应网络的品牌图标 |
| 扫码一致性 | 扫描解析地址与设备屏幕显示地址逐字符一致 |
| 关闭 | 右上角 `X` 关闭，返回地址详情页 |

### 2.8 BTC 新鲜地址

| 行为 | 规则 |
|------|------|
| 入口 | Bitcoin 地址详情页 |
| 输入编号 | 输入指定编号跳转对应新鲜地址 |
| 派生路径覆盖 | 4 种 BTC 派生路径均支持 |
| 跨工具核对 | 与 `https://bip39.onekey.so/index.html` 输入相同助记词 + 编号 + 路径生成的地址一致 |

### 2.9 Passphrase 行为

| 行为 | 规则 |
|------|------|
| 启用后首次进入网络 | 弹出 Passphrase 输入弹窗 |
| 同会话保持 | 切换网络不再弹出输入框 |
| 锁屏重置 | 锁屏 + 解锁后进入会话状态重置，需重新输入 |
| 切换 Passphrase 入口 | 「选择网络」页右上角按钮 |
| 空值等价 | Passphrase 输入为空时等价标准钱包 Account 同号地址 |
| 关闭开关后 | 「我的地址」直接进入「选择网络」页，右上角无切换 Passphrase 按钮 |

### 2.10 助记词位数支持

| 位数 | 支持来源 |
|------|---------|
| 12 / 18 / 24 | 设备创建 / 助记词导入 |

每种位数 × 标准 / Passphrase 钱包 双验证 Account 矩阵：

| # | 来源 | 位数 | 标准 Account | Passphrase | Passphrase Account |
|---|------|------|------------|-----------|--------------------|
| M1 | 导入 | 18 | #188 | `onekey` | #188 |
| M2 | 导入 | 24 | #2024 | `12345` | #2024 |
| M3 | 创建 | 12 | #12 | `12` | #12 |
| M4 | 创建 | 18 | #18 | `18` | #18 |
| M5 | 创建 | 24 | #24 | `24` | #24 |

### 2.11 多语言支持

支持 English / 简体中文 / 繁體中文 / 日本語 / 한국어 / Español / Português (Brasil)；语言切换不影响地址字符内容与二维码解析结果。

---

## 3. 已知风险 / 历史缺陷

- 一期暂不支持 Cosmos / Polkadot 子链，需在用例中显式校验入口不展示
- 数字键盘超限值 / 0 值需有清空 + 提示双重反馈，避免输入留存
- Passphrase 会话状态保持的边界：锁屏后必须重置，不能因切换网络等浅交互意外重置

---

## 4. 关联资源

- 规则文档：`docs/qa/rules/hardware-rules.md` §13
- 测试用例：`docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-我的地址/`
  - `2026-05-14_Pro2-我的地址-入口与账户选择.md`
  - `2026-05-14_Pro2-我的地址-地址展示与派生路径.md`
  - `2026-05-14_Pro2-我的地址-Passphrase与助记词位数.md`
- 跨工具核对：`https://bip39.onekey.so/index.html`

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-05-14 | 初始化文档，整合 Pro2 5.20.0「我的地址」改版需求：账户选择器（每页 5 个 / 数字键盘有效范围 1~10亿）、横向滚动网络列表（27 个）、派生路径独立选择页、QR Code 独立按钮、EVM 多链提示、Passphrase 会话保持与锁屏重置、12/18/24 位助记词矩阵、多语言一致性 |
