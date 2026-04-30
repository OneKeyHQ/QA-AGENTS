# Wallet - 最近转账

> 模块：Wallet
> App 版本：
> 测试端：iOS / Android / Desktop / Extension
> 关联 PR：`https://github.com/OneKeyHQ/app-monorepo/pull/10507`

---

## 1. 需求背景

发送页收款人快速选择面板中的「最近转账」能力升级。最近转账不再只依赖本地存储记录，而是改为优先读取链上/API 返回的最近收款人；在不同网络支持度不一致时，按网络类型和数据可用性回退到本地链历史或存储兜底数据。

---

## 2. 功能描述

### 2.1 数据来源策略

最近转账按"链是否支持 `transfer-recipient` indexer"分两条**互不回退**的独立路径：

1. **API 路径（服务端过滤）** —— 支持 indexer 的链：
   - EVM：Ethereum / BSC / Polygon / Arbitrum / Avalanche / Optimism / Base
   - UTXO：Bitcoin / Litecoin / Dogecoin / Bitcoin Cash
   - Tron
   - **Solana**（已接入，与其它 API 支持链口径一致；服务端 `transfer-recipient` 返回 `supported=true`）
   - EVM 链统一以 `evm--1` 作为 API 读取维度
   - **服务端过滤**：合约交互地址（包括 Solana 的 Program 调用如 Jupiter / Raydium / Orca 等 dApp）、中心化 Swap 渠道订单（Changelly / ChangeHero / Exodus / Houdini）、诈骗地址、**0 金额转账记录**
   - API 返回为空即显示空态，**不**回退本地历史；API 异常保持不白屏
2. **本地历史路径（客户端过滤）** —— 不支持 indexer 的链（Aptos / Sui / Cardano 等）：
   - 数据来源于当前钱包在本地客户端发起过的历史转账
   - **客户端过滤**：合约交互、0 金额转账
   - **按账户隔离存储**：切换账户后仅显示当前账户的本地记录，不跨账户共用

### 2.2 账户聚合规则

不同链类型按不同维度聚合，决定"一个账户的最近转账"范围：

- **EVM 链（ETH / BSC / Polygon / Arbitrum / Avalanche / Optimism / Base）**
  - 按共享 `evm` 存储键聚合，跨 EVM 链共享最近转账池
  - 同一地址在不同 EVM 链有记录时，按最近时间保留
  - 地址按 lowercase 归一化，避免 checksum 大小写差异导致重复
  - 列表项可展示最近一次转账所在链名称
- **BTC / LTC（仅这两条链）**
  - 按**扩展公钥（xpub）**聚合，而非单一地址
  - 同一账户下所有派生路径（Taproot / Native SegWit / Nested SegWit / Legacy）产生的转账**都**进入列表
  - **历史使用过的旧地址**（已不是当前收款地址）产生的转账**仍**进入列表
  - 不同 HD 账户（不同 xpub）的转账互不串扰
- **DOGE / BCH / Tron / Solana**
  - 按单一地址聚合（不走 xpub）
  - Solana 仅单一账户地址，不涉及派生路径聚合

### 2.3 数据过滤规则

**API 路径（服务端过滤）** 不进入最近转账的记录：

- scam tx
- `Failed` / `Dropped` 交易
- 合约交互（`functionCall`）
- 无转出动作的记录
- 识别为合约地址的收款对象
- 中心化 Swap 渠道订单（Changelly / ChangeHero / Exodus / Houdini）
- **0 金额转账记录**
- **注意**：API 路径**不过滤**"转给自己"（允许展示自转记录）

**本地历史路径（客户端过滤）** 不进入最近转账的记录：

- 合约交互（dapp swap / 质押 / 能量租赁等触发的合约调用）
- 0 金额转账记录
- 账户隔离存储，不显示其他账户产生的本地历史

### 2.4 展示与交互规则

