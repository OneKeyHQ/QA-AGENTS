# Swap - Jupiter 渠道同链测试

> 生成时间：2026-04-20
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/rules/swap-network-features.md`
> 需求文档：（Jupiter 渠道配置见 `swap-rules.md` §渠道白名单）
> 测试端：iOS / Android / Desktop / Extension / Web
> 本文档覆盖 Jupiter 渠道 **Solana 同链**场景；账户地址与代币合约地址以 `swap-network-features.md` 为唯一基线。

## 前置条件

- 已登录 HD 或 HW 钱包（§2 为 HW）；Solana 网络 SOL 余额充足（需覆盖兑换 + Gas + ATA 租金）。
- Solana 基线数据（来自 `swap-network-features.md`）：
  - 账户地址：`5UCR1u65cKhcJCnuaRxXy9zFYXnRBZ9ArYmGah6sEB52`
  - USDC：`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
  - USDT：`Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB`
  - SOL 主币标识：空字符串（询价接口 `fromTokenAddress/toTokenAddress`）

## 测试范围说明

**Jupiter 渠道支持网络**：Solana（仅同链）

**同链兑换类型覆盖**（必须全部覆盖）：
- 主币→代币（SOL → USDC）
- 代币→主币（USDC → SOL）
- 代币→代币（USDC ↔ USDT，禁止同币对）

**测试覆盖要求**：
- **金额**：最小可识别精度、中间值、**Max**（扣除 Gas + ATA 租金）并入 §1 步骤与预期
- **授权**：Solana **不需要授权**，SPL 代币直接兑换；验证报价与确认页**不出现 Approve 步骤**
- **测试路线**：报价测试、构建订单测试、手续费测试、历史记录测试
- **渠道标识**：询价 / 确认页 / 历史记录中渠道商名称为 **Jupiter**
- **构建返回断言**：Jupiter 按静态参数构建，**`/swap/v1/build-tx` 返回体必须包含 `data.tx`**；无 `data.tx` 判 failed
- **禁止伪造 `quoteResultCtx`**：Jupiter 不依赖询价上下文，用例 body 保持简洁

---

## 1. HD 钱包同链兑换测试（Jupiter · Solana）

### 1.1 主币→代币：SOL → USDC（标杆：最小 + 中间 + Max 完整示例）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. Solana 网络<br>3. 账户 SOL 余额 | 1. 进入 Swap<br>2. 源=SOL，目标=USDC（Solana）<br>3. 输入**最小可识别精度**（1 lamport 级别）询价 | 1. 显示同链报价<br>2. Est Received 为 USDC，9 位精度正确显示<br>3. Network Fee 以 SOL（lamports 换算）+ 法币价值显示<br>4. 报价来源标识显示 **Jupiter** |
| ❗️❗️P0❗️❗️ | 同上，已完成最小值询价 | 1. 输入**中间值**（余额 50%）询价<br>2. 点击 **Max** | 1. 报价随输入刷新<br>2. Max 填充为扣除 Gas + ATA 租金后的可用上限<br>3. 余额校验通过（无「余额不足」提示） |
| ❗️❗️P0❗️❗️ | 已获取有效报价 | 1. 点击「兑换」进入确认页 | 1. 网络=Solana<br>2. 支付币种/数量与输入一致<br>3. 接收币种=USDC，数量精度正确<br>4. 渠道商名称为 **Jupiter**<br>5. 显示滑点、汇率、Network Fee（无 Approve 步骤） |
| ❗️❗️P0❗️❗️ | 确认页已展示 | 1. 点击确认并签名 | 1. 交易提交；不出现二次授权步骤<br>2. 生成 Pending 历史记录<br>3. 状态可更新为 Success / Failed |
| P1 | 已获取报价 | 1. 等待报价过期（有倒计时）后继续点击「兑换」 | 1. 显示报价过期提示或触发重新询价<br>2. 重新询价后可继续进入确认页 |
| P1 | Jupiter 返回空路由（低流动性代币对） | 1. 输入不常见代币对询价 | 1. 报价区域显示「无可用路由」或同等文案<br>2. 不显示 Jupiter 标识；兑换按钮不可点 |
| P1 | 网络断开 | 1. 在 Swap 页面触发询价 | 1. 显示网络错误提示<br>2. 提供重试入口 |

### 1.2 代币→主币：USDC → SOL

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. USDC 余额充足 | 1. 源=USDC（Solana），目标=SOL<br>2. 输入中间值询价<br>3. 点击「兑换」进入确认页 | 1. 报价来源标识显示 Jupiter<br>2. 确认页**不显示 Approve 按钮**（Solana 无需授权）<br>3. Network Fee 以 SOL 显示<br>4. 渠道商名称为 Jupiter |
| ❗️❗️P0❗️❗️ | 1. 确认页已展示 | 1. 签名提交 | 1. 单笔交易提交<br>2. Pending 记录生成<br>3. 状态可更新为终态 |
| ❗️❗️P0❗️❗️ | 接收账户无 SOL（首次接收） | 目标账户首次接收 SOL | 交易不创建 ATA（SOL 原生无需 ATA）；Network Fee 不包含 ATA 租金项 |

