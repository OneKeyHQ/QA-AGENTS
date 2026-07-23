# OneKey Pro 2 固件 UI 模拟器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 macOS 上用 firmware-pro2 真实 UI 源码 + LVGL SDL 驱动渲染设备页面（480×800），支持交互窗口与批量 PNG 截图。

**Architecture:** 独立 CMake 工程引用固件 clone（`FIRMWARE_DIR`，固件零改动）。编译固件的 `ui/components|styles|font|demo` + `tasks/task_foreground/pages` + `modules/lvgl`，用 LVGL 内置 SDL 窗口/鼠标驱动替换 `lv_port_disp/indev`，用 LVGL 内置 stdio 文件系统驱动（盘符 `A:`）替换 FatFS，资产（字体 bin/图片 PNG）本地生成。

**Tech Stack:** C11、CMake ≥3.21、Homebrew SDL2、LVGL v9.3（固件 submodule 源码）、lv_font_conv（npm）、Python3（占位图生成，无第三方依赖）。

---

## 前置事实（已实探确认，执行者无需再查）

- 固件 clone 位于 `~/workspace/codex-workspace/firmware-pro2`（depth 1，lvgl submodule 已 init）。
- 屏幕 480×800（TXW350135B0 面板），颜色 RGB565（`cmake/compile_options.cmake:113` 定义 `DISPLAY_MODE_RGB565=1` → `DISPLAY_BPP=2` → `LV_COLOR_DEPTH=16`）。
- **UI 源码是纯 LVGL**：`ui/` 与 `tasks/task_foreground/pages/` 不 include 任何 hal/sys/zbus 头（仅 `emmc_png_demo.c` include `<debug_print.h>`，该头在未定义 `USE_DEBUG_PRINT` 时全部为空宏，零 stub 需求）。`status_bar.c` 自带 `USE_SIMULATOR 1` mock（电量 80% 等）。**设计文档中预估的 sim_stubs/ 层实际不需要**。
- 资产运行时从盘符 `A:` 加载，**不在固件仓库中**：
  - 字体：`A:/assets/font/font_montserrat_<size>.bin`，size ∈ {14,16,20,22,24,26,28,30,32,48}（`ui/font/ui_font_manager.c`），LVGL 标准 bin 字体格式（`ui_binfont_loader.c` 解析 head/cmap/glyf/loca/kern 段）→ 用 `lv_font_conv --format bin` 自行生成。
  - 图片：`A:/assets/**/*.png` 真 PNG（运行时 lodepng 解码）→ 扫描源码引用生成灰色占位图（QA 同事后续可用真机资产覆盖）。
  - 注意源码里存在 `img_icon_setting_general_44.png.png` 双后缀引用——按引用原样生成文件，不要"纠正"。
- 入口函数签名（snapshot 注册表用）：
  - `void onekey_demo_layouts(void)` — demo 总菜单（自带各 demo 跳转按钮和返回按钮，交互模式只需调它）
  - `void` 入参的 demo：`ui_create_text_button_demo / ui_create_icon_button_demo / ui_create_information_tip_demo / ui_create_toast_demo / ui_create_checkbox_demo / ui_create_container_demo / ui_create_button_list_demo / ui_create_slider_list_demo / ui_create_alert_window_demo / ui_create_action_sheet_demo / ui_create_page_sheet_demo / ui_create_animation_demo`
  - `lv_obj_t* parent` 入参：`ui_create_navigation_bar_demo / ui_create_emmc_png_demo / status_bar_demo_create`
  - 键盘组件：`lv_obj_t* ui_create_numberKeyboard(void) / ui_create_mnemonicKeyboard(void) / ui_create_passphraseKeyboard(void)`
  - 产品页：`lv_obj_t* ui_create_homescreen(lv_obj_t* parent)`、`lv_obj_t* ui_create_settings_page(lv_obj_t* parent)` + `void ui_show_settings_page(void)`
- 固件对 lvgl 打了 4 个 workaround 补丁源文件（`ui/lvgl_port/workarounds/`），host 构建只需要其一：`lv_font_manager_recycle.c`（C23 返回值 bug，clang 同样会报）。lodepng 补丁（STM32 CRC 符号冲突）、lv_freertos、lv_draw_dma2d 在 host 上不需要。
- 工程目录 `~/workspace/codex-workspace/firmware-pro2-sim/` 已建好（git 已 init，含 docs/specs 设计文档）。

## 文件结构