- 列表最多显示 `20` 条
- 列表按最近转账时间倒序
- 钱包内地址优先展示钱包账户名；地址簿地址展示地址簿名称；其他地址展示原始地址
- 搜索与联想**仅**支持：**收款地址**关键字、**钱包账户名称**；**不**支持按地址簿联系人名称、**不**支持按 `memo` / `note` / `destinationTag` 搜索或联想
- 选择最近转账项后，自动带入收款地址；**可**将该笔记录关联的 memo、备注或 destinationTag 一并带入发送表单（以数据源与实现为准）；**不要求**该地址已在地址簿。若该地址同时在地址簿存在联系人，联系人预填与最近转账数据的合并/覆盖顺序以产品实现为准
- **不支持删除最近转账记录**：最近转账列表是数据源的只读投影（API / 本地历史），用户**不能**在 UI 上删除单条记录；记录随数据源自然更新（新转账插入、超过 20 条截尾）

### 2.5 Memo / Tag 规则（最近转账 vs 地址簿）

- **最近转账**：列表**可展示**与该笔记录对应的备注、Memo、destinationTag 等标签（链/API 或合并后数据有则展示）；**不要求**收款地址在地址簿。选择后**可**从最近转账数据带入上述字段。
- **地址簿联系人**：若收款地址匹配已保存联系人且实现支持，**可**按联系人数据预填备注 / `destinationTag` 等；与最近转账数据同时存在时，合并/覆盖规则以产品实现为准。

### 2.6 账户与重装后的行为

- 最近转账与当前 `accountId` 相关
- 切换账户后，应展示当前账户对应的数据源结果
- 重装 / 重置后，若接口或链历史仍能返回数据，最近转账仍可展示；仅当前述数据源均无结果时显示空状态

---

## 3. 业务规则

| 规则项 | 规则描述 |
|-------|---------|
| 数据源分发 | 按链分两条独立路径：支持 indexer 的链走 API 路径；不支持的链走本地历史路径；两者**不互为回退** |
| API 支持链 | EVM（ETH / BSC / Polygon / Arbitrum / Avalanche / Optimism / Base）+ UTXO（BTC / LTC / DOGE / BCH）+ Tron + **Solana** |
| 本地历史链 | 上述 API 支持链以外的全部链（Aptos / Sui / Cardano 等） |
| 条数上限 | 列表最多 20 条 |
| 排序 | 按最近转账时间倒序 |
| EVM 聚合 | 所有 EVM 链共享最近转账池，按最近时间去重 |
| EVM 去重 | 地址 lowercase 后去重 |
| BTC / LTC 聚合 | 按**扩展公钥（xpub）**聚合：所有派生路径（Taproot / Native SegWit / Nested SegWit / Legacy）+ 历史旧地址产生的转账都计入 |
| DOGE / BCH / Tron / Solana 聚合 | 按单一地址聚合（不走 xpub） |
| 链名展示 | EVM 聚合结果可显示最近一次转账所在链名称 |
| API 过滤 | 合约交互、合约地址、scam、Failed / Dropped、Swap 中心化渠道、**0 金额**；**不过滤**"转给自己" |
| 本地历史过滤 | 合约交互、**0 金额**；按账户隔离存储 |
| Memo / 备注与 Tag | 最近转账列表**可展示** memo / note / destinationTag 等标签；选择后**可**从最近转账带入；不要求地址在地址簿；与地址簿联系人并存时以产品合并规则为准 |
| 搜索与联想 | 仅地址、钱包账户名称；memo / note / destinationTag **无**搜索、无联想 |
| 账户隔离 | 最近转账按当前账户维度展示，不应串账户 |
| 跨钱包类型一致性 | 同一账户在 HD 钱包 / HW 钱包 / 观察地址下导入时，最近转账中地址字符串展示一致（特别是闪电网络 LNURL 地址不得退化为原始 pubkey、不得截断或大小写失真）；不要求列表条数、顺序、memo / tag 完全一致（数据源、缓存可能存在差异） |
| 重装行为 | 不再默认依赖本地缓存是否存在；只在所有数据源均无结果时显示空态 |

---

## 4. 已知风险

- 不同链对 `transfer-recipient` 的支持度不一致
- API 支持但空数据、API 不支持、API 异常三类分支容易混淆
- EVM 聚合后链名展示可能与单链心智不一致
- memo/tag 字段在不同链的映射不一致
- 重装 / 切账户后的展示口径与旧版本明显不同，容易沿用旧测试预期

