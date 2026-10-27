#pragma once
// sim shim：遮蔽固件 hal/hal.h（STM32H7 整个硬件栈）。
//
// 只暴露 compositor（tasks/task_foreground/compositor/*.c）与固件 lv_port_indev.c
// 在 host 上真正用到的那一小撮接口，实现全部在 src/sim_hw_shims.c：
//   - DMA2D：convert / fill 的软件版（memcpy / 循环）
//   - DWT：周期计数器 → host 单调时钟
//   - 触摸面板：TouchPanelData_t 与 touch_panel_read/irq_read（场景注入队列 + SDL 鼠标）
//   - ARM 屏障宏：host 上为编译器/原子栅栏
// 固件新增用到的 HAL 符号会在链接期报 undefined，按同样方式补到这里。
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

#include "soc_cache.h"

// ── ARM CMSIS 屏障（lv_port_disp.c / lv_port_indev.c 直接用）──
#define __DSB() __atomic_thread_fence(__ATOMIC_SEQ_CST)
#define __DMB() __atomic_thread_fence(__ATOMIC_SEQ_CST)

// ── hal/soc/timer/dwt.h ──
uint32_t dwt_get_counter(void);

// ── hal/soc/dma2d/dma2d.h（颜色模式值同 STM32 HAL：ARGB8888=0, RGB565=2）──
#define DMA2D_INPUT_ARGB8888  0x0U
#define DMA2D_INPUT_RGB565    0x2U
#define DMA2D_OUTPUT_ARGB8888 0x0U
#define DMA2D_OUTPUT_RGB565   0x2U

// R2M 纯色填充：addr_dest 起 width x height 像素，每行末尾跳过 offset 像素（行距 = width + offset）。
bool dma2d_fill(uint32_t* addr_dest, uint32_t offset, uint32_t width, uint32_t height, uint32_t color, uint32_t output_color_mode);
// M2M 拷贝/转换：src/dst 各自按 (y * stride + x) 定位，拷 width x height 像素。
bool dma2d_convert(
    uint32_t* addr_src, uint32_t src_stride, uint32_t input_color_mode, uint32_t* addr_dst, uint32_t dst_stride, uint32_t output_color_mode, uint32_t x,
    uint32_t y, uint32_t width, uint32_t height
);
// M2M_BLEND：FG（按 opacity 再乘一层 alpha）over BG → dst。覆盖层半透明部分（ARGB8888 行段 / 非 COVER 透明度）走这里。
bool dma2d_blend_opa(
    uint32_t* addr_fg, uint32_t fg_stride, uint32_t fg_color_mode, uint8_t opacity, uint32_t* addr_bg, uint32_t bg_stride, uint32_t bg_color_mode,
    uint32_t* addr_dst, uint32_t dst_stride, uint32_t output_color_mode, uint32_t x, uint32_t y, uint32_t width, uint32_t height
);

// lv_port_disp.c 的一条失败日志打印 DMA2D->CR 寄存器；host 给个固定 0 的替身。
typedef struct
{
    uint32_t CR;
} SimDma2dRegs_t;
extern SimDma2dRegs_t sim_dma2d_regs;
#define DMA2D (&sim_dma2d_regs)

// ── hal/peripheral/touch_panel/touch_panel.h ──
typedef enum
{
    TOUCH_PANEL_EVENT_INVALID = 0,
    TOUCH_PANEL_EVENT_NONE,
    TOUCH_PANEL_EVENT_START,
    TOUCH_PANEL_EVENT_MOVE,
    TOUCH_PANEL_EVENT_END,
    TOUCH_PANEL_EVENT_TOTAL,
} TouchPanelEvent_t;

typedef struct
{
    uint32_t x;
    uint32_t y;
    TouchPanelEvent_t event;
} TouchPanelData_t;

bool touch_panel_init(void);
TouchPanelData_t touch_panel_read(void);
bool touch_panel_irq_read(void);
// 真机：触摸使能时读掉一次残留点击（lv_port_indev_enable）。sim 无残留，回 NONE。
TouchPanelData_t touch_panel_click(void);

// ── sys/fault_handler/fault_handlers.h（真机经 hal.h 链路可见；sim 在 src/fault_handlers.h shim）──
#include "fault_handlers.h"
