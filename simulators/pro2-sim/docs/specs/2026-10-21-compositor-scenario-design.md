# pro2-sim 合成层与场景回归 — 设计

日期：2026-10-21 · 固件基线：main d7e612e6（修复 OK-64012 的 e2aca352 #232 已包含） · 修复前对照：aea0ae02

## 目标

让模拟器能复现、回归真机上"滚动 / 翻页 / 转场过程中组件闪烁、残影"这一类问题。
典型案例 OK-64012：slip39 创建多重备份警告页，勾选复选框启用 Continue 后上下滑动，按钮在
禁用态与启用态之间跳变。根因在 compositor 的组件快照缓存未随状态切换失效（旧页面裸调
`lv_obj_add_state/remove_state(LV_STATE_DISABLED)`），滚动中显示旧快照、静止显示实时绘制。
这类问题只在真机的"快照合成"路径上出现；此前 sim 不编 compositor、合成层依赖硬件、截图是对象级，
无法复现。

验收闭环：同一场景文件，对修复前固件 aea0ae02 必须 FAIL，对修复后 d7e612e6 必须 PASS。

## 方案（A：固件零改动，合成层在 sim 侧实现）

| 层 | 真机 | sim |
|---|---|---|
| compositor（`tasks/task_foreground/compositor/*.c`，6.8k 行） | 原样 | **原样编入**，`section(".sdram")` 改写成 `aligned(32)`，`optimize` 属性告警关闭 |
| 合成接口 `lv_port_disp_compose_* / transition_*`（`ui/lvgl_port/lv_port_disp.c`） | 纯 C 像素合成 + DMA2D/FreeRTOS/LTDC 胶水 | **configure 时逐字抽取**合成段（`tools/extract_disp_compose.py` → `build/generated/lv_port_disp_compose_body.inc`），`src/sim_disp_compose.c` 提供 host 替身后 `#include` |
| 扫描缓冲（FRAMEBUFFER_POOL 3 片 slice） | SDRAM + LTDC | host 堆上 3 片 604×1024 RGB565；LVGL 整帧 flush 与 compositor present 都先落到 slice，再推 SDL 纹理 |
| DMA2D convert / fill / blend_opa | 硬件 | `src/sim_hw_shims.c` 软件版（偏移语义同 `dma2d_*_config`） |
| 触摸（`ui/lvgl_port/lv_port_indev.c`） | FT3519 事件队列 | **原样编入**（`UI_SNAPSHOT_TEST=1` 带上固件测试触摸队列），`touch_panel_read()` 替身 = SDL 鼠标 |
| `hal.h` / `framebuffer.h` / `soc_cache.h` / `rng.h` / `fault_handlers.h` | 硬件头 | `src/` 下 shim 遮蔽，只暴露上述接口 |

抽取而不是手抄的理由：合成逻辑决定"滚动时屏幕上显示什么"，必须与固件逐字一致；固件改了合成逻辑
sim 自动跟上，改了结构（标记找不到 / 替换命中数不对）configure 直接失败。

### 前台帧不变量

真机 `framebuffer_get_handle(SECONDARY)->addr` 永远指向池内正在扫描的 slice；compositor 依赖它做
转场 pin 与状态栏行拷贝。sim 用包装过的 LVGL flush（私有头取 `disp->flush_cb`）把整帧 memcpy 进后备
slice 并记为前台，保证同样的不变量，抽取段里的 `transition_front_pin` 等逻辑原样可用。

### 有意不模拟

LTDC 扫描时序、DMA2D 异步链、撕裂。present 同步完成，`s_refresh_done_sem/s_chain_idle_sem` 恒 NULL，
抽取段的"等刷新完成"分支永远不走。sim 抓"帧内容"类缺陷（旧快照、缓存未失效、覆盖层行数错），
抓不到纯时序类缺陷。`lv_port_disp_active_scan_address_get` 返回 0（host 指针放不进 uint32），
activity_animation 的前台帧蒙版动效在 sim 上降级跳过。

