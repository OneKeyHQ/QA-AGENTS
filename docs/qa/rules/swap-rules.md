# Swap 模块测试规则文档

> 本文档记录 Swap 模块的核心测试规则，包括报价测试、构建订单测试、手续费测试、历史记录测试等。
> 生成 Swap 模块测试用例时，必须参考本文档中的规则。

---

## 📋 核心测试路线（必须覆盖）

生成 Swap 模块测试用例时，必须覆盖以下四个核心测试路线：

**重要说明**：
- **兑换类型变量化**：同链和跨链的兑换类型测试流程相同，在测试用例中应作为变量处理，不需要为每种类型单独编写用例
  - **同链渠道测试场景**：主币到代币、代币到主币、代币到代币（共 3 种）
  - **跨链渠道测试场景**：主币到主币、主币到代币、代币到主币、代币到代币（共 4 种）
- **特殊情况单独测试**：特殊情况（如 Ethereum USDT 需要二次授权）需要单独编写测试用例，不能使用变量化处理

### 1. 报价测试（Quote Testing）

#### 1.1 同链报价

**报价展示验证**：
- 报价金额精度符合代币 decimals 规范
- Gas 费展示：显示为 native token 和法币价值（保留 2 位小数）
- 法币价值计算准确性

**路由验证**：
- 路由信息展示：DEX 名称、路径百分比、路由占比
- 多条路由时：显示最优路由（接收代币数量最大）
- 路由详情可展开查看

**刷新机制**：
- 报价有效期检查（如 30 秒）
- 自动刷新倒计时显示
- 手动刷新功能
- 报价过期后自动重新询价

**异常处理**：
- 报价失败：返回错误、超时、空数据
- 网络错误：断网、弱网、服务器错误
- 容错处理：错误提示、重试入口

#### 1.2 跨链报价

**报价展示验证**：
- 报价金额精度符合代币 decimals 规范
- Gas 费展示：显示为 native token 和法币价值
- Protocol Fee 展示：显示为代币计价和法币价值
- 时间展示：Est. Time 显示为可读时间格式（如"约 5 分钟"）

**费用计算**：
- Protocol Fee 由两部分组成，都转换为法币价值后求和
- 费用展示与计算一致性验证

**时间展示**：
- Est. Time 格式转换：秒 → 可读时间格式（如"约 5 分钟"）
- 时间展示准确性

**路由验证**：
- 跨链路由信息展示（可能只显示 100% 通过某个路径）
- 路由包含跨链桥名称
- 路由信息清晰展示

**特殊场景**：
- Solana 跨链 CCTP 路径可能需要多签交易（2 个私钥签名）
- 多签交易流程验证

#### 1.3 报价一致性

**页面展示一致性**：
- Est Received 显示正确
- Network Fee 显示正确
- Protocol Fee 显示正确
- RouteInfo 显示正确

**多次询价结果对比**：
- 价格波动容忍度验证
- 报价刷新后数据更新及时性

**报价来源标识**：
- 显示路由/报价来源（如"OKX Dex Aggregator"）
- 来源标识清晰可见

---

### 2. 构建订单测试（Build Order Testing）

#### 2.1 同链订单构建

**订单构建验证**：
- 订单构建成功，包含完整的交易参数
- Gas Limit 计算准确性验证

**授权检查**：
- ERC20 代币需要检查授权状态
- 授权额度需满足兑换数量要求
- Native token 无需授权

**授权流程测试规则**（必须覆盖）：
- **授权按钮状态验证**：未授权状态下显示"授权"按钮（非"兑换"按钮），授权按钮可点击
- **Approve+Swap 捆绑提交**：
  - 支持将 Approve 和 Swap 两笔交易捆绑在一起提交
  - 钱包弹窗显示 Approve+Swap 两笔交易捆绑
  - 在钱包中一次性确认两笔交易
  - Approve 交易先执行，Swap 交易在 Approve 成功后自动执行
  - 两笔交易都成功确认，授权状态更新为已授权
- **Approve、Swap 单独提交**：
  - 支持 Approve 和 Swap 分别单独提交
  - 先单独提交 Approve 交易，等待确认
  - Approve 成功后，授权按钮变为"兑换"按钮
  - 再单独提交 Swap 交易，等待确认
  - Swap 交易成功，余额变化正确

