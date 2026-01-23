#!/bin/bash
# Cursor MCP 工具自动确认脚本（智能版）
# 功能：
#   1. 仅在 Cursor 窗口激活且有 MCP 弹窗时自动按 Enter
#   2. 测试结束后自动停止（通过标志文件控制）
#   3. 不影响其他程序操作

# 标志文件路径
FLAG_FILE="/tmp/cursor-mcp-auto-confirm.flag"

# 创建标志文件
touch "$FLAG_FILE"

echo "🚀 Cursor MCP 自动确认脚本已启动"
echo "📍 仅在 Cursor MCP 弹窗时自动确认"
echo "🛑 删除标志文件将自动停止: $FLAG_FILE"
echo ""

while true; do
  # 检查标志文件是否存在，不存在则退出
  if [[ ! -f "$FLAG_FILE" ]]; then
    echo "✅ 标志文件已删除，脚本自动停止"
    exit 0
  fi
  
  # 检查 Cursor 是否是当前激活的应用
  ACTIVE_APP=$(osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true' 2>/dev/null)
  
  if [[ "$ACTIVE_APP" == "Cursor" ]]; then
    # 检查是否有 MCP 工具确认弹窗（通过检测窗口标题或按钮）
    # 使用 AppleScript 检测是否有 "Run" 按钮可见
    HAS_DIALOG=$(osascript -e '
      tell application "System Events"
        tell process "Cursor"
          try
            if exists (first button whose name contains "Run") then
              return "yes"
            end if
          end try
        end tell
      end tell
      return "no"
    ' 2>/dev/null)
    
    # 只有检测到 MCP 弹窗时才按 Enter
    if [[ "$HAS_DIALOG" == "yes" ]]; then
      osascript -e 'tell application "System Events" to keystroke return' 2>/dev/null
      echo "$(date '+%H:%M:%S') ✓ 自动确认 MCP 工具"
    fi
  fi
  
  # 等待 0.3 秒
  sleep 0.3
done
