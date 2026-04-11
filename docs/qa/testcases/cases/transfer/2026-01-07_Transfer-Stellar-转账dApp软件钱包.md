# Stellar - 转账/dApp 软件钱包

> 规则文档：`docs/qa/rules/transfer-chain-rules.md`
> 测试端：iOS / Android / Desktop / Extension / Web
> 测试目标：验证 Stellar 链在软件钱包下的基础转账、Token 管理、dApp 连接、私钥导出等功能
> 测试范围：XLM 原生转账（新账户创建 vs 老账户转账）、Stellar Asset Token 转账与激活、Contract Token 转账、Token 添加与搜索逻辑、账户激活与保证金机制、dApp 连接与 Swap、私钥导出与验证
> Memo 规则：Stellar 链 Memo 最大长度为 28 字节，纯数字自动推断为 MEMO_ID，含字符则为 MEMO_TEXT
> Token 合约地址查询：https://raw.githubusercontent.com/soroswap/token-list/main/tokenList.json

---

## 前置条件

1. 已导入测试助记词钱包，Stellar 账户余额 ≥ 10 XLM
2. 已准备一个链上已存在的老账户地址和一个链上不存在的新账户地址

---

## 1. Token 管理与添加

### 1.1 Stellar Asset Token 添加

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Token：`USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`<br>2. 账户余额 ≥ 1.5 XLM | 1. 进入 Token 添加页面<br>2. 输入 Asset Code:Asset Issuer 格式<br>3. 点击添加/激活<br>4. 确认交易并签名 | 1. 识别为 Stellar Asset Token，显示需激活 Trustline 提示<br>2. 发起链上交易（扣 Gas），占用 0.5 XLM 锁定额度<br>3. Token 显示在列表中，格式为 Code:Issuer<br>4. 余额可查询（精度 7 位） |
| ❗️❗️P0❗️❗️ | 1. Token：`USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`<br>2. 账户余额 < 1.5 XLM | 1. 进入 Token 添加页面<br>2. 输入 Asset Code:Asset Issuer 格式<br>3. 点击添加/激活 | 1. 提示余额不足（需保留 1 XLM + 0.5 XLM 激活费用）<br>2. 无法发起激活交易 |
| P1 | 该 Token 已激活过 | 1. 进入 Token 添加页面<br>2. 输入已激活的 Token<br>3. 点击添加 | 1. 识别为已激活状态，直接显示，无需再次激活<br>2. Token 显示在列表中 |
| P1 | 输入错误的 Issuer 地址 | 1. 进入 Token 添加页面<br>2. 输入 Code:错误的 Issuer<br>3. 点击添加 | 1. 提示 Issuer 地址格式错误或无效<br>2. 无法添加 |

### 1.2 Contract Token 添加

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | Token：`CDPV3H7C3MR2R4Y4GAEJN4AXXY4LBITRRVE74VSMVCSBWISIU3Q4QTMW`（Contract Token） | 1. 进入 Token 添加页面<br>2. 输入 `C...` 开头合约地址<br>3. 点击添加 | 1. 识别为 Contract Token<br>2. 显示无需激活提示<br>3. 按合约 Token 保存，余额可查询 |
| ❗️❗️P0❗️❗️ | Token：`C...` 开头合约地址（Asset 包装类型） | 1. 进入 Token 添加页面<br>2. 输入 Asset 包装的合约地址<br>3. 点击添加 | 1. 自动判断为 Asset 包装<br>2. 最终按 `Code:Issuer` 保存，遵循 Asset Token 规则（需激活） |
| P1 | 输入无效格式（纯数字 / 特殊字符） | 1. 进入 Token 添加页面<br>2. 输入无效格式<br>3. 点击添加 | 显示格式错误提示，无法添加 |
| P1 | 输入已添加的 Token 地址 | 1. 进入 Token 添加页面<br>2. 输入已存在的 Token 地址<br>3. 点击添加 | 显示"已添加"提示，不重复添加 |

---

## 2. XLM 原生转账

### 2.1 向新账户转账（Create Account）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 收款地址：链上不存在的新地址<br>2. 金额 = 1 XLM（最小值） | 1. 进入转账页面<br>2. 输入新地址<br>3. 输入 1 XLM<br>4. 确认并签名 | 1. 自动调用 createAccount<br>2. 发送方扣除 1 XLM + Gas，接收方账户创建，余额 1 XLM<br>3. 交易记录生成 |
| ❗️❗️P0❗️❗️ | 1. 收款地址：链上不存在的新地址<br>2. 金额 = 0.9 XLM（< 最小值） | 1. 进入转账页面<br>2. 输入新地址<br>3. 输入 0.9 XLM<br>4. 尝试确认 | 1. 提示金额不足（必须 ≥ 1 XLM）<br>2. 无法提交交易 |
| ❗️❗️P0❗️❗️ | 1. 收款地址：链上不存在的新地址<br>2. 金额 = Max | 1. 进入转账页面<br>2. 输入新地址<br>3. 点击 Max 按钮<br>4. 确认并签名 | 1. Max 金额 = 余额 − 1 XLM − Gas<br>2. 交易后账户余额保留 1 XLM |
| P1 | 1. 收款地址：链上不存在的新地址<br>2. 金额 = 中间值（如 10 XLM） | 1. 进入转账页面<br>2. 输入新地址<br>3. 输入 10 XLM<br>4. 确认并签名 | 1. 交易上链，余额扣除与输入金额 + Gas 一致<br>2. 交易记录生成 |