**特殊代币授权规则**：
- **Ethereum USDT**：需要二次授权（特殊代币）
  - **适用范围**：仅当 USDT → ETH 时需要二次授权，USDT → 其他代币不需要二次授权
  - 第一次授权：将授权额度设置为 0（重置授权）
  - 第二次授权：设置实际授权额度
  - 需要验证两次授权交易都能正常执行
  - 需要验证授权流程提示清晰（如显示"USDT 需要二次授权"或类似提示）
- 其他特殊代币：根据代币特性确定授权规则

**余额检查**：
- 可用余额验证：余额 ≥ 兑换数量 + Gas 费
- Max 按钮功能：自动填充可用余额（扣除 Gas 费）
- 余额不足提示

**交易确认页面数据验证**（构建订单后）：
- **网络信息**：显示当前网络名称，与选择的网络一致
- **账户信息**：
  - 账户地址：显示当前账户地址
  - 地址标签：显示账户标签（如有）
- **支付信息**：
  - 支付代币：显示源代币名称和图标
  - 支付数量：显示兑换数量，精度正确
- **接收信息**：
  - 接收代币：显示目标代币名称和图标
  - 接收数量：显示预计收到的目标代币数量，精度正确
  - 接收地址：显示接收地址（通常为当前账户地址）
  - 账户标签：显示接收账户标签（如有）
  - 合约地址：显示目标代币合约地址
  - 合约地址跳转：可以点击合约地址跳转到区块浏览器
- **渠道商信息**：
  - 渠道商名称：显示渠道名称（如"0x Protocol"）
  - 汇率：显示兑换汇率
  - 滑点：显示设置的滑点百分比
  - 服务费用：显示渠道服务费用比例（如 0x 渠道为 0.25%）
- **进阶设置数据**：
  - Gas Limit：显示 Gas Limit 值
  - Gas Price：显示 Gas Price（如有）
  - 其他进阶设置参数（如有）

#### 2.2 跨链订单构建

**订单构建验证**：
- 订单构建成功，包含完整的交易参数
- Gas Limit 值合理性验证

**多签支持**：
- Solana 跨链 CCTP 路径的多签交易处理
- 多签交易流程验证（2 个私钥签名）
- 钱包支持多签交易流程

**订单状态查询**：
- 订单状态查询功能验证
- 状态更新及时性

#### 2.3 订单状态流转

**状态转换**：
- Pending → Processing → Success/Failed 状态转换
- 状态转换时机验证

**状态更新**：
- 状态更新及时性（实时或轮询更新）
- 状态更新准确性

**失败回滚机制**：
- 交易失败后状态回滚
- 失败原因可追溯
- 提供重试入口

---

### 3. 手续费测试（Fee Testing）

#### 3.1 渠道返佣收费验证

**重要说明**：
- **不同渠道的返佣比例和收款地址不同**，测试时需要根据具体渠道验证
- 各渠道的返佣比例和收款地址见下方渠道列表

**收费比例**：
- 收费比例根据渠道不同而不同（如 0x 渠道为 0.25%）
- 收费比例配置验证

**收费计算**：
- 收费金额 = 兑换数量 × 收费比例
- 收费计算准确性验证
- 不同渠道的收费比例需要分别验证

**收费扣除**：
- 从源代币中扣除
- 直接发送到渠道对应的返佣地址
- 收费扣除时机验证
- 需要验证返佣地址是否为该渠道的正确地址

**收费展示**：
- 页面展示的手续费与实际扣除的手续费一致
- 收费展示清晰明确

**各渠道返佣信息**：
- **0x 渠道**：
  - 返佣比例：0.25%
  - 返佣地址：0x0994e6337a6c69c3ef4c2e2de885c22c4f0cf5b4
- **1inch 渠道**：
  - 返佣比例：0.25%
  - 返佣地址：0xeb373e57f59aaaf4e2957bc9920a20255b9aa694
- **其他渠道**：根据实际配置确定返佣比例和地址

#### 3.2 Network Fee 验证

**同链 Network Fee**：
- 展示：显示为 native token 和法币价值
- 页面展示的 Network Fee 与实际扣除的 Gas 费一致

