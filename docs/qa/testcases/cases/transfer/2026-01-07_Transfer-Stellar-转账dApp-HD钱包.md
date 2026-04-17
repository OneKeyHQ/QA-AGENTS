# Transfer - Stellar - 转账/dApp-HD钱包

> 规则文档：`docs/qa/rules/transfer-chain-rules.md` §「Stellar (XLM)」
> 关联用例：`docs/qa/testcases/cases/transfer/2026-01-07_Transfer-Stellar-转账dApp-HW钱包.md`
> 测试端：iOS / Android / Desktop / Extension / Web（以产品支持为准）
> 测试范围：XLM 原生（新账户 / 老账户）、Stellar Asset / Contract Token 添加与转账、账户保留金与 Trustline、dApp（aqua.network）连接与 Swap、私钥导出、余额展示
> Memo：最大 28 字节；纯数字推断为 `MEMO_ID`，含字符为 `MEMO_TEXT`
> Token 列表参考：https://raw.githubusercontent.com/soroswap/token-list/main/tokenList.json

## 前置条件与测试数据

1. 已导入 HD 钱包（测试助记词），Stellar 账户余额 ≥ 10 XLM
2. 链上**已存在**的老账户地址、链上**不存在**的新账户地址各一
3. 常用 Asset Token：`USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`；Contract Token 示例：`CDPV3H7C3MR2R4Y4GAEJN4AXXY4LBITRRVE74VSMVCSBWISIU3Q4QTMW`

---

## 1. Stellar Asset Token 添加

**通用操作步骤**：进入 Token 添加页 → 输入 `Code:Issuer` → 添加 / 激活 → 确认签名（若需）→ 观察列表与余额。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | USDC Asset 激活（余额 ≥ 1.5 XLM） | 输入 `USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` → 添加 / 激活 → 签名 | 1. 识别为 Stellar Asset，提示需激活 Trustline<br>2. 链上交易扣 Gas，锁定 0.5 XLM<br>3. 列表展示 `Code:Issuer`，余额可查（精度 7 位） |
| ❗️❗️P0❗️❗️ | USDC Asset 激活（余额 < 1.5 XLM） | 同上，账户仅保留不足 1.5 XLM 可用 | 1. 提示余额不足（需保留约 1 XLM + 0.5 XLM 激活）<br>2. 无法发起激活 |
| P1 | 已激活过的 USDC | 输入已激活的同一 Asset | 1. 识别已激活，无需再签激活<br>2. 列表正常展示 |
| P1 | Issuer 错误 | 输入 `Code` + 错误 Issuer | 1. 提示 Issuer 无效或格式错误<br>2. 无法添加 |

---

## 2. Contract Token 添加

**通用操作步骤**：进入 Token 添加页 → 输入合约地址 → 添加 → 观察识别结果与列表。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 纯 Contract Token | 输入 `CDPV3H7C3MR2R4Y4GAEJN4AXXY4LBITRRVE74VSMVCSBWISIU3Q4QTMW` | 1. 识别为 Contract Token<br>2. 无需 Trustline 激活提示<br>3. 按合约 Token 入库，余额可查 |
| ❗️❗️P0❗️❗️ | Asset 包装合约地址 | 输入 Asset 包装类 `C...` 合约 | 1. 识别为 Asset 包装<br>2. 最终以 `Code:Issuer` 形态落库，遵循 Asset 规则（需 Trustline 时走激活） |
| P1 | 非法格式 | 输入纯数字 / 乱码 | 格式错误提示，无法添加 |
| P1 | 已添加的合约 | 输入已在列表的地址 | 「已添加」提示，不重复 |

---

## 3. XLM 原生转账 - 新账户（Create Account）

> 向链上不存在地址首笔须 ≥ **1 XLM**。成功后的历史字段口径本节首行写全，后续仅写差异。

