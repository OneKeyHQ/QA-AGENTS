# OneKey Pro 2 固件 UI 模拟器

在 macOS 上直接用 **firmware-pro2 真实 UI 源码**（LVGL 9）渲染设备页面（Pro 2 面板 **604×1024**，SDL 窗口，鼠标=触摸）。固件仓库**零改动**——CMake 通过 `FIRMWARE_DIR` 只读引用 `../firmware-pro2`（dev 分支）的源码与 lvgl submodule。

> **dev 分支适配**：dev 分支删除了 `ui/demo`，页面统一由 `tasks/task_foreground` 的 `page_manager` 管理（`PAGE_REGISTER` 宏注册到自定义链接段）。模拟器从固件 `page_id.h` + 各 page `.c` 的 `PAGE_REGISTER` **自动重建全量页面注册表（160 注册页）**。详见下方「dev 分支适配」章节。

## 依赖

```bash
brew install sdl2 cmake ninja
```

- **Node.js**：字体生成用 `npx lv_font_conv@1.5.3`（脚本内已 pin 版本）
- **Python 3**：占位图生成脚本（无第三方依赖）
- **固件仓库**：`../firmware-pro2`（与本仓库同级），且 lvgl submodule 已初始化：

```bash
cd ../firmware-pro2 && git submodule update --init modules/lvgl
```

## 首次构建（四步）

```bash
cd firmware-pro2-sim

# 1. 生成 bin 字体（Montserrat 10 个字号 → assets/font/font_montserrat_*.bin）
./tools/gen_fonts.sh

# 2. 生成占位图（扫描固件源码的 A:/assets|res/**.png 引用 → 灰色占位 PNG）
python3 tools/gen_placeholder_images.py

# 3. 配置
cmake -B build -G Ninja

# 4. 编译
ninja -C build
```

## 使用

> ⚠️ **必须在工程根目录运行。** `lv_conf.h` 的 `LV_FS_STDIO_PATH "assets"` 把 `A:` 盘映射到 `./assets/`（dev 资产路径 `A:/font|graphics|hero_icons/...`）。在错误目录运行**不会 crash**，但字体/图片全部加载失败，页面降级渲染（默认字体、空白图）。

三种模式：

```bash
# 1. 交互模式（默认打开 homescreen）
./build/onekey-sim

# 打开指定页面（160 个注册页，id = PAGE_ID 去前缀小写）
./build/onekey-sim --page homescreen
./build/onekey-sim --page settings
./build/onekey-sim --page onboarding_hello

# 2. 无头自检：跑 N 帧后退出（CI 用）
SDL_VIDEODRIVER=dummy ./build/onekey-sim --page homescreen --frames 120

# 3. 批量截图：遍历全部 supported 页面（148 个），逐页 fork 子进程导出 PNG 到 <dir>
#    needs_arg 页面（12 个）自动 SKIP。退出码 = 失败页数（0 = 全绿）。
SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot out
```

**查看全部页面 id**：传一个不存在的 id 即可列出（或看 `build/generated/page_list.inc`）：

```bash
./build/onekey-sim --page nope
# sim: 未知页面 'nope'，可用页面:
#   lock_screen      lock_screen
#   onboarding_hello onboarding_hello
#   homescreen       homescreen
#   settings         settings
#   ...（共 160 个）
```

## 已知差异 vs 真机

| 差异 | 原因 |
|------|------|
| 图片是灰色占位图 | 真实资产不在固件仓库（运行时由设备 EMMC 提供），模拟器用 `tools/gen_placeholder_images.py` 生成同名占位 PNG |
| 状态栏电量为随机 mock（每次运行 20–99%）| 固件 `status_bar.c` 的 `USE_SIMULATOR` mock：`(lv_tick_get() % 80) + 20` |
| DMA2D 硬件加速 → LVGL 软件渲染 | host 上无 STM32 DMA2D，视觉结果一致、性能路径不同 |

## dev 分支适配

dev 分支重构后，模拟器侧做了如下适配（固件仓库**仍零改动**，所有生成/拷贝产物落 sim 侧 `build/` 或 `tools/`）：

### 1. 面板 604×1024（Pro 2 真实分辨率）

Pro 2 面板 G1354TU101GF = **604×1024**（dev 分支 `DP_UNIT ×1.25` 设计基准，壁纸按此作图）。`src/main.c` 的 `SIM_HRES/SIM_VRES` 与 `src/sim_stubs.c` 的 `lvgl_disp_hres/vres` 必须同步（两处不一致 → SDL 窗口与 LVGL disp 尺寸错位）。机型由编译期 `MODULE_HAL_TYPE=22`（PRO2_V2）注入。

### 2. 字体：Roobert 字号表

`ui_font_manager.c` 按 `MODULE_HAL_TYPE` 选 Pro 2 的 Roobert 字号表。`tools/gen_fonts.sh` 已对齐 dev 分支字号清单（占位用 Montserrat 渲染对应字号 bin）。

### 3. shadow page_manager（Mach-O 段适配）

固件 `page_manager.h` 的 `PAGE_REGISTER` 宏用 ELF 单段语法 `section(".page_registry")`（macOS clang 报错），`page_manager.c` 用 linkerscript 符号枚举该段。CMake configure 时生成 **shadow 拷贝**到 `build/shadow/`：段名换成 Mach-O 语法 `__DATA,__pg_reg`，段边界用 ld64 魔法符号 `section$start$__DATA$__pg_reg` / `section$end$...`（asm 标签绑定，无需运行时 `getsectiondata`）。shadow include 优先级置于固件目录之前。

### 4. 全量页面注册表自动重建