**跨链 Network Fee**：
- 展示：显示为 native token 和法币价值
- 页面展示的 Network Fee 与实际扣除的 Gas 费一致

**Gas Limit 计算**：
- Gas Limit 计算准确性验证

**展示一致性**：
- 页面展示的 Network Fee 与实际扣除的 Gas 费一致
- Gas 费计算准确性

#### 3.3 Protocol Fee 验证（仅跨链）

**费用组成**：
- Protocol Fee 由两部分组成
- 两个费用都转换为法币价值后求和

**计价转换**：
- 一部分以目标链 native token 计价，转换为法币价值
- 另一部分以代币计价，转换为法币价值

**法币价值**：
- 两个费用转换为法币价值后求和
- 法币价值计算准确性

**展示一致性**：
- 页面展示的 Protocol Fee 与实际扣除的费用一致
- Protocol Fee 展示清晰明确

#### 3.4 手续费总和验证

**总手续费计算**：
- 总手续费 = Network Fee + Protocol Fee（跨链）+ 渠道返佣收费
- 总手续费计算准确性

**余额扣除验证**：
- 源代币余额减少 = 兑换数量 + 总手续费
- 余额扣除准确性验证（允许精度误差）

**手续费展示与计算一致性**：
- 页面展示的所有手续费与实际扣除的手续费一致
- 手续费明细清晰可查

---

### 4. 历史记录测试（History Testing）

#### 4.1 交易记录生成

**记录生成时机**：
- 交易提交后立即生成 Pending 记录
- 记录生成及时性验证

**记录字段完整性**：
- 交易 hash
- 时间戳
- 源代币/目标代币信息
- 兑换数量
- 状态（Pending/Success/Failed）
- 手续费信息
- 其他必要字段

**状态更新**：
- Pending → Success/Failed 状态更新及时性
- 状态更新准确性

#### 4.2 历史记录查询

**列表展示**：
- 按时间倒序排列
- 分页加载功能
- 列表展示性能

**搜索功能**：
- 按交易 hash 搜索
- 搜索功能准确性

**详情查看**：
- 点击记录查看详情
- 详情包含：交易参数、状态、时间、手续费等完整信息
- 详情展示准确性

#### 4.3 记录数据一致性

**订单数据验证**：
- **交易对核对**：记录中显示的源代币和目标代币与交易时选择的一致
- **兑换数量核对**：记录中显示的兑换数量与交易时输入的一致，精度正确
- **订单状态**：记录中显示的状态（Pending/Success/Failed）与链上状态一致
- **下单时间**：记录中显示的下单时间准确，时间格式一致

**链上数据验证**：
- **发送地址**：记录中显示的发送地址为当前账户地址，格式正确
- **接收地址**：记录中显示的接收地址与发送地址相同（Swap 场景下），数据显示正确
- **网络费一致性**：记录中显示的网络费与交易确认页面显示的网络费差距较小（允许合理误差）

**渠道商数据验证**：
- **渠道商名称**：记录中显示的渠道商名称正确（如"0x Protocol"）
- **汇率显示**：记录中显示的汇率正常，可以点击汇率切换汇率方向（正向/反向）
- **渠道商费用**：记录中显示的渠道商费用与询价时渠道商列表展示的费用一致（如 0x 渠道为 0.25%）
- **Order ID**：对于支持 Order ID 的渠道（如 CowSwap、1inch Fusion），记录中显示 Order ID 且格式正确

**金额一致性**：
- 记录中的金额与交易时输入的金额一致
- 金额精度一致性

**手续费一致性**：
- 记录中的手续费与交易时扣除的手续费一致
- 手续费明细一致性

**状态一致性**：
- 记录中的状态与链上状态一致
- 状态更新及时性

**时间戳准确性**：
- 记录中的时间戳准确
- 时间格式一致性

#### 4.4 跨链订单记录

**订单状态查询**：
- 订单状态查询功能验证

**状态同步**：
- 订单状态从 Pending → Processing → Success/Failed
- 状态同步及时性和准确性

**记录关联**：
- 跨链订单记录与链上交易记录关联正确
- 记录关联准确性

---

## 🌐 多链测试覆盖规则

