#!/usr/bin/env bash
# 场景回归对照：同一场景分别跑在两个固件 commit 上（修复前应 FAIL、修复后应 PASS）。
#
# 用法：
#   tools/regress_scenario.sh <scenario.json> <bad-commit> <good-commit> [out-root]
#   例：tools/regress_scenario.sh scenarios/ok-64012-ms-warning-scroll.json aea0ae02 d7e612e6
#
# 每个 commit 在 QA-AGENTS/.deps/firmware-pro2-<commit>/ 下按需克隆（从 FIRMWARE_DIR 本地仓库，不走网络），
# lvgl 子模块与资源产物（utils/resource/output，gitignored）软链到 FIRMWARE_DIR 的现成目录，
# 各自在 build-<commit>/ 下构建，然后跑场景。退出码：两边都符合预期 = 0，否则 1。
#
# 环境变量：
#   FIRMWARE_DIR  本地固件仓库（默认 ../../../Pro2/firmware-pro2，即 codex-workspace/Pro2/firmware-pro2）
set -euo pipefail

SIM_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$SIM_DIR/../.." && pwd)"
FIRMWARE_DIR="${FIRMWARE_DIR:-$(cd "$SIM_DIR/../../../Pro2/firmware-pro2" 2>/dev/null && pwd || true)}"