`tools/gen_page_list.py`（CMake configure 时跑）解析固件 `page_id.h` 枚举 + 各 page `.c` 的 `PAGE_REGISTER*` → 生成 `build/generated/page_list.inc`（`{id_str, name_zh, PAGE_ID, supported}`），`src/page_registry.c` `#include` 它。每页统一经 `open_page(page_id)`（init → push → run → 5ms 导航泵）打开。

**统计：160 注册页 = 148 supported + 12 needs_arg**。

### 5. needs_arg 说明（snapshot 跳过）

很多页面 `on_create(container, arg)` 需要调用方传 `void* arg`（payload：列表索引、分片数据、PIN 步骤上下文等）。生成器分析 create 回调函数体：去掉无害的 `UNUSED(arg)`/`(void)arg` 后仍出现 `arg` 标识符 → 判为 **needs_arg**，`supported=0`。这类页面 `--snapshot` 自动 SKIP（不硬塞 NULL 试爆），`--page` 仍可手动打开（自担 NULL 风险）。当前 12 个 needs_arg 页：

```
onboarding_device_name_done, onboarding_restore_share_entered, seedcard_looking,
seedcard_holding, settings_ble_pair_code, nft_detail, settings_findmy,
settings_seedcard_check_rp, settings_enter_recovery_phrase, phrase_edit_word,
settings_keytag_backup_intro, settings_keytag_backup_chart
```

### 6. unsupported 子目录（编译期排除）

下列 page 子目录依赖编译期不可解析的产物，从编译集排除（`CMakeLists.txt` 的 `SIM_PAGES_UNSUPPORTED`），其 `PAGE_ID` 不进注册表：

| 子目录 | 排除原因 | 涉及 PAGE_ID |
|--------|----------|-------------|
| `pages/my_address/` | 依赖 nanopb 生成的 `legacy/messages_uiview.pb.h`（源码不存在）+ `sys/ipc/channel/channel.h`（IPC 通道） | `ADDRESS_DISPLAY` / `ADDRESS_SELECT_NETWORK` / `ADDRESS_SELECT_ACCOUNT` 等 |
| `pages/ui_view/`（sign/verify tx 审批流） | `approval_txconfirm` / `approval_verify` 依赖同一 `messages_uiview.pb.h`；`sign_page`/`verify_page` 传递依赖它 + `ui_msg_queue`/IPC | `SIGN_PAGE` / `VERIFY_PAGE` |

### 7. 业务符号 stub（策略 b）

`tasks/task_foreground` 的业务 `.c`（`utils/op_client`、`auth_manager`、`ui_state_cache`、`slip39_recovery`、`reset_device` 等，依赖 zbus/IPC channel/SE 协处理器）**不编入**，pages 引用到的符号在 `src/sim_stubs_pages.c` 给最小假实现（op_client async 返回 `false`「未发起」、auth/ui_state 放行、crypto 安全默认、slip39 无会话）。每个 stub 注释真机行为。新增页面缺符号时在此补——stub 面越薄越好。

`src/sim_stubs.c` 保留 Stage A 的 host 替身（`lvgl_disp_*`、`debug_log_*`、`g_ui_state_cache`、`ui_request_haptic` 等）。

## 真机资产替换

拿到真实 EMMC 资产后，直接覆盖 `assets/`（及 `res/`）下的同名文件即可。`gen_placeholder_images.py` 对已存在文件会 **SKIP 不覆盖**，可放心重复执行。

## 固件更新后

```bash
cd ../firmware-pro2 && git pull
cd ../firmware-pro2-sim && ninja -C build   # CONFIGURE_DEPENDS 会自动重新 glob 固件源文件
```

编不过通常是固件新增了头文件目录——按报错在 `CMakeLists.txt` 补对应的 `target_include_directories` 即可。若固件新增了 `A:/...` 图片引用，重跑一次 `python3 tools/gen_placeholder_images.py`。

## 工程结构

```
firmware-pro2-sim/
├── CMakeLists.txt        # 引用 ../firmware-pro2 源码 + lvgl submodule（零改动，FILTER 剔除平台驱动）
├── lv_conf.h             # 固件 lv_conf 的 host 适配版（RGB565 / PTHREAD / SDL / FS_STDIO 等 11 处差异）
├── src/
│   ├── main.c            # 入口：SDL 窗口 + 参数解析（--page / --frames / --snapshot / --snapshot-page 内部模式供编排器子进程调用）
│   ├── page_registry.c   # 页面注册表：#include build/generated/page_list.inc（160 页）+ open_page(page_id) 统一入口
│   ├── snapshot.c        # fork+exec 按页子进程编排器：每页独立子进程隔离（单页崩溃不炸整批；退出码=失败页数；必须子进程隔离因固件 static 单例跨页污染单进程无法可靠清理）+ alarm 看门狗防卡死 + layer_top alpha 合成
│   ├── sim_stubs.c       # Stage A host stub（lvgl_disp / debug_log / ui_state_cache 等）
│   └── sim_stubs_pages.c # Stage B 业务层符号 stub（op_client / auth / slip39 / crypto，策略 b）
├── tools/
│   ├── gen_fonts.sh              # Roobert/Montserrat → LVGL bin 字体（dev 字号表）
│   ├── gen_placeholder_images.py # 扫源码生成占位 PNG（assets/ + res/）
│   ├── gen_page_list.py          # 解析 page_id.h + PAGE_REGISTER → build/generated/page_list.inc
│   └── sim_shims/                # <FreeRTOS.h> <task.h> 空头（页面 include 但未用 RTOS 符号）
├── assets/               # A: 盘内容（字体 bin + 占位/真机图片）
└── docs/                 # plans / specs
```