### 渠道与网络支持矩阵

生成 Swap 模块测试用例时，必须根据不同的 Swap 渠道覆盖其支持的网络。各渠道支持的网络如下：

**渠道与 provider 映射表**（编写 API 用例时，请求体/断言中的 `provider` 必须按下表取值，不得自拟）：

| 渠道 | provider |
|------|----------|
| 0x | `Swap0x` |
| 1inch | `Swap1inch` |
| 1inch Fusion | `Swap1inchFusion` |
| Jupiter | `SwapJupiter` |
| OKX | `SwapOKX` |
| CowSwap | `SwapCow` |
| Exodus | `SwapExodus` |
| Panora | `SwapPanora` |
| LiquidMesh | `SwapLiquidMesh` |
| LiFi | `SwapLifi` |
| Near | `SwapNear` |
| Changelly | `SwapChangelly` |
| ChangeHero | `SwapChangeHero` |
| SwapKit（ThorChain） | `SwapThor` |

**渠道构建依赖规则（quoteResultCtx）**：
- 部分渠道的构建接口（`POST /swap/v1/build-tx`）**必须依赖询价返回的上下文**（如 `quoteResultCtx` / 内部 quoteId / CowSwap 未签名订单等），不能只靠静态字段拼 body。
- 编写任意渠道的构建用例前，必须先根据下表确认**是否需要传 `quoteResultCtx`**：

| 是否需要 quoteResultCtx | 渠道 | 说明 |
|------------------------|------|------|
| ✅ 需要 | LiFi (`SwapLifi`) | 构建依赖前一步跨链询价结果（内部路径/quoteId 等） |
| ✅ 需要 | Changelly (`SwapChangelly`) | 构建依赖 Changelly 侧 quote 上下文 |
| ✅ 需要 | ChangeHero (`SwapChangeHero`) | 构建依赖 ChangeHero 侧 quote 上下文 |
| ✅ 需要 | 1inch Fusion (`Swap1inchFusion`) | 必须先 quote，使用返回的 `quoteResultCtx` 进行 Fusion 构建 |
| ✅ 需要 | CowSwap (`SwapCow`) | 必须携带 CowSwap 询价返回的 `quoteResultCtx`（包括 unsignedOrder、appData、quoteId、签名等） |
| ✅ 需要 | Exodus (`SwapExodus`) | 仅跨链渠道，构建前必须先询价并携带返回的 `quoteResultCtx`（跨链路径、桥接信息等） |
| ❌ 不需要 | 0x (`Swap0x`) | 仅依赖静态参数（from/to/tokenAmount/network/provider/slippage 等） |
| ❌ 不需要 | 1inch (`Swap1inch`) | 普通 1inch 构建不需要 quoteResultCtx，按静态参数构建 |
| ❌ 不需要 | OKX (`SwapOKX`) | 构建按静态参数+provider 即可 |
| ❌ 不需要 | ThorSwap / SwapKit（`SwapThor`） | 由 SwapKit 封装，当前构建按静态参数处理 |
| ❌ 不需要 | Panora (`SwapPanora`) | Aptos Panora 构建按静态参数处理 |
| ❌ 不需要 | Jupiter (`SwapJupiter`) | Solana Jupiter 构建按静态参数处理，但必须返回 `data.tx` |

> 规则：生成构建用例时，先根据渠道名查本表——**需要 quoteResultCtx 的渠道**，用例必须先说明「前置询价 + 提取 quoteResultCtx」或直接使用真实 quoteResultCtx 示例；**不需要的渠道**则禁止伪造无效 quoteResultCtx 字段，保持 body 简洁一致。

#### 同链聚合器（DEX Aggregator）

**0x**：
- Ethereum、Polygon、Arbitrum、Avalanche、BSC、Optimism、Base

**1inch**：
- Ethereum、Polygon、Arbitrum、Avalanche、BSC、Optimism、Base、zkSync Era

**1inch Fusion**：
- Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche

**Jupiter**：
- Solana

**CowSwap**：
- Ethereum、Arbitrum、Base

#### 跨链桥（Cross-Chain Bridge）

**Socket Bridge**：
- Ethereum、Optimism、BSC、Polygon、zkSync Era、Base、Arbitrum、Avalanche

