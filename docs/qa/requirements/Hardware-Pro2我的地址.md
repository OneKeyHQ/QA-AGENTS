# Hardware - Pro2 我的地址（My Address）

> 模块：HW & App / Pro2
> 设备版本：Pro2
> 测试端：Pro2 设备端 + App（Desktop / Mobile / Extension）
> 关联规则：`docs/qa/rules/hardware-rules.md` §14 Pro2 我的地址
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
- 隐藏（密语）钱包查看：仅可通过「Attach to PIN」绑定的 Extra PIN 解锁进入（2026-07-24 变更，原「进入网络弹 Passphrase 输入框 + 切换 Passphrase 按钮」方案废弃）
- 一期支持 20 个网络（暂不支持 Cosmos / Polkadot 子链；2026-07-24 确认移除 Alephium / Benfen / Nervos / Neo N3 / Neurai / Nexa / SCDO）

---

## 2. 功能描述

### 2.1 入口与「选择网络」页

| 字段 | 描述 |
|------|------|
| 入口路径 | 应用菜单 → 我的地址 |
| 账户选择器（顶部） | 显示当前选中 Account，默认 `Account #1`，可点击进入「选择账户」页 |
| 网络列表 | 横向滚动，主链（Bitcoin / Ethereum / Solana / Tron / TON）置前 |
| Title 开关 | 列表底部，控制账户标题展示 |
| 右上角「切换 Passphrase」 | 已移除（2026-07-24 变更）：页面不再提供任何 Passphrase 输入 / 切换入口 |

### 2.2 网络清单（20 个）

Bitcoin / Ethereum / Solana / Tron / TON / Kaspa / Sui / Dogecoin / Cardano / Ripple / Aptos / Algorand / Bitcoin Cash / Conflux / Cosmos / Filecoin / NEAR / Nostr / Polkadot / Litecoin。

一期暂不支持 Cosmos / Polkadot 的子链。2026-07-24 确认移除 7 个网络：Alephium / Benfen / Nervos / Neo N3 / Neurai / Nexa / SCDO，列表中出现视为 bug。

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

### 2.9 Passphrase 行为（2026-07-24 变更：Extra PIN 联动）

| 行为 | 规则 |
|------|------|
| 无输入弹窗 | 「我的地址」全流程不弹出 Passphrase 输入框；主 PIN 解锁时出现该弹窗视为 bug |
| 主 PIN 解锁 | 无论 Passphrase 开关开启或关闭，主 PIN 解锁后只能看到主（标准）钱包地址 |
| Extra PIN 解锁 | 仅当使用「Attach to PIN」绑定了 Passphrase 的 Extra PIN 解锁时，显示对应隐藏（密语）钱包地址 |
| 钱包切换 | 唯一方式为锁屏后改用其他 PIN 解锁；「切换 Passphrase」按钮已移除 |
| 会话一致性 | 同一解锁会话内切换网络 / 账户，钱包身份保持不变（由解锁所用 PIN 决定） |

> 历史方案（已废弃）：进入网络前弹 Passphrase 输入框、切换 Passphrase 按钮、锁屏重置重输、空值等价标准钱包。

### 2.10 助记词位数支持

| 位数 | 支持来源 |
|------|---------|
| 12 / 18 / 24 | 设备创建 / 助记词导入 |

每种位数 × 主钱包 / 隐藏钱包（Extra PIN 解锁）双验证 Account 矩阵：

| # | 来源 | 位数 | 主钱包 Account | Passphrase（绑定 Extra PIN） | 隐藏钱包 Account |
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
- 主 PIN 解锁任何路径下都不得弹出 Passphrase 输入框（弹出即 bug）；隐藏钱包地址只能经 Extra PIN 解锁可见，不能通过其他交互泄露

---

## 4. 关联资源

- 规则文档：`docs/qa/rules/hardware-rules.md` §14
- 测试用例：`docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-我的地址/`
  - `2026-05-14_Pro2-我的地址-入口与账户选择.md`（含主 PIN 解锁 Passphrase 负向验证）
  - `2026-05-14_Pro2-我的地址-地址展示与派生路径.md`（含 Extra PIN 隐藏钱包、助记词位数矩阵）
  - Attach to PIN 绑定流程见 `docs/qa/testcases/cases/hardware/HW-Pro2/Pro2-钱包/2026-05-11_Pro2-钱包-Passphrase.md`
- 跨工具核对：`https://bip39.onekey.so/index.html`

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-07-24 | Passphrase 逻辑变更：输入弹窗 / 切换按钮 / 锁屏重输 / 空值等价整体废弃，隐藏钱包仅可通过 Attach to PIN 绑定的 Extra PIN 解锁查看，主 PIN 解锁（无论开关状态）只见主钱包且禁止弹窗；网络清单 27 → 20（移除 Alephium / Benfen / Nervos / Neo N3 / Neurai / Nexa / SCDO）。用例重组：撤销《Passphrase与助记词位数》独立用例，主 PIN 负向验证并入《入口与账户选择》，Extra PIN 隐藏钱包与助记词位数矩阵并入《地址展示与派生路径》 |
| 2026-05-14 | 初始化文档，整合 Pro2 5.20.0「我的地址」改版需求：账户选择器（每页 5 个 / 数字键盘有效范围 1~10亿）、横向滚动网络列表（27 个）、派生路径独立选择页、QR Code 独立按钮、EVM 多链提示、Passphrase 会话保持与锁屏重置、12/18/24 位助记词矩阵、多语言一致性 |
