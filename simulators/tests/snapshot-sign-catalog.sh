#!/usr/bin/env bash
# SIM-TX-001 链转账/签名页走查：批量导出全部 --demo-catalog 签名页截图。
#
# 覆盖固件 frozen/app 全部 17 条链（BTC 流程同时代表 LTC/DOGE/BCH）、每链每种
# 签名流程一条（转账/代币/授权/盲签/消息签名/EIP-712 等，共 77 条，随
# demo_catalog.c 演进）。页面由固件真实 view_sign_page 渲染。
#
# 用法（在 QA-AGENTS 仓库根目录）:
#   ./simulators/tests/snapshot-sign-catalog.sh [语言码] [输出目录]
#   ./simulators/tests/snapshot-sign-catalog.sh                       # 英文 → sign-catalog-out/
#   ./simulators/tests/snapshot-sign-catalog.sh zh-Hans-CN out-zh     # 中文
#
# 退出码 = 失败条数（0 = 全绿）。
set -uo pipefail

LANG_CODE="${1:-}"
OUT_DIR="${2:-sign-catalog-out}"
SIM_DIR="$(cd "$(dirname "$0")/../pro2-sim" && pwd)"
BIN="$SIM_DIR/build/onekey-sim"

[ -x "$BIN" ] && cd "$SIM_DIR" || { echo "错误: $BIN 不存在，先构建（见 simulators/README.md）" >&2; exit 125; }
mkdir -p "$OUT_DIR"
OUT_ABS="$(cd "$OUT_DIR" && pwd)"

LANG_ARGS=()
[ -n "$LANG_CODE" ] && LANG_ARGS=(--lang "$LANG_CODE")

export SDL_VIDEODRIVER=dummy
fail=0 total=0
while IFS='|' read -r id _rest; do
    [ -z "$id" ] && continue
    total=$((total + 1))
    if ./build/onekey-sim ${LANG_ARGS[@]+"${LANG_ARGS[@]}"} --demo-catalog "$id" --demo-tx-snap "$OUT_ABS/$id.png" > /dev/null 2>&1; then
        echo "OK    $id"
    else
        echo "FAIL  $id"
        fail=$((fail + 1))
    fi
done < <(./build/onekey-sim --demo-catalog list 2>/dev/null | grep '|')

echo "sign-catalog 完成: $fail/$total 失败 -> $OUT_ABS ${LANG_CODE:+(lang=$LANG_CODE)}"
exit "$fail"