```
firmware-pro2-sim/
├── CMakeLists.txt              # 构建入口（Task 1 创建，Task 3 扩充）
├── lv_conf.h                   # 固件 lv_conf.h 副本 + 6 处 host 化修改（Task 1）
├── .gitignore                  # build/ out/ assets/ tools/*.ttf（Task 1）
├── src/
│   ├── main.c                  # SDL 窗口 + 主循环 + CLI 参数（Task 1 创建，3/4/5 扩充）
│   ├── page_registry.h         # 页面注册表（Task 5）
│   ├── page_registry.c         # （Task 5）
│   ├── snapshot.h              # 批量截图（Task 5）
│   └── snapshot.c              # （Task 5）
├── tools/
│   ├── gen_fonts.sh            # 字体 bin 生成（Task 2）
│   └── gen_placeholder_images.py  # 占位图生成（Task 2）
├── assets/                     # 生成产物（gitignored）
│   ├── font/font_montserrat_*.bin
│   └── **/*.png
└── docs/{specs,plans}/         # 已存在
```

---

### Task 1: 工程骨架 — lv_conf + CMake + 空 SDL 窗口（里程碑 M1）

**Files:**
- Create: `firmware-pro2-sim/CMakeLists.txt`
- Create: `firmware-pro2-sim/lv_conf.h`（从固件复制后修改）
- Create: `firmware-pro2-sim/src/main.c`
- Create: `firmware-pro2-sim/.gitignore`

- [ ] **Step 1: 确认依赖**

```bash
brew list sdl2 >/dev/null 2>&1 || brew install sdl2
cmake --version   # 需 ≥3.21
ninja --version || brew install ninja
```

- [ ] **Step 2: 复制并修改 lv_conf.h**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim
cp ../firmware-pro2/ui/lvgl_port/lv_conf.h lv_conf.h
```

对 `lv_conf.h` 做以下 6 处精确修改（用 Edit 工具，old → new）：

1. `#include <display.h>` → `#define DISPLAY_BPP 2 /* sim: RGB565, 对齐固件 DISPLAY_MODE_RGB565=1 */`
2. `#define LV_USE_OS   LV_OS_FREERTOS` → `#define LV_USE_OS   LV_OS_PTHREAD`
3. `#define LV_USE_DRAW_DMA2D 1` → `#define LV_USE_DRAW_DMA2D 0`
4. `#define LV_USE_SDL              0` → `#define LV_USE_SDL              1`
5. `#define LV_USE_FS_STDIO 0` → `#define LV_USE_FS_STDIO 1`
6. `LV_USE_FS_STDIO` 块内：`#define LV_FS_STDIO_LETTER '\0'` → `#define LV_FS_STDIO_LETTER 'A'`，`#define LV_FS_STDIO_PATH ""` → `#define LV_FS_STDIO_PATH "."`（`A:/assets/...` → `./assets/...`，要求从工程根目录运行）

- [ ] **Step 3: 写 CMakeLists.txt**

```cmake
cmake_minimum_required(VERSION 3.21)
project(onekey-sim C)

set(CMAKE_C_STANDARD 11)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# 固件仓库位置（只读引用，零改动）
set(FIRMWARE_DIR "${CMAKE_CURRENT_LIST_DIR}/../firmware-pro2" CACHE PATH "firmware-pro2 仓库根目录")
if(NOT EXISTS "${FIRMWARE_DIR}/modules/lvgl/CMakeLists.txt")
    message(FATAL_ERROR "FIRMWARE_DIR 无效或 lvgl submodule 未初始化: ${FIRMWARE_DIR}")
endif()

find_package(SDL2 REQUIRED CONFIG)

# ── LVGL：固件 submodule 源码 + 模拟器自己的 lv_conf.h ──
set(LV_BUILD_CONF_PATH "${CMAKE_CURRENT_LIST_DIR}/lv_conf.h" CACHE PATH "" FORCE)
option(CONFIG_LV_BUILD_DEMOS "" OFF)
option(CONFIG_LV_BUILD_EXAMPLES "" OFF)
option(CONFIG_LV_USE_THORVG_INTERNAL "" OFF)
add_subdirectory(${FIRMWARE_DIR}/modules/lvgl ${CMAKE_BINARY_DIR}/lvgl)

# lv_sdl_window 需要 SDL 头与库
target_link_libraries(lvgl PUBLIC SDL2::SDL2)

# 同固件 ui/CMakeLists.txt：剔除用不到的平台驱动源码（保留 sdl）
get_target_property(lvgl_sources lvgl SOURCES)
foreach(pat nema_gfx nxp opengles renesas vg_lite glfw wayland x11 qnx nuttx uefi windows gltf thorvg)
    list(FILTER lvgl_sources EXCLUDE REGEX ".*${pat}.*")
endforeach()
set_target_properties(lvgl PROPERTIES SOURCES "${lvgl_sources}")

# 同固件：lv_font_manager_recycle C23 返回值 bug 补丁（clang 下同样需要）
get_target_property(lvgl_sources lvgl SOURCES)
list(REMOVE_ITEM lvgl_sources ${FIRMWARE_DIR}/modules/lvgl/src/font/font_manager/lv_font_manager_recycle.c)
set_target_properties(lvgl PROPERTIES SOURCES "${lvgl_sources}")
target_sources(lvgl PRIVATE ${FIRMWARE_DIR}/ui/lvgl_port/workarounds/lv_font_manager_recycle.c)
set_property(
    SOURCE ${FIRMWARE_DIR}/ui/lvgl_port/workarounds/lv_font_manager_recycle.c
    TARGET_DIRECTORY lvgl APPEND
    PROPERTY INCLUDE_DIRECTORIES ${FIRMWARE_DIR}/modules/lvgl/src/font/font_manager
)

# ── 模拟器可执行 ──
add_executable(onekey-sim src/main.c)
target_include_directories(onekey-sim PRIVATE src)
target_link_libraries(onekey-sim PRIVATE lvgl SDL2::SDL2 m pthread)
```

