# Android Recorder 使用说明

CDP 风格的 Android 操作录制器。监听手机触摸事件，对每次点击拍 pre-tap 截图，调用 Claude Vision 识别红十字标记处的 UI 元素，输出可重放的 `session.json`。

## 适用场景

- 录制 OneKey Android app 的操作流，作为生成测试脚本的素材
- 摸清新功能的 UI 流程（探索性录制）
- 给已有用例补录截图证据

不适用：录制 iOS（暂未支持），录制滑动/长按/输入（仅 tap）。

## 前置条件

| 项目 | 说明 |
|---|---|
| Node.js | 22+ |
| Android SDK | `ANDROID_HOME` 指向 SDK 根目录（默认 `~/Library/Android/sdk`） |
| 设备 | USB 连接，开发者模式 + USB 调试已启用 |
| 授权 | 首次连接需在手机上点「允许 USB 调试」 |
| API key | `.env` 中配置 `ANTHROPIC_API_KEY=sk-ant-...` |

## 启动

```bash
# 默认选第一个连接的设备
node src/tests/android/recorder.mjs

# 指定设备 udid
node src/tests/android/recorder.mjs <udid>
```

启动成功会看到：
```
  Device: <udid>
  Screen: 1080x2400
  Touch:  /dev/input/eventX (touch_panel) maxX=... maxY=...
  Monitor UI: http://localhost:3212
  +---------------------------------------------+
  |       ANDROID RECORDING MODE ACTIVE          |
  +---------------------------------------------+
```

浏览器会自动打开 `http://localhost:3212`。

## 操作流程

1. 启动录制器后等待 `ANDROID RECORDING MODE ACTIVE` 提示
2. 在手机上正常操作（每次点击会被捕获）
3. 监控 UI 实时显示每次 tap 的位置、AI 识别结果、截图缩略图
4. 录完按 `Ctrl+C`，2 秒后自动 flush `session.json` 并退出

## 输出

```
midscene_run/recordings/session-<timestamp>/
├── session.json       # 完整 tap 列表 + AI 识别元数据
├── 000-initial.png    # 录制开始时的截图
├── 001-pre-tap.png    # 第 1 次 tap 之前的截图（AI 看的是这张）
├── 002-tap-1.png      # 第 1 次 tap 之后的截图（人类参考）
└── ...
```

`session.json` 单条事件结构：
```json
{
  "index": 0,
  "type": "tap",
  "screenX": 540,
  "screenY": 1200,
  "time": "2026-05-08T11:30:15.000Z",
  "element": {
    "elementType": "button",
    "label": "添加资产",
    "section": "token-list",
    "action": "open-add-token-modal",
    "confidence": 0.92
  },
  "description": "\"添加资产\" [button] in token-list",
  "screenshot": "002-tap-1.png"
}
```

## 验证 AI 识别工作正常

每次点击后**三处应同步亮起**：

**A. 终端**
```
  [1] Tap (540, 1200) -> "添加资产" [button] in token-list
       001-tap-1.png
```

**B. 监控 UI（http://localhost:3212）**
- 新增一行，Element 列从 `identifying...` 变成 `"添加资产" [button]`
- 截图缩略图出现

**C. session.json**
- 每个 event 的 `element` 字段非 null，含 `label / elementType / section / action / confidence`

如果终端打 `AI identify failed: ...` 或 element 一直为 null，进失败排查。

## 配置

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `ONEKEY_LLM_KEY` | （必填）| OneKey 内部网关 API key |
| `ONEKEY_LLM_BASE_URL` | （必填）| 内部网关 base URL（如 `https://llm-api.onekeytest.com/v1`） |
| `VISION_MODEL` | `gpt-5.5` | 视觉识别用的模型（必须支持 vision） |
| `ANDROID_HOME` | `~/Library/Android/sdk` | Android SDK 根目录 |

> 兼容回退：如果未设置 `ONEKEY_LLM_*`，会回退读 `OPENAI_API_KEY` / `OPENAI_BASE_URL`（共用 Midscene 的 qwen-vl 配置）。

切换其他网关支持的视觉模型：
```bash
VISION_MODEL=gpt-5.4 node src/tests/android/recorder.mjs            # 上代 OpenAI
VISION_MODEL=doubao-seed-2.0-pro node src/tests/android/recorder.mjs # 字节豆包
VISION_MODEL=glm-5.1 node src/tests/android/recorder.mjs             # 智谱
```
注意：不是所有网关模型都支持 vision，必须确认目标模型支持 `image_url` 输入。

## 监控 UI 功能

| 操作 | 说明 |
|---|---|
| 删除行（每行右侧 `X` 按钮） | 录错的 tap 可删除，会同步从 `session.json` 移除 |
| 点击截图缩略图 | 灯箱放大查看 |
| 状态点（左上）| 绿色脉冲 = 录制中；红色 = SSE 断连 |

## 失败排查

| 现象 | 原因 | 修法 |
|---|---|---|
| `No Android devices connected` | adb 未识别 | 重插数据线，确认手机已授权 USB 调试 |
| `AI identify failed: 401` | API key 无效 | 检查 `.env` 中 `ONEKEY_LLM_KEY` 拼写 |
| `AI identify failed: 403` 且返回 Cloudflare HTML | WAF 拦截 | recorder 已通过 OpenAI SDK 内置 UA，正常不会触发；如出现请确认机器 IP 在网关白名单 |
| `AI identify failed: model not found` | 模型 ID 错 | 取消 `VISION_MODEL` 覆盖，用默认 `gpt-5.5` |
| Web UI 一直 `identifying...` | API 调用未返回 | 看终端报错；偶尔 5–10s 是 Opus 正常延迟 |
| 完全没 tap 事件 | 触摸设备没识别到 | `adb shell getevent -p` 找真正的触摸 event 路径 |
| `EADDRINUSE :3212` | 端口被占用（极少） | `lsof -i :3212` 找占用进程，杀掉重启 |

单独验证网关 + key 通不通：
```bash
KEY=$(grep '^ONEKEY_LLM_KEY=' .env | cut -d= -f2-)
BASE=$(grep '^ONEKEY_LLM_BASE_URL=' .env | cut -d= -f2-)
curl -s "$BASE/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -H "User-Agent: Mozilla/5.0" \
  -H "content-type: application/json" \
  -d '{"model":"gpt-5.5","max_tokens":10,"messages":[{"role":"user","content":"reply OK"}]}'
```
应返回带 `"choices":[{"message":{"content":"OK"...}` 的 JSON。

## 已知限制

- 只录 tap，不录滑动 / 长按 / 文本输入
- 只支持 Android（iOS 录制器规划中）
- AI 识别异步进行（不阻塞下一次 tap），但识别延迟 ~3–5s（豆包 / OpenAI 系列）
- AI 看的是 **pre-tap** 截图，识别结果反映点击**前**的 UI 状态
- 多触摸点同时按下时只记录最后一次坐标

## 相关文件

| 路径 | 说明 |
|---|---|
| `src/tests/android/recorder.mjs` | 录制器主程序 |
| `src/tests/android/connect-test.mjs` | 设备连接 smoke test |
| `src/tests/android/helpers/` | Midscene 设备 / 校准 helpers |
| `midscene_run/recordings/` | 录制输出根目录 |
