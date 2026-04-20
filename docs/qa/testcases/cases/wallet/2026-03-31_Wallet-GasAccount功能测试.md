# Wallet - Gas Account / Gas Sponsor 功能测试

> 需求文档：`docs/qa/requirements/Wallet-GasAccount.md`
> 规则文档：`docs/qa/rules/wallet-rules.md` §8、§8.9
> 测试端：全端（iOS / Android / Desktop / Extension）
> 支持链：Ethereum、BSC、BASE、Arbitrum
> 业务模块覆盖：发送 / Swap / Perps / Earn / dApp

## 前置条件

- 已登录 OneKey ID；支持链（ETH / BSC / BASE / Arbitrum）有余额或可满足最小交易；默认 RPC。
- 可抓包或查看 `/estimate-fee`、`/send-transaction` 请求；B 类错误场景可 mock 时优先 mock。

---

## 测试范围说明

**本轮测试聚焦**：SignatureConfirm 发送确认链路中 Gas Account 的接入，包括免费态展示、提交透传、错误处理与回退逻辑。Gas Sponsor 能力贯穿**发送、Swap、Perps、Earn、dApp** 五大业务模块，均需覆盖。
**暂不涉及**：Gas Account 充值流程。

---

## 1. 免费态展示与 Badge 样式（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 发起支持链上的交易<br>2. /estimate-fee 返回 `payer=gasAccount`<br>3. `gasAccountEligible=true` | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 费用区域显示为免费态<br>2. 显示 Free Badge（带礼物图标）<br>3. 不显示需要用户补足 native fee 的提示 |
| ❗️❗️P0❗️❗️ | 1. 发起支持链上的交易<br>2. /estimate-fee 返回 `payer=gasAccount` | 1. 进入交易确认页<br>2. 查看费用详情 | 1. 不显示 quoteId<br>2. 不显示 quote expires 时间<br>3. 免费态仅强调"本次网络费被赞助，可免费发送" |
| ❗️❗️P0❗️❗️ | 1. 发起 BSC 链交易<br>2. /estimate-fee 返回 `payer=megafuel` | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 费用区域显示为免费态<br>2. 显示 Free Badge（带礼物图标）<br>3. 与 `payer=gasAccount` 的免费态视觉样式一致 |
| P1 | 1. 发起支持链上的交易<br>2. /estimate-fee 返回 `payer=user` | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 不显示 Free Badge<br>2. 显示常规 Network Fee（native token + 法币价值）<br>3. 用户需自行支付 Gas |

---

## 2. Gas Account 估价判定（通用）

### 2.1 符合 Gas Account 条件（支持链 + gasAccountEligible）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 发起 Ethereum 链上交易<br>2. /estimate-fee 返回 `payer=gasAccount`、`gasAccountEligible=true`、`gasAccountQuote` 含 quoteId / maxFee / expiresAt | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. 不要求用户补足 native fee |
| ❗️❗️P0❗️❗️ | 1. 发起 BSC 链上交易<br>2. /estimate-fee 返回 `payer=gasAccount`、`gasAccountEligible=true` | 1. 进入交易确认页 | 1. 显示免费态（Free Badge） |
| ❗️❗️P0❗️❗️ | 1. 发起 BASE 链上交易<br>2. /estimate-fee 返回 `payer=gasAccount`、`gasAccountEligible=true` | 1. 进入交易确认页 | 1. 显示免费态（Free Badge） |
| ❗️❗️P0❗️❗️ | 1. 发起 Arbitrum 链上交易<br>2. /estimate-fee 返回 `payer=gasAccount`、`gasAccountEligible=true` | 1. 进入交易确认页 | 1. 显示免费态（Free Badge） |

---

