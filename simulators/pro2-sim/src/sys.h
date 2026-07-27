#pragma once
// sim shim：真机 sys/sys.h 会拉入 <hal.h>/fault_handlers/tusb_port 整个硬件栈。
// UI 层（ui_colors.h 等）include <sys.h> 只为取 per-model 配置宏
// （SYS_UI_DP_SCALE_125 / SYS_DEVICE_MODEL_NAME / SYS_DEVICE_SE_* ...），
// 这里直接透传固件 sys/sys_config.h（经 -I ${FIRMWARE_DIR}/sys 解析，
// MODULE_SYS_CONFIG_H 在 CMakeLists 定义为 sys_config_pro2.h）。
// src/ 位于 include 搜索路径最前，故本文件遮蔽固件 sys/sys.h。

#include <stdint.h>
#include <stdbool.h>

#include "sys_config.h"