#### SwapKit 系列

**ThorChain**：
- Ethereum、Avalanche、Base、BSC、BTC、LTC、BCH、DOGE

**MAYAChain**：
- Ethereum、Arbitrum、BTC

**Chainflip**：
- Ethereum、Arbitrum、Solana、BTC

#### 第三方服务商

**SWFT**：
- Filecoin、Ripple、SOL、DOGE、LTC、zkSync Era、Fantom、ETC、Base、Ethereum、BSC、Polygon、Avalanche、Optimism、Arbitrum、Tron、Polkadot、Algorand、Cardano、Aptos、EthereumW、Linea、Mantle、Celo

**Exodus（仅跨链）**：
- BTC、Doge、LTC、Optimism、Arbitrum、Ethereum、Base、BSC、Solana、Avalanche、Polygon、Fantom、Ripple、Tron、TON、SUI

**Changelly**：
- BTC、Ethereum、Polygon、Avalanche、Fantom、Arbitrum、Optimism、SOL、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa

**ChangeHero**：
- Ethereum、BSC、Polygon、Avalanche、Fantom、Arbitrum、Optimism、SOL、Near、ETC、DOGE、LTC、BCH、Ripple、zkSync Era、CFX、Base、Kaspa、Tron、TON、SUI、Aptos、BTC、Cardano、Algorand、Cosmos、CRO、Polkadot、Flare

**OKX**：
- Ethereum、Arbitrum、Optimism、BSC、Polygon、Avalanche、Fantom、zkSync Era、Base、Solana、Tron、TON、SUI

**Panora**：
- Aptos

### 多链测试覆盖原则

#### 1. 同链测试覆盖

**必须覆盖场景**：
- 每个渠道在其支持的每个网络上至少覆盖 1 个同链兑换场景
- 优先覆盖主流网络（Ethereum、BSC、Polygon、Arbitrum、Optimism、Base、Avalanche）
- 特殊网络（如 Solana、zkSync Era）需单独验证渠道特定逻辑

**兑换类型覆盖**（必须全部覆盖）：
- **主币到代币**（Native Token → ERC20 Token）：如 ETH → USDC
- **代币到主币**（ERC20 Token → Native Token）：如 USDC → ETH
- **代币到代币**（ERC20 Token → ERC20 Token）：如 USDC → DAI
- **注意**：同链不支持主币到主币（同链主币到主币没有意义）

**测试重点**：
- 渠道路由选择正确性（如 Ethereum 使用 0x/1inch，Solana 使用 Jupiter）
- 网络特定 Gas 费计算（不同网络的 Gas 单位不同）
- 网络特定代币精度处理

#### 2. 跨链测试覆盖

**必须覆盖场景**：
- 每个跨链渠道在其支持的源链和目标链组合中至少覆盖 1 个跨链兑换场景
- 优先覆盖主流链组合（如 Ethereum ↔ Arbitrum、Ethereum ↔ BSC）
- 特殊链组合（如 BTC ↔ Ethereum、Solana ↔ Ethereum）需单独验证

**兑换类型覆盖**（必须全部覆盖）：
- **主币到主币**（Native Token → Native Token）：如 ETH → BNB（跨链）
- **主币到代币**（Native Token → ERC20 Token）：如 ETH → USDC（跨链）
- **代币到主币**（ERC20 Token → Native Token）：如 USDC → ETH（跨链）
- **代币到代币**（ERC20 Token → ERC20 Token）：如 USDC → DAI（跨链）

**测试重点**：
- 跨链路由选择正确性
- 跨链费用计算准确性
- 跨链时间估算准确性
- 跨链订单状态查询

#### 3. 渠道切换测试

**必须覆盖场景**：
- 同一网络多个渠道可用时，验证渠道切换功能
- 渠道不可用时（如网络不支持），验证降级或错误提示

**测试重点**：
- 渠道优先级选择逻辑
- 渠道不可用时的错误处理
- 渠道切换后报价刷新

#### 4. 网络特定规则测试

**重要说明**：详细的网络特性表请参考 `docs/rules/swap-network-features.md`，包含所有支持网络的详细特性（主币信息、授权要求、交易费单位、特殊规则等）。

