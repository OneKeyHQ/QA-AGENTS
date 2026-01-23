#!/usr/bin/env bash
#
# Chrome MCP 调试连接脚本
#
# 用法:
#   ./start-mcp-chrome.sh                    # 连接模式：尝试连接已有 Chrome
#   ./start-mcp-chrome.sh --new              # 启动新实例（不复制数据）
#   ./start-mcp-chrome.sh --new --copy       # 启动新实例（复制数据）
#
# 环境变量:
#   PORT         - 调试端口 (默认: 9222)
#   PROFILE      - Chrome Profile 目录名 (默认: "Profile 2")
#
set -e

# 默认配置
PORT="${PORT:-9222}"
PROFILE="${PROFILE:-Profile 2}"
CHROME_BIN="${CHROME_BIN:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="$HOME/Library/Application Support/Google/Chrome"

# 解析参数
MODE="connect"  # 默认连接模式
COPY_DATA=0

for arg in "$@"; do
  case $arg in
    --new)
      MODE="new"
      ;;
    --copy)
      COPY_DATA=1
      ;;
    [0-9]*)
      PORT="$arg"
      ;;
  esac
done

# 检查 CDP 是否可用
check_cdp() {
  curl -s "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1
}

# 连接模式：直接连接已有 Chrome
if [[ "$MODE" == "connect" ]]; then
  echo "🔗 连接模式：检查 CDP 端口 $PORT ..."
  
  if check_cdp; then
    VERSION=$(curl -s "http://127.0.0.1:$PORT/json/version" | grep -o '"Browser":"[^"]*"' | cut -d'"' -f4)
    echo "✅ CDP 已就绪！"
    echo "   端口: $PORT"
    echo "   浏览器: $VERSION"
    echo ""
    echo "💡 MCP 可以直接连接到这个 Chrome 实例"
    exit 0
  else
    echo "❌ CDP 未就绪（端口 $PORT）"
    echo ""
    echo "📌 请用以下命令启动 Chrome（带调试端口）："
    echo ""
    echo "   方法1：关闭所有 Chrome 后重新启动"
    echo "   pkill -f 'Google Chrome'"
    echo "   '$CHROME_BIN' --remote-debugging-port=$PORT &"
    echo ""
    echo "   方法2：启动独立实例（推荐）"
    echo "   $0 --new"
    echo ""
    exit 1
  fi
fi

# 新实例模式：启动独立 Chrome
echo "🚀 启动新的 Chrome MCP 调试实例"
echo "   端口: $PORT"
echo "   Profile: $PROFILE"
echo "   复制数据: $([ $COPY_DATA -eq 1 ] && echo '是' || echo '否（轻量模式）')"

# 数据目录
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
DST="/tmp/chrome-mcp-$TIMESTAMP"
mkdir -p "$DST"
echo "   数据目录: $DST"

# 是否复制数据
if [[ "$COPY_DATA" == "1" ]]; then
  echo "📂 复制配置..."
  cp "$SRC/Local State" "$DST/" 2>/dev/null || true
  mkdir -p "$DST/$PROFILE"
  # 只复制必要文件，跳过大文件
  rsync -a --ignore-errors "$SRC/$PROFILE/" "$DST/$PROFILE/" \
    --exclude "Cache" \
    --exclude "Code Cache" \
    --exclude "GPUCache" \
    --exclude "Service Worker" \
    --exclude "File System" \
    --exclude "IndexedDB" \
    --exclude "Local Storage" \
    --exclude "Session Storage" \
    --exclude "*.log" \
    --exclude "Singleton*" \
    --exclude "Lockfile" \
    --exclude "*/passkey" \
    --exclude "Policy" \
    --exclude "Extensions" \
    2>/dev/null || true
  echo "✅ 复制完成"
else
  # 轻量模式：创建空的 Profile 目录
  mkdir -p "$DST/$PROFILE"
fi

# 启动 Chrome
"$CHROME_BIN" \
  --remote-debugging-port=$PORT \
  --user-data-dir="$DST" \
  --profile-directory="$PROFILE" \
  --no-first-run --no-default-browser-check &

# 等待 CDP 就绪
echo "⏳ 等待 CDP 就绪..."
for i in {1..50}; do
  if check_cdp; then
    echo "✅ CDP 就绪！"
    echo ""
    echo "💡 MCP 可以连接到: http://127.0.0.1:$PORT"
    exit 0
  fi
  sleep 0.2
done

echo "❌ CDP 未就绪"
exit 1
