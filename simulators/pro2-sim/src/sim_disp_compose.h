#pragma once
// sim 合成层：固件 ui/lvgl_port/lv_port_disp.c 的 host 版（合成部分逐字抽取，硬件胶水换替身）。
//
// 职责：
//   1. 扫描池：3 片 604x1024 RGB565（同真机 DISP_SCAN_SLICE_COUNT），"前台帧永远是池里某一片"
//      ——LVGL 整帧 flush 先 memcpy 进一片再上屏；compositor present 也落到一片再上屏。
//      所以 lv_port_disp_transition_front_pin / 状态栏行拷贝等依赖池地址的逻辑原样可用。
//   2. 14 个 lv_port_disp_compose_* / transition_* 接口与全部 compose_* 像素合成函数：
//      configure 时由 tools/extract_disp_compose.py 从固件抽取到 build/generated/，本文件 #include。
//   3. 帧接收器：每一帧真正送到"面板"（SDL 纹理）的像素都经过它——LVGL 直绘帧标 "lvgl"，
//      compositor 合成帧标 "compose"。场景执行器用它逐帧落盘，做帧间差异。
#include <lvgl.h>
#include <stdint.h>
#include <stdbool.h>

typedef void (*SimFrameSink_t)(const uint16_t* rgb565_p, uint32_t width, uint32_t height, const char* source_p, void* user_p);

// lv_sdl_window_create 之后调用：分配扫描池、包装 SDL 驱动的 flush_cb、建 RGB565 纹理。
bool sim_disp_compose_init(lv_display_t* disp_p);

// 帧接收器（NULL 取消）。回调在 present 当下同步调用，rgb565_p 指向池内 slice，回调返回后内容可能被复用，需要就拷走。
void sim_disp_frame_sink_set(SimFrameSink_t sink, void* user_p);

// 已上屏帧计数（lvgl + compose 合计）；与 lv_port_disp_present_count_get 相同。
uint32_t sim_disp_present_count(void);

// 当前前台帧（池内 slice，hres x vres RGB565）；未初始化返回 NULL。
const uint16_t* sim_disp_front_frame(void);
