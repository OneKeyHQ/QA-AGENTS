#!/usr/bin/env bash
# pro2 模拟器 bootstrap：拉取 firmware-pro2 dev 分支 → 构建 → 30 帧无头冒烟。
#
# 用法：
#   ./simulators/pro2-sim-bootstrap.sh
#
# 环境变量：
#   FIRMWARE_DIR     已有的 firmware-pro2 本地 clone 路径。指定后脚本按原样使用
#                    （不 fetch / 不切分支），适合复用本地已在维护的固件仓库。
#                    不指定时默认 clone/更新到 QA-AGENTS/.deps/firmware-pro2（已 gitignore）。
#   FIRMWARE_REMOTE  固件仓库地址（默认 OneKeyHQ/firmware-pro2）
#   FIRMWARE_BRANCH  跟踪分支（默认 dev）
#
# 构建后固件 commit 记录在 simulators/pro2-sim/build/firmware-commit.txt，
# 测试报告引用该 hash 即可复现（无需把固件代码入库）。
#
# 注意：拉最新 dev 后若链接报 undefined symbols，是 dev 新增页面引用了未桩的
# 固件后端符号 —— 按现有风格在 pro2-sim/src/sim_stubs_pages.c 补最小桩。
set -euo pipefail

SIM_DIR="$(cd "$(dirname "$0")/pro2-sim" && pwd)"
REPO_ROOT="$(cd "$SIM_DIR/../.." && pwd)"

DEFAULT_FIRMWARE_DIR="$REPO_ROOT/.deps/firmware-pro2"
FIRMWARE_REMOTE="${FIRMWARE_REMOTE:-https://github.com/OneKeyHQ/firmware-pro2.git}"
FIRMWARE_BRANCH="${FIRMWARE_BRANCH:-dev}"

if [ -n "${FIRMWARE_DIR:-}" ]; then
    # 外部 clone：按原样使用，由使用者自己负责更新到想测的 commit
    if [ ! -d "$FIRMWARE_DIR/.git" ]; then
        echo "错误: FIRMWARE_DIR 不是 git 仓库: $FIRMWARE_DIR" >&2
        exit 1
    fi
    echo "使用外部固件仓库（不自动更新）: $FIRMWARE_DIR"
else
    # 托管 clone：.deps 下的仓库视为一次性依赖，强制对齐 origin/$FIRMWARE_BRANCH
    FIRMWARE_DIR="$DEFAULT_FIRMWARE_DIR"
    if [ ! -d "$FIRMWARE_DIR/.git" ]; then
        echo "clone firmware-pro2 ($FIRMWARE_BRANCH) -> $FIRMWARE_DIR"
        git clone --depth 1 --branch "$FIRMWARE_BRANCH" --single-branch \
            "$FIRMWARE_REMOTE" "$FIRMWARE_DIR"
    else
        echo "更新 firmware-pro2 -> origin/$FIRMWARE_BRANCH"
        git -C "$FIRMWARE_DIR" fetch --depth 1 origin "$FIRMWARE_BRANCH"
        git -C "$FIRMWARE_DIR" reset --hard FETCH_HEAD
    fi
    git -C "$FIRMWARE_DIR" submodule update --init modules/lvgl
fi

FIRMWARE_COMMIT="$(git -C "$FIRMWARE_DIR" rev-parse HEAD)"
echo "firmware-pro2 @ $FIRMWARE_COMMIT"

cmake -S "$SIM_DIR" -B "$SIM_DIR/build" -G Ninja -DFIRMWARE_DIR="$FIRMWARE_DIR"
ninja -C "$SIM_DIR/build"
echo "$FIRMWARE_COMMIT" > "$SIM_DIR/build/firmware-commit.txt"

# 无头冒烟：A:/ 资源路径相对 cwd，必须在 sim 根目录运行
(cd "$SIM_DIR" && SDL_VIDEODRIVER=dummy ./build/onekey-sim --frames 30)

echo "OK: 构建 + 30 帧冒烟通过 | firmware @ $FIRMWARE_COMMIT"
echo "全量逐页截图验证: cd $SIM_DIR && ./build/onekey-sim --snapshot <dir>"
