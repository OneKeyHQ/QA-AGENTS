# OneKey Pro 2 固件 UI 模拟器

在 macOS 上直接用 **firmware-pro2 真实 UI 源码**（LVGL 9）渲染设备页面（Pro 2 面板 **604×1024**，SDL 窗口，鼠标=触摸）。固件仓库**零改动**——CMake 通过 `FIRMWARE_DIR` 只读引用本地 firmware-pro2 clone（2026-10 起 **main** 分支，远端 dev 已删）的源码与 lvgl submodule。

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

## 滚动 / 翻页 / 转场闪烁类问题复现与回归（`--scenario`）

真机滚动、首页翻页、segmented 横滑、页面推入弹出时**不走在线渲染**：`tasks/task_foreground/compositor`
冻结 LVGL 刷新，用组件快照逐帧合成。"滚动中组件闪烁 / 残影"（如 OK-64012 多重备份警告页 Continue
按钮）只在这条路径上出现。2026-10 起 compositor **原样编入** sim，真机 `lv_port_disp.c` 的像素合成段在
configure 时逐字抽取（`tools/extract_disp_compose.py`），触摸走固件 `lv_port_indev.c`，所以 sim 上的
合成帧与真机同源。

```bash
# 回放 JSON 场景（虚拟时钟、固件同款手势注入），逐帧 PNG + 帧间差异报告，退出码 0 过 / 1 断言失败 / 2 错误
SDL_VIDEODRIVER=dummy ./build/onekey-sim --scenario scenarios/ok-64012-ms-warning-scroll.json --out out/ok-64012
open out/ok-64012/report.md

# 修复前 / 修复后两份固件对照（按 commit 克隆到 ../../.deps/，各自 build-<commit>/）：修复前必须 FAIL，修复后必须 PASS
tools/regress_scenario.sh scenarios/ok-64012-ms-warning-scroll.json aea0ae02 d7e612e6
```

场景格式、断言语义、容差说明见 `scenarios/README.md`；设计见 `docs/specs/2026-10-21-compositor-scenario-design.md`。
GUI 模式下鼠标拖动同样走 compositor（窗口里能直接看到合成帧）。

## 已知差异 vs 真机

| 差异 | 原因 |
|------|------|
| 图片是灰色占位图 | 真实资产不在固件仓库（运行时由设备 EMMC 提供），模拟器用 `tools/gen_placeholder_images.py` 生成同名占位 PNG |
| 状态栏电量为随机 mock（每次运行 20–99%）| 固件 `status_bar.c` 的 `USE_SIMULATOR` mock：`(lv_tick_get() % 80) + 20` |
| DMA2D → 软件版（`src/sim_hw_shims.c`） | host 上无 STM32 DMA2D；convert/fill/blend 逐像素实现，合成帧与直绘帧在抗锯齿边缘有 ±1 LSB 舍入差（真机 DMA2D 与 LVGL 混合公式本就不同） |
| present 同步完成、无扫描时序 | 没有 LTDC/DMA2D 异步链；sim 抓"帧内容"类缺陷，抓不到撕裂类时序缺陷 |
| activity_animation 的前台帧蒙版动效跳过 | `lv_port_disp_active_scan_address_get` 是 32 位地址 API，host 指针放不下，返回 0 走降级 |

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
cd <firmware-pro2> && git checkout main && git pull --ff-only origin main   # 2026-10 起跟踪 main（远端 dev 已删）
python3 utils/resource/resource_pkg.py font --only json && python3 utils/resource/resource_pkg.py image   # 资源产物（gitignored）
cd <QA-AGENTS>/simulators/pro2-sim && cmake -B build && ninja -C build       # configure 重跑 page_list / 合成段抽取
```

- i18n JSON 与固件 `i18n_tags.h` 键数不一致时整份翻译作废（启动日志 `Translation key count N, expected M`、页面文案为空）——重跑 `font --only json`。
- 编不过通常是固件新增了头文件目录 / 业务符号：按报错在 `CMakeLists.txt` 补 `target_include_directories`，在 `src/sim_stubs_pages.c` 末尾按现有风格补最小桩。
- configure 报 `extract_disp_compose.py` 失败 = 固件 `lv_port_disp.c` 合成段结构变了：核对 `src/sim_disp_compose.c` 前导段的替身是否仍匹配，再调整脚本里的标记 / 替换计数。
- `PAGE_REGISTER*` 新宏变体无需改 `tools/gen_page_list.py`（任意后缀匹配）。

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
│   ├── sim_stubs_pages.c # Stage B 业务层符号 stub（op_client / auth / slip39 / crypto / navigation_coordinator，策略 b）
│   ├── sim_disp_compose.c/.h # 合成层：扫描池 + LVGL flush 包装 + compositor present → SDL；#include 固件抽取的合成段；帧接收器
│   ├── sim_hw_shims.c/.h # DMA2D 软件版 / DWT / dcache 空实现 / 触摸源（SDL 鼠标）/ RNG / fault handler
│   ├── scenario.c/.h     # --scenario 场景执行器：JSON 步骤、虚拟时钟、手势注入、逐帧 PNG、差异报告与断言
│   ├── hal.h framebuffer.h soc_cache.h rng.h fault_handlers.h sys.h   # 遮蔽固件硬件头的 shim（只暴露 host 用到的接口）
├── scenarios/            # 场景文件（README.md 说明格式；ok-64012-ms-warning-scroll.json 为首个用例）
├── tools/
│   ├── extract_disp_compose.py   # configure 时从固件 lv_port_disp.c 抽取合成段 → build/generated/（标记/替换计数断言）
│   ├── regress_scenario.sh       # 同一场景跑两个固件 commit（修复前 FAIL / 修复后 PASS），固件按 commit 克隆到 ../../.deps/
│   ├── gen_page_list.py          # 解析 page_id.h + PAGE_REGISTER* → build/generated/page_list.inc
│   └── sim_shims/                # <FreeRTOS.h> <task.h> 空头、nanopb 生成头的占位（latest/ legacy/）
├── assets/               # A: 盘内容（字体 bin + 占位/真机图片）
└── docs/                 # plans / specs
```