**用户地址（userAddress）规则**：
- 为保证不同渠道、不同网络下的 API 用例一致复用，这里维护一份「按网络/地址类型划分的测试用户地址表」。
- 所有 Swap 相关 API 用例（0x / 1inch / Jupiter / CowSwap / OKX / Panora / ThorChain / Changelly 等），在同一网络/地址类型下必须共用同一个 `userAddress` / `receivingAddress`。

| 网络 / 类型 | userAddress / receivingAddress | 说明 |
|------------|--------------------------------|------|
| EVM（Ethereum / BSC / Polygon / Arbitrum / Optimism / Base / Avalanche 等） | `0x4EF880525383ab4E3d94b7689e3146bF899A296e` | 统一 EVM 测试地址，所有 EVM 渠道共用 |
| Tron | `TC6LJQFu9Ji7CRNNwBwLjsVRne3yfyYozz` | TRC20 / TRX 测试地址 |
| Solana | `CYwvPxrqq6aomdhTwDRHRisKGPCMzcfetgTcmRKu32eZ` | Solana/SPL 测试地址（Jupiter 等） |
| TON | `UQBRIGeMl7e7rAKeWZAQww3G0iaiL6H0naMP9qHQqZdqyXJi` | TON 主网测试地址 |
| Aptos | `0x1b8e3ea235b70deb8317fa5a81b9908873c19619598895291e557564eb71b6cc` | Aptos/Panora 测试地址 |
| Near | `2a6c28047e3e7d4aab0f31f56db3b54623d0a983c3168f74fd052a5c4481f3cd` | Near 测试地址 |
| SUI | `0x941c5346003a695b5a5d2c176e60e15ab8172e58c16adae3e634eb4e54541297` | SUI 测试地址 |
| Dogecoin | `DDCnuDbHbvYsz3BaYx9H3dwAu2d2AzuAMJ` | DOGE UTXO 地址 |
| Bitcoin Cash | `bitcoincash:qqz4mx4h9t5ux9vjgjj4fefyrrv3a56gqujx8jz6fy` | BCH 地址 |
| Bitcoin Taproot | `bc1ph7kashckclw7krcat6um7xlvvms4rsnpv2962av4pkdhw9sm08xqlm4nlc` | BTC Taproot 地址 |
| Bitcoin Nested SegWit | `3CPcZhXh8fkaVrvX8LPxhpHzecS8AMUZ8H` | BTC P2SH-P2WPKH 地址 |
| Bitcoin Native SegWit | `bc1qxen4232s9uyms7vhz5yj4nssjcgcw4ngt25gzm` | BTC Bech32 测试（如需专用地址可后续拆分） |
| Bitcoin Legacy | `1DmmuFwDUdmqJNUU7qzsfUFZijqNjfoQ5k` | BTC Legacy 测试（同上，可后续拆分） |
| Litecoin Nested SegWit | `MS6rq9UZenRGgfZe9AWUP1Uy9LVSGa8Wb9` | LTC P2SH-P2WPKH 地址 |
| Litecoin Native SegWit | `ltc1qnfw5td47d7euedp22aca8068s7fmpp3pelca7d` | LTC Bech32 地址 |
| Litecoin Legacy | `LLDxVgko1QChSend8YB9HwZ3tvMhhGTA9F` | LTC Legacy 地址 |

> 规则：编写任意渠道的 Swap 用例时，`userAddress` 与 `receivingAddress` 必须从上表按网络（以及 BTC/LTC 的地址类型）选择，不得自定义随机地址，避免不同文件间不一致。

**代币合约地址规则**：
- 不同网络常用代币的合约地址在本节中维护，**生成测试用例时必须从表中选取**，避免临时手填导致不一致
- **代币<>代币场景禁止使用同一个合约地址**，如 USDC→USDC 不允许，需使用 USDC→USDT 或 USDT→USDC 等组合

| 网络 | 代币 | 类型 | 合约地址 / Mint |
|------|------|------|-----------------|
| Solana | SOL | 主币 | `native`（无合约地址，使用账户地址+lamports） |
| Solana | USDC | 代币 | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Solana | USDT | 代币 | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |
| Aptos | APT | 主币 | `0x1::aptos_coin::AptosCoin` |
| Aptos | USDC | 代币 | `0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b` |
| Aptos | USDT | 代币 | `0x357b0b74bc833e95a115ad22604854d6b0fca151cecd94111770e5d6ffc9dc2b` |
| SUI | SUI | 主币 | `0x2::sui::SUI` |

