#pragma once
// sim_hw_shims.c 里 sim 自己的开关（固件 HAL 接口在 src/hal.h）。
#include <stdbool.h>

// SDL 鼠标作为触摸源的开关。场景模式关掉，避免无头/CI 环境里鼠标状态干扰注入序列。
void sim_touch_mouse_enable(bool enable);