- [ ] **Step 4: 写 src/main.c（M1 最小版：空窗口 + 一个 label + --frames 自检参数）**

```c
// OneKey Pro 2 固件 UI 模拟器
// 用法:
//   ./onekey-sim                 交互模式（SDL 窗口，鼠标=触摸）
//   ./onekey-sim --frames N      跑 N 帧后退出（无头自检用，配合 SDL_VIDEODRIVER=dummy）
#include <lvgl.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

#define SIM_HRES 480
#define SIM_VRES 800

static uint32_t sim_tick_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint32_t)((uint64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
}

int main(int argc, char** argv)
{
    long max_frames = -1; // -1 = 无限（交互模式）
    for ( int i = 1; i < argc; i++ )
    {
        if ( strcmp(argv[i], "--frames") == 0 && i + 1 < argc )
            max_frames = atol(argv[++i]);
    }

    lv_init();
    lv_tick_set_cb(sim_tick_ms);

    lv_display_t* disp = lv_sdl_window_create(SIM_HRES, SIM_VRES);
    lv_sdl_window_set_title(disp, "OneKey Pro 2 Simulator");
    lv_sdl_mouse_create();

    lv_obj_t* label = lv_label_create(lv_screen_active());
    lv_label_set_text(label, "OneKey Pro 2 Simulator\nM1: toolchain OK");
    lv_obj_center(label);

    for ( long frame = 0; max_frames < 0 || frame < max_frames; frame++ )
    {
        uint32_t delay = lv_timer_handler();
        if ( delay == LV_NO_TIMER_READY )
            delay = 5;
        usleep(delay * 1000);
    }
    printf("sim: exit after %ld frames\n", max_frames);
    return 0;
}
```

- [ ] **Step 5: 写 .gitignore**

```
build/
out/
assets/
tools/*.ttf
.DS_Store
```

- [ ] **Step 6: 构建**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim
cmake -B build -G Ninja && ninja -C build
```

预期：构建成功，产物 `build/onekey-sim`。
若 lvgl 个别源文件在 macOS 上编不过：优先在 CMake 的 `foreach(pat ...)` 过滤列表加对应模式剔除（这些都是被 lv_conf 关掉的可选驱动/库），不要改固件源码。

- [ ] **Step 7: 无头自检 + 交互验证**

```bash
SDL_VIDEODRIVER=dummy ./build/onekey-sim --frames 60
```

预期输出：`sim: exit after 60 frames`，退出码 0。

```bash
./build/onekey-sim   # 手动看一眼：480×800 窗口 + 居中文字，Ctrl-C 退出
```

- [ ] **Step 8: Commit**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim
git add CMakeLists.txt lv_conf.h src/main.c .gitignore
git commit -m "feat: M1 工程骨架 — LVGL SDL 空窗口（480x800, RGB565）"
```

---

### Task 2: 资产生成 — 字体 bin + 占位图 PNG

**Files:**
- Create: `firmware-pro2-sim/tools/gen_fonts.sh`
- Create: `firmware-pro2-sim/tools/gen_placeholder_images.py`

- [ ] **Step 1: 写 tools/gen_fonts.sh**