### 2.2 向老账户转账（Payment）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 收款地址：链上已存在的地址<br>2. 金额 = 最小值 0.0000001 XLM | 1. 进入转账页面<br>2. 输入已存在地址<br>3. 输入 0.0000001<br>4. 确认并签名 | 1. 调用 payment，交易上链<br>2. 余额扣除与输入金额 + Gas 一致 |
| ❗️❗️P0❗️❗️ | 1. 收款地址：链上已存在的地址<br>2. 金额 = Max | 1. 进入转账页面<br>2. 输入已存在地址<br>3. 点击 Max 按钮<br>4. 确认并签名 | 1. Max 金额 = 余额 − 1 XLM − Gas<br>2. 交易后账户余额保留 1 XLM |
| P1 | 1. 收款地址：链上已存在的地址<br>2. 金额 = 中间值（如 10 XLM） | 1. 进入转账页面<br>2. 输入已存在地址<br>3. 输入 10 XLM<br>4. 确认并签名 | 1. 交易上链，余额扣除与输入金额 + Gas 一致<br>2. 交易记录生成 |

### 2.3 Memo 功能测试

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Memo = 纯数字（如 `123456`）<br>2. 收款地址：Binance 或 OKX 充值地址 | 1. 进入转账页面<br>2. 输入 CEX 充值地址<br>3. 输入纯数字 Memo<br>4. 确认并签名 | 1. 自动设为 MEMO_ID 类型<br>2. 交易上链，链上查询 Memo 类型为 MEMO_ID<br>3. CEX 到账 |
| ❗️❗️P0❗️❗️ | Memo = 包含字符（如 `test123`） | 1. 进入转账页面<br>2. 输入收款地址<br>3. 输入包含字符的 Memo<br>4. 确认并签名 | 1. 自动设为 MEMO_TEXT 类型<br>2. 链上查询 Memo 类型为 MEMO_TEXT |
| P1 | Memo = 空 | 1. 进入转账页面<br>2. 输入普通地址，不填写 Memo<br>3. 确认并签名 | 1. 交易上链<br>2. 链上查询无 Memo |
| P2 | Memo = 超长文本（> 28 字节） | 1. 进入转账页面<br>2. 输入超长 Memo<br>3. 尝试确认 | 1. 提示 Memo 长度限制（最大 28 字节）<br>2. 无法提交 |

---

## 3. Token 转账

### 3.1 Stellar Asset Token 转账

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 收款地址：已激活该 Token<br>2. 金额 = 最小值 | 1. 进入 Token 转账页面<br>2. 选择 Asset Token<br>3. 输入已激活的收款地址<br>4. 输入最小金额<br>5. 确认并签名 | 1. 交易上链，余额扣除（精度 7 位）<br>2. 交易记录生成 |
| ❗️❗️P0❗️❗️ | 1. 收款地址：已激活该 Token<br>2. 金额 = Max（Token 余额） | 1. 进入 Token 转账页面<br>2. 选择 Asset Token<br>3. 点击 Max 按钮<br>4. 确认并签名 | 1. Max 金额 = Token 余额<br>2. 交易后 Token 余额归零<br>3. XLM 保留 1 XLM + 锁定额度 |
| ❗️❗️P0❗️❗️ | 1. 收款地址：**未激活**该 Token<br>2. 金额 = 任意 | 1. 进入 Token 转账页面<br>2. 选择 Asset Token<br>3. 输入未激活的收款地址<br>4. 输入金额，尝试确认 | 1. 提示接收方未激活该 Token，需先激活 Trustline<br>2. 交易失败或前端阻止提交 |
| P1 | 1. 收款地址：已激活该 Token<br>2. 金额 = 中间值 | 1. 进入 Token 转账页面<br>2. 选择 Asset Token<br>3. 输入中间值金额<br>4. 确认并签名 | 1. 交易上链，余额扣除与输入一致<br>2. 交易记录生成 |

### 3.2 Contract Token 转账

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Token：Contract Token<br>2. 收款地址：任意（无需激活）<br>3. 金额 = 最小值 | 1. 进入 Token 转账页面<br>2. 选择 Contract Token<br>3. 输入任意地址<br>4. 输入最小金额<br>5. 确认并签名 | 1. 交易上链（无需接收方激活）<br>2. 余额扣除，手续费含 Resource Fee<br>3. 交易记录生成 |
| ❗️❗️P0❗️❗️ | 1. Token：Contract Token<br>2. 金额 = Max（Token 余额） | 1. 进入 Token 转账页面<br>2. 选择 Contract Token<br>3. 点击 Max 按钮<br>4. 确认并签名 | 1. Max 金额 = Token 余额<br>2. 交易上链，预估 Gas 足够 |
| P1 | 账户 XLM 余额不足支付 Resource Fee | 1. 进入 Token 转账页面<br>2. 选择 Contract Token<br>3. 输入金额，尝试确认 | 1. 提示 Gas 不足<br>2. 无法提交交易 |

