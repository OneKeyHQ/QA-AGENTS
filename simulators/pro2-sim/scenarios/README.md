# 场景文件（`--scenario`）

用 JSON 描述一段触摸序列，模拟器按真机主循环节奏回放，把每一帧真正送到"面板"的像素落盘，
并对指定区域做逐帧差异断言。用来复现 / 回归 **"滚动、翻页、转场过程中组件闪烁 / 残影"** 这类
只在 compositor 快照合成路径上出现的问题（例：OK-64012 多重备份警告页 Continue 按钮闪烁）。

```bash
cd simulators/pro2-sim
SDL_VIDEODRIVER=dummy ./build/onekey-sim --scenario scenarios/ok-64012-ms-warning-scroll.json --out out/ok-64012
# 退出码 0 = 全部断言通过；1 = 有断言失败；2 = 场景文件 / 页面错误
# 产物：out/ok-64012/frames/f00042_compose.png（逐帧）、report.md、report.json
```

修复前后对照（两份固件各建一次 sim）：`tools/regress_scenario.sh <scenario> <bad-commit> <good-commit>`。

场景解析和产物错误处理回归：构建后运行 `python3 tools/test_scenario.py`。可用
`SIM_TEST_BIN=/absolute/path/to/asan/onekey-sim` 指向带 AddressSanitizer 的二进制复验。

## 为什么结果可信

- 固件 `tasks/task_foreground/compositor/` **原样编入** sim；真机 `lv_port_disp.c` 里的像素合成段在 configure 时
  从当前固件**逐字抽取**（`tools/extract_disp_compose.py`），只把 DMA2D / FreeRTOS / LTDC 胶水换成 host 替身。
- 触摸走固件 `lv_port_indev.c`（原样编入）自带的测试触摸队列，经真实 indev 读回调与 hit-test，读周期 5ms、
  `scroll_limit` 10、`scroll_throw` 10 与真机一致；手势算法照抄固件 `ui_perf_runner.c`。
- 虚拟时钟：主循环每步推进 1ms（compositor 活跃）/ 5ms（否则），同真机 `task_foreground.c`。
  同一场景在任何机器上得到完全相同的帧序列。
- 帧来源标记：`lvgl` = LVGL 直绘帧（静止时），`compose` = compositor 合成帧（滚动 / 翻页 / 转场中）。
  OK-64012 这类缺陷的特征就是 compose 帧与相邻 lvgl 帧在"应该静止"的区域不一致。

有意不模拟：LTDC 扫描时序、DMA2D 异步链、撕裂。sim 抓"帧内容"类缺陷，抓不到纯时序类缺陷。

## 格式

```json
{
  "name": "ok-64012-ms-warning-scroll",
  "description": "可选，写进报告",
  "page": "settings_ms_warning",          // 起始页面 id（同 --page，见 build/generated/page_list.inc）
  "settle_ms": 500,                        // 打开页面后等待（默认 500）
  "capture": "all",                        // all | changed | none：逐帧 PNG / 仅有变化的帧 / 不落盘
  "tolerance_px": 0,                       // watch 内差异像素数 > 此值才算变化（默认 0）
  "tolerance_delta": 8,                    // 通道差（8 位量纲）> 此值的像素才计入差异（默认 8，见下）
  "watch": [
    { "name": "continue_button", "rect": [32, 880, 540, 106] }   // [x, y, w, h]，最多 8 个
  ],
  "steps": [
    { "wait": 200 },
    { "tap": [302, 420] },                                        // 坐标点按
    { "tap_text": "I understand this is an advanced feature." }, // 按 label 文本定位（先精确后子串），点其中心
    { "drag": { "from": [302, 760], "to": [302, 460], "steps": 20, "step_ms": 12 },
      "settle_ms": 1200,                     // END 之后再跑多久（惯性 / 弹性回弹期间 compositor 仍在合成）
      "expect_compose": true,                // 该步必须出现合成帧，否则 FAIL（防止测试静默退回在线渲染）
      "assert_static": ["continue_button"] }, // 该步（含 settle）内这些 watch 区域相邻帧不得变化
    { "nav": "push", "page": "verify_device_pin" },              // 非触摸导航：模拟主机指令 / 定时器 / 业务回调
    { "nav": "pop", "settle_ms": 800, "expect_compose": true }   // 驱动的 push / pop（不经过按下触发对象的缓存失效）
  ]
}
```

- `tap` / `tap_text` 可带 `hold_ms`（默认 60）与 `settle_ms`（默认 500）。
- `nav`：`push`（需 `page`）/ `pop`，走 `navigation_coordinator_navigate(NAV_LANE_USER)`。与 tap 触发的导航
  区别在于没有被按下的对象，`ui_press_feedback_hold` 不会让 compositor 页面缓存失效——这正是
  `scenarios/pin-page-stale-slide-out.json` 复现"滑出动画显示旧快照"的方式（视觉复现，看 frames 即可，无断言）。
- `drag.steps` / `drag.step_ms` 默认 20 / 12（固件 `UI_PERF_GESTURE_STEP_MS`）。
- `expect_compose` 必须是 JSON 布尔值；`assert_static` 必须是已定义 watch 名称组成的字符串数组。
  字段类型错误或引用不存在的 watch 时退出 2，不执行场景。
- `tolerance_delta` 默认 8 = RGB565 一个 LSB。compositor 合成帧与 LVGL 直绘帧在抗锯齿边缘有 ±1 LSB 的
  混合舍入差（真机 DMA2D 与 LVGL 的混合公式本就不同），不是缺陷；真正的状态跳变（禁用灰 → 启用白）
  通道差 > 100。报告里的"最大通道差"列可以直接判断是哪种。

## 报告

`report.md` 含：步骤表（帧数 / 合成帧数 / 失败数 / 是否缺合成帧）、watch 表（变化帧数 / 最大通道差）、
断言失败明细（帧号 → `frames/fNNNNN_<source>_VIOLATION.png`）、帧间差异表（差异像素 / 包围盒）。
`report.json` 是同样内容的机器可读版（含每帧记录）。stdout 每步一行 `SCENARIO|step N|...`。
报告或所需 PNG 的分配、编码、打开、写入、关闭失败时退出 2，最终状态为 `ERROR`；保留已经写出的产物。

## 定坐标 / 文本

- 先 `SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot-page <page> out/snap` 截一张图量坐标。
- 文本用页面上实际渲染的文案（英文默认；`--lang` 切语言时文案随之变化）。