```bash
#!/bin/bash
# 生成固件 ui_font_manager 需要的 LVGL bin 字体
# 格式与 ui/font/ui_binfont_loader.c 解析的一致（lv_font_conv --format bin）
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p assets/font

TTF=tools/Montserrat-Regular.ttf
if [ ! -f "$TTF" ]; then
    echo "下载 Montserrat-Regular.ttf (OFL 开源字体)..."
    curl -fsSL -o "$TTF" \
        "https://raw.githubusercontent.com/JulietaUla/Montserrat/master/fonts/ttf/Montserrat-Regular.ttf"
fi

# 尺寸列表与 ui/font/ui_font_manager.c 的 g_font_manager_montserrat_map 一致
for size in 14 16 20 22 24 26 28 30 32 48; do
    npx --yes lv_font_conv \
        --font "$TTF" --size "$size" --bpp 4 --format bin --no-compress \
        --range 0x20-0x7E \
        -o "assets/font/font_montserrat_${size}.bin"
    echo "OK assets/font/font_montserrat_${size}.bin"
done
```

- [ ] **Step 2: 写 tools/gen_placeholder_images.py**

```python
#!/usr/bin/env python3
"""扫描固件源码中的 A:/assets/**.png 引用，为每个生成灰色占位 PNG。

真机资产不在固件仓库中（运行时由 EMMC 提供）；占位图保证页面结构可渲染。
后续拿到真实资产时直接覆盖 assets/ 目录即可。
用法: python3 tools/gen_placeholder_images.py [FIRMWARE_DIR]
"""
import os
import re
import struct
import sys
import zlib

SIM_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIRMWARE_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(SIM_ROOT, "..", "firmware-pro2")

PAT = re.compile(r'A:(/assets/[\w./-]+?\.png)')

refs = set()
for root, dirs, files in os.walk(FIRMWARE_DIR):
    dirs[:] = [d for d in dirs if d not in ("modules", ".git", ".build")]
    for f in files:
        if f.endswith((".c", ".h")):
            with open(os.path.join(root, f), encoding="utf-8", errors="ignore") as fp:
                refs.update(PAT.findall(fp.read()))

def make_png(path, size):
    """无第三方依赖生成 size×size 半透明灰色 RGBA PNG。"""
    w = h = size
    raw = b"".join(b"\x00" + b"\x80\x80\x80\xc0" * w for _ in range(h))
    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(raw))
           + chunk(b"IEND", b""))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as fp:
        fp.write(png)

for ref in sorted(refs):
    m = re.search(r"_(\d+)(?:\.png)+$", ref)
    size = int(m.group(1)) if m else 32
    out = os.path.join(SIM_ROOT, ref.lstrip("/"))
    make_png(out, size)
    print(f"{ref}  ->  {size}x{size}")

print(f"共生成 {len(refs)} 个占位图")
```

