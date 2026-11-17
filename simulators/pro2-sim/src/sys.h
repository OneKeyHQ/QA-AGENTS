#pragma once
// sim shim：真机 sys/sys.h 会拉入 <hal.h>/fault_handlers/tusb_port 整个硬件栈。
// UI 层（ui_colors.h 等）include <sys.h> 只为取 per-model 配置宏
// （SYS_UI_DP_SCALE_125 / SYS_DEVICE_MODEL_NAME / SYS_DEVICE_SE_* ...），
// 这里直接透传固件 sys/sys_config_pro2.h（main 2026-10 起 sys/sys_config.h 已删，
// 由 sys/sys_internal.h 按 MODULE_SYS_CONFIG_H 选择；sim 在 CMakeLists 定义该宏为
// "sys_config_pro2.h"，经 -I ${FIRMWARE_DIR}/sys 解析）。
// src/ 位于 include 搜索路径最前，故本文件遮蔽固件 sys/sys.h。

#include <stdint.h>
#include <stdbool.h>

// 固件 sys/sys_internal.h：MODULE_SYS_TYPE_* 常量、按 MODULE_SYS_CONFIG_H 引入机型配置、
// SYS_DEVICE_SE_COUNT 等派生宏。它只 include <hal.h>（在 sim 解析到 src/hal.h shim），可直接用。
#include <sys_internal.h>

// 真机 UI 代码经 sys.h → <hal.h> → crypto.h / soc_cache.h 拿到安全清零与 dcache 声明
// （pin_set.c / backup_keytag.c / asset_progress_bar.c 等直接调用且不自行 include）。
// crypto_utils.h 只依赖 secbool.h/util_macros.h，实现在 sim_stubs.c；dcache 空实现在 sim_hw_shims.c。
#include <crypto_utils.h>
#include "soc_cache.h"
