# Desktop Transfer Amount & Case Details - 2026-06-10

> 金额说明：固定数值为脚本实际输入；`Max（点击最大）` 表示脚本点击页面“最大”，当前结果 JSON 未记录展开后的具体数值；Lightning 单位为 sats。Cosmos 广播真实交易，本轮未执行。

## Tron

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TRON-001 TRX 小额转账预览 + 法币切换 | Tron | TRX | 0.001 | - | preview | passed (9✓ 0✗ 1⊘) | - |
| TRON-002 TRX Max 金额预览 | Tron | TRX | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| TRON-003 TRX 金额 0 拦截 | Tron | TRX | 0 | - | invalid-amount | passed (7✓ 0✗ 0⊘) | - |
| TRON-004 USDT-TRC20 转账预览 + 资源字段 | Tron | USDT | 0.0002 | - | preview | passed (9✓ 0✗ 0⊘) | - |

## Polkadot

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POLKADOT-001 Polkadot AssetHub DOT 小额预览 | Polkadot AssetHub | DOT | 0.001 | - | preview | failed (11✓ 1✗ 3⊘) | 预览页字段校验并取消: 两个默认账户均余额不足: insufficient before preview |
| POLKADOT-002 Kusama AssetHub KSM 小额预览 | Kusama AssetHub | KSM | 0.0001 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| POLKADOT-003 Astar ASTR Max 预览 | Astar | ASTR | Max（点击最大） | - | preview | failed (11✓ 1✗ 2⊘) | 预览页字段校验并取消: 预览按钮不可提交: 网络Astar账户地址Z72iVJYv5pBtZPwQFHB3KcgMkpYRAxMnZHidkJ1j9zXvNrjran / vault😂资产-0  ASTR至YkjKN9Zeesi9hUmnQuupnu5DDTQU8zV92sa1f1HQrVXnXmUPro - Kitty0x996 / piggy🐷 |
| POLKADOT-004 Joystream JOY 小额预览 | Joystream | JOY | 0.0001 | - | preview | failed (5✓ 1✗ 3⊘) | 切换到 vault 账户: Failed to switch to account vault, got: piggy🐷 |
| POLKADOT-005 Manta Atlantic MANTA 小额预览 | Manta Atlantic | MANTA | 0.001 | - | preview | failed (8✓ 1✗ 0⊘) | 输入金额 0.001: Amount input not found |
| POLKADOT-006 Hydration HDX 小额预览 | Hydration | HDX | 0.1 | - | preview | failed (8✓ 1✗ 0⊘) | 输入金额 0.1: Amount input not found |
| POLKADOT-007 Bifrost Polkadot BNC 小额预览 | Bifrost Polkadot | BNC | 0.01 | - | preview | failed (7✓ 2✗ 0⊘) | 输入金额 0.01: Amount input not found \| 预览页字段校验并取消: 预览按钮不可提交: 网络Bifrost Polkadot账户地址13pS2QSYjCW5NQTTFkWnwHZwynjwCDqtCL6uwEnn6aX6P5Gzran / piggy🐷资产-0  BNC至14AjRXbXzdSZ7GNcsat49pHZ8L759FokqrX4ZL5WQt26WemLPro - Kitty0x996 / vault😂 |
| POLKADOT-008 Bifrost Kusama BNC 小额预览 | Bifrost Kusama | BNC | 0.0001 | - | preview | failed (8✓ 1✗ 0⊘) | 输入金额 0.0001: Amount input not found |
| POLKADOT-009 Polkadot AssetHub USDT 预览 | Polkadot AssetHub | USDT | 0.01 | 跳过：当前默认测试账户无 Polkadot AssetHub USDT 资产，按要求不执行 | preview | passed (0✓ 0✗ 1⊘) | - |
| POLKADOT-010 Kusama AssetHub USDT 预览 | Kusama AssetHub | USDT | 0.01 | 跳过：当前默认测试账户无 Kusama AssetHub USDT 资产，按要求不执行 | preview | passed (0✓ 0✗ 1⊘) | - |
| POLKADOT-011 Polkadot AssetHub DOT 非法金额拦截 | Polkadot AssetHub | DOT | N/A | - | invalid-amounts | failed (7✓ 1✗ 1⊘) | 负数 / 0 / 超余额校验: 未显示 0 金额错误提示 |

