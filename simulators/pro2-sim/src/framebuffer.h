#pragma once
// sim shim：遮蔽固件 sys/framebuffer/framebuffer.h。
//
// 真机：FRAMEBUFFER_POOL_ADDR 是 SDRAM 里 LTDC 扫描池的固定地址，framebuffer_get_handle(SECONDARY)->addr
// 指向当前正在扫描输出的那一片。compositor 用它做两件事：转场时 pin 住前台帧；系统覆盖层（状态栏）
// 从前台帧拷贝未变化的行。
// sim：扫描池是 host 堆上 3 片 604x1024 RGB565（sim_disp_compose.c），addr 改为 uintptr_t（固件是
// uint32_t，64 位 host 放不下指针；compositor 只读该字段，兼容）。"前台帧永远在池内" 的不变量由
// sim_disp_compose.c 维护：LVGL flush 与 compositor present 都先落到池内的 slice 再上屏。
#include <stdint.h>
#include <stdbool.h>

typedef enum
{
    FRAMEBUFFER_CHANNEL_INVALID = 0,
    FRAMEBUFFER_CHANNEL_PRIMARY,
    FRAMEBUFFER_CHANNEL_SECONDARY,
    FRAMEBUFFER_CHANNEL_TOTAL,
} FramebufferChannel_t;

typedef enum
{
    FRAMEBUFFER_FORMAT_INVALID = 0,
    FRAMEBUFFER_FORMAT_RGB565,
    FRAMEBUFFER_FORMAT_RGB888,
    FRAMEBUFFER_FORMAT_ARGB8888,
    FRAMEBUFFER_FORMAT_TOTAL,
} FramebufferFormat_t;

typedef struct
{
    uintptr_t addr; // 固件为 uint32_t
    uint32_t byte_size;
    uint32_t x_size;
    uint32_t y_size;
    uint32_t x_pos;
    uint32_t y_pos;
    FramebufferFormat_t format;
} FramebufferConfig_t;

FramebufferConfig_t* framebuffer_get_handle(FramebufferChannel_t channel);

// 扫描池（sim_disp_compose.c 分配）。固件里是常量宏，这里是函数求值，用法不变。
uintptr_t sim_framebuffer_pool_addr(void);
uint32_t sim_framebuffer_pool_size_bytes(void);
#define FRAMEBUFFER_POOL_ADDR       (sim_framebuffer_pool_addr())
#define FRAMEBUFFER_POOL_SIZE_BYTES (sim_framebuffer_pool_size_bytes())
