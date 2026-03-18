#!/bin/bash
# Chrome 调试模式启动脚本
# 用于 QA 冒烟测试，配合 Chrome DevTools MCP 使用

set -e

DEBUG_PORT=9222
DEBUG_DIR="$HOME/Library/Application Support/Google/Chrome-Debug"
CHROME_APP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "🔍 检查 Chrome 调试端口状态..."

# 检查端口是否已在监听
if curl -s "http://127.0.0.1:$DEBUG_PORT/json/version" > /dev/null 2>&1; then
    echo "✅ Chrome 调试模式已运行在端口 $DEBUG_PORT"
    curl -s "http://127.0.0.1:$DEBUG_PORT/json/version" | python3 -m json.tool 2>/dev/null || curl -s "http://127.0.0.1:$DEBUG_PORT/json/version"
    exit 0
fi

echo "⚠️  Chrome 调试端口未开启，正在启动..."

# 检查是否有 Chrome 进程在运行
if pgrep -x "Google Chrome" > /dev/null; then
    echo "🛑 检测到 Chrome 正在运行，正在关闭..."
    pkill -x "Google Chrome" || true
    sleep 2
fi

# 检查调试目录是否存在
if [ ! -d "$DEBUG_DIR" ]; then
    echo "📁 调试目录不存在，正在从默认配置复制..."
    echo "   这可能需要几分钟，请耐心等待..."
    cp -R "$HOME/Library/Application Support/Google/Chrome" "$DEBUG_DIR"
    echo "✅ 用户数据复制完成"
fi

# 启动 Chrome 调试模式
echo "🚀 正在启动 Chrome 调试模式..."
"$CHROME_APP" \
    --remote-debugging-port=$DEBUG_PORT \
    --user-data-dir="$DEBUG_DIR" &

# 等待 Chrome 启动
echo "⏳ 等待 Chrome 启动..."
for i in {1..10}; do
    sleep 1
    if curl -s "http://127.0.0.1:$DEBUG_PORT/json/version" > /dev/null 2>&1; then
        echo ""
        echo "✅ Chrome 调试模式启动成功！"
        echo ""
        echo "📋 连接信息:"
        curl -s "http://127.0.0.1:$DEBUG_PORT/json/version" | python3 -m json.tool 2>/dev/null || curl -s "http://127.0.0.1:$DEBUG_PORT/json/version"
        echo ""
        echo "🔧 MCP 服务器: user-chrome-devtools-9222"
        echo "🌐 调试端口: http://127.0.0.1:$DEBUG_PORT"
        exit 0
    fi
    echo -n "."
done

echo ""
echo "❌ Chrome 启动超时，请手动检查"
exit 1