## Stellar

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| STELLAR-001 XLM 老账户最小金额 + 文本 Memo 预览 | Stellar | XLM | 0.0000001 | test123 | preview | passed (9✓ 0✗ 0⊘) | - |
| STELLAR-002 XLM 纯数字 Memo 预览 | Stellar | XLM | 0.0000001 | 123456 | preview | failed (8✓ 1✗ 0⊘) | 预览页字段校验并取消: 预览页未在 20 秒内完成渲染: 选择币种XLMStellar13.1817$2.48AQUAAQUA3.9949$0.00BTCBTC0.055$0.00USDCUSDC0.3607$0.00USDCUSD Coin0.5112$0.00选择地址收款方GD5JMOU6UXREKBGHEAJBPALCWQHYFLX62MJNAQRZWWZOAL3GK5TB457V然Classic 999 / vault😂清除标签(可选)清除123456最近 (1)账户 (5)地址簿然Classic 999 / vault� |
| STELLAR-003 Memo 超 28 字节拦截 | Stellar | XLM | N/A | stellar-memo-over-28-bytes-limit | memo-limit | passed (7✓ 0✗ 0⊘) | - |
| STELLAR-004 XLM 老账户 Max 预览 | Stellar | XLM | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| STELLAR-005 XLM 新账户 0.9 小于激活金额拦截 | Stellar | XLM | 0.9 | 跳过：新账户激活边界按要求暂不执行 | raw-recipient-boundary | passed (0✓ 0✗ 1⊘) | - |
| STELLAR-006 USDC Asset 转账预览 | Stellar | USDC | 0.0000001 | - | preview | passed (9✓ 0✗ 0⊘) | - |

## EVM

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| EVM-001 BNB Chain BNB 小额预览 + 法币切换 | BNB Chain | BNB | 0.000001 | - | preview | failed (8✓ 1✗ 1⊘) | 输入金额 0.000001: Amount input not found |
| EVM-002 BNB Chain BNB Max 预览 | BNB Chain | BNB | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-003 BNB Chain BNB 非法金额拦截 | BNB Chain | BNB | N/A | - | invalid-amounts | failed (6✓ 1✗ 0⊘) | 负数 / 0 / 超余额校验: 金额输入框不可见 |
| EVM-004 BNB Chain USDT 0 金额拦截 | BNB Chain | USDT | 0 | - | invalid-amount | passed (7✓ 0✗ 0⊘) | - |
| EVM-005 BNB Chain USD1 小额预览 | BNB Chain | USD1 | 0.000001 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-006 BNB Chain USDT 免 Gas 边界金额预览 | BNB Chain | USDT | 0.1 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-007 Polygon POL 最小精度预览 | Polygon | POL | 0.000000000000000001 | - | preview | failed (8✓ 1✗ 1⊘) | 输入金额 0.000000000000000001: Amount input not found |
| EVM-008 Polygon POL Max 预览 | Polygon | POL | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-009 Polygon USDC 小额预览 | Polygon | USDC | 0.000001 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-010 Polygon USDC Max 预览 | Polygon | USDC | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-011 Optimism ETH Max 预览 | Optimism | ETH | Max（点击最大） | - | preview | passed (12✓ 0✗ 2⊘) | - |
| EVM-012 Optimism OP 0 金额拦截 | Optimism | OP | 0 | - | invalid-amount | passed (8✓ 0✗ 1⊘) | - |
| EVM-013 Base ETH Max 预览 | Base | ETH | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-014 Base USDC Max 预览 | Base | USDC | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-015 Arbitrum ETH Max 预览 | Arbitrum | ETH | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| EVM-016 Arbitrum ARB 小额预览 | Arbitrum | ARB | 0.0001 | - | preview | failed (4✓ 3✗ 0⊘) | 打开 ARB 发送页: locator.waitFor: Timeout 8000ms exceeded. \| 选择收款人 vault: locator.click: Timeout 5000ms exceeded. \| 等待金额页资产加载: 金额页资产信息 10s 内未加载完成: skeleton=0, text=选择币种DeFi 代币当前钱包中没有资产 |

## TON

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TON-001 TON USDt Jetton 小额 + Comment 预览 | TON | USD₮ | 0.000000001 | onekey | preview | passed (9✓ 0✗ 0⊘) | - |
| TON-002 TON AKITA Jetton Max + 数字 Comment 预览 | TON | AKITA | Max（点击最大） | 123456 | preview | failed (4✓ 3✗ 0⊘) | 打开 AKITA 发送页: locator.waitFor: Timeout 8000ms exceeded. \| 选择收款人 vault: locator.click: Timeout 5000ms exceeded. \| 等待金额页资产加载: 金额页资产信息 10s 内未加载完成: skeleton=0, text=选择币种当前钱包中没有资产 |
| TON-003 TON 主币最小精度 + Comment 预览 | TON | TON | 0.000000001 | onekey | preview | passed (9✓ 0✗ 0⊘) | - |
| TON-004 TON 主币 Max + 数字 Comment 预览 | TON | TON | Max（点击最大） | 123456 | preview | passed (9✓ 0✗ 0⊘) | - |

