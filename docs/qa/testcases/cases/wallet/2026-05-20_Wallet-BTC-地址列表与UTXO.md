# BTC 地址列表与 Coins (UTXO)

> 需求文档：`docs/qa/requirements/Wallet-BTC多地址与UTXO.md`
> 规则文档：`docs/qa/rules/wallet-rules.md` §11 BTC 多地址 / Address List / Coins (UTXO)
> 关联用例：`docs/qa/testcases/cases/wallet/2026-05-20_Wallet-BTC新鲜与找零地址.md`、`docs/qa/testcases/cases/wallet/2026-05-20_Wallet-BTC选币功能.md`
> PR 参考：app-monorepo [#11716](https://github.com/OneKeyHQ/app-monorepo/pull/11716)
> Jira：[OK-54985](https://onekeyhq.atlassian.net/browse/OK-54985)（Address list）/ [OK-54986](https://onekeyhq.atlassian.net/browse/OK-54986)（Coins UTXO）
> 测试端：iOS / Android / Desktop / Extension
> 变更说明：首版——覆盖 More 菜单两个新入口 Address list（Receive/找零 tab + 「下一个」标签 + 分页 已使用列表 + 派生路径切换器）与 Coins (UTXO)（UTXO 列表 + 4 种排序 + Change 徽标 + 只读模式）

---

## 前置条件与测试数据

1. 已导入含历史交易记录的 BTC 助记词钱包（推荐使用 `music strategy danger page blood lumber tongue trust clump rose rely saddle`），同时持有 **接收**方向多个已用地址 + **找零**方向多个找零输出 + 多个未花费 UTXO（至少 10+ 条以覆盖分页）
2. 已在 `设置 - 钱包 - BTC 多地址模式` 开启多地址（`enableBTCFreshAddress = true`）
3. 已创建 4 种 BTC 派生路径地址：Taproot（默认）/ Native SegWit / Nested SegWit / Legacy
4. 至少 1 笔未确认（pending）+ 1 笔已确认的 UTXO（用于验证 pending 标识）
5. 当前账户为 HD（已备份），同时准备 BTC 观察账户 / 私钥账户 / Keyless Wallet 用于验证入口可见性
6. 区块浏览器（mempool.space / blockstream.info）用于比对地址/UTXO 数据

---

## 1. 入口可见性与导航

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | HD 钱包 + 多地址开启 → 入口可见 | BTC HD 账户 → 钱包首页 → 点击 More（…）按钮 | 菜单中**同时**出现两个新入口：**Address list** + **Coins (UTXO)**，图标分别为列表 / 加密币图标 |
| ❗️❗️P0❗️❗️ | 多地址关闭 → 仅隐藏 Address list | 1. 在设置中关闭「BTC 多地址模式」<br>2. 重新打开 More 菜单 | 1. **不展示** Address list 入口<br>2. **仍展示** Coins (UTXO) 入口（UTXO 浏览不依赖多地址，关闭后仍可查 UTXO 明细） |
| P1 | 非 UTXO 链 → 入口隐藏 | 将网络切换到 ETH / SOL / Cosmos 等非 UTXO 链 → 打开 More 菜单 | **不展示** Address list / Coins (UTXO)（仅 BTC 系链支持） |
| ❗️❗️P0❗️❗️ | 观察账户 → 入口隐藏 | 切换到 BTC 观察账户 → 打开 More 菜单 | 不展示两个入口（观察账户无私钥派生能力） |
| P1 | 私钥账户 → 入口隐藏 | 切换到 BTC 私钥导入账户 → 打开 More 菜单 | 不展示两个入口（私钥账户无 xpub）|
| P1 | 进入 Address list | More 菜单点击「Address list」 | 弹出 Address list 模态，默认选中接收 tab |
| P1 | 进入 Coins (UTXO) | More 菜单点击「Coins (UTXO)」 | 弹出 Coins (UTXO) 模态，默认排序「最新」 |
| P2 | 关闭按钮回到首页 | Address list / Coins 模态左上角点击 ×（关闭） | 模态关闭，回到钱包首页，无残留 toast |

---

## 2. Address List — 接收 tab

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 「下一个」卡片展示 | 打开 Address list → 接收 tab | 顶部独立卡片展示**下一个新鲜接收地址**：「下一个」徽标 + 缩略地址 + 复制按钮 |
| ❗️❗️P0❗️❗️ | 已使用区域 | 同上 | 区域标题 **「已使用 · N」**（N = 已用接收地址总数）；每行展示：缩略地址 + 累计接收金额（BTC，8 位小数）+ 复制按钮 |
| ❗️❗️P0❗️❗️ | 分页（每页 7 条） | 已使用总数 > 7 | 显示分页器；每页 7 条；总数 ≤ 7 时不显示分页器 |
| ❗️❗️P0❗️❗️ | 复制「下一个」新鲜地址 | 点击「下一个」卡片复制按钮 | 复制成功；HW 钱包额外跳转设备核对 |
| ❗️❗️P0❗️❗️ | 点击「下一个」卡片整行 | 点击「下一个」卡片（非复制按钮区域） | 同上 |
| P1 | 复制已使用地址 — 复制按钮 | 点击已使用列表某一行的复制按钮 | 复制成功；不跳转 HW 核对 |
| P1 | 复制已使用地址 — 整行 | 点击已使用列表某一行（非复制按钮区域） | 同上 |
| P1 | 切页 | 点击下一页 | 列表刷新为下一页 7 条；总数 N 不变；不重新生成「下一个」地址 |
| P1 | 已使用列表为空 | 全新账户无任何已用接收地址 | 「下一个」卡片正常展示；已使用区域显示空态（「无结果」） |
| P2 | 「下一个」与已使用列表均为空 | 极端场景（账户初始化中） | 「下一个」行显示 `—`；已使用区域显示空态 |

---

## 3. Address List — 找零 tab

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 切换到找零 tab | 点击顶部「找零」 | tab 切换；「下一个」卡片与已使用列表刷新为**找零方向**数据 |
| ❗️❗️P0❗️❗️ | 找零 tab「下一个」点击仅复制 | 点击「下一个」卡片任意区域 | 复制成功；**不**跳转 HW 核对（找零地址无需向外展示） |
| P1 | 找零 tab 已使用列表 | 查看每行 | 字段与接收 tab 一致：缩略地址 + 累计接收 + 复制按钮 |
| P1 | 接收 / 找零页码独立 | 接收 tab 翻到第 2 页 → 切到找零 tab → 切回接收 tab | 接收 tab 仍在第 2 页 |
| P1 | 切换账户或派生路径页码重置 | 在 Address list 中切换派生路径 / 账户 | 接收 / 找零两侧页码都重置为第 1 页 |
| P2 | 找零方向无数据 | 账户从未发起转账 | 「下一个」行与已使用列表均显示空态 |

---

## 4. Address List — 派生路径切换器

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 切换器可见 | 已创建多个 BTC 路径地址时打开 Address list | 标题栏右上角显示当前路径名 + 下拉（如 `Taproot ▽`） |
| ❗️❗️P0❗️❗️ | 切换 4 种路径 | 选择 Native SegWit / Nested SegWit / Legacy / Taproot | 接收 + 找零两 tab 数据全部刷新为选定路径；不关闭模态；地址前缀正确（`bc1q` / `3` / `1` / `bc1p`） |
| P1 | 仅单一路径时无切换器 | 账户仅创建 Taproot 路径 | 右上角不显示切换器 |
| P1 | 切换路径后页码重置 | 接收 tab 翻到第 3 页 → 切换路径 | 页码回到第 1 页 |

---

## 5. Coins (UTXO) 模态 — 字段与排序

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 顶部总额 | 打开 Coins (UTXO) | 顶部大字号展示总余额 = 所有 UTXO 金额之和（BTC，8 位小数） |
| ❗️❗️P0❗️❗️ | 列表字段 | 查看每行 | 序号 + 金额 + 缩略地址 + 时间（`YYYY/MM/DD, HH:mm:ss`） |
| P1 | 只读模式 | 查看每行 | 不展示 Checkbox；整行不可勾选 |
| ❗️❗️P0❗️❗️ | Change 徽标 | 找零方向 UTXO | 该行展示「Change」徽标 |
| ❗️❗️P0❗️❗️ | 默认排序 | 打开 Coins | 默认「最新」，列表按区块高度降序 |
| P1 | 切换排序 | 选择「最旧」/「最小」/「最大」 | 列表按对应规则排序（区块高度升序 / 金额升序 / 金额降序）；序号重新计数 |
| P1 | 排序下拉选项 | 点击排序下拉 | 4 个选项：最新 / 最旧 / 最小 / 最大；当前项打勾 |
| P1 | 派生路径切换器 | 同 Address list | 切换后 UTXO 列表刷新为该路径数据 |
| P1 | Pending UTXO | UTXO 未确认（`confirmations = 0`） | 时间字段显示「Pending」 |
| P1 | 空列表 | 账户无 UTXO | 顶部总额 `0 BTC`；列表为空态 |
| P2 | 总额与列表金额一致 | 顶部总额 vs 列表合计 | 完全相等 |

---

## 6. Coins (UTXO) — 派生路径与跨入口

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 与发送页选币功能数据一致 | 打开 Coins → 关闭 → 发送页进入「选币功能」 | UTXO 集合（地址、金额、时间、Change 徽标）完全一致；选币功能额外有 Checkbox 与「完成」按钮 |
| ❗️❗️P0❗️❗️ | 与区块浏览器对账 | 区块浏览器查询同账户 UTXO | 数量 + 金额 + txid 与 Coins 弹窗一致 |
| P1 | Change 徽标准确性 | 带 Change 徽标的 UTXO → 区块浏览器查 path | 派生路径倒数第二位 = `1`；无 Change 徽标的 = `0` |
| P1 | 切换派生路径 | 切换路径 | 列表 + 总额刷新为该路径数据 |

---

## 7. 边界与异常

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 加载中 | 首次拉取数据 | 显示 Spinner |
| P1 | 接口失败兜底 | 网络断开或后端 5xx | 空态显示「无结果」；不崩溃；重新打开可重试 |
| P1 | 大列表性能 | UTXO > 100 条 | 滚动流畅；分页正常 |
| P2 | 多语言 | 切换 zh-CN / ja / de / fr | 界面文案按当前语言展示 |
| P2 | 关闭后再打开状态重置 | 切到找零 tab + 第 2 页 → 关闭 → 重新打开 | Tab 默认接收；页码回到 1 |
