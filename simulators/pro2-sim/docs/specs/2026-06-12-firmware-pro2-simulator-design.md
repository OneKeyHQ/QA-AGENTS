# OneKey Pro 2 固件 UI 模拟器 — 设计文档

- 日期：2026-06-12
- 状态：已批准（用户确认）
- 目标仓库：`OneKeyHQ/firmware-pro2`（私有）

## 1. 背景与目标

`firmware-pro2` 是 OneKey Pro 2 的全新自研固件（STM32H7 + FreeRTOS + LVGL v9 + MicroPython）。
仓库目前**没有任何模拟器支持**：

- `ui/lvgl_port/lv_conf.h` 中 `LV_USE_SDL = 0`
- `ui/CMakeLists.txt` 将 LVGL 的全部 PC 端驱动源码（sdl/x11/glfw/windows/wayland）从编译中剔除
- `cmake/toolchain_system.cmake` 实际仍为 `arm-none-eabi` 交叉编译，host 构建未落地
- 构建链强绑 FreeRTOS（`LV_USE_OS = LV_OS_FREERTOS`）与 STM32 HAL

**目标**：在 macOS 上用真实固件 UI 源码（组件、样式、字体、图片资源）渲染出设备页面，
做到与真机像素级一致（同一套 LVGL 渲染代码），供 UI 评审、QA 留档、回归对比使用。

## 2. 已确认的需求决策

| 决策点 | 结论 |
|--------|------|
| 技术路线 | 源码级 LVGL SDL 模拟器（排除 QEMU/Renode 指令级模拟——STM32H7 外设无现成模型，工期数月且对目标无增量） |
| 代码归属 | 本地独立工程，固件仓库零改动；架构保持可移植性，未来可贡献回 `firmware-pro2`（拷目录 + 加 CMake preset 即可） |
| 渲染范围 | `ui/demo/` 13 个组件演示页 + `tasks/task_foreground/pages/` 真实产品页（homescreen、settings）；不含 MicroPython 完整 App 模拟 |
| 产出形式 | 交互式 SDL 窗口（鼠标=触摸）+ `--snapshot` 批量 PNG 截图导出 |
| 实现方案 | 独立 CMake 工程 + Homebrew SDL2（排除：复用固件 cmake 体系 overlay——ARM 工具链耦合太深；Docker+X11——macOS GUI 体验差） |

## 3. 总体架构

```
~/workspace/codex-workspace/
├── firmware-pro2/              ← 固件仓库 clone（含 modules/lvgl submodule，零改动，只读引用）
└── firmware-pro2-sim/          ← 模拟器独立工程（本工程）
    ├── CMakeLists.txt           ← 唯一构建入口，FIRMWARE_DIR 变量指向固件 clone
    ├── lv_conf_sim.h            ← 基于固件 lv_conf.h 派生：LV_USE_SDL=1, LV_USE_OS=LV_OS_PTHREAD
    ├── src/
    │   ├── main.c               ← SDL 窗口创建 + lv_timer 主循环 + 页面路由
    │   ├── page_registry.c      ← 页面注册表（demo 13 组件页 + homescreen/settings）
    │   └── screenshot.c         ← lv_snapshot → PNG 导出（复用 LVGL 内置 lodepng）
    └── sim_stubs/               ← HAL/sys/zbus 桩实现（满足链接即可）
        ├── stub_display.c       ← display_get_params_p() 返回 480×800
        ├── stub_zbus.c
        ├── stub_sys.c
        └── stub_log.c ...
```

**编译范围（真实固件源码）**：
`ui/components`、`ui/styles`、`ui/font`、`ui/images`、`ui/demo`、`tasks/task_foreground/pages`、`modules/lvgl`

**替换范围**：
- `ui/lvgl_port/lv_port_disp|indev|fs` → LVGL 自带 SDL 驱动（`lv_sdl_window_create` / `lv_sdl_mouse_create`）
- STM32 HAL 全部 → `sim_stubs/`
- FreeRTOS → pthread（`LV_OS_PTHREAD`）
- DMA2D 硬件绘制加速 → LVGL 软件渲染（`LV_USE_DRAW_SW`，渲染结果一致，仅性能差异）

**屏幕参数**：Pro 2 面板 TXW350135B0，480×800。从宏读取，不硬编码散落，换面板只改一处。
颜色深度与固件一致（`LV_COLOR_DEPTH = DISPLAY_BPP*8`，DISPLAY_BPP 实际值待 clone 后从
`hal/soc/display/display_common.h` 确认）。

## 4. 运行模式

```bash
./onekey-sim                    # 交互模式：SDL 窗口，鼠标=触摸，页面列表切换
./onekey-sim --snapshot out/    # 截图模式：遍历页面注册表，每页渲染→PNG→退出（无头可跑 CI）
```

页面注册表是唯一页面清单：`{ id, 中文名, create_fn, supported }`。
新页面加一行，两种模式同时生效。

## 5. Stub 策略（主要工作量，约 60%）

原则：**不 stub 业务，只 stub 边界**。UI 源码 include 的固件头文件分三档处理：

1. **直接复用**：纯宏/类型定义的头 → 直接 include 固件源码中的头文件
2. **最小假实现**：`display_get_params_p()`（返回 480×800）、日志宏、zbus pub/sub（实现为简单回调表）、tick 源
3. **链接级空桩**：SE 安全芯片、USB、EMMC 文件系统 → 空实现；依赖它们的页面数据显示占位值（电量 100%、未连接等）

每解决一个 stub 坑，按项目规范沉淀到 QA-AGENTS 的 `shared/knowledge.json`。

## 6. 错误处理与已知风险

| 风险 | 应对 |
|------|------|
| `ui/` 代码隐式依赖 DMA2D（ARM 绘制加速） | sim 配置切 `LV_USE_DRAW_SW` 软件渲染，结果一致只是慢 |
| `emmc_png_demo` 等强依赖硬件的页面 | 注册表标记 `unsupported`，跳过不渲染，不阻塞其他页面 |
| 固件更新导致 sim 编不过 | sim 只读引用固件源码，`git pull` 后构建即知；stub 面薄，修复成本低 |
| 字体/图片资源 | 资源为编译进二进制的 C 数组（`ui/font`、`ui/images`），无运行时路径问题 |
| `LV_COLOR_DEPTH` 依赖 HAL 宏 | `lv_conf_sim.h` 中显式定义 `DISPLAY_BPP`，与固件值对齐 |

## 7. 验证方式

1. **构建验证**：macOS `cmake + ninja` 全绿
2. **渲染验证**：`--snapshot` 跑全部页面，人工核对 PNG 与真机/设计稿
3. **回归基线**：截图存 `out/baseline/`；像素 diff 工具本期不做（YAGNI）
4. **完成门禁**：实跑通过才算完成

## 8. 里程碑

| 里程碑 | 内容 | 意义 |
|--------|------|------|
| M1 | clone 仓库 + 空 SDL 窗口跑起来 | 验证工具链 |
| M2 | 第一个 demo 页（button_list_demo）渲染成功 | **最大风险消除点** |
| M3 | 13 个组件 demo 页全部可渲染 + 页面切换 | 组件层覆盖完成 |
| M4 | homescreen / settings 真实页面（zbus stub） | 产品页覆盖 |
| M5 | `--snapshot` 批量截图模式 | QA 产出形式落地 |