### 2.2 不符合 Gas Account 条件

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 发起非支持链交易（如 Solana、Bitcoin、TRON） | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 不显示免费态<br>2. 显示常规 Gas Fee 选项 |
| ❗️❗️P0❗️❗️ | 1. 发起支持链上的交易<br>2. /estimate-fee 返回 `gasAccountEligible=false`、`payer=user` | 1. 进入交易确认页 | 1. 不显示免费态<br>2. 显示常规 Network Fee |
| ❗️❗️P0❗️❗️ | 1. 发起支持链上的交易<br>2. 当前网络使用自定义 RPC | 1. 进入交易确认页 | 1. 不启用 Gas Account<br>2. 显示常规 Network Fee |

---

## 3. estimate-fee 请求与返回字段验证（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 发起支持链交易<br>2. Gas Account 可用 | 1. 进入交易确认页<br>2. 检查 /estimate-fee 请求参数 | 1. 请求包含 `lockedUserNonce`（当前用户锁定 nonce）<br>2. 请求包含 `gasAccountEnabled=true` |
| ❗️❗️P0❗️❗️ | 1. /estimate-fee 返回 `payer=gasAccount`<br>2. 返回 `gasAccountEligible=true`<br>3. 返回 `gasAccountQuote` | 1. 检查返回字段 | 1. `payer` 值为 `gasAccount`<br>2. `gasAccountQuote.quoteId` 不为空<br>3. `gasAccountQuote.maxFee` 不为空<br>4. `gasAccountQuote.expiresAt` 不为空 |
| ❗️❗️P0❗️❗️ | 1. Gas Account 被临时禁用（sponsor fallback 后） | 1. 进入交易确认页<br>2. 检查 /estimate-fee 请求参数 | 1. 请求包含 `gasAccountEnabled=false`<br>2. 避免下一次 estimate 又自动切回 sponsor |

---

## 4. 提交流程 — quoteId / idempotencyKey 透传（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 交易确认页显示免费态（`payer=gasAccount`）<br>2. 存在有效 gasAccountQuote | 1. 点击确认提交交易<br>2. 检查 /send-transaction 请求参数 | 1. 请求包含 `quoteId`（来源于 gasAccountQuote.quoteId）<br>2. 请求包含 `idempotencyKey`（前端基于 quoteId 生成） |
| ❗️❗️P0❗️❗️ | 1. 交易确认页显示常规模式（`payer=user`） | 1. 点击确认提交交易<br>2. 检查 /send-transaction 请求参数 | 1. 请求不包含 `quoteId`<br>2. 请求不包含 `idempotencyKey` |
| P1 | 1. 交易确认页显示免费态<br>2. 同一笔交易重复提交 | 1. 第一次提交（成功）<br>2. 尝试第二次提交 | 1. `idempotencyKey` 保证幂等性<br>2. 不出现重复广播 |

---

## 5. 提交成功 — Toast 提示（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas-sponsored 交易提交成功 | 1. 在免费态下确认交易<br>2. 交易提交成功 | 1. 显示 Toast 提示<br>2. 文案为"Gas-sponsored transaction submitted"<br>3. 图标为 GiftSolid |
| ❗️❗️P0❗️❗️ | 1. 普通交易（`payer=user`）提交成功 | 1. 在常规模式下确认交易<br>2. 交易提交成功 | 1. 显示与 `payer=user` 匹配的默认完成 Toast（非 Gas-sponsored 文案）<br>2. 不显示"Gas-sponsored transaction submitted"<br>3. 不显示 GiftSolid 图标 |

---

## 6. 提交失败 — A 类：自动重估（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40201（quote 过期） | 1. 在免费态下确认交易<br>2. 后端返回 40201 | 1. 不显示默认错误 toast<br>2. 自动重置 gas sponsor 相关 UI 状态<br>3. 自动触发一次重新 /estimate-fee<br>4. 重新获取 sponsor quote |
| ❗️❗️P0❗️❗️ | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40202（nonce 变化） | 1. 在免费态下确认交易<br>2. 后端返回 40202 | 1. 不显示默认错误 toast<br>2. 自动触发重新 /estimate-fee |
| P1 | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40209 或 90201 | 1. 在免费态下确认交易<br>2. 后端返回对应错误码 | 1. 不显示默认错误 toast<br>2. 自动触发重新 /estimate-fee |
| P1 | 1. A 类错误触发自动重估后<br>2. 重估成功返回新的 gasAccountQuote | 1. 检查确认页状态 | 1. 确认页按新 quote 刷新<br>2. 免费态展示与重估返回一致（仍符合 sponsor 条件则显示 Free Badge）<br>3. 用户可再次提交 |

