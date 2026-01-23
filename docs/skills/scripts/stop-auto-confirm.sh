#!/bin/bash
# 停止 Cursor MCP 自动确认脚本
# 通过删除标志文件来优雅地停止脚本

FLAG_FILE="/tmp/cursor-mcp-auto-confirm.flag"
LOG_FILE="/tmp/cursor-mcp-auto-confirm.log"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛑 停止 Cursor MCP 自动确认脚本"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [[ -f "$FLAG_FILE" ]]; then
  rm -f "$FLAG_FILE"
  echo "✅ 标志文件已删除"
else
  echo "ℹ️  自动确认脚本未运行"
fi

# 确保进程也被终止
if pgrep -f "auto-confirm.sh" > /dev/null 2>&1; then
  pkill -f "auto-confirm.sh" 2>/dev/null
  echo "✅ 进程已终止"
fi

# 显示日志摘要
if [[ -f "$LOG_FILE" ]]; then
  echo ""
  echo "📄 日志摘要（最后5行）："
  tail -5 "$LOG_FILE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💡 提示：推荐使用 ./enable-auto-run.sh 启用 Cursor 内置自动运行"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
