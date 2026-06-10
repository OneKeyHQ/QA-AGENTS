# Transfer - Tron / Polkadot / Stellar 软件钱包自动化

> 文档性质：本文档为**自动化覆盖映射**（记录脚本断言范围），非手动用例模板；表头为 `自动化 ID / 优先级 / 场景 / 自动化断言`，与 qa-rules §7.3 手动用例 4 列模板不同。
> 规则文档：`docs/qa/rules/transfer-chain-rules.md`
> 测试端：Desktop
> 来源用例：
> `docs/qa/testcases/cases/transfer/2026-05-08_Transfer-Tron转账-软件钱包.md`
> `docs/qa/testcases/cases/transfer/2026-05-08_Transfer-Polkadot转账-软件钱包.md`
> `docs/qa/testcases/cases/transfer/2026-01-07_Transfer-Stellar-转账dApp-HD钱包.md`
> 自动化范围：Desktop CDP，默认只执行发送页输入、按钮状态、预览页字段校验，并在预览页取消，不广播真实交易。
> 说明：当前金额页法币切换控件、预览页费用 / 资源字段缺少稳定 testid，脚本按 best-effort 记录；核心强断言为网络、币种、金额、按钮状态与页面流转。Stellar Memo 不强制在确认页展示，真实提交后以历史详情 Memo 字段为准。

---

## 前置条件与测试数据

1. Desktop OneKey 已导入 HD 软件钱包，`Account #1` / `Account #2` 已创建对应网络地址。
2. 账户需持有本用例涉及的主币或代币余额；脚本会优先使用 `Account #1 -> Account #2`，余额不足时尝试反向。
3. Stellar 新账户激活边界用例需要额外设置环境变量：`STELLAR_NEW_ACCOUNT_ADDRESS=<链上不存在的 G... 地址>`；未设置时该用例自动跳过。
4. 默认不广播交易；如要跑真实广播，需要单独增加风险门禁和链上对账逻辑。

---

## 1. Tron

| 自动化 ID | 优先级 | 场景 | 自动化断言 |
| --- | --- | --- | --- |
| TRON-001 | P0 | TRX 金额 `0.001` | 可选择联系人、输入金额、进入预览；法币切换与费用字段 best-effort 记录 |
| TRON-002 | P0 | TRX `Max` | Max 可填入并进入预览；费用字段 best-effort 记录 |
| TRON-003 | P0 | TRX 金额 `0` | 错误文案或预览按钮置灰任一满足即判定拦截有效 |
| TRON-004 | P0 | USDT-TRC20 金额 `0.0002` | 可进入预览；资源字段 Energy / Bandwidth best-effort 记录 |

---

## 2. Polkadot / Kusama 系

| 自动化 ID | 优先级 | 场景 | 自动化断言 |
| --- | --- | --- | --- |
| POLKADOT-001 | P0 | Polkadot AssetHub / DOT / `0.001` | 可进入预览；预览显示网络、代币、金额，费用字段 best-effort |
| POLKADOT-002 | P0 | Kusama AssetHub / KSM / `0.0001` | 同上 |
| POLKADOT-003 | P0 | Astar / ASTR / `Max` | Max 可填入并进入预览 |
| POLKADOT-004 | P0 | Joystream / JOY / `0.0001` | 小数金额可进入预览 |
| POLKADOT-005 | P0 | Manta Atlantic / MANTA / `0.001` | 可进入预览 |
| POLKADOT-006 | P0 | Hydration / HDX / `0.1` | 可进入预览 |
| POLKADOT-007 | P0 | Bifrost Polkadot / BNC / `0.01` | 预览网络与 BNC 不串台 |
| POLKADOT-008 | P0 | Bifrost Kusama / BNC / `0.0001` | 预览网络与 BNC 不串台 |
| POLKADOT-009 | P0 | Polkadot AssetHub / USDT / `0.01` | 代币转账预览；费用币种 DOT best-effort |
| POLKADOT-010 | P0 | Kusama AssetHub / USDT / `0.01` | 代币转账预览；费用币种 KSM best-effort |
| POLKADOT-011 | P0 | DOT 非法金额 | 负数不能输入、0 金额提示、超余额显示资金不足 |

---

## 3. Stellar

| 自动化 ID | 优先级 | 场景 | 自动化断言 |
| --- | --- | --- | --- |
| STELLAR-001 | P0 | XLM 老账户最小金额 `0.0000001` + 文本 Memo `test123` | 可输入 Memo 并进入预览；确认页不强制展示 Memo；真实提交后历史详情应展示 Memo |
| STELLAR-002 | P0 | XLM 老账户最小金额 + 纯数字 Memo `123456` | 可输入 Memo 并进入预览；确认页不强制展示 Memo；真实提交后历史详情应展示 Memo |
| STELLAR-003 | P0 | Memo 超过 28 字节 | 显示长度限制；下一步按钮不可提交 |
| STELLAR-004 | P0 | XLM 老账户 `Max` | Max 可填入并进入预览；费用字段 best-effort |
| STELLAR-005 | P0 | 新账户金额 `0.9` XLM | 设置 `STELLAR_NEW_ACCOUNT_ADDRESS` 后验证小于 1 XLM 的激活金额拦截 |
| STELLAR-006 | P0 | USDC Asset 最小金额 | 可进入预览；预览显示 Stellar / USDC，费用字段 best-effort |

---

## 暂不默认自动化的链上对账项

1. 点击确认后的真实广播、历史记录新增、区块浏览器字段对账；Stellar Memo 的最终断言归入真实提交后的历史详情校验。
2. Tron 资源不足烧 TRX 的真实链上费用对账。
3. Stellar Trustline 激活、未激活收款方失败、Contract Token 上链扣 Resource Fee。
4. Stellar dApp 连接 / Swap / 私钥导出，这些不属于本次“软件钱包转账输入与预览校验”脚本范围。

---

## 运行方式

```bash
cd /Users/chole/workspace/codex-workspace/QA-AGENTS
node src/tests/run.mjs desktop/transfer/tron
node src/tests/run.mjs desktop/transfer/polkadot
node src/tests/run.mjs desktop/transfer/stellar
node src/tests/desktop/transfer/stellar/transfer.test.mjs STELLAR-005
```