---

## 7. 提交失败 — B 类：自动 fallback 到用户自付（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40213 | 1. 在免费态下确认交易<br>2. 后端返回 40213 | 1. 不显示默认错误 toast<br>2. `gasAccountTemporarilyDisabled` 设为 true<br>3. payer 切回 user<br>4. 清空 quote / idempotencyKey<br>5. 自动触发一次重新 /estimate-fee<br>6. 确认页切换为用户自付的 Network Fee 模式 |
| ❗️❗️P0❗️❗️ | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 90200 | 1. 在免费态下确认交易<br>2. 后端返回 90200 | 1. 不显示默认错误 toast<br>2. 自动 fallback 到用户自付<br>3. 确认页显示常规 Network Fee |
| P1 | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40218 / 40219 / 90205 之一 | 1. 在免费态下确认交易<br>2. 后端返回对应错误码 | 1. 自动 fallback 到用户自付 |
| ❗️❗️P0❗️❗️ | 1. B 类错误已触发 fallback<br>2. 确认页切换为用户自付模式 | 1. 查看确认页<br>2. 确认提交 | 1. 显示常规 Network Fee（native token 费用）<br>2. 用户可完成交易（自付 Gas）<br>3. Gas 从用户钱包原生代币扣减 |

---

## 8. 提交失败 — C 类：仅提示不自动重试（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40203 | 1. 在免费态下确认交易<br>2. 后端返回 40203 | 1. 不显示默认错误 toast<br>2. 显示当前状态提示<br>3. 不自动重估<br>4. 不自动 fallback<br>5. 保留当前页面状态 |
| P1 | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 40214 / 40215 / 40216 / 40217 之一 | 1. 在免费态下确认交易<br>2. 后端返回对应错误码 | 1. 不显示默认错误 toast<br>2. 仅提示用户当前状态<br>3. 不自动重估或 fallback |
| P1 | 1. Gas-sponsored 交易提交失败<br>2. 错误码为 90207 / 90208 / 90209 之一 | 1. 在免费态下确认交易<br>2. 后端返回对应错误码 | 1. 不显示默认错误 toast<br>2. 仅提示用户当前状态<br>3. 不自动重估或 fallback |

---

## 9. gasAccountTemporarilyDisabled 行为（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. B 类错误触发后 gasAccountTemporarilyDisabled=true<br>2. 当前交易已 fallback 到用户自付 | 1. 当前交易完成后<br>2. 发起新一笔交易<br>3. 检查 /estimate-fee 请求 | 1. 新一笔 estimate-fee 请求中 `gasAccountEnabled=false`<br>2. 不会自动切回 sponsor 态 |
| P1 | 1. gasAccountTemporarilyDisabled=true<br>2. 用户重新进入交易确认页 | 1. 发起新交易<br>2. 进入交易确认页 | 1. 显示常规 Network Fee<br>2. 不显示免费态 |

---

## 10. 自定义 RPC 场景（通用）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前网络使用自定义 RPC<br>2. 发起支持链上的交易 | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 不启用 Gas Account<br>2. 不显示免费态<br>3. 显示常规 Network Fee |
| P1 | 1. 当前网络使用默认 RPC<br>2. Gas Account 可用 | 1. 进入交易确认页 | 1. 启用 Gas Account 估价<br>2. 显示免费态（如符合条件） |

---

