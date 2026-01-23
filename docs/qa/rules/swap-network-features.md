# Swap 网络特性表

> 本文档记录 Swap 模块支持的各网络特性，包括网络类型、主币信息、授权要求、交易费单位等。
> 生成 Swap 测试用例时，必须参考本文档中的网络特性。
> 新增网络时，需要及时更新本表。

---

## 📋 网络分类说明

Swap 模块支持的网络按技术架构分为三类：

1. **EVM 网络**：基于以太坊虚拟机，使用 ERC20 代币标准，需要授权（Approve）
2. **异构链**：非 EVM 架构，使用各自的代币标准，不需要授权
3. **UTXO 链**：基于 UTXO 模型，主要用于价值转移，不需要授权

---

## 🔗 网络特性表

### EVM 网络

| 网络名称 | 主币符号 | 主币精度 | 交易费单位 | 是否需要授权 | 特殊规则 | 说明 |
|---------|---------|---------|-----------|------------|---------|------|
| Ethereum | ETH | 18 | wei | ✅ 是（ERC20 代币） | Ethereum USDT → ETH 需要二次授权 | 原生 EVM 网络 |
| BSC（BNB Smart Chain） | BNB | 18 | wei | ✅ 是（ERC20 代币） | - | EVM 兼容 |
| Polygon | MATIC | 18 | wei | ✅ 是（ERC20 代币） | - | EVM 兼容 |
| Arbitrum | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Optimism | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Base | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Avalanche | AVAX | 18 | wei | ✅ 是（ERC20 代币） | - | EVM 兼容 |
| Fantom | FTM | 18 | wei | ✅ 是（ERC20 代币） | - | EVM 兼容 |
| zkSync Era | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Linea | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Mantle | MNT | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Scroll | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Blast | ETH | 18 | wei | ✅ 是（ERC20 代币） | - | Layer 2 |
| Sonic | SONIC | 18 | wei | ✅ 是（ERC20 代币） | - | EVM 兼容 |

**EVM 网络通用特性**：
- **授权机制**：ERC20 代币需要先授权（Approve）才能 Swap，Native token（ETH/BNB/MATIC 等）不需要授权
- **授权流程**：
  - Approve+Swap 捆绑提交：两笔交易一起提交
  - Approve、Swap 单独提交：先授权，再 Swap
- **Gas 费计算**：使用 wei 单位，需要转换为 native token 显示（1 ETH = 10^18 wei）
- **特殊规则**：Ethereum 网络上的 USDT 代币，在兑换到 ETH 时需要二次授权（先重置为 0，再设置实际额度）

---

### 异构链

| 网络名称 | 主币符号 | 主币精度 | 交易费单位 | 是否需要授权 | 特殊规则 | 说明 |
|---------|---------|---------|-----------|------------|---------|------|
| Solana | SOL | 9 | lamports | ❌ 否 | 可能涉及多签交易（跨链 CCTP 路径） | Rust 语言生态，SPL 代币标准 |
| Tron | TRX | 6 | sun | ✅ 是（TRC20 代币） | TRC20 代币需要授权，Native token（TRX）不需要授权 | TRC20 代币标准 |
| TON | TON | 9 | nanoTON | ❌ 否 | - | Telegram 生态 |
| SUI | SUI | 9 | MIST | ❌ 否 | - | Move 语言生态 |
| Aptos | APT | 8 | octas | ❌ 否 | - | Move 语言生态 |
| Near | NEAR | 24 | yoctoNEAR | ❌ 否 | - | 分片架构 |

**异构链通用特性**：
- **授权机制**：
  - **Tron**：TRC20 代币需要授权，Native token（TRX）不需要授权
  - **其他异构链**（Solana、TON、SUI、Aptos、Near）：不需要授权，代币可以直接 Swap
- **交易费计算**：各网络使用不同的最小单位（lamports、sun、octas 等），需要转换为主币显示
- **代币标准**：各网络使用各自的代币标准（SPL、TRC20、Move 等）
- **特殊说明**：
  - Solana 网络在跨链场景下可能涉及多签交易
  - Tron 网络使用 TRC20 代币标准，需要授权机制（类似 EVM 的 ERC20）

---

### UTXO 链