---

## 5. 关联资源

- PR：`https://github.com/OneKeyHQ/app-monorepo/pull/10507`
- 现有 Jira：`OK-23801`
- 关键实现：
  - `useRecentRecipientsData.ts`
  - `SimpleDbEntityRecentRecipients.ts`
  - `RecentRecipients.tsx`

---

## 6. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-04-03 | v2.0 | 1. 最近转账由“本地记录”升级为“链上/API 优先”<br>2. 新增 API / 本地历史 / stored recipients 多级回退策略<br>3. EVM 最近转账改为跨 EVM 链聚合并按 lowercase 去重<br>4. 新增 memo/tag、链名展示与多类异常过滤规则<br>5. 调整账户切换与重装后的预期口径 |
| 2026-04-05 | v2.1 | 明确中心化 `transfer-recipient` 等接口 **服务端过滤 Swap 相关中心化转账记录**，客户端与接口返回对齐 |
| 2026-04-07 | v2.2 | 更正：最近转账**不展示、不携带**历史备注与 Memo，选择后**仅**带地址；备注/Memo/tag **仅**地址簿联系人可预填；**移除**「`Call:` memo 不进入列表」的错误规则；合约类已由 functionCall/合约地址等规则过滤，**不**单列 `Call:` memo 场景 |
| 2026-04-07 | v2.3 | 「最近转账」搜索与联想：仅地址、钱包账户名称；memo / note / Tag **无**搜索与联想 |
| 2026-04-07 | v2.4 | 更正过滤口径：最近转账允许展示「转给自己」与「0 金额」的链上记录；客户端不应额外过滤这两类记录 |
| 2026-04-08 | v2.5 | 更正 Memo/Tag：最近转账列表可展示标签，选择后可带入 memo/tag；不要求地址在地址簿；与地址簿并存时合并规则以实现为准 |
| 2026-04-17 | v2.6 | 1. 数据源策略重写为两条**互不回退**的独立路径（API 路径 vs 本地历史路径），按链是否支持 `transfer-recipient` indexer 分发<br>2. 明确 API 支持链清单：EVM（ETH/BSC/Polygon/Arbitrum/Avalanche/Optimism/Base）+ UTXO（BTC/LTC/DOGE/BCH）+ Tron；Solana 规划中<br>3. 明确 API 过滤规则（合约交互、scam、Swap 中心化渠道、Failed/Dropped）**不过滤 0 金额**<br>4. 新增本地历史路径过滤规则：**合约交互 + 0 金额 + 账户隔离**（与 v2.4 "客户端不过滤 0 金额" 的差异：v2.4 描述的是 API 链上记录，本地历史路径客户端需过滤 0 金额）<br>5. 新增跨钱包类型一致性规则：同地址在软件 / 硬件 / 观察地址下的最近转账应一致<br>6. 新增 xpub 聚合规则：**仅 BTC / LTC** 按扩展公钥聚合，所有派生路径（Taproot / Native SegWit / Nested SegWit / Legacy）+ 历史旧地址产生的转账都计入列表；**DOGE / BCH / Tron 按单一地址聚合**，不走 xpub |
| 2026-04-17 | v2.7 | 更正：最近转账**不支持删除单条记录**；列表是数据源（API / 本地历史）的只读投影，随数据源自然更新；移除 v2.0 的"删除后列表同步移除"描述 |
| 2026-04-17 | v2.8 | 更正 0 金额过滤口径：**API 服务端 + 本地历史客户端双端都过滤** 0 金额转账记录；**撤销** v2.4 "客户端不应额外过滤 0 金额" / v2.6 "API 不过滤 0 金额" 的错误描述。"转给自己"仍允许展示。 |
| 2026-04-24 | v2.9 | **Solana 接入 API 路径**：服务端 `transfer-recipient` 对 Solana（`sol--101`）返回 `supported=true`，最近转账从本地历史路径迁移至 API 路径；聚合维度为单一地址（与 DOGE / BCH / Tron 一致）；dApp（Jupiter / Raydium / Orca 等）的 Program 调用由服务端统一过滤，客户端不再处理 Solana 本地历史路径。 |