## 11. 每日补贴限额与 Fallback

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当日补贴限额尚未用尽<br>2. 发起支持链上的交易 | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. Gas 由 sponsor 代付 |
| ❗️❗️P0❗️❗️ | 1. 当日补贴限额已用尽<br>2. /estimate-fee 返回 `payer=user`（`gasAccountEligible=false`） | 1. 发起支持链上的交易<br>2. 进入交易确认页<br>3. 查看 Network Fee 区域 | 1. 不显示免费态<br>2. 显示常规 Network Fee（用户自付）<br>3. 交易流程可继续，不阻断 |
| ❗️❗️P0❗️❗️ | 1. 当日补贴限额已用尽<br>2. 确认页显示常规 Network Fee | 1. 点击提交交易 | 1. 交易已广播<br>2. Gas 从用户钱包 native token 扣减<br>3. 不包含 quoteId / idempotencyKey |
| ❗️❗️P0❗️❗️ | 1. 当日补贴限额剩余刚好够 1 笔交易<br>2. 连续发起 2 笔交易 | 1. 第 1 笔交易：确认页显示免费态 → 提交成功<br>2. 第 2 笔交易：进入确认页 | 1. 第 1 笔：Gas 由 sponsor 代付，Toast 显示"Gas-sponsored transaction submitted"<br>2. 第 2 笔：确认页显示常规 Network Fee（限额已用尽），用户自付 Gas |
| P1 | 1. 当日补贴限额已用尽<br>2. 在不同业务模块（发送 / Swap / Perps / Earn / dApp）分别发起交易 | 1. 逐一进入各业务模块的交易确认页 | 1. 所有业务模块均显示常规 Network Fee<br>2. 不出现某个模块仍显示免费态<br>3. 限额状态全局一致 |
| P1 | 1. 当日补贴限额已用尽<br>2. 次日限额重置后 | 1. 次日发起支持链上的交易<br>2. 进入交易确认页 | 1. 显示免费态（Free Badge）<br>2. Gas 由 sponsor 代付<br>3. 限额重置生效 |
| P1 | 1. 当日补贴限额即将用尽（如剩余 < $0.10）<br>2. 发起一笔预估 Gas 费 > 剩余限额的交易 | 1. 进入交易确认页<br>2. 查看 Network Fee 区域 | 1. 不显示免费态（剩余限额不足本笔 Gas）<br>2. 显示常规 Network Fee（用户自付） |

---

## 12. 业务模块：发送（Transfer）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. Ethereum 链<br>3. 发起主币（ETH）转账 | 1. 进入发送确认页<br>2. 确认免费态展示<br>3. 点击 Send | 1. 交易广播<br>2. 用户 ETH 余额仅扣转账金额，不扣 Gas<br>3. Toast 显示"Gas-sponsored transaction submitted"（GiftSolid 图标） |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. Ethereum 链<br>3. 发起 ERC-20 代币转账（如 USDT） | 1. 进入发送确认页<br>2. 确认免费态展示<br>3. 点击 Send | 1. 交易广播<br>2. 用户 ETH 余额不变（不扣 Gas）<br>3. USDT 余额扣减转账金额<br>4. Toast 显示"Gas-sponsored transaction submitted" |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. BSC 链<br>3. 发起 BEP-20 代币转账 | 1. 进入发送确认页<br>2. 确认免费态展示<br>3. 点击 Send | 1. 交易广播<br>2. 用户 BNB 余额不变（不扣 Gas）<br>3. 代币余额扣减转账金额 |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. BASE 链<br>3. 发起转账 | 1. 进入发送确认页<br>2. 确认免费态展示<br>3. 点击 Send | 1. 交易广播<br>2. 用户不扣 Gas |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. Arbitrum 链<br>3. 发起转账 | 1. 进入发送确认页<br>2. 确认免费态展示<br>3. 点击 Send | 1. 交易广播<br>2. 用户不扣 Gas |

---