---

## 4. 账户激活与保证金机制

### 4.1 账户最低余额验证

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 账户余额 1.5 XLM<br>2. 尝试转出 0.6 XLM | 1. 进入转账页面<br>2. 输入收款地址<br>3. 输入 0.6 XLM<br>4. 尝试确认 | 1. 提示余额不足，需保留 1 XLM 基础保留<br>2. 无法提交交易 |
| ❗️❗️P0❗️❗️ | 1. 账户余额 10 XLM<br>2. 已激活 5 个 Asset Token | 查看账户余额详情 | 1. 显示总余额 10 XLM<br>2. 锁定额度 2.5 XLM（5 × 0.5）<br>3. 可用余额 = 10 − 1 − 2.5 = 6.5 XLM |
| P1 | 1. 账户余额 1 XLM<br>2. 尝试激活 Asset Token | 1. 进入 Token 添加页面<br>2. 尝试激活 Asset Token | 1. 提示余额不足（需 1 XLM + 0.5 XLM 激活费用）<br>2. 无法激活 |

### 4.2 Trustline 激活流程

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. Token：未激活的 Asset Token<br>2. 账户余额 ≥ 1.5 XLM | 1. 进入 Token 添加页面<br>2. 输入 Asset Token<br>3. 点击激活<br>4. 确认交易并签名 | 1. 发起链上交易（扣 Gas）<br>2. 占用 0.5 XLM 锁定额度<br>3. Token 显示已激活，余额可查询 |
| P1 | Token 已激活，再次尝试激活 | 1. 进入 Token 添加页面<br>2. 输入已激活的 Token<br>3. 点击添加 | 1. 识别为已激活，直接显示<br>2. 不重复发起交易，不重复占用锁定额度 |

---

## 5. dApp 连接与 Swap（aqua.network）

### 5.1 dApp 连接（Hana Wallet 协议）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | dApp：aqua.network，Hana Wallet 协议 | 1. 打开 aqua.network<br>2. 选择连接钱包<br>3. 选择 Hana Wallet 图标<br>4. 确认连接 | 1. 唤起 OneKey 钱包，显示连接请求<br>2. 确认后 DApp 显示已连接状态，地址一致 |
| P1 | 用户拒绝连接 | 1. 打开 aqua.network<br>2. 选择连接钱包<br>3. 选择 Hana Wallet<br>4. 拒绝连接 | 1. DApp 显示未连接状态<br>2. 可重新发起连接 |

### 5.2 Swap 交易

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 已连接钱包，进行 Swap | 1. 在 aqua.network 选择交易对<br>2. 输入 Swap 金额<br>3. 确认交易<br>4. 在 OneKey 中签名 | 1. 显示交易详情（From/To、金额、Gas）<br>2. 签名后交易提交到链上<br>3. 源 Token 余额扣除，目标 Token 余额增加<br>4. 交易记录生成 |
| P1 | 用户拒绝签名 | 1. 在 aqua.network 发起 Swap<br>2. 在 OneKey 中拒绝签名 | 1. 交易未提交，余额未扣除<br>2. DApp 显示交易取消 |

---

## 6. 私钥导出与验证

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 导出私钥 | 1. 进入账户设置<br>2. 选择导出私钥<br>3. 验证身份（密码/生物识别） | 1. 显示私钥（掩码保护），可复制<br>2. 私钥格式为 S 开头 56 字符 |
| ❗️❗️P0❗️❗️ | 使用导出的私钥在 Stellar Lab 验证 | 1. 打开 Stellar Lab（mainnet）<br>2. 使用私钥生成地址<br>3. 对比 OneKey 中的地址 | 1. Stellar Lab 生成的地址与 OneKey 地址一致（G 开头）<br>2. 公钥即地址（无单独导出公钥功能） |
| P1 | 身份验证失败 | 1. 进入账户设置<br>2. 选择导出私钥<br>3. 输入错误密码 | 1. 提示密码错误<br>2. 无法查看私钥 |

---

## 7. 余额查询与刷新

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 账户包含多种 Token | 1. 查看资产列表页<br>2. 进入 Token 详情页<br>3. 对比余额 | 1. 列表页余额与详情页余额一致<br>2. 精度显示：XLM 和 Asset Token 7 位，Contract Token 按链上精度<br>3. 余额刷新及时 |
| P1 | 完成一笔转账后 | 1. 执行转账交易<br>2. 返回资产列表页<br>3. 查看余额 | 1. 余额立即更新<br>2. 与 Horizon API 查询结果一致 |