## 场景执行器（`src/scenario.c`，`--scenario <json> [--out <dir>]`）

- 虚拟时钟：主循环每步推进 1ms（compositor 活跃）/ 5ms（否则），同 `task_foreground.c`；同一场景在任何
  机器上得到完全相同的帧序列。
- 步骤：`wait` / `tap [x,y]` / `tap_text "..."` / `drag {from,to,steps,step_ms}`，手势算法照抄固件
  `ui_perf_runner.c inject_touch`（默认 20 步 × 12ms），经真实 indev 读回调与 hit-test。
- 取证：`sim_disp_compose.c` 帧接收器在每次上屏时回调，逐帧 PNG（`lvgl` / `compose` 来源标记）、
  与上一帧的差异像素与包围盒。
- 断言：`watch` 矩形在标了 `assert_static` 的步骤（含 settle）内相邻帧不得变化；`expect_compose`
  要求该步出现合成帧（防止静默退回在线渲染）。差异判定：通道差（8 位量纲）> `tolerance_delta`（默认 8，
  RGB565 一个 LSB，吸收 DMA2D 与 LVGL 混合公式的舍入差）的像素数 > `tolerance_px`（默认 0）。
- 产物：`frames/fNNNNN_<source>[_VIOLATION].png`、`report.md`、`report.json`；退出码 0/1/2。
- 多 commit 对照：`tools/regress_scenario.sh <scenario> <bad> <good>` 在 `.deps/` 下按 commit 克隆固件
  （本地仓库，lvgl 子模块与资源产物软链复用），各自 `build-<commit>/` 构建后跑场景。

## 追平 main 顺带的适配（2026-10）

固件 561be533 → d7e612e6 共 153 个提交，sim 之前已编不过：`sys_config.h` 并入 `sys_internal.h`、
`rng.h` / `fault_handlers.h` 新依赖、`loading` → `loading_window`、resource_manager pkg API 带路径、
SignPageConfig_t 的 Data 预览改页级 card、protobuf 占位头补 `DeviceSettingsPage` 新值 / `DeviceRebootType` /
`DeviceSessionPinType` / `ViewContentPage`、业务层新增约 60 个符号的桩（`sim_stubs_pages.c` 末尾）、
`lv_gif` 补丁版替换、`ui_dither` / `lvgl_image_cache` 按存在性编入、`PAGE_REGISTER*` 任意后缀匹配。
资源需重跑 `resource_pkg.py font --only json` / `image`（否则 i18n 键集不匹配）。

## 验证记录

- `--frames 60` 无头冒烟、`--page settings_ms_warning --frames 120`、`--snapshot-page settings_ms_warning` 正常。
- `scenarios/ok-64012-ms-warning-scroll.json` @ d7e612e6：86 帧（lvgl 9 / compose 77），`tolerance_delta=8`
  下 0 违规 PASS；`tolerance_delta=0` 时只在合成↔直绘切换帧看到 501 px、最大通道差 8 的舍入噪声，
  而真正的禁用→启用跳变通道差 232。
- @ aea0ae02：见本文档末尾"对照结果"。

## 对照结果

`tools/regress_scenario.sh scenarios/ok-64012-ms-warning-scroll.json aea0ae02 d7e612e6`（2026-10-21）：

| 固件 | 帧数 | 结果 | 按钮区域（watch continue_button） |
|---|---|---|---|
| aea0ae02（修复前） | 85（lvgl 8 / compose 77） | **FAIL**，4 处违规 | 每次拖动的首个合成帧差异 55717 px、最大通道差 232（启用白 → 禁用灰快照）；settle 后首个直绘帧跳回 |
| d7e612e6（修复后） | 86（lvgl 9 / compose 77） | **PASS**，0 违规 | 合成帧与直绘帧只差抗锯齿边缘 501 px、通道差 8（容差内） |

修复前的违规帧 `frames/f00005_compose_VIOLATION.png` 肉眼可见：两个复选框已勾选、Continue 仍是灰色禁用态，
即 Jira 描述的现象。