## 13. 业务模块：Swap

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. Ethereum 链<br>3. 发起 Swap 交易（如 USDC → ETH） | 1. 进入 Swap 确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. 不要求用户补足 ETH 作为 Gas |
| ❗️❗️P0❗️❗️ | 1. Swap 确认页显示免费态 | 1. 确认 Swap 交易 | 1. 交易广播<br>2. 用户 ETH 余额不扣 Gas<br>3. Swap 按报价完成兑换<br>4. Toast 显示"Gas-sponsored transaction submitted" |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. Ethereum 链<br>3. Swap 源币为 ERC-20（需授权）<br>4. 当前未授权 | 1. 进入 Swap 确认页<br>2. 执行 Approve 交易 | 1. Approve 交易的确认页显示免费态<br>2. Approve 提交时 Gas 由 Gas Account 代付<br>3. Approve 完成后 Swap 步骤的确认页同样显示免费态 |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. BSC 链<br>3. 发起 Swap 交易 | 1. 进入 Swap 确认页<br>2. 确认免费态<br>3. 提交 | 1. 交易广播<br>2. 用户 BNB 余额不扣 Gas |
| P1 | 1. Gas Account 可用<br>2. BASE / Arbitrum 链<br>3. 发起 Swap 交易 | 1. 进入 Swap 确认页<br>2. 确认免费态<br>3. 提交 | 1. 交易广播<br>2. 用户不扣 Gas |
| P1 | 1. Gas Account 可用<br>2. Swap 交易提交失败（B 类错误） | 1. 确认 Swap → 后端返回 B 类错误码 | 1. 自动 fallback 到用户自付<br>2. 用户可完成 Swap（自付 Gas） |

---

## 14. 业务模块：Perps（合约交易）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 支持链上<br>3. 发起 Perps 保证金存入交易 | 1. 进入 Perps 存入确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. 不要求用户补足 native fee |
| ❗️❗️P0❗️❗️ | 1. Perps 确认页显示免费态 | 1. 确认存入交易 | 1. 交易广播<br>2. 用户 native token 余额不扣 Gas<br>3. Toast 显示"Gas-sponsored transaction submitted" |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 支持链上<br>3. 发起 Perps 保证金提取交易 | 1. 进入 Perps 提取确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge） |
| ❗️❗️P0❗️❗️ | 1. Perps 提取确认页显示免费态 | 1. 确认提取交易 | 1. 交易广播<br>2. 用户不扣 Gas<br>3. Toast 显示"Gas-sponsored transaction submitted" |
| P1 | 1. Gas Account 可用<br>2. Perps 交易涉及 Token 授权 | 1. 进入授权确认页 | 1. 授权交易的确认页显示免费态<br>2. 授权 Gas 由 Gas Account 代付 |
| P1 | 1. Gas Account 可用<br>2. Perps 交易提交失败（A 类错误） | 1. 确认 Perps 交易 → 后端返回 A 类错误码 | 1. 自动重估<br>2. 用户可再次提交 |

---

## 15. 业务模块：Earn（DeFi / 质押）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 支持链上<br>3. 发起 Earn 存入（Deposit / Stake）交易 | 1. 进入 Earn 存入确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. 不要求用户补足 native fee |
| ❗️❗️P0❗️❗️ | 1. Earn 确认页显示免费态 | 1. 确认存入交易 | 1. 交易广播<br>2. 用户 native token 余额不扣 Gas<br>3. Toast 显示"Gas-sponsored transaction submitted" |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 支持链上<br>3. 发起 Earn 赎回（Withdraw / Unstake）交易 | 1. 进入 Earn 赎回确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge） |
| ❗️❗️P0❗️❗️ | 1. Earn 赎回确认页显示免费态 | 1. 确认赎回交易 | 1. 交易广播<br>2. 用户不扣 Gas<br>3. Toast 显示"Gas-sponsored transaction submitted" |
| P1 | 1. Gas Account 可用<br>2. 支持链上<br>3. 发起 Earn 收益领取（Claim）交易 | 1. 进入 Claim 确认页<br>2. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge） |
| P1 | 1. Earn Claim 确认页显示免费态 | 1. 确认 Claim 交易 | 1. 交易广播<br>2. 用户不扣 Gas |
| P1 | 1. Gas Account 可用<br>2. Earn 操作涉及 Token 授权 | 1. 进入授权确认页 | 1. 授权交易的确认页显示免费态<br>2. 授权 Gas 由 Gas Account 代付 |

