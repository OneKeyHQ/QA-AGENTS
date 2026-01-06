Stellar (XLM) 新链接入 QA 测试文档
1. 核心测试概览
测试目标：Stellar 链的基础转账、Token 管理、dApp 连接及硬件钱包支持。

重点关注：账户最低余额限制、Trustline（信任线）激活机制、不同 Token 类型的处理逻辑、交易所（CEX）充提。

2. Token 管理与类型支持
Stellar 的 Token 机制较复杂，系统内处理逻辑如下，请重点测试不同类型的添加和展示。

2.1 三种 Token 类型定义
Token 类型	格式特征	激活 (Trustline)	余额查询方式	硬件支持	手续费
Stellar Asset Token	Code:Issuer (如 USDC:G...)	需要 (占用 0.5 XLM)	Horizon API	✅ 支持	低
Contract Token	C 开头的合约地址	不需要	RPC (simulateTransaction)	❌ 不支持	高
Stellar Asset Contract	C 开头的合约地址 (本质是 Asset 的包装)	同 Asset Token	混合模式	-	高

Export to Sheets

2.2 Token 添加与搜索逻辑 (UI/UX)
用户输入 Token 信息后，App 内部的处理逻辑如下：

输入格式为 Asset Code:Asset Issuer：

识别为 Stellar Asset Token。

预期行为：支持余额检测，保存格式为 Code:Issuer。

输入格式为 Contract Address (C 开头)：

系统会自动判断其本质是 Contract 还是 Asset 包装。

如果是 Contract Token：按合约 Token 保存，不支持自动余额检测（添加后才能查），无需激活。

如果是 Asset 包装：最终按 Code:Issuer 保存，遵循 Asset Token 的规则（需激活）。

2.3 余额与精度
XLM (原生)：精度 7 位。

Asset Token：固定精度 7 位。

Contract Token：精度需通过链上查询。

显示：需测试列表页和详情页余额刷新是否及时。

3. 转账功能测试
3.1 XLM 原生转账 (Native)
账户机制 (Create vs Payment)：

场景 A：向新账户（链上不存在）转账。

逻辑：系统自动调用 createAccount。

限制：金额必须 ≥ 1 XLM (否则交易失败)。

场景 B：向老账户转账。

逻辑：系统调用 payment。

Memo (备注) 逻辑：

由于 UI 无 Memo 类型选择器，系统自动推断：

输入纯数字 → 自动设为 MEMO_ID 类型。

输入包含字符/字符串 → 自动设为 MEMO_TEXT 类型。

不支持：Hash 和 Return 类型的 Memo。

必测项：往 Binance 和 OKX 充值 XLM，务必填写 Memo，验证到账情况。

3.2 Token 转账
转出 Stellar Asset Token：

前置条件：接收方必须已经激活（建立了 Trustline）该 Token。

预期结果：如果接收方未激活，交易应失败或前端提示无法转账。

转出 Contract Token：

前置条件：无特殊要求（无需对方激活）。

3.3 手续费 (Fees)
普通交易：费用极低（默认约 100 stroops）。

合约交易：包含 Resource Fee，费用较高。

测试点：检查预估 Gas 是否足够，交易是否因 Gas 不足失败。

4. 账户激活与保证金机制 (重要)
Stellar 有严格的账户储备金（Reserve）机制，QA 需验证余额扣除逻辑：

基础门槛：账户余额不能低于 1 XLM。

Token 占用：

每激活（Add Trustline）一个 Stellar Asset Token，必须锁定 0.5 XLM。

示例：账户持有 10 个 Asset Token，则有 5 XLM 被锁定不可转出。

激活测试：

在 App 内点击“添加/激活” Asset Token。

未激活过：发起一笔链上交易（扣 Gas），成功后占用 0.5 XLM 额度。

已激活过：直接显示成功。

5. 硬件钱包支持 (Hardware)
请针对所有型号硬件进行回归测试。

功能	支持情况	备注
XLM 转账	✅ 支持	
Asset Token 转账	✅ 支持	
Contract Token 转账	❌ 不支持	需验证是否有正确报错或屏蔽
Swap	❌ 不支持	
Soroban Token	❌ 不支持	图表里标记 Soroban 的即为 Contract Token

Export to Sheets

6. dApp 连接与 Swap
连接方式：目前通过模拟 Hana Wallet 协议接入。

测试 DApp：Aqua.network Swap

测试路径：

进入 Aqua 网站。

选择连接钱包（选择 Hana Wallet 图标，实际唤起 OneKey）。

进行连接、签名、Swap 交易测试。

注意：Swap 功能目前在 App 原生端不支持，只能通过 dApp 网页进行。

7. 账号与私钥测试
私钥导出：

将助记词导入 OneKey，查看第一个账户私钥。

对比验证：使用 Stellar Lab (设置 network 为 mainnet) 验证私钥生成的地址是否一致。

公钥：Stellar 中公钥即地址，无单独导出公钥功能。

8. QA 辅助工具与资源
在测试过程中遇到数据核对，请使用以下工具：

Token 资源 (用于测试添加/转账)：

找一些 Contract Token 和 Asset Token 进行混合测试。

QA 提示：Contract Token 也就是 Soroban Token。

余额与交易查询：

Horizon API (查 Asset/Native 余额): https://horizon.stellar.org/accounts/{address}

Stellar Expert (浏览器): 查看交易详情。

Token 详情查询：

Asset Token 检查: Lobstr API 示例