- [ ] **Step 3: 执行生成并验证**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim
chmod +x tools/gen_fonts.sh
./tools/gen_fonts.sh
python3 tools/gen_placeholder_images.py
ls -la assets/font/        # 预期 10 个 .bin，每个几 KB～几十 KB
find assets -name "*.png" | wc -l   # 预期 ≥10（以实际扫描数为准，脚本会打印清单）
```

验证字体格式（bin 字体头 4 字节后是 "head" 标签）：

```bash
xxd assets/font/font_montserrat_14.bin | head -2   # 偏移 4 处应见 "head"
```

- [ ] **Step 4: Commit**

```bash
git add tools/ && git commit -m "feat: 资产生成脚本（lv_font_conv bin 字体 + 占位 PNG）"
```

---

### Task 3: 编译固件 UI 库 + 渲染 demo 总菜单（里程碑 M2/M3）

**Files:**
- Modify: `firmware-pro2-sim/CMakeLists.txt`（追加 UI 源码）
- Modify: `firmware-pro2-sim/src/main.c`（字体管理器 + demo 菜单）

- [ ] **Step 1: CMakeLists.txt 追加固件 UI 源码（加在 add_executable 之后）**

```cmake
# ── 固件真实 UI 源码（只读引用） ──
file(GLOB_RECURSE FIRMWARE_UI_SOURCES
    ${FIRMWARE_DIR}/ui/components/*.c
    ${FIRMWARE_DIR}/ui/font/*.c
    ${FIRMWARE_DIR}/ui/demo/*.c
    ${FIRMWARE_DIR}/tasks/task_foreground/pages/*.c
)
target_sources(onekey-sim PRIVATE ${FIRMWARE_UI_SOURCES})
target_include_directories(onekey-sim PRIVATE
    ${FIRMWARE_DIR}/ui
    ${FIRMWARE_DIR}/ui/components
    ${FIRMWARE_DIR}/ui/components/slider     # demo 用引号 include "slider_normal.h"
    ${FIRMWARE_DIR}/ui/components/keyboard   # demo 用引号 include "keyboard_defs.h"
    ${FIRMWARE_DIR}/ui/demo
    ${FIRMWARE_DIR}/ui/font
    ${FIRMWARE_DIR}/hal/utils                # emmc_png_demo include <debug_print.h>（空宏，无需 stub）
    ${FIRMWARE_DIR}/tasks/task_foreground
)
```

- [ ] **Step 2: main.c 接入字体管理器与 demo 菜单**

将 Task 1 的 label 段替换为：

```c
    // ... lv_sdl_mouse_create(); 之后 ...

    if ( !ui_font_manager_init() )
    {
        fprintf(stderr, "sim: font manager init 失败 — 先运行 tools/gen_fonts.sh 生成 assets/font/*.bin\n");
        return 1;
    }

    onekey_demo_layouts(); // 固件 demo 总菜单（自带各 demo 入口与返回按钮）
```

头部新增 include：

```c
#include <ui_font_manager.h>
#include <onekey_demo_layouts.h>
```

- [ ] **Step 3: 构建**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim && ninja -C build
```

预期：成功。常见问题处置（均改 sim 侧，不改固件）：
- 头文件找不到 → 按引号 include 的所在目录补 `target_include_directories`
- 符号重复/缺失 → 检查 GLOB 是否把不该编的文件卷进来，用 `list(FILTER ... EXCLUDE REGEX ...)` 剔除

- [ ] **Step 4: 无头自检 + 交互验证**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim   # 必须在工程根目录跑（A: → ./assets）
SDL_VIDEODRIVER=dummy ./build/onekey-sim --frames 120
```

预期：`sim: exit after 120 frames`，无 crash、无 `Error` 级日志刷屏（个别图片 WARN 可接受）。

```bash
./build/onekey-sim
```

手动验证（M2/M3 验收）：demo 菜单渲染出按钮列表（Montserrat 字体生效，非方框）；逐个点进 Text Button / Toast / Checkbox / 键盘等 demo，能进能退。

- [ ] **Step 5: Commit**

```bash
git add CMakeLists.txt src/main.c
git commit -m "feat: M2/M3 固件 UI 源码渲染 — demo 总菜单 + 13 组件可交互"
```

---

### Task 4: 产品页 homescreen / settings（里程碑 M4）

**Files:**
- Modify: `firmware-pro2-sim/src/main.c`（`--page` 参数）

- [ ] **Step 1: main.c 增加 --page 参数路由**

头部新增：

```c
#include <pages/homescreen.h>
#include <pages/settings.h>
```

参数解析处新增 `const char* page = NULL;`：

```c
        else if ( strcmp(argv[i], "--page") == 0 && i + 1 < argc )
            page = argv[++i];
```

`onekey_demo_layouts();` 替换为：

```c
    if ( page == NULL || strcmp(page, "demo") == 0 )
    {
        onekey_demo_layouts();
    }
    else if ( strcmp(page, "homescreen") == 0 )
    {
        ui_create_homescreen(lv_screen_active());
    }
    else if ( strcmp(page, "settings") == 0 )
    {
        ui_create_homescreen(lv_screen_active()); // settings 是 homescreen 上的覆盖页
        ui_create_settings_page(lv_screen_active());
        ui_show_settings_page();
    }
    else
    {
        fprintf(stderr, "sim: 未知页面 '%s'（可选: demo / homescreen / settings）\n", page);
        return 1;
    }
```

- [ ] **Step 2: 构建 + 验证**

```bash
ninja -C build
SDL_VIDEODRIVER=dummy ./build/onekey-sim --page homescreen --frames 120
SDL_VIDEODRIVER=dummy ./build/onekey-sim --page settings --frames 120
./build/onekey-sim --page homescreen   # 手动核对页面内容
```

预期：两条无头命令均正常退出；交互窗口显示 homescreen（状态栏电量 80% 为 status_bar.c 内置 USE_SIMULATOR mock，正常）。

- [ ] **Step 3: Commit**

```bash
git add src/main.c
git commit -m "feat: M4 产品页 homescreen/settings 渲染（--page 参数）"
```

---

### Task 5: `--snapshot` 批量截图（里程碑 M5）

**Files:**
- Create: `firmware-pro2-sim/src/page_registry.h`
- Create: `firmware-pro2-sim/src/page_registry.c`
- Create: `firmware-pro2-sim/src/snapshot.h`
- Create: `firmware-pro2-sim/src/snapshot.c`
- Modify: `firmware-pro2-sim/CMakeLists.txt`、`firmware-pro2-sim/src/main.c`

- [ ] **Step 1: 写 page_registry.h**

```c
#pragma once
#include <stdbool.h>

typedef struct
{
    const char* id;        // 文件名用（如 "text-button"）
    const char* name_zh;   // 中文名（日志用）
    void (*create)(void);  // 在 lv_screen_active() 上创建页面
    bool supported;        // false = 跳过（标注原因在 .c 注释里）
} sim_page_t;

extern const sim_page_t SIM_PAGES[];
extern const int SIM_PAGE_COUNT;
```

- [ ] **Step 2: 写 page_registry.c（带参 demo 用 wrapper 适配）**

```c
#include "page_registry.h"
#include <lvgl.h>

#include <onekey_demo_layouts.h>
#include "text_button_demo.h"
#include "icon_button_demo.h"
#include "information_tip_demo.h"
#include "toast_demo.h"
#include "checkbox_demo.h"
#include "navigation_bar_demo.h"
#include "container_demo.h"
#include "button_list_demo.h"
#include "slider_list_demo.h"
#include "alert_window_demo.h"
#include "action_sheet_demo.h"
#include "page_sheet_demo.h"
#include "status_bar_demo.h"
#include "animation_demo.h"
#include "emmc_png_demo.h"
#include <keyboard/keyboard_number.h>
#include <keyboard/keyboard_mnemonic.h>
#include <keyboard/keyboard_passphrase.h>
#include <pages/homescreen.h>
#include <pages/settings.h>

// 带参入口的 wrapper（统一成 void(void)）
static void w_navigation_bar(void) { ui_create_navigation_bar_demo(lv_screen_active()); }
static void w_emmc_png(void)       { ui_create_emmc_png_demo(lv_screen_active()); }
static void w_status_bar(void)     { status_bar_demo_create(lv_screen_active()); }
static void w_kb_number(void)      { ui_create_numberKeyboard(); }
static void w_kb_mnemonic(void)    { ui_create_mnemonicKeyboard(); }
static void w_kb_passphrase(void)  { ui_create_passphraseKeyboard(); }
static void w_homescreen(void)     { ui_create_homescreen(lv_screen_active()); }
static void w_settings(void)
{
    ui_create_homescreen(lv_screen_active());
    ui_create_settings_page(lv_screen_active());
    ui_show_settings_page();
}

const sim_page_t SIM_PAGES[] = {
    {"demo-menu",       "Demo 总菜单",   onekey_demo_layouts,            true},
    {"text-button",     "文字按钮",      ui_create_text_button_demo,     true},
    {"icon-button",     "图标按钮",      ui_create_icon_button_demo,     true},
    {"information-tip", "信息提示",      ui_create_information_tip_demo, true},
    {"toast",           "Toast",         ui_create_toast_demo,           true},
    {"checkbox",        "复选框",        ui_create_checkbox_demo,        true},
    {"navigation-bar",  "导航栏",        w_navigation_bar,               true},
    {"container",       "容器",          ui_create_container_demo,       true},
    {"button-list",     "按钮列表",      ui_create_button_list_demo,     true},
    {"slider-list",     "滑块列表",      ui_create_slider_list_demo,     true},
    {"alert-window",    "警告弹窗",      ui_create_alert_window_demo,    true},
    {"action-sheet",    "操作面板",      ui_create_action_sheet_demo,    true},
    {"page-sheet",      "页面面板",      ui_create_page_sheet_demo,      true},
    {"status-bar",      "状态栏",        w_status_bar,                   true},
    {"animation",       "动画",          ui_create_animation_demo,       true},
    {"emmc-png",        "EMMC 图片",     w_emmc_png,                     true},
    {"kb-number",       "数字键盘",      w_kb_number,                    true},
    {"kb-mnemonic",     "助记词键盘",    w_kb_mnemonic,                  true},
    {"kb-passphrase",   "Passphrase 键盘", w_kb_passphrase,              true},
    {"homescreen",      "主屏",          w_homescreen,                   true},
    {"settings",        "设置页",        w_settings,                     true},
};
const int SIM_PAGE_COUNT = (int)(sizeof(SIM_PAGES) / sizeof(SIM_PAGES[0]));
```

- [ ] **Step 3: 写 snapshot.h / snapshot.c**

```c
// snapshot.h
#pragma once
// 遍历页面注册表，逐页渲染并导出 PNG 到 out_dir。返回失败页数（0 = 全部成功）。
int sim_snapshot_all(const char* out_dir);
```

```c
// snapshot.c
#include "snapshot.h"
#include "page_registry.h"

#include <lvgl.h>
#include <lodepng.h>   // 由 lvgl 编译（LV_USE_LODEPNG=1），include 目录在 CMake 中补
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>

// 渲染 n 帧让动画/异步布局稳定
static void pump_frames(int n)
{
    for ( int i = 0; i < n; i++ )
    {
        lv_timer_handler();
        lv_refr_now(NULL);
    }
}

// lv_snapshot ARGB8888 输出为 BGRA 字节序，转 RGBA 并按 stride 去 padding
static int write_png(const char* path, lv_draw_buf_t* buf)
{
    const uint32_t w = buf->header.w, h = buf->header.h, stride = buf->header.stride;
    unsigned char* rgba = malloc((size_t)w * h * 4);
    if ( rgba == NULL )
        return -1;
    for ( uint32_t y = 0; y < h; y++ )
    {
        const uint8_t* src = buf->data + (size_t)y * stride;
        unsigned char* dst = rgba + (size_t)y * w * 4;
        for ( uint32_t x = 0; x < w; x++ )
        {
            dst[x * 4 + 0] = src[x * 4 + 2]; // R <- B 位
            dst[x * 4 + 1] = src[x * 4 + 1]; // G
            dst[x * 4 + 2] = src[x * 4 + 0]; // B <- R 位
            dst[x * 4 + 3] = 0xFF;           // 不透明
        }
    }
    unsigned err = lodepng_encode32_file(path, rgba, w, h);
    free(rgba);
    return err == 0 ? 0 : -1;
}

int sim_snapshot_all(const char* out_dir)
{
    mkdir(out_dir, 0755);
    int failed = 0;
    for ( int i = 0; i < SIM_PAGE_COUNT; i++ )
    {
        const sim_page_t* p = &SIM_PAGES[i];
        if ( !p->supported )
        {
            printf("SKIP  %-16s %s\n", p->id, p->name_zh);
            continue;
        }
        // 每页用全新 screen，避免页面间状态串扰
        lv_obj_t* scr = lv_obj_create(NULL);
        lv_screen_load(scr);
        pump_frames(3);

        p->create();
        pump_frames(10);

        lv_draw_buf_t* buf = lv_snapshot_take(lv_screen_active(), LV_COLOR_FORMAT_ARGB8888);
        char path[512];
        snprintf(path, sizeof(path), "%s/%s.png", out_dir, p->id);
        if ( buf == NULL || write_png(path, buf) != 0 )
        {
            printf("FAIL  %-16s %s\n", p->id, p->name_zh);
            failed++;
        }
        else
        {
            printf("OK    %-16s %s -> %s\n", p->id, p->name_zh, path);
        }
        if ( buf != NULL )
            lv_draw_buf_destroy(buf);
    }
    printf("snapshot 完成: %d/%d 失败\n", failed, SIM_PAGE_COUNT);
    return failed;
}
```

- [ ] **Step 4: CMake 接入新源文件与 lodepng 头**

```cmake
target_sources(onekey-sim PRIVATE src/page_registry.c src/snapshot.c)
target_include_directories(onekey-sim PRIVATE
    ${FIRMWARE_DIR}/modules/lvgl/src/libs/lodepng
)
```

- [ ] **Step 5: main.c 接入 --snapshot**

头部 `#include "snapshot.h"`；参数解析新增 `const char* snapshot_dir = NULL;`：

```c
        else if ( strcmp(argv[i], "--snapshot") == 0 && i + 1 < argc )
            snapshot_dir = argv[++i];
```

在 `ui_font_manager_init()` 成功之后、页面路由之前插入：

```c
    if ( snapshot_dir != NULL )
        return sim_snapshot_all(snapshot_dir);
```

- [ ] **Step 6: 构建 + 验证**

```bash
ninja -C build
cd ~/workspace/codex-workspace/firmware-pro2-sim
SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot out
ls -la out/   # 预期 21 个 PNG
```

预期：`snapshot 完成: 0/21 失败`，退出码 0。打开 `out/demo-menu.png`、`out/homescreen.png` 人工核对内容非空白、字体正常。
若个别页 FAIL/空白：将该页 `supported` 置 `false` 并在注册表行尾注释原因，不阻塞整体交付；问题记入 Task 6 的 knowledge 沉淀。

- [ ] **Step 7: Commit**

```bash
git add src/ CMakeLists.txt
git commit -m "feat: M5 --snapshot 批量截图（21 页 PNG 导出）"
```

---

### Task 6: README + 知识沉淀 + 收尾

**Files:**
- Create: `firmware-pro2-sim/README.md`
- Modify: `QA-AGENTS/shared/knowledge.json`（K-NNN 递增追加）
- Modify: `~/.claude/github-kb-index.md`（登记 firmware-pro2 clone）

- [ ] **Step 1: 写 README.md**

```markdown
# OneKey Pro 2 固件 UI 模拟器

在 macOS 上用 firmware-pro2 真实 UI 源码（LVGL）渲染设备页面（480×800 RGB565）。
固件仓库零改动，通过 `FIRMWARE_DIR` 只读引用。

## 依赖
- Homebrew: `brew install sdl2 cmake ninja`
- Node.js（字体生成用 `npx lv_font_conv`）、Python3
- `../firmware-pro2` clone（lvgl submodule 已 init）

## 首次构建
```bash
./tools/gen_fonts.sh                      # 生成 assets/font/*.bin
python3 tools/gen_placeholder_images.py   # 生成占位图（有真机资产可直接覆盖 assets/）
cmake -B build -G Ninja && ninja -C build
```

## 使用
```bash
./build/onekey-sim                        # 交互模式：demo 总菜单，鼠标=触摸
./build/onekey-sim --page homescreen      # 指定页面: demo / homescreen / settings
./build/onekey-sim --snapshot out         # 全部页面批量导出 PNG
SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot out   # 无头模式（CI）
```

## 已知差异（vs 真机）
- 图片为灰色占位图（真机资产在 EMMC，不在固件仓库）；拿到真资产后覆盖 `assets/` 即可
- 状态栏电量 80% 等为固件 `status_bar.c` 内置 `USE_SIMULATOR` mock
- DMA2D 硬件加速 → LVGL 软件渲染（渲染结果一致，仅速度差异）

## 固件更新后
`cd ../firmware-pro2 && git pull && cd - && ninja -C build`，编不过通常是新增了头文件目录，按报错补 `target_include_directories`。
```

- [ ] **Step 2: 知识沉淀到 QA-AGENTS（按项目规范，K-NNN 递增）**

向 `QA-AGENTS/shared/knowledge.json` 追加（先读文件确认当前最大 K-NNN，category 用 `process`/`quirk`）：
- 固件 UI 模拟器的存在与用法（路径、三种模式、固件零改动架构）
- `firmware-pro2` 资产不在仓库（EMMC 运行时加载，`A:` 盘符），模拟器用 lv_font_conv 生成字体 bin
- 实现过程中实际踩到的坑（按执行时实际情况记录，如 lvgl host 编译需剔除的源码组、include 目录补充等）

- [ ] **Step 3: 登记 github-kb 索引**

`~/.claude/github-kb-index.md` Repos 表追加一行：

```markdown
| firmware-pro2 | ~/workspace/codex-workspace/firmware-pro2 | OneKey Pro 2 自研固件（STM32H7+FreeRTOS+LVGL9+MicroPython），UI 模拟器见 ../firmware-pro2-sim | 2026-06-12 |
```

- [ ] **Step 4: 最终验证（完整冒烟）**

```bash
cd ~/workspace/codex-workspace/firmware-pro2-sim
rm -rf build out && cmake -B build -G Ninja && ninja -C build
SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot out
echo "exit=$?" && ls out | wc -l
```

预期：从零构建全绿，`exit=0`，21 个 PNG。

- [ ] **Step 5: Commit**

```bash
git add README.md && git commit -m "docs: README — 构建/使用/已知差异"
```

---

## 自审记录

- **Spec 覆盖**：技术路线/零改动/渲染范围（demo 13 组件 + homescreen/settings）/双模式（交互+截图）/480×800/里程碑 M1-M5 — 全部有对应 Task。Spec 中的 `sim_stubs/` 层经实探确认不需要（UI 源码纯 LVGL），属于简化而非缺口，已在"前置事实"中说明。**[执行后回写]** 该结论被部分推翻：实际需要 `src/sim_stubs.c` 提供 `lvgl_disp_hres/vres` 两个全局变量（定义在不编译的 `lv_port_disp.c` 中，固件 UI 14+ 处引用）；另外 `--snapshot` 因固件 static 单例跨页污染（status_bar 挂 layer_top）改为按页 fork+exec 子进程隔离，见 src/snapshot.c。
- **占位符扫描**：无 TBD/TODO；所有代码块完整可粘贴。
- **类型一致性**：`sim_page_t`/`SIM_PAGES`/`sim_snapshot_all` 在 Task 5 内定义与使用一致；`--frames/--page/--snapshot` 参数在 main.c 演进中签名连贯。