---

## 16. 业务模块：dApp（浏览器交互）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 支持链上<br>3. 在 dApp 浏览器中发起合约交互（如 Uniswap Swap） | 1. dApp 触发交易签名请求<br>2. 进入交易确认页<br>3. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. 不要求用户补足 native fee |
| ❗️❗️P0❗️❗️ | 1. dApp 交易确认页显示免费态 | 1. 确认交易 | 1. 交易广播<br>2. 用户 native token 余额不扣 Gas<br>3. Toast 显示"Gas-sponsored transaction submitted" |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 支持链上<br>3. dApp 请求 ERC-20 Token Approve | 1. dApp 触发 Approve 签名请求<br>2. 进入授权确认页<br>3. 查看 Network Fee 区域 | 1. 显示免费态（Free Badge）<br>2. Approve 交易的 Gas 由 Gas Account 代付 |
| P1 | 1. Gas Account 可用<br>2. 支持链上<br>3. dApp 发起多笔连续交易（Approve + Swap） | 1. 逐笔确认交易 | 1. 每笔交易的确认页均显示免费态<br>2. 每笔交易的 Gas 均由 Gas Account 代付<br>3. 各笔 Toast 均显示"Gas-sponsored transaction submitted" |
| P1 | 1. Gas Account 可用<br>2. dApp 交易提交失败（B 类错误） | 1. 确认 dApp 交易 → 后端返回 B 类错误码 | 1. 自动 fallback 到用户自付<br>2. 用户可完成 dApp 交易（自付 Gas）<br>3. dApp 不因 fallback 而中断交互 |
| P1 | 1. Gas Account 可用<br>2. 非支持链的 dApp 交易（如 Solana dApp） | 1. dApp 触发交易签名请求<br>2. 进入交易确认页 | 1. 不显示免费态<br>2. 显示常规 Network Fee |

---

## 17. 多链 × 多模块覆盖矩阵

> 以下矩阵确保 4 条支持链 × 5 大业务模块的 Gas Sponsor 能力均被验证。每个交叉格至少验证一次免费态展示 + 提交成功。

| 优先级 | 链 | 业务模块 | 操作步骤 | 预期结果 |
|---|---|---|---|---|
| ❗️❗️P0❗️❗️ | Ethereum | 发送 | ETH / USDT 转账 → 确认免费态 → Send | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | Ethereum | Swap | USDC → ETH Swap → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | BSC | 发送 | BNB / USDT 转账 → 确认免费态 → Send | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | BSC | Swap | USDC → BNB Swap → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | BASE | 发送 | ETH / USDC 转账 → 确认免费态 → Send | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | BASE | Swap | Swap 交易 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | Arbitrum | 发送 | ETH / USDC 转账 → 确认免费态 → Send | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| ❗️❗️P0❗️❗️ | Arbitrum | Swap | Swap 交易 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | Ethereum | Perps | 保证金存入 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | Ethereum | Earn | Deposit → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | Ethereum | dApp | 合约交互 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | BSC | Perps | 保证金存入 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | BSC | Earn | Deposit → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | BSC | dApp | 合约交互 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | BASE | Perps | 保证金存入 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | BASE | Earn | Deposit → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | BASE | dApp | 合约交互 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | Arbitrum | Perps | 保证金存入 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | Arbitrum | Earn | Deposit → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |
| P1 | Arbitrum | dApp | 合约交互 → 确认免费态 → 确认 | 免费态符合 §1；用户 native 不因 Gas 扣减 |

