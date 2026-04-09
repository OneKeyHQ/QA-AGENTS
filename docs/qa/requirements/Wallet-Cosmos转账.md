# Wallet - Cosmos 系转账（软件钱包）

## 需求背景

覆盖 Cosmos SDK / IBC 生态多条网络的软件钱包转账能力，验证主币与 IBC 代币、金额边界（最大可用、极小精度）、Memo（含 UTF-8 与 Emoji）及与预览页、历史记录、区块浏览器的一致性。

## 功能描述

- 在指定 Cosmos 系网络上选择主币或代币发起转账。
- 支持 Memo/备注字段；链侧上限为 **512 字节**（UTF-8 编码计字节，非仅字符数）。
- 支持 Emoji 等 Unicode 字符作为 Memo 内容（在字节上限内）。

## 业务规则

| 项 | 规则 |
|----|------|
| Memo 上限 | 最大 **512 字节**（UTF-8）；超出时前端拦截或报错，不可提交 |
| Memo 内容 | 允许空、纯数字、中英文、Emoji、超长边界字符串（≤512 字节） |
| 金额 | 需覆盖：最大可用（Max）、链/代币允许的最小精度、中间值；主币与 IBC 代币分别覆盖 |
| 网络 | 至少包含：Akash、Cosmos、Crypto.org、Fetch.ai、Juno、Osmosis（主币+跨链代币）、Secret、Celestia、Babylon、Noble（USDC）等 |

## 测试端

iOS / Android / Desktop / Extension / Web（以产品支持为准）

## 关联资源

- 链规则：`docs/qa/rules/transfer-chain-rules.md` — Cosmos 系章节
- 钱包规则：`docs/qa/rules/wallet-rules.md`
- 用例：`docs/qa/testcases/cases/wallet/2026-04-08_Wallet-Cosmos转账-软件钱包.md`

## 变更记录

| 日期 | 说明 |
|------|------|
| 2026-04-08 | 初版：Cosmos 系软件钱包转账范围、Memo 512 字节、多网络参数矩阵 |
