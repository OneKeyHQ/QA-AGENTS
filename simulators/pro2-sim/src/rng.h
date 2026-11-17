#pragma once
// sim shim：遮蔽固件 hal/soc/rng/rng.h（STM32 硬件 RNG，依赖 hal_internal.h）。
// main 2026-10 起 ui/components/keyboard/keyboard_layout.c 直接 include <rng.h> 做键盘乱序。
// host 实现用 arc4random（sim_hw_shims.c）。
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

bool rng_get(uint32_t* out);
bool rng_get_buffer(uint8_t* buffer, size_t length);