### 1.3 代币→代币：USDC ↔ USDT（禁止同币对）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录 HD 钱包<br>2. Solana USDC 余额 | 1. 源=USDC，目标=USDT（合约地址不同）<br>2. 输入中间值询价<br>3. 点击「兑换」进入确认页 | 1. `fromTokenAddress ≠ toTokenAddress` 校验通过<br>2. 报价来源标识显示 Jupiter<br>3. 渠道商名称为 Jupiter<br>4. 无 Approve 步骤 |
| ❗️❗️P0❗️❗️ | 1. 同上<br>2. 接收方首次接收 USDT（无 ATA） | 1. 确认页查看费用 | 1. Network Fee 包含**新建 ATA 租金**（约 0.00203928 SOL × 1）<br>2. 显示「接收账户将创建 Token Account」或同等提示 |
| ❗️❗️P0❗️❗️ | 1. 同上<br>2. 接收方已有 USDT ATA | 1. 确认页查看费用 | Network Fee 不含 ATA 租金 |
| ❗️❗️P0❗️❗️ | 1. 有效报价 | 1. 签名提交 | 1. 单笔交易（含 ATA 创建与兑换）<br>2. Pending 记录<br>3. 状态可更新为终态 |
| P1 | 输入同币对（USDC → USDC） | 源与目标代币地址相同 | 前端阻断或服务端拒绝询价；不得生成 Jupiter 报价 |

---

## 2. 硬件钱包同链兑换测试（Jupiter · Solana）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 已登录硬件钱包<br>2. Solana 有 SOL 余额 | 1. 源=SOL，目标=USDC<br>2. 输入中间值询价<br>3. 点击「兑换」并在设备确认 | 1. 设备确认流程完整<br>2. 提交后生成 Pending 记录<br>3. 状态可更新为终态 |
| ❗️❗️P0❗️❗️ | 1. 硬件钱包 Solana 多签场景（如 CCTP 跨链路径被误匹配） | 1. 触发需要多签的交易 | 1. 设备支持多签签名流程<br>2. 流程完成后可提交并生成链上交易哈希（若仍走 Jupiter 同链，则该场景应不触发多签） |

---

## 3. 费用验证测试（Jupiter · Solana）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 已进入确认页 | 1. 查看费用明细 | 1. 显示 Network Fee（SOL / lamports 换算 + 法币价值）<br>2. 显示渠道服务费 / 返佣（如有）<br>3. 涉及新 ATA 时显示 ATA 租金 |
| ❗️❗️P0❗️❗️ | Max 模式 | 选择 SOL → USDC 并点击 Max | 填充值 = 余额 − (Network Fee + ATA 租金预留)；提交后账户 SOL 不低于链上最低租金豁免 |
| P1 | 交易状态更新为 Success | 1. 对比余额变化与页面展示费用 | 源资产减少 ≈ 兑换数量 + Network Fee + ATA 租金（如有）+ 渠道费用（如有），允许精度误差 |

---

## 4. 历史记录测试（Jupiter · Solana）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 已提交同链兑换 | 1. 打开历史记录列表 | 1. 及时出现 Pending 记录<br>2. 字段包含币对 / 数量 / 状态 / 时间 / 手续费 |
| ❗️❗️P0❗️❗️ | 记录已生成 | 1. 进入详情页 | 1. 渠道商名称为 Jupiter<br>2. 网络 = Solana；交易对与下单一致<br>3. 显示 Solana 浏览器跳转链接 |
| P1 | Pending 记录 | 1. 等待状态更新 | 状态可更新为 Success / Failed |

---

## 5. 账户类型限制（Jupiter · Solana）

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 观察账户 | 1. 进入 Swap 并触发同链兑换 | 显示不支持提示（文案与产品一致） |
| P1 | Solana 导入私钥账户 | 1. 使用导入账户执行 Jupiter 兑换 | 流程与 HD 钱包一致；签名后生成 Pending 记录并可更新为终态 |

---

## 6. Jupiter 渠道特定校验

> 本节聚焦 Jupiter 与其他渠道的差异点，属于通道级断言；改动 Swap 底层构建链路时必须回归。

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 询价返回字段 | 1. 触发 `/swap/v1/quote`（SOL / USDC / USDT 组合） | 响应 `data` 中至少一条命中 Jupiter provider（`info.provider = SwapJupiter` 或等价标识）；附带可用报价与路由概览 |
| ❗️❗️P0❗️❗️ | 构建必须返回 `data.tx` | 1. 对命中 Jupiter 的 quote 调用 `/swap/v1/build-tx` | 响应 `data.tx` 非空（已序列化 Solana 交易）；缺失 `data.tx` 判 failed |
| ❗️❗️P0❗️❗️ | 禁止伪造 `quoteResultCtx` | 1. 生成构建用例 body | body 中不携带 `quoteResultCtx`；若携带空对象或无效字段，服务端响应仍返回 `data.tx`（不依赖此字段） |
| ❗️❗️P0❗️❗️ | 地址基线校验 | 1. 检查 body 中 `userAddress` / `receivingAddress` / 代币地址 | 与 `swap-network-features.md` 维护值完全一致；Solana 主币标识为空字符串 |
| ❗️❗️P0❗️❗️ | 稳定可构建组合 | 1. 探测 SOL↔USDC、USDC↔USDT 三组参数 | 至少 1 组稳定返回 Jupiter 报价且 `data.tx` 可构建；持续空路由的组合归档为预期失败，不混入可执行用例集 |
| P1 | 询价超时 / 路由更新 | 1. 快速切换源/目标 / 金额 | 前端仅采用最后一次有效响应；旧请求被丢弃，不出现错位渠道标识 |

---

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-04-20 | 初版：Jupiter 渠道 Solana 同链用例（主币↔代币 / 代币↔代币；费用 / 历史 / 通道级断言） |