---

## 18. 跨端一致性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 分别在 iOS / Android / Desktop / Extension 端<br>2. Gas Account 可用 | 1. 在各端分别发起发送、Swap 交易<br>2. 确认免费态展示 | 1. 各端免费态展示一致（Free Badge + 礼物图标）<br>2. 各端 Gas-sponsored 提交后 Toast 文案与 GiftSolid 图标一致 |
| P1 | 1. 在 iOS 端完成一笔 Gas 代付的 Swap 交易 | 在 Desktop 端发起新交易，查看 Gas Account 状态 | Gas Account 状态与 iOS 端同步 |

---

## 19. 网络异常与容错

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| P1 | 1. /estimate-fee 接口返回超时 | 进入任一业务模块的交易确认页 | 1. 费用区域显示加载状态或加载失败<br>2. 用户可选择普通 Gas 支付方式 |
| P1 | 1. /estimate-fee 返回 500 错误 | 进入任一业务模块的交易确认页 | 1. 不显示免费态<br>2. 不影响普通交易流程 |
| P1 | 1. 免费态已展示<br>2. 网络断开 | 在任一业务模块的确认页点击提交 | 1. 显示网络错误提示<br>2. 交易不广播 |
| P1 | 1. 弱网环境（高延迟） | 在免费态下提交任一业务模块的交易 | 1. 提交超时后显示错误提示<br>2. 不出现重复提交 |

---

## 20. 性能与并发

### 20.1 连续交易与 Quote 消耗

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 同一端连续发起 5 笔 Gas-sponsored 交易（发送 / Swap 混合） | 1. 第 1 笔交易：确认免费态 → 提交 → 等待成功<br>2. 立即发起第 2 笔 → 提交<br>3. 依次完成至第 5 笔 | 1. 每笔交易均获取独立 quoteId<br>2. 每笔提交均携带对应 quoteId / idempotencyKey<br>3. 不出现 quote 复用或串用<br>4. 所有交易均已广播 |
| ❗️❗️P0❗️❗️ | 1. Gas Account 可用<br>2. 连续发起多笔 Gas-sponsored 交易<br>3. 中间某笔触发 A 类错误（40201 quote 过期） | 1. 第 1 笔提交成功<br>2. 第 2 笔触发 40201 → 自动重估<br>3. 重估后继续提交第 2 笔<br>4. 第 3 笔正常提交 | 1. A 类错误后自动重估不影响后续交易<br>2. 后续交易的 quoteId 为新 quote<br>3. 不出现状态残留 |

---

### 20.2 多端同时操作

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 同一 Gas Account<br>2. 在 iOS 端和 Desktop 端同时进入交易确认页 | 1. 两端几乎同时进入确认页<br>2. 两端均显示免费态<br>3. 两端几乎同时点击提交 | 1. 两笔交易使用不同 quoteId / idempotencyKey<br>2. 两笔交易均已广播（或其中一笔因 nonce 冲突触发 A 类重估）<br>3. 不出现双重扣费异常或 quote 冲突 |
| P1 | 1. 同一 Gas Account<br>2. 在 iOS 端和 Extension 端同时进入交易确认页<br>3. iOS 端发起发送，Extension 端发起 dApp 交易 | 1. 两端几乎同时点击提交 | 1. 不同业务模块的并发提交互不干扰<br>2. 各自的 quoteId / idempotencyKey 独立<br>3. 两笔交易状态各自正确 |

---

### 20.3 快速重复操作

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 交易确认页显示免费态<br>2.「Send / 确认」按钮可点击 | 1. 快速连续点击提交按钮 3 次 | 1. 仅触发一次交易提交（防抖处理）<br>2. 不出现重复广播<br>3. 不出现多次 Toast |
| P1 | 1. 交易确认页显示免费态 | 1. 点击提交 → 立即返回 → 重新进入确认页 → 再次提交 | 1. 第一笔交易已广播<br>2. 第二笔交易获取新 quote<br>3. 不复用上一笔的 quoteId / idempotencyKey |

