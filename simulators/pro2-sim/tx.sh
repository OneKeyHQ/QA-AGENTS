#!/bin/zsh
# 交易确认页快速测试工具（真实查表 + 真实换算）
# 用法:
#   ./tx.sh                       随机抽一个内置代币 + 随机原始金额
#   ./tx.sh <合约地址> <原始整数>   用你自己的值（原始金额=最小单位整数）
#   ./tx.sh 0xdac17f958d2ee523a2206206994597c13d831ec7 5000000   # USDT → 5
# 终端打印「是否内置 / decimals / 原始 / 换算」，并弹出交易页 GUI（鼠标=触摸，可点 Overview/Details）。
SIM="$HOME/workspace/codex-workspace/firmware-pro2-sim"
cd "$SIM" || { echo "找不到 sim 目录"; exit 1; }
REG="src/token_registry.inc"

pkill -f 'build/onekey-sim' 2>/dev/null
sleep 0.3

if [[ -n "$1" && -n "$2" ]]; then
  addr="$1"; raw="$2"
else
  # 随机选一行内置代币，按 " 分割解析: $2=地址 $4=符号 $5含decimals $6=链
  read addr sym dec chain <<< "$(awk -F'"' '
    /^[[:space:]]*\{/ { rows[++n] = $0 }
    END {
      srand(); idx = int(rand()*n) + 1; line = rows[idx]
      split(line, f, "\"")
      d = f[5]; gsub(/[^0-9]/, "", d)
      print f[2], f[4], d, f[6]
    }' "$REG")"
  # 随机原始金额: 长度约 decimals + (1..4) 位
  extra=$(( (RANDOM % 4) + 1 )); digits=$(( dec + extra )); raw=""
  for i in $(seq 1 $digits); do raw="${raw}$(( RANDOM % 10 ))"; done
  raw="${raw##0}"; [[ -z "$raw" ]] && raw=1
  echo "🎲 随机: $sym  decimals=$dec  链=$chain"
fi

echo "▶ 合约=$addr  原始金额=$raw"
./build/onekey-sim --demo-tx-raw "$addr" "$raw"   # 前台运行: 打印换算 + 弹窗; 关窗口即结束