| 网络名称 | 主币符号 | 主币精度 | 交易费单位 | 是否需要授权 | 特殊规则 | 说明 |
|---------|---------|---------|-----------|------------|---------|------|
| Bitcoin | BTC | 8 | satoshi | ❌ 否 | 使用 ThorChain/MAYAChain/Chainflip 等渠道 | UTXO 模型 |
| Litecoin | LTC | 8 | litoshi | ❌ 否 | 使用 ThorChain/MAYAChain/Chainflip 等渠道 | UTXO 模型 |
| Bitcoin Cash | BCH | 8 | satoshi | ❌ 否 | 使用 ThorChain/MAYAChain/Chainflip 等渠道 | UTXO 模型 |
| Dogecoin | DOGE | 8 | - | ❌ 否 | 使用 ThorChain/MAYAChain/Chainflip 等渠道 | UTXO 模型 |

**UTXO 链通用特性**：
- **授权机制**：不需要授权，UTXO 模型不涉及代币授权
- **交易费计算**：基于交易大小和费率计算，单位通常为 satoshi（BTC、BCH）或 litoshi（LTC）
- **Swap 渠道**：主要通过跨链桥渠道（ThorChain、MAYAChain、Chainflip）进行 Swap
- **地址格式**：需要验证地址格式正确性（Legacy、SegWit、Native SegWit 等）

---

## 🔍 网络特性详细说明

### 1. 授权机制差异

#### EVM 网络授权流程
1. **ERC20 代币 Swap**：必须先调用 `approve()` 授权合约使用代币
2. **授权方式**：
   - **Approve+Swap 捆绑**：两笔交易一起提交，先执行 Approve，成功后自动执行 Swap
   - **Approve、Swap 单独提交**：先单独提交 Approve 交易，确认后再提交 Swap 交易
3. **Native Token**：ETH、BNB、MATIC 等主币不需要授权，可以直接 Swap

#### 非 EVM 网络（异构链 + UTXO）
- **Tron 网络**：
  - TRC20 代币需要授权（类似 EVM 的 ERC20 授权流程）
  - Native token（TRX）不需要授权，可以直接 Swap
  - 授权方式：Approve+Swap 捆绑提交 或 Approve、Swap 单独提交
- **其他异构链**（Solana、TON、SUI、Aptos、Near）：
  - **不需要授权**：所有代币（包括主币和代币）都可以直接 Swap，无需授权流程
- **UTXO 链**：
  - **不需要授权**：UTXO 模型不涉及代币授权
- **测试用例要求**：
  - Tron 网络的测试用例需要包含授权相关测试（TRC20 代币）
  - 其他非 EVM 网络的测试用例中不包含授权相关测试

### 2. 交易费单位转换

| 网络类型 | 交易费单位 | 转换关系 | 示例 |
|---------|-----------|---------|------|
| EVM | wei | 1 ETH = 10^18 wei | 21000 wei ≈ 0.000021 ETH |
| Solana | lamports | 1 SOL = 10^9 lamports | 5000 lamports = 0.000005 SOL |
| Tron | sun | 1 TRX = 10^6 sun | 10000 sun = 0.01 TRX |
| TON | nanoTON | 1 TON = 10^9 nanoTON | 1000000 nanoTON = 0.001 TON |
| SUI | MIST | 1 SUI = 10^9 MIST | 1000000 MIST = 0.001 SUI |
| Aptos | octas | 1 APT = 10^8 octas | 100000 octas = 0.001 APT |
| Near | yoctoNEAR | 1 NEAR = 10^24 yoctoNEAR | 10^20 yoctoNEAR = 0.0001 NEAR |
| Bitcoin | satoshi | 1 BTC = 10^8 satoshi | 1000 satoshi = 0.00001 BTC |
| Litecoin | litoshi | 1 LTC = 10^8 litoshi | 1000 litoshi = 0.00001 LTC |
| Bitcoin Cash | satoshi | 1 BCH = 10^8 satoshi | 1000 satoshi = 0.00001 BCH |
| Dogecoin | - | 1 DOGE = 1 DOGE | 直接使用 DOGE 单位 |

### 3. 主币精度说明

| 网络类型 | 主币精度范围 | 说明 |
|---------|------------|------|
| EVM | 18 decimals | 所有 EVM 网络主币统一为 18 位精度 |
| Solana | 9 decimals | SOL 使用 9 位精度 |
| Tron | 6 decimals | TRX 使用 6 位精度 |
| TON | 9 decimals | TON 使用 9 位精度 |
| SUI | 9 decimals | SUI 使用 9 位精度 |
| Aptos | 8 decimals | APT 使用 8 位精度 |
| Near | 24 decimals | NEAR 使用 24 位精度（极高精度） |
| UTXO | 8 decimals | BTC、LTC、BCH、DOGE 统一为 8 位精度 |

### 4. 特殊规则