> 生成 Jupiter、Panora 等异构链渠道的用例时：  
> - 主币<>代币场景：主币使用上表主币标识（如 Aptos APT 用 `0x1::aptos_coin::AptosCoin`，SUI 主币用 `0x2::sui::SUI`，Solana 主币保持空字符串）。  
> - 「代币<>代币」用例应优先使用上表中的 USDC/USDT 组合，确保 `fromTokenAddress` 与 `toTokenAddress` 不同。

**EVM 兼容链**（Ethereum、BSC、Polygon、Arbitrum、Optimism、Base、Avalanche、zkSync Era、Linea、Mantle、Scroll、Blast、Sonic 等）：
- Gas 费计算（wei 单位）
- ERC20 代币授权流程
- Native token 无需授权
- **特殊规则**：Ethereum USDT → ETH 需要二次授权

**异构链**（Solana、Tron、TON、SUI、Aptos、Near）：
- **Tron 网络**：
  - TRC20 代币需要授权（类似 EVM 的 ERC20 授权流程）
  - Native token（TRX）不需要授权，可以直接 Swap
  - 授权方式：Approve+Swap 捆绑提交 或 Approve、Swap 单独提交
- **其他异构链**（Solana、TON、SUI、Aptos、Near）：
  - **不需要授权**：所有代币（包括主币和代币）都可以直接 Swap
- 交易费用计算单位不同（lamports、sun、octas、MIST、yoctoNEAR 等）
- 各网络使用各自的代币标准（SPL、TRC20、Move 等）
- **特殊规则**：
  - Solana 可能涉及多签交易（跨链 CCTP 路径）
  - Tron TRC20 代币需要授权，Native token（TRX）不需要授权

**UTXO 链**（Bitcoin、Litecoin、Bitcoin Cash、Dogecoin）：
- **不需要授权**：UTXO 模型不涉及代币授权
- 使用 ThorChain/MAYAChain/Chainflip 等渠道
- 交易费用计算方式不同（基于交易大小和费率）
- 地址格式验证（Legacy、SegWit、Native SegWit 等）

### 测试用例组织建议

**按渠道分组**：
- 每个渠道的测试用例独立组织
- 同链和跨链测试分开
- 不同网络的测试用例明确标注网络名称

**按网络分组**：
- 同一网络的不同渠道测试用例可以合并
- 突出显示该网络支持的渠道列表
- 验证渠道选择逻辑

**优先级建议**：
- **P0**：主流网络（Ethereum、BSC、Polygon、Arbitrum）的主流渠道（0x、1inch、OKX）
- **P1**：其他 EVM 兼容链、Solana、跨链场景
- **P2**：特殊链（BTC、UTXO 链、其他非 EVM 链）

---

## 🔄 Swap 模块通用规则

### 金额覆盖测试规则（强制）

所有 Swap 测试用例必须覆盖以下金额场景：

**最小值规则**：
- 定义为代币的最小精度值（根据代币 decimals 确定）
- 例如：USDC（6 decimals）最小值为 0.000001，ETH（18 decimals）最小值为 0.000000000000000001
- 需要验证最小精度值的询价、构建订单、执行流程是否正常

**中间值规则**：
- 选择余额的中间值进行测试（如余额的 50%）
- 确保覆盖正常兑换场景
- 需要验证中间值金额的询价准确性、手续费计算正确性

**最大值规则**：
- 定义为钱包里的当前余额
- 需要验证最大金额兑换时的余额检查、Max 按钮功能

**金额测试覆盖要求**：
- 每个兑换场景（主币→代币、代币→主币、代币→代币）至少覆盖最小值、中间值、最大值
- 最小值测试已覆盖代币精度边界值（如 6 decimals 代币测试 0.000001、18 decimals 代币测试 0.000000000000000001）
- 不同 decimals 的代币需要分别测试精度边界

### 状态机
- 询价→路径→授权(Approve/Permit)→Swap→Pending→Success/Fail→回滚提示