**通用操作步骤**：进入转账页 → 输入新地址 → 输入金额 → 确认签名 → 至成功后打开历史详情核对。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 新账户，金额 = 1 XLM（最小创建） | 新地址；金额 `1` XLM；确认签名 | 1. 走 createAccount<br>2. 发送方扣 1 XLM + Gas；接收方创建且余额 1 XLM<br>3. 至成功：loading/UI 无异常<br>4. 历史详情：类型 = 发送；网络 = Stellar；金额与 Gas 与确认页一致；对方地址 = 新地址；无 Memo 或与输入一致；状态成功；哈希可复制、可跳转 Stellar 浏览器 |
| ❗️❗️P0❗️❗️ | 新账户，金额 = 0.9 XLM | 新地址；`0.9` XLM；尝试确认 | 1. 提示须 ≥ 1 XLM<br>2. 无法提交 |
| ❗️❗️P0❗️❗️ | 新账户，Max | 新地址；点 Max；确认签名 | 1. Max = 余额 − 1 XLM − Gas（口径与产品一致）<br>2. 成功后保留约 1 XLM<br>3. 历史详情：**同上**（上表首行第 4 点），**金额 / 扣款**与 Max 一致 |
| P1 | 新账户，中间值（如 10 XLM） | 新地址；`10` XLM；确认签名 | 1. 上链成功，扣款 = 输入 + Gas<br>2. 历史详情：**同上**，**金额**与输入一致 |

---

## 4. XLM 原生转账 - 老账户（Payment）

> 历史字段口径与 **「新账户，金额 = 1 XLM（最小创建）」** 首行一致；本节首行写全 payment 场景，后续 **同上**。

**通用操作步骤**：转账页 → 已存在地址 → 金额 → 确认签名 → 历史详情核对。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 老账户，最小金额 0.0000001 XLM | 已存在地址；`0.0000001`；签名 | 1. payment 上链<br>2. 扣款 = 输入 + Gas<br>3. 至成功 loading/UI 正常<br>4. 历史详情：同「新账户，金额 = 1 XLM（最小创建）」首行第 4 点口径；**业务**为普通转账；**金额** = 0.0000001 XLM（+ Gas 展示一致） |
| ❗️❗️P0❗️❗️ | 老账户，Max | 已存在地址；Max；签名 | 1. Max = 余额 − 1 XLM − Gas<br>2. 成功后保留约 1 XLM<br>3. 历史详情：**同上**（本节首行第 4 点），**金额**与 Max 一致 |
| P1 | 老账户，中间值（如 10 XLM） | 已存在地址；`10` XLM；签名 | 1. 上链成功<br>2. 历史详情：**同上**，**金额** = 10 XLM + Gas |

---

## 5. Memo

> CEX 充值（Binance / OKX）须带正确 Memo。

**通用操作步骤**：转账页 → 地址与 Memo → 确认签名 → 必要时链上 / 历史核对 Memo 类型。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 纯数字 Memo + CEX 地址 | CEX 充值地址；Memo `123456`；签名 | 1. 推断为 `MEMO_ID`<br>2. 上链后类型为 `MEMO_ID`<br>3. 历史详情：Memo 展示与类型一致；其余字段口径 **同上**（「老账户，最小金额 0.0000001 XLM」首行第 4 点） |
| ❗️❗️P0❗️❗️ | 含字符 Memo | 普通地址；Memo `test123`；签名 | 1. 推断为 `MEMO_TEXT`<br>2. 链上为 `MEMO_TEXT`<br>3. 历史详情：**同上**，Memo 为文本 |
| P1 | Memo 为空 | 普通地址；不填 Memo；签名 | 1. 上链成功<br>2. 链上无 Memo；历史无 Memo 或与产品空态一致 |
| P2 | Memo 超过 28 字节 | 输入超长 Memo；尝试确认 | 1. 提示长度限制<br>2. 无法提交 |

---

## 6. Stellar Asset Token 转账

**通用操作步骤**：Token 转账页 → 选 Asset → 地址与金额 → 签名 → 历史核对。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 收款方已激活，最小金额 | 已激活收款地址；最小金额；签名 | 1. 上链成功，Token 扣减（7 位精度）<br>2. 至成功 loading/UI 正常<br>3. 历史详情：类型 = Token 发送；代币 = 所选 Asset；金额与精度正确；网络 Stellar；对方地址；状态成功；哈希可跳转 |
| ❗️❗️P0❗️❗️ | 收款方已激活，Token Max | 已激活地址；Token Max；签名 | 1. Max = Token 全额<br>2. 成功后 Token 归零；XLM 仍满足 1 XLM + 锁定<br>3. 历史详情：**同上**（本节首行第 3 点），**金额** = 转出总量 |
| ❗️❗️P0❗️❗️ | 收款方未激活该 Asset | 未激活地址；任意金额；尝试确认 | 1. 提示对方未激活 Trustline<br>2. 无法提交或交易失败 |
| P1 | 收款方已激活，中间值 | 已激活地址；中间金额；签名 | 1. 上链成功<br>2. 历史详情：**同上**，**金额**与输入一致 |

