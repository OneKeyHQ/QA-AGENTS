# Chrome MCP 测试脚本集

> 用于简化 Chrome MCP 测试流程的脚本工具

## 🎯 快速开始

### 问题：MCP 工具执行时需要手动确认

**推荐方案（一劳永逸）：**

```bash
# 启用 Cursor 内置的自动运行功能
./enable-auto-run.sh

# 重启 Cursor 后生效
```

**临时方案（模拟按键）：**

```bash
# 后台运行自动确认脚本
./auto-confirm.sh --bg

# 停止脚本
./stop-auto-confirm.sh
```

---

## 📁 脚本说明

| 脚本 | 功能 | 使用场景 |
|-----|------|---------|
| `enable-auto-run.sh` | 启用 Cursor 自动运行工具 | **推荐**，永久解决确认问题 |
| `auto-confirm.sh` | 模拟按键自动确认 | 临时方案，需要持续运行 |
| `stop-auto-confirm.sh` | 停止自动确认脚本 | 停止 auto-confirm.sh |
| `force-stop.sh` | 强制停止自动确认 | auto-confirm.sh 无法正常停止时使用 |
| `start-mcp-chrome.sh` | 启动/连接 Chrome 调试实例 | 启动带 CDP 的 Chrome |

---

## 🚀 方案对比

### 方案 1：Cursor 内置自动运行（推荐）

```bash
./enable-auto-run.sh
```

**原理**：修改 Cursor 的 `settings.json`，启用 `cursor.agent.autoRunTools` 选项

**优点**：
- ✅ 官方支持的功能
- ✅ 一次配置，永久生效
- ✅ 不需要后台进程
- ✅ 更可靠稳定

**缺点**：
- ⚠️ 需要重启 Cursor 生效
- ⚠️ 所有 Agent 操作都会自动执行（无法选择性确认）

**管理命令**：

```bash
# 检查当前状态
./enable-auto-run.sh --check

# 启用自动运行
./enable-auto-run.sh

# 禁用自动运行（恢复手动确认）
./enable-auto-run.sh --off
```

---

### 方案 2：自动确认脚本（临时方案）

```bash
# 后台运行
./auto-confirm.sh --bg

# 或前台运行（可看到日志）
./auto-confirm.sh
```

**原理**：检测 Cursor 窗口是否在前台，每 0.3 秒自动按 Enter 键

**优点**：
- ✅ 即时生效，无需重启
- ✅ 可随时启停

**缺点**：
- ⚠️ 需要持续运行后台进程
- ⚠️ 可能误触发其他输入操作
- ⚠️ 依赖 Cursor 在前台

**管理命令**：

```bash
# 启动（后台）
./auto-confirm.sh --bg

# 停止
./stop-auto-confirm.sh

# 强制停止
./force-stop.sh

# 查看日志
tail -f /tmp/cursor-mcp-auto-confirm.log
```

---

## 🌐 Chrome MCP 连接

### 连接已有 Chrome 实例

```bash
./start-mcp-chrome.sh
```

如果你已经启动了带 `--remote-debugging-port=9222` 的 Chrome，脚本会检测并确认连接状态。

### 启动新的调试实例

```bash
# 轻量模式（空 Profile）
./start-mcp-chrome.sh --new

# 复制现有配置
./start-mcp-chrome.sh --new --copy
```

### 手动启动 Chrome

```bash
# 关闭所有 Chrome 后
pkill -f 'Google Chrome'

# 带调试端口启动
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 &
```

---

## 📂 inject/ 目录

包含页面注入脚本，用于采集性能数据：

| 脚本 | 功能 |
|-----|------|
| `performance-collector.js` | 采集 Core Web Vitals 和性能指标 |
| `websocket-monitor.js` | 监控 WebSocket 连接 |

这些脚本在冒烟测试时自动注入，无需手动操作。

---

## ❓ 常见问题

### Q: 自动确认脚本为什么没有生效？

1. **确保 Cursor 在前台**：脚本只在 Cursor 是活跃窗口时生效
2. **检查脚本是否运行**：`pgrep -f auto-confirm.sh`
3. **推荐使用方案 1**：`./enable-auto-run.sh` 更可靠

### Q: 如何恢复手动确认？

```bash
# 方案 1 用户
./enable-auto-run.sh --off

# 方案 2 用户
./stop-auto-confirm.sh
```

### Q: Chrome MCP 连接失败？

1. 确保 Chrome 启动时带有 `--remote-debugging-port=9222`
2. 确保端口未被占用：`lsof -i :9222`
3. 尝试启动新实例：`./start-mcp-chrome.sh --new`

---

## 📝 更新日志

- **2026-01-08**：新增 `enable-auto-run.sh`，支持 Cursor 内置自动运行
- **2026-01-08**：优化 `auto-confirm.sh`，改为智能模式