### 资金流
- 授权额度变化、兑换前后余额对账、手续费/滑点/price impact 展示一致

### 链上不确定性
- 报价过期重算、同块抢跑导致滑点失败、nonce 冲突

### 代币兼容
- 通缩/税费币、rebase、黑名单 token、非标准 decimals

### 风控
- 高滑点/高 price impact 强提醒；目标合约风险提示；最小收到保护

### 数据源
- 路由/报价来源标识、刷新倒计时、WS/轮询策略一致

### 可观测
- 失败类型可分类（授权失败/余额不足/滑点/路由不可达/链错误）

### 账户类型测试规则（强制）

所有 Swap 测试用例必须覆盖以下账户类型：

**支持的账户类型**：
- **软件钱包（HD Wallet）**：支持 Swap 功能，可正常进行询价、授权、兑换
- **硬件钱包（HW Wallet）**：支持 Swap 功能，需要硬件设备确认交易
- **私钥账户（Private Key Account）**：支持 Swap 功能，但需验证账户系列限制
- **外部账户（External Account/Third Party）**：支持 Swap 功能，但需验证账户系列限制

**不支持的账户类型**：
- **观察账户（Watched Only Account）**：不支持 Swap 功能，应提示"观察账户不支持 Swap"或类似错误信息

**账户系列限制**：
- **私钥账户/外部账户**：只能使用同系列账户进行 Swap
- 选择非同系列账户时，应提示"不支持"或"账户类型不匹配"等错误信息
- 例如：EVM 系列账户（Ethereum、BSC、Polygon 等）之间可以互换，但不能与非 EVM 账户（如 Solana、BTC）互换

**账户类型测试覆盖要求**：
- 每个兑换场景（主币→代币、代币→主币、代币→代币）至少覆盖软件钱包和硬件钱包
- 观察账户需要验证不支持提示
- 私钥账户/外部账户需要验证同系列和不同系列的账户选择场景

---

## 📝 规则维护指南

### 如何更新规则

1. **发现规则变更**：
   - 在测试过程中发现规则与文档不一致
   - 收到产品/开发通知规则变更

2. **更新文档**：
   - 直接修改对应测试路线的规则部分
   - 在变更记录中记录更新时间和原因

3. **通知相关方**：
   - 如规则变更影响现有测试用例，需同步更新用例

---

## 📅 变更记录

### 2026-01-21
- 清理接口、API、E2E、字段验证相关内容，仅保留功能测试规则
- 移除所有接口路径、参数验证、字段验证等 API 测试相关内容
- 简化规则描述，专注于用户交互和业务流程验证

### 2026-01-06
- 初始版本
- 添加 Swap 模块核心测试路线：报价测试、构建订单测试、手续费测试、历史记录测试
- 添加多链测试覆盖规则：各渠道支持网络矩阵、多链测试覆盖原则、测试用例组织建议
- 添加金额覆盖测试规则：最小值、中间值、最大值、代币精度值测试要求
- 添加账户类型测试规则：软件钱包、硬件钱包、私钥账户、外部账户、观察账户测试要求
- 更新手续费测试规则：不同渠道有不同的返佣比例和收款地址（0x 渠道：0.25%，地址：0x0994e6337a6c69c3ef4c2e2de885c22c4f0cf5b4）
- 明确同链和跨链兑换类型覆盖要求：
  - **同链渠道测试场景**：主币到代币、代币到主币、代币到代币（共 3 种，必须全部覆盖）
  - **跨链渠道测试场景**：主币到主币、主币到代币、代币到主币、代币到代币（共 4 种，必须全部覆盖）
- 添加授权流程测试规则：Approve+Swap 捆绑提交和 Approve、Swap 单独提交两种方式必须全部覆盖
- 更新 Ethereum USDT 二次授权规则：明确仅 USDT → ETH 需要二次授权，USDT → 其他代币不需要二次授权
- 移除历史记录筛选功能测试规则：当前版本不支持筛选功能，已从测试用例和规则文档中移除
- 添加 1inch 渠道返佣信息：返佣比例为 0.25%，返佣地址为 0xeb373e57f59aaaf4e2957bc9920a20255b9aa694

