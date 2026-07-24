#!/usr/bin/env python3
"""SIM-TOKEN-001 内置代币对照检查。

比对固件内置代币表（真源）与参照榜单（simulators/testdata/builtin-tokens/*.json）：
  固件真源:
    EVM    <FIRMWARE_DIR>/tasks/task_mp_engine/micropython_port/frozen/app/ethereum/eth_utils/tokens.py
    Solana <FIRMWARE_DIR>/tasks/task_mp_engine/micropython_port/frozen/app/solana/sol_utils/spl_tokens.py
  参照文件 → 链的映射见 REF_CHAIN_MAP。

检查语义（以参照榜单为基准的单向检查）：
  - 缺失（榜单代币不在固件内置表）→ 覆盖率警告（真机上该代币签名时显示 UNKNOWN_TOKEN，不算错误）
  - 字段不一致（地址命中但 symbol / decimals 不同）→ 硬错误，退出码 = 不一致条数
  - name 不一致仅作 info 输出（固件 name 来源 pro1，措辞差异常见）

用法：
  FIRMWARE_DIR=~/workspace/codex-workspace/Pro2/firmware-pro2 \
      python3 simulators/tests/check_builtin_tokens.py [--verbose]
  不设 FIRMWARE_DIR 时默认 QA-AGENTS/.deps/firmware-pro2（bootstrap 托管 clone）。
"""

import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
REF_DIR = REPO_ROOT / "simulators" / "testdata" / "builtin-tokens"

# 参照文件 → 固件表的链定位（EVM 用 chain_id，Solana 特殊处理）
REF_CHAIN_MAP = {
    "eth-top-100.json": 1,
    "bsc-top-50.json": 56,
    "bsc-stock-top-20.json": 56,
    "polygon-top-50.json": 137,
    "base-top-50.json": 8453,
    "arb-top-50.json": 42161,
    "sol-top-50.json": "solana",
}


def firmware_dir() -> Path:
    fw = os.environ.get("FIRMWARE_DIR") or str(REPO_ROOT / ".deps" / "firmware-pro2")
    p = Path(fw).expanduser()
    if not (p / "tasks").is_dir():
        sys.exit(f"错误: 固件目录无效: {p}（设 FIRMWARE_DIR 或先跑 pro2-sim-bootstrap.sh）")
    return p


def parse_evm_tokens(fw: Path) -> dict:
    """返回 {chain_id: {address_lower: (symbol, decimals, name)}}"""
    src = (
        fw / "tasks/task_mp_engine/micropython_port/frozen/app/ethereum/eth_utils/tokens.py"
    ).read_text()
    tables: dict = {}
    chain_id = None
    # 生成文件结构固定：`if chain_id == N:` 分块 + 四元组 yield（address bytes 跨行）
    for m in re.finditer(
        r"if chain_id == (\d+):|yield \(.*?\n\s*(b\"[^\"]+\"),\n\s*\"([^\"]*)\",\n\s*(\d+),\n\s*\"([^\"]*)\",",
        src,
        re.S,
    ):
        if m.group(1):
            chain_id = int(m.group(1))
            tables.setdefault(chain_id, {})
            continue
        addr_bytes, symbol, decimals, name = m.group(2), m.group(3), m.group(4), m.group(5)
        raw = addr_bytes[2:-1].encode().decode("unicode_escape").encode("latin1")
        addr = "0x" + raw.hex()
        tables[chain_id][addr] = (symbol, int(decimals), name)
    return tables


def parse_spl_tokens(fw: Path) -> dict:
    """返回 {mint: (symbol, decimals, name)}（name 取行尾注释）"""
    src = (
        fw / "tasks/task_mp_engine/micropython_port/frozen/app/solana/sol_utils/spl_tokens.py"
    ).read_text()
    table = {}
    for m in re.finditer(
        r"yield \(\"([^\"]+)\", \"([^\"]+)\", (\d+)\)(?:\s*#\s*\"([^\"]*)\")?", src
    ):
        symbol, mint, decimals, name = m.groups()
        table[mint] = (symbol, int(decimals), name or "")
    return table


def main() -> int:
    verbose = "--verbose" in sys.argv
    fw = firmware_dir()
    evm = parse_evm_tokens(fw)
    spl = parse_spl_tokens(fw)
    print(f"固件: {fw}")
    print(f"内置表: EVM {sum(len(v) for v in evm.values())} 条（{len(evm)} 链）, SPL {len(spl)} 条")

    total_mismatch = 0
    for ref_name, chain in REF_CHAIN_MAP.items():
        ref_path = REF_DIR / ref_name
        if not ref_path.exists():
            print(f"\n[{ref_name}] 参照文件缺失: {ref_path}")
            total_mismatch += 1
            continue
        refs = json.load(open(ref_path))
        missing, mismatch, name_diff = [], [], []
        for t in refs:
            # bsc-stock 榜单是 {rank, ticker, bsc_contract} 结构且无 decimals：
            # 归一化后只做收录 + symbol 包含性检查（链上符号可能带后缀，如 NVDAx）
            if "ticker" in t:
                hit = evm.get(chain, {}).get(t["bsc_contract"].lower())
                if hit is None:
                    missing.append(f"{t['ticker']} {t['bsc_contract']}")
                elif t["ticker"].lower() not in hit[0].lower():
                    mismatch.append(
                        f"{t['bsc_contract']} 参照 ticker {t['ticker']} ∉ 固件 symbol {hit[0]}"
                    )
                continue
            symbol, decimals, name = t["symbol"], int(t["decimals"]), t.get("name", "")
            if chain == "solana":
                hit = spl.get(t["address"])
            else:
                hit = evm.get(chain, {}).get(t["address"].lower())
            if hit is None:
                missing.append(f"{symbol} {t['address']}")
                continue
            fw_symbol, fw_decimals, fw_name = hit
            if fw_symbol != symbol or fw_decimals != decimals:
                mismatch.append(
                    f"{t['address']} 参照 {symbol}/{decimals} ≠ 固件 {fw_symbol}/{fw_decimals}"
                )
            elif name and fw_name and fw_name != name:
                name_diff.append(f"{symbol}: 参照 '{name}' / 固件 '{fw_name}'")
        total_mismatch += len(mismatch)
        cov = len(refs) - len(missing)
        print(f"\n[{ref_name}] 覆盖 {cov}/{len(refs)}，字段不一致 {len(mismatch)}")
        for line in mismatch:
            print(f"  ✗ {line}")
        if verbose:
            for line in missing:
                print(f"  - 缺失: {line}")
            for line in name_diff:
                print(f"  ~ name: {line}")
        elif missing:
            print(f"  （缺失 {len(missing)} 条，--verbose 查看清单）")

    print(f"\n结果: {'PASS' if total_mismatch == 0 else 'FAIL'}（字段不一致 {total_mismatch} 条）")
    return min(total_mismatch, 125)


if __name__ == "__main__":
    sys.exit(main())
