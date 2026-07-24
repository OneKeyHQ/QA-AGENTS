# 内置代币参照榜单

固件内置代币表（SIM-TOKEN-001 用例）的对照基准，原位于 `~/workspace/codex-workspace/Pro2/内置代币合约地址/`，2026-07-23 迁入本仓库作为唯一维护来源。

| 文件 | 链 | 条数 | 结构 |
|------|-----|------|------|
| eth-top-100.json | Ethereum (1) | 100 | address / symbol / name / decimals |
| bsc-top-50.json | BSC (56) | 50 | 同上 |
| bsc-stock-top-20.json | BSC (56) 股票代币 | 20 | rank / ticker / bsc_contract（无 decimals，只查收录 + symbol 包含性） |
| polygon-top-50.json | Polygon (137) | 50 | address / symbol / name / decimals |
| base-top-50.json | Base (8453) | 50 | 同上 |
| arb-top-50.json | Arbitrum (42161) | 50 | 同上 |
| sol-top-50.json | Solana (SPL mint) | 50 | 同上 |

- **被测对象**（固件真源）：EVM `frozen/app/ethereum/eth_utils/tokens.py`、Solana `frozen/app/solana/sol_utils/spl_tokens.py`
- **执行**：`FIRMWARE_DIR=<固件目录> python3 simulators/tests/check_builtin_tokens.py [--verbose]`
- **更新榜单**：直接替换/编辑本目录 JSON（保持字段结构），重跑脚本即可