## Aptos

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| APTOS-001 Aptos USDC 小额预览 | Aptos | USDC | 0.0002 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| APTOS-002 Aptos USDt Max 预览 | Aptos | USDt | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |
| APTOS-003 Aptos APT 小额预览 | Aptos | APT | 0.0001 | - | preview | failed (8✓ 1✗ 0⊘) | 输入金额 0.0001: Amount input not found |
| APTOS-004 Aptos APT 0 金额拦截 | Aptos | APT | 0 | - | invalid-amount | failed (6✓ 1✗ 0⊘) | 输入非法金额 0: Amount input not found |
| APTOS-005 Aptos APT Max 预览 | Aptos | APT | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |

## ADA/Cardano

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ADA-001 Cardano MELD 代币预览 | Cardano | MELD | 1 | - | preview | failed (4✓ 3✗ 0⊘) | 打开 MELD 发送页: locator.waitFor: Timeout 8000ms exceeded. \| 选择收款人 vault: locator.click: Timeout 5000ms exceeded. \| 等待金额页资产加载: 金额页资产信息 10s 内未加载完成: skeleton=0, text=选择币种当前钱包中没有资产 |
| ADA-002 Cardano BANK 代币预览 | Cardano | BANK | 1 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| ADA-003 Cardano ADA 主币预览 | Cardano | ADA | 1 | - | preview | passed (9✓ 0✗ 0⊘) | - |
| ADA-004 Cardano ADA Max 预览 | Cardano | ADA | Max（点击最大） | - | preview | passed (9✓ 0✗ 0⊘) | - |

## BenFen

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| BENFEN-001 BenFen BFC 最小精度预览 | BenFen | BFC | 0.000000001 | - | preview | failed (15✓ 2✗ 3⊘) | 输入金额 0.000000001: Amount input not found \| 输入金额 0.000000001: Amount input not found |
| BENFEN-002 BenFen BFC Max 预览 | BenFen | BFC | Max（点击最大） | - | preview | passed (17✓ 0✗ 1⊘) | - |
| BENFEN-003 BenFen BFC 非法金额拦截 | BenFen | BFC | N/A | - | invalid-amounts | failed (6✓ 1✗ 0⊘) | 负数 / 0 / 超余额校验: 金额输入框不可见 |
| BENFEN-004 BenFen BUSD 最小精度预览 | BenFen | BUSD | 0.000000001 | - | preview | failed (4✓ 3✗ 0⊘) | 打开 BUSD 发送页: locator.waitFor: Timeout 8000ms exceeded. \| 选择收款人 vault: locator.click: Timeout 5000ms exceeded. \| 等待金额页资产加载: 金额页资产信息 10s 内未加载完成: skeleton=0, text=选择币种当前钱包中没有资产 |
| BENFEN-005 BenFen LONG 0 金额拦截 | BenFen | LONG | 0 | - | invalid-amount | passed (7✓ 0✗ 0⊘) | - |
| BENFEN-006 BenFen BF_USDC Max 预览 | BenFen | BF_USDC | Max（点击最大） | - | preview | failed (4✓ 3✗ 0⊘) | 打开 BF_USDC 发送页: locator.waitFor: Timeout 8000ms exceeded. \| 选择收款人 vault: locator.click: Timeout 5000ms exceeded. \| 等待金额页资产加载: 金额页资产信息 10s 内未加载完成: skeleton=0, text=选择币种当前钱包中没有资产 |

## Lightning

| 用例 | 网络 | 币种/单位 | 金额动作 | Memo/备注 | 类型 | 最新结果 | 失败摘要 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| LIGHTNING-001 LN Address 中间值金额 + 描述输入 | Lightning Network | sats | 1000 | OneKey Invoice | pay-request | passed (5✓ 0✗ 0⊘) | - |
| LIGHTNING-002 LNURL 中间值金额解析 | Lightning Network | sats | 1000 | OneKey Invoice | pay-request | passed (5✓ 0✗ 0⊘) | - |
| LIGHTNING-003 LN Address 金额 0 拦截 | Lightning Network | sats | 0 | - | invalid-amount | failed (4✓ 1✗ 0⊘) | 验证金额拦截: 确认发送按钮未置灰 |
| LIGHTNING-004 LN Address 超 1 BTC 金额拦截 | Lightning Network | sats | 100000001 | - | invalid-amount | failed (4✓ 1✗ 0⊘) | 验证金额拦截: 确认发送按钮未置灰 |
| LIGHTNING-005 LN Address 格式错误拦截 | Lightning Network | N/A | N/A | user@invalid | invalid-recipient | passed (3✓ 0✗ 0⊘) | - |