#### Ethereum USDT 二次授权
- **适用场景**：仅适用于 Ethereum 网络，USDT 代币兑换到 ETH
- **授权流程**：
  1. 第一次授权：将授权额度重置为 0
  2. 第二次授权：设置实际授权额度
- **原因**：Ethereum USDT 合约的特殊实现要求
- **测试要求**：必须单独编写测试用例，不能使用变量化处理

#### Tron TRC20 代币授权
- **适用场景**：Tron 网络，TRC20 代币 Swap
- **授权机制**：
  - TRC20 代币需要先授权（Approve）才能 Swap
  - Native token（TRX）不需要授权，可以直接 Swap
  - 授权方式：Approve+Swap 捆绑提交 或 Approve、Swap 单独提交
- **测试要求**：Tron 网络的测试用例需要包含授权相关测试（TRC20 代币）

#### Solana 多签交易
- **适用场景**：跨链 Swap 场景（如 CCTP 路径）
- **说明**：可能涉及多签交易，需要验证多签流程

---

## 📝 测试用例生成规则

### 根据网络类型生成测试用例

#### EVM 网络测试用例必须包含：
1. ✅ 授权流程测试（ERC20 代币）
   - 授权按钮状态验证
   - Approve+Swap 捆绑提交
   - Approve、Swap 单独提交
2. ✅ 金额覆盖测试（精度值、中间值、最大值）
3. ✅ 手续费测试（Gas 费计算和扣除）
4. ✅ 特殊情况测试（如 Ethereum USDT 二次授权）

#### Tron 网络测试用例必须包含：
1. ✅ 授权流程测试（TRC20 代币）
   - 授权按钮状态验证
   - Approve+Swap 捆绑提交
   - Approve、Swap 单独提交
2. ✅ 金额覆盖测试（精度值、中间值、最大值）
3. ✅ 手续费测试（交易费计算和扣除）
4. ✅ Native token（TRX）Swap 测试（不需要授权）

#### 其他非 EVM 网络（异构链 + UTXO）测试用例必须包含：
1. ❌ **不包含**授权流程测试
2. ✅ 金额覆盖测试（精度值、中间值、最大值）
3. ✅ 手续费测试（交易费计算和扣除）
4. ✅ 网络特定规则测试（如 Solana 多签交易）

### 网络标识在测试用例中的使用

生成测试用例时，应根据网络类型：
- **EVM 网络**：使用 "Ethereum"、"BSC"、"Polygon" 等作为示例网络
- **Tron 网络**：使用 "Tron" 作为示例网络，需要包含授权测试（TRC20 代币）
- **其他异构链**：使用实际网络名称（"Solana"、"TON"、"SUI"、"Aptos"、"Near"），不包含授权测试
- **UTXO 链**：使用实际网络名称（"Bitcoin"、"Litecoin"、"Bitcoin Cash"、"Dogecoin"），不包含授权测试

### 术语使用规范

| 网络类型 | Gas/交易费术语 | 示例 |
|---------|--------------|------|
| EVM | Gas 费、Gas Limit、wei | "Network Fee 显示预估 Gas 费转换为 ETH 后的数值" |
| 异构链 | 交易费、交易成本 | "Network Fee 显示预估交易费转换为 SOL 后的数值" |
| UTXO | 交易费、手续费 | "Network Fee 显示预估交易费" |

---

## 🔄 更新记录

### 2026-01-08
- 初始版本
- 添加 EVM 网络特性表（14 个网络）
- 添加异构链特性表（6 个网络）
- 添加 UTXO 链特性表（4 个网络）
- 明确授权机制差异和测试用例生成规则
- 添加交易费单位转换表
- 添加主币精度说明
- 添加特殊规则说明（Ethereum USDT 二次授权、Solana 多签交易）
- **更新 Tron 特殊规则**：Tron TRC20 代币需要授权，Native token（TRX）不需要授权

---

## 📌 注意事项

1. **新增网络时**：必须及时更新本表，包括网络类型、主币信息、授权要求、交易费单位等
2. **测试用例生成**：生成测试用例前，必须先查阅本表，确认网络特性
3. **授权逻辑**：
   - **EVM 网络**：必须包含授权相关测试（ERC20 代币）
   - **Tron 网络**：必须包含授权相关测试（TRC20 代币）
   - **其他非 EVM 网络**：不包含授权相关测试
4. **术语规范**：不同网络类型使用对应的术语（Gas 费 vs 交易费）
5. **精度处理**：不同网络的主币精度不同，测试用例中需要正确使用精度值