if [ $# -lt 3 ]; then
    sed -n 2,15p "$0"
    exit 2
fi
SCENARIO="$1"; BAD="$2"; GOOD="$3"; OUT_ROOT="${4:-$SIM_DIR/out/regress}"
# 场景与输出目录转绝对路径：sim 在 SIM_DIR 下运行（A: 盘相对 cwd），rm/mkdir 在调用者目录运行，两边必须指向同一处
if [ ! -f "$SCENARIO" ]; then
    echo "错误: 场景文件不存在: $SCENARIO" >&2
    exit 2
fi
SCENARIO="$(cd "$(dirname "$SCENARIO")" && pwd)/$(basename "$SCENARIO")"
mkdir -p "$OUT_ROOT"
OUT_ROOT="$(cd "$OUT_ROOT" && pwd)"
if [ ! -d "$FIRMWARE_DIR/.git" ]; then
    echo "错误: FIRMWARE_DIR 不是 git 仓库: $FIRMWARE_DIR" >&2
    exit 2
fi
if [ ! -d "$FIRMWARE_DIR/modules/lvgl/src" ] || [ ! -d "$FIRMWARE_DIR/utils/resource/output/i18n" ]; then
    echo "错误: FIRMWARE_DIR 需已初始化 lvgl 子模块并生成资源（见 CMakeLists.txt 顶部注释）" >&2
    exit 2
fi

prepare_tree() { # <commit> → 打印树路径
    local commit="$1"
    local short; short="$(git -C "$FIRMWARE_DIR" rev-parse --short "$commit")"
    local tree="$REPO_ROOT/.deps/firmware-pro2-$short"
    if [ ! -d "$tree/.git" ]; then
        echo "clone firmware-pro2 @ $short -> $tree" >&2
        git clone --quiet --no-checkout "$FIRMWARE_DIR" "$tree" || return 2
        git -C "$tree" checkout --quiet "$commit" || return 2
    fi
    # lvgl 子模块：复用 FIRMWARE_DIR 的（子模块 commit 相同时才正确，不同则提示）
    if [ ! -e "$tree/modules/lvgl/CMakeLists.txt" ]; then
        local want have
        want="$(git -C "$tree" ls-tree HEAD modules/lvgl | awk '{print $3}')"
        have="$(git -C "$FIRMWARE_DIR" ls-tree HEAD modules/lvgl | awk '{print $3}')"
        if [ "$want" != "$have" ]; then
            echo "警告: $short 的 lvgl 子模块 ($want) 与 FIRMWARE_DIR ($have) 不同，仍复用后者；合成逻辑不受影响但 LVGL 行为可能有差" >&2
        fi
        rmdir "$tree/modules/lvgl" 2>/dev/null || true
        ln -sfn "$FIRMWARE_DIR/modules/lvgl" "$tree/modules/lvgl" || return 2
    fi
    # 资源产物（gitignored）：images / fonts 软链复用；i18n 必须按该 commit 自己的翻译生成
    # （固件按 i18n_tags.h 键数校验 JSON，键集不一致整份翻译作废、页面文案为空、tap_text 定位失败）
    # 以哨兵文件判断生成完成，半截的 i18n 目录不会被当作已生成
    if [ ! -f "$tree/utils/resource/output/.sim_i18n_ok" ]; then
        mkdir -p "$tree/utils/resource/output" || return 2
        ln -sfn "$FIRMWARE_DIR/utils/resource/output/images" "$tree/utils/resource/output/images" || return 2
        ln -sfn "$FIRMWARE_DIR/utils/resource/output/fonts" "$tree/utils/resource/output/fonts" || return 2
        (cd "$tree" && python3 utils/resource/resource_pkg.py font --only json > "$tree.i18n.log" 2>&1) \
            || { echo "错误: $short 生成 i18n 失败，见 $tree.i18n.log" >&2; return 2; }
        touch "$tree/utils/resource/output/.sim_i18n_ok" || return 2
    fi
    echo "$tree"
}

build_and_run() { # <commit> <expect: FAIL|PASS>
    local commit="$1" expect="$2"
    local short; short="$(git -C "$FIRMWARE_DIR" rev-parse --short "$commit")"
    local tree; tree="$(prepare_tree "$commit")" || { echo "准备固件树失败: $commit" >&2; return 2; }
    local build="$SIM_DIR/build-$short"
    echo "== firmware @ $short → $build" >&2
    cmake -S "$SIM_DIR" -B "$build" -G Ninja -DFIRMWARE_DIR="$tree" > "$build.configure.log" 2>&1 || { echo "configure 失败，见 $build.configure.log" >&2; return 2; }
    ninja -C "$build" > "$build.build.log" 2>&1 || { echo "构建失败，见 $build.build.log" >&2; return 2; }
    local out="$OUT_ROOT/$(basename "${SCENARIO%.json}")-$short"
    rm -rf "$out"
    mkdir -p "$OUT_ROOT"
    local rc=0
    (cd "$SIM_DIR" && SDL_VIDEODRIVER=dummy SIM_FIRMWARE_COMMIT="$short" "$build/onekey-sim" --scenario "$SCENARIO" --out "$out" > "$out.stdout.log" 2>&1) || rc=$?
    grep '^SCENARIO|' "$out.stdout.log" || true
    local got="PASS"; [ "$rc" -eq 0 ] || got="FAIL"
    [ "$rc" -le 1 ] || got="ERROR"
    # "修复前 FAIL" 必须是静态区域真的变了（violations > 0 且没有步骤缺合成帧），不能拿场景错误 / 缺合成帧充数
    if [ "$got" = "FAIL" ] && [ "$expect" = "FAIL" ]; then
        python3 -c 'import json,sys; r=json.load(open(sys.argv[1])); ok=r["violations"]>0 and not any(s["compose_missing"] for s in r["steps"]); sys.exit(0 if ok else 1)' "$out/report.json" \
            || got="FAIL(非断言失败)"
    fi
    echo "firmware @ $short: $got (期望 $expect) — $out/report.md" >&2
    [ "$got" = "$expect" ]
}

ok=0
build_and_run "$BAD" FAIL || ok=1
build_and_run "$GOOD" PASS || ok=1

# resroot/（A: 盘软链）是所有 build 目录共用的，跟随"最后一次 configure"的 FIRMWARE_DIR。
# 两次对照各自 configure 后立即跑完，顺序正确；结束时把默认 build/ 重新 configure 一次，
# 让 resroot 回到 FIRMWARE_DIR（否则之后手动跑 ./build/onekey-sim 会读到 .deps 里某个 commit 的资源）。
if [ -f "$SIM_DIR/build/CMakeCache.txt" ]; then
    cmake -S "$SIM_DIR" -B "$SIM_DIR/build" -DFIRMWARE_DIR="$FIRMWARE_DIR" > /dev/null 2>&1 || true
fi
if [ "$ok" -eq 0 ]; then
    echo "OK: 修复前 FAIL、修复后 PASS，场景 $SCENARIO 能区分 $BAD / $GOOD"
else
    echo "NG: 结果与预期不符，见上方 report.md" >&2
fi
exit "$ok"
