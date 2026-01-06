#!/usr/bin/env bash
#
# 启动 Chrome MCP 调试实例
#
# 用法:
#   ./start-mcp-chrome.sh                    # 默认端口 9222, Profile 2
#   ./start-mcp-chrome.sh 12306              # 指定端口 12306
#   PORT=9222 PROFILE="Profile 2" ./start-mcp-chrome.sh
#
# 环境变量:
#   PORT         - 调试端口 (默认: 9222, 或第一个参数)
#   PROFILE      - Chrome Profile 目录名 (默认: "Profile 2")
#   HEADLESS     - 1=无头模式 (默认: 0)
#   COPY_PROFILE - 1=复制配置 (默认: 1)
#   CDP_CHECK    - 1=等待 CDP 就绪 (默认: 1)
#   KILL_CHROME  - 1=启动前关闭现有 Chrome (默认: 0)
#
set -e

# 支持第一个参数作为端口
PORT="${1:-${PORT:-9222}}"
SRC="${SRC:-$HOME/Library/Application Support/Google/Chrome}"

# 数据目录（放在 /tmp 避免污染项目目录）
DST="${DST:-/tmp/chrome-mcp-user-data-$PORT}"

# 配置
PROFILE="${PROFILE:-Profile 2}"
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

# 可选开关
HEADLESS="${HEADLESS:-0}"
COPY_PROFILE="${COPY_PROFILE:-1}"
CDP_CHECK="${CDP_CHECK:-1}"
KILL_CHROME="${KILL_CHROME:-0}"

echo "🚀 启动 Chrome MCP 调试实例"
echo "   端口: $PORT"
echo "   Profile: $PROFILE"
echo "   数据目录: $DST"

# 是否关闭现有 Chrome
if [[ "$KILL_CHROME" == "1" ]]; then
  echo "⚠️  关闭现有 Chrome 进程..."
  pkill -f "Google Chrome" || true
  sleep 1
fi

# 清理并创建数据目录
rm -rf "$DST" || true
mkdir -p "$DST"

# 复制配置
if [[ "$COPY_PROFILE" == "1" ]]; then
  echo "📂 复制配置: Local State + $PROFILE ..."
  cp "$SRC/Local State" "$DST/" 2>/dev/null || true
  mkdir -p "$DST/$PROFILE"
  rsync -a "$SRC/$PROFILE/" "$DST/$PROFILE/" \
    --exclude "Cache" \
    --exclude "Code Cache" \
    --exclude "GPUCache" \
    --exclude "Service Worker" \
    --exclude "*.log" \
    --exclude "Singleton*" \
    --exclude "Lockfile"
  echo "✅ 复制完成"
fi

# 无头模式参数
HEADLESS_ARGS=()
if [[ "$HEADLESS" == "1" ]]; then
  HEADLESS_ARGS+=(--headless=new --disable-gpu)
  echo "🖥️  无头模式启用"
fi

# 启动 Chrome
"$CHROME_BIN" \
  --remote-debugging-port=$PORT \
  --user-data-dir="$DST" \
  --profile-directory="$PROFILE" \
  "${HEADLESS_ARGS[@]}" \
  --no-first-run --no-default-browser-check &

# 等待 CDP 就绪
if [[ "$CDP_CHECK" == "1" ]]; then
  echo "⏳ 等待 CDP 就绪..."
  for i in {1..50}; do
    if curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null; then
      echo "✅ CDP 就绪 (端口 $PORT, Profile: $PROFILE)"
      exit 0
    fi
    sleep 0.2
  done

  echo "❌ CDP 未就绪 (端口 $PORT)"
  exit 1
fi

echo "✅ Chrome 已启动 (端口: $PORT, Profile: $PROFILE)"