---

### 20.4 estimate-fee 并发与竞态

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 进入交易确认页<br>2. 触发多次 estimate-fee（如用户快速修改金额 / Gas 参数） | 1. 快速连续修改交易金额 3 次<br>2. 查看最终确认页状态 | 1. 确认页以最后一次 estimate-fee 的返回结果为准<br>2. 不出现旧 quote 覆盖新 quote<br>3. 免费态 / 常规态与最终 estimate 结果一致 |
| P1 | 1. 进入确认页触发 estimate-fee<br>2. estimate-fee 尚未返回时切换网络 | 1. 进入 Ethereum 交易确认页<br>2. estimate-fee 请求中<br>3. 快速切换到 BSC 并重新进入确认页 | 1. 旧的 Ethereum estimate-fee 结果被丢弃<br>2. 确认页以 BSC 的 estimate-fee 结果为准<br>3. 不出现链 / quote 错配 |
| P1 | 1. B 类 fallback 触发后<br>2. 自动重新 estimate-fee 与用户手动重试同时发生 | 1. sponsor 提交失败 → 自动 fallback 触发 re-estimate<br>2. 用户同时手动点击重试 | 1. 不出现两次 estimate-fee 结果竞态<br>2. 确认页以最终有效 estimate 为准<br>3. payer / quote 状态一致 |

---

### 20.5 高频场景下的 UI 稳定性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| P1 | 1. Gas Account 可用<br>2. 反复进出交易确认页 | 1. 进入确认页 → 关闭 → 进入 → 关闭（重复 10 次） | 1. 每次进入均触发 estimate-fee<br>2. 免费态展示 / Badge / 按钮状态与 sponsor 态一致<br>3. 无内存泄漏或页面响应递减 |
| P1 | 1. Gas Account 可用<br>2. 短时间内跨多个业务模块操作 | 1. 发起 Send → 返回 → 发起 Swap → 返回 → 发起 dApp 交易 | 1. 各业务模块确认页的 Gas Account 状态独立<br>2. 不出现上一模块的 quote / payer 残留到下一模块<br>3. 免费态展示正确 |
| P2 | 1. estimate-fee 接口响应较慢（2-3s） | 1. 进入确认页<br>2. 等待 estimate-fee 返回 | 1. 费用区域显示加载状态<br>2. 加载期间提交按钮状态=禁用<br>3. 加载完成后正确显示免费态或常规态 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-01 | v5：新增 §11 每日补贴限额与 Fallback（限额耗尽后自动回退用户自付、临界值交易、次日限额重置、多模块限额全局一致性），后续章节序号顺延 +1 |
| 2026-04-01 | v4：新增 §20 性能与并发测试（连续交易 quote 隔离、多端同时提交、快速重复点击防抖、estimate-fee 竞态处理、高频操作 UI 稳定性） |
| 2026-04-01 | v3：按业务模块拆分测试，新增 Swap（§13）、Perps（§14）、Earn（§15）、dApp（§16）独立章节，新增多链×多模块覆盖矩阵（§17），确保发送/Swap/Perps/Earn/dApp 五大模块在 4 条支持链上均被覆盖 |
| 2026-04-01 | v2：基于 SignatureConfirm Gas Account 接入 PR 重构，聚焦免费态展示、estimate-fee/send-transaction 新字段、三类错误处理策略、gasAccountTemporarilyDisabled、自定义 RPC 禁用、成功 Toast 区分。移除充值相关用例 |
| 2026-03-31 | v1：Gas Account 全功能测试（含充值、Activity、黑名单、熔断等） |
| 2026-04-20 | v6：PR 评审修复 — 新增前置条件节；规则引用 §8.9；预期列去除禁用词「成功/正常」类表述；矩阵预期与 §1 对齐 |
