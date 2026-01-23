#!/bin/bash
# 启用 Cursor Agent 自动运行工具（无需手动确认）
#
# 原理：修改 Cursor 的 settings.json，启用 autoRunTools 选项
# 这是官方支持的功能，比模拟按键更可靠
#
# 使用方法：
#   ./enable-auto-run.sh         # 启用自动运行
#   ./enable-auto-run.sh --off   # 关闭自动运行
#   ./enable-auto-run.sh --check # 检查当前状态

# Cursor 配置文件路径
CURSOR_CONFIG_DIR="$HOME/Library/Application Support/Cursor/User"
SETTINGS_FILE="$CURSOR_CONFIG_DIR/settings.json"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo_info() { echo -e "${GREEN}✅ $1${NC}"; }
echo_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
echo_error() { echo -e "${RED}❌ $1${NC}"; }

# 检查 jq 是否安装
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo_warn "jq 未安装，使用 sed 进行配置（功能受限）"
    return 1
  fi
  return 0
}

# 检查当前状态
check_status() {
  if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo_warn "settings.json 不存在，自动运行未配置"
    return
  fi
  
  if check_jq; then
    local STATUS=$(jq -r '.["cursor.agent.autoRunTools"] // "未设置"' "$SETTINGS_FILE" 2>/dev/null)
    if [[ "$STATUS" == "true" ]]; then
      echo_info "自动运行已启用"
    elif [[ "$STATUS" == "false" ]]; then
      echo_warn "自动运行已禁用"
    else
      echo_warn "自动运行未配置（默认禁用）"
    fi
  else
    if grep -q '"cursor.agent.autoRunTools": true' "$SETTINGS_FILE" 2>/dev/null; then
      echo_info "自动运行已启用"
    else
      echo_warn "自动运行未配置或已禁用"
    fi
  fi
}

# 启用自动运行
enable_auto_run() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🚀 启用 Cursor Agent 自动运行工具"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # 确保目录存在
  mkdir -p "$CURSOR_CONFIG_DIR"
  
  # 如果文件不存在，创建一个
  if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo '{}' > "$SETTINGS_FILE"
  fi
  
  # 备份
  cp "$SETTINGS_FILE" "${SETTINGS_FILE}.bak"
  echo_info "已备份: ${SETTINGS_FILE}.bak"
  
  if check_jq; then
    # 使用 jq 更新
    local TEMP_FILE=$(mktemp)
    jq '. + {"cursor.agent.autoRunTools": true}' "$SETTINGS_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$SETTINGS_FILE"
  else
    # 使用 sed 更新（简单版本）
    if grep -q '"cursor.agent.autoRunTools"' "$SETTINGS_FILE"; then
      sed -i '' 's/"cursor\.agent\.autoRunTools": false/"cursor.agent.autoRunTools": true/g' "$SETTINGS_FILE"
    else
      # 在第一个 { 后插入
      sed -i '' 's/{/{\n  "cursor.agent.autoRunTools": true,/' "$SETTINGS_FILE"
    fi
  fi
  
  echo_info "已启用自动运行工具"
  echo ""
  echo "📌 说明："
  echo "   - Agent 现在会自动执行工具，无需手动确认"
  echo "   - 重启 Cursor 后生效"
  echo "   - 如需恢复确认提示：./enable-auto-run.sh --off"
  echo ""
}

# 禁用自动运行
disable_auto_run() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🔒 禁用 Cursor Agent 自动运行工具"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  if [[ ! -f "$SETTINGS_FILE" ]]; then
    echo_warn "settings.json 不存在，无需操作"
    return
  fi
  
  if check_jq; then
    local TEMP_FILE=$(mktemp)
    jq '. + {"cursor.agent.autoRunTools": false}' "$SETTINGS_FILE" > "$TEMP_FILE" && mv "$TEMP_FILE" "$SETTINGS_FILE"
  else
    if grep -q '"cursor.agent.autoRunTools"' "$SETTINGS_FILE"; then
      sed -i '' 's/"cursor\.agent\.autoRunTools": true/"cursor.agent.autoRunTools": false/g' "$SETTINGS_FILE"
    fi
  fi
  
  echo_info "已禁用自动运行工具"
  echo "📌 重启 Cursor 后生效"
}

# 主逻辑
case "$1" in
  --off|--disable)
    disable_auto_run
    ;;
  --check|--status)
    check_status
    ;;
  *)
    enable_auto_run
    ;;
esac