---

## 7. Contract Token 转账

**通用操作步骤**：Token 转账页 → 选 Contract Token → 地址与金额 → 签名 → 历史核对。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 任意收款地址，最小金额 | 选 Contract；任意 `G...`；最小额；签名 | 1. 上链成功（无需对方 Trustline）<br>2. 扣减与 Resource Fee 与确认页一致<br>3. 历史详情：类型 = 合约 Token 发送；合约 / 符号展示正确；金额；手续费；哈希可跳转 |
| ❗️❗️P0❗️❗️ | Contract Token Max | 选 Contract；Max；签名 | 1. Max = Token 余额<br>2. 上链成功，Gas 足够<br>3. 历史详情：**同上**（本节首行第 3 点） |
| P1 | XLM 不足以付 Resource Fee | XLM 极低；选 Contract 尝试发送 | 1. Gas 不足提示<br>2. 无法提交 |

---

## 8. 账户最低余额与可用余额展示

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 可用不足（保留金拦截） | 余额约 1.5 XLM；尝试转出 0.6 XLM | 1. 提示须保留约 1 XLM 基础保留<br>2. 无法提交 |
| ❗️❗️P0❗️❗️ | 多 Asset 锁定展示 | 余额 10 XLM；已激活 5 个 Asset | 资产详情：总余额 10 XLM；锁定约 2.5 XLM（5×0.5）；可用 ≈ 10 − 1 − 2.5 |
| P1 | 仅 1 XLM 时激活 Asset | 余额 1 XLM；尝试激活新 Asset | 1. 余额不足提示<br>2. 无法激活 |

---

## 9. Trustline 激活流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 未激活 Asset，余额充足 | 添加未激活 Asset → 激活 → 签名 | 1. 链上扣 Gas<br>2. 锁定 0.5 XLM<br>3. Token 已激活，余额可查 |
| P1 | 已激活再次激活 | 对已激活 Token 再点激活 | 1. 识别已激活<br>2. 不重复签链上、不重复占锁定 |

---

## 10. dApp 连接（aqua.network）

> 协议：Hana Wallet；站点：aqua.network

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 首次连接 | 打开站点 → 连接钱包 → 选 Hana Wallet → App 内确认 | 1. OneKey 弹出连接请求<br>2. 确认后站点已连接，地址与钱包一致 |
| P1 | 拒绝连接 | 连接流程中点拒绝 | 1. 站点未连接<br>2. 可再次发起 |

---

## 11. dApp Swap（aqua.network）

**通用操作步骤**：站点已连接 → 选交易对 → 金额 → 确认 → App 签名 → 查余额与历史。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Swap 成功 | 选币对 → 输入数量 → 确认 → OneKey 签名 | 1. 确认页：From/To、金额、Gas 正确<br>2. 提交上链成功<br>3. 源 Token 减少、目标 Token 增加<br>4. 历史详情：Swap / 合约交互类记录与链上一致（类型、代币、金额、网络、哈希可跳转） |
| P1 | 拒绝签名 | 站点发起 Swap → App 拒绝 | 1. 未上链、余额不变<br>2. 站点提示取消或失败 |

---

## 12. 私钥导出与验证

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 导出私钥 | 账户设置 → 导出私钥 → 密码 / 生物识别 | 1. 私钥可查看（掩码 / 复制）<br>2. 格式 `S` 开头约 56 字符 |
| ❗️❗️P0❗️❗️ | Stellar Lab 验地址 | Lab mainnet 用私钥推导地址 | 推导地址与 OneKey `G...` 一致 |
| P1 | 密码错误 | 导出私钥时输错密码 | 提示错误，不可查看 |

---

## 13. 余额查询与刷新

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 多 Token 一致性 | 资产列表 ↔ Token 详情对照 | 1. 列表与详情余额一致<br>2. XLM / Asset 7 位；Contract 按链上精度<br>3. 刷新及时 |
| P1 | 转账后刷新 | 完成一笔转账 → 回列表 | 1. 余额更新<br>2. 与 Horizon（或等价接口）一致 |
