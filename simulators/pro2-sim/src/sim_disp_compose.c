// sim 合成层：见 sim_disp_compose.h。
//
// 文件结构：
//   [前导段]  host 替身：扫描池、FreeRTOS 信号量宏、present 原型、统计计数
//   [抽取段]  #include build/generated/lv_port_disp_compose_body.inc
//             = 固件 lv_port_disp.c 的合成状态 + back buffer 选择 + 14 个接口 + compose_* 辅助函数，逐字
//   [尾段]    disp_present_now（送显=推 SDL 纹理）、LVGL flush 包装、framebuffer 句柄、杂项 lv_port_disp_* 接口
//
// 与真机的差异（有意不模拟）：
//   - present 同步完成：没有 LTDC 扫描/DMA2D 异步链，s_pending_scan_slice 恒为 -1，
//     s_refresh_done_sem/s_chain_idle_sem 恒为 NULL → 抽取段里的 "等待刷新完成" 分支永远不走、不会 BUSY。
//   - 因而 sim 抓得到"帧内容"类缺陷（旧快照、缓存未失效、覆盖层行数错），抓不到纯扫描时序类缺陷（撕裂）。
#include "sim_disp_compose.h"

#include <lv_port_disp.h>
#include <hal.h>
#include <framebuffer.h>

#include <src/display/lv_display_private.h>
#include <src/misc/lv_area_private.h> // lv_area_intersect / lv_area_diff（同固件 lv_port_disp.c）
#include <src/drivers/sdl/lv_sdl_window.h>
#include <SDL.h> // 同 lv_conf.h LV_SDL_INCLUDE_PATH：SDL2::SDL2 已把 include/SDL2 加入搜索路径

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// ── 前导段：host 替身 ─────────────────────────────────────────────────────────
#define DISP_SCAN_SLICE_COUNT 3U

// FreeRTOS 信号量：真机用来等 LTDC 刷新完成 / DMA2D 链空闲。sim 同步送显，句柄恒 NULL，
// 抽取段里 "if ( s_xxx_sem != NULL && xSemaphoreTake(...) == pdFALSE )" 永远为假。
typedef void* SemaphoreHandle_t;
static SemaphoreHandle_t s_refresh_done_sem = NULL;
static SemaphoreHandle_t s_chain_idle_sem = NULL;
#define xSemaphoreTake(sem, ticks) (1)
#define xSemaphoreGive(sem)        (1)
#define pdFALSE                    0
#define pdMS_TO_TICKS(ms)          (ms)
#define display_request_refresh()  ((void)0)

// 真机 flush 的延迟 present 地址；sim 的 flush 同步落池，恒 0。
static volatile uintptr_t s_pending_present_addr = 0;
static void disp_present_pending(uint32_t ticks)
{
    (void)ticks;
}

static volatile uint32_t s_present_count = 0;

// 扫描池
static uint8_t* s_scan_pool = NULL;
static uint32_t s_scan_pool_bytes = 0;
static uintptr_t s_front_addr = 0; // 当前"面板正在显示"的 slice
static SDL_Renderer* s_renderer = NULL;
static SDL_Texture* s_texture = NULL;
static lv_display_t* s_disp = NULL;
static SimFrameSink_t s_frame_sink = NULL;
static void* s_frame_sink_user = NULL;

uintptr_t sim_framebuffer_pool_addr(void)
{
    return (uintptr_t)s_scan_pool;
}

uint32_t sim_framebuffer_pool_size_bytes(void)
{
    return s_scan_pool_bytes;
}

static void disp_present_now(uintptr_t present_addr);

// ── 抽取段：固件 lv_port_disp.c 合成逻辑（逐字） ───────────────────────────
#include "lv_port_disp_compose_body.inc"

// ── 尾段 ─────────────────────────────────────────────────────────────────────
static int32_t slice_index_of(uintptr_t addr)
{
    if ( s_scan_pool == NULL || s_scan_buf_size == 0U || addr < FRAMEBUFFER_POOL_ADDR )
    {
        return -1;
    }
    const uintptr_t offset = addr - FRAMEBUFFER_POOL_ADDR;
    const uintptr_t slice = offset / s_scan_buf_size;
    if ( slice >= DISP_SCAN_SLICE_COUNT || offset != slice * s_scan_buf_size )
    {
        return -1;
    }
    return (int32_t)slice;
}

// 记录一帧已上屏：更新前台/active slice、计数，通知帧接收器。
static FramebufferConfig_t s_fb_config; // framebuffer_get_handle 返回的句柄；每次 present 同步 addr（持有指针的调用方也看到最新前台）

static void present_record(uintptr_t addr, const char* source_p)
{
    s_front_addr = addr;
    s_fb_config.addr = addr;
    s_active_scan_slice = slice_index_of(addr);
    s_pending_scan_slice = -1;
    s_present_count++;
    if ( s_frame_sink != NULL )
    {
        s_frame_sink((const uint16_t*)addr, lvgl_disp_hres, lvgl_disp_vres, source_p, s_frame_sink_user);
    }
}

// compositor 送显：真机把 slice 地址交给 LTDC；sim 把 slice 推进自己的 RGB565 纹理并呈现。
// 合成退出后 LVGL 的下一次 flush 用 SDL 驱动自己的纹理整帧覆盖，两张纹理不会互相残留。
static void disp_present_now(uintptr_t present_addr)
{
    if ( s_renderer != NULL && s_texture != NULL )
    {
        SDL_UpdateTexture(s_texture, NULL, (const void*)present_addr, (int)lvgl_disp_hres * 2);
        SDL_RenderClear(s_renderer);
        SDL_RenderCopy(s_renderer, s_texture, NULL, NULL);
        SDL_RenderPresent(s_renderer);
    }
    present_record(present_addr, "compose");
}

// LVGL flush 包装：真机 disp_flush = 等上一帧 → DMA2D 把直绘缓冲拷进后备 slice → present → advance。
// sim 照同样顺序：先让 SDL 驱动原 flush 上屏（它就是用这块直绘缓冲更新纹理），再把整帧 memcpy 进后备 slice
// 记为前台，这样 compositor 看到的前台帧永远在池内。
static void (*s_orig_flush_cb)(lv_display_t* disp_p, const lv_area_t* area_p, uint8_t* px_map_p) = NULL;

static bool s_flush_enabled = true; // disp_enable_update / disp_disable_update（签名页 activity 交接时冻结送显）

static void sim_flush_cb(lv_display_t* disp_p, const lv_area_t* area_p, uint8_t* px_map_p)
{
    // 同真机 disp_flush 入口：送显被禁、或 compositor 正持有送显管线（compose_enter 后的 lv_refr_now）时整帧丢弃
    if ( !s_flush_enabled || s_compose_entered )
    {
        lv_display_flush_ready(disp_p);
        return;
    }
    const bool last = lv_display_flush_is_last(disp_p);
    s_orig_flush_cb(disp_p, area_p, px_map_p);
    if ( !last || s_scan_pool == NULL )
    {
        return;
    }
    // DIRECT 模式：flush 传入的 px_map 就是整帧直绘缓冲起点（lv_refr.c draw_buf_flush 传 draw_buf->data）
    if ( !disp_back_buf_select_safe() )
    {
        return;
    }
    const uintptr_t slice_addr = FRAMEBUFFER_POOL_ADDR + s_back_buf_index * s_scan_buf_size;
    memcpy((void*)slice_addr, px_map_p, (size_t)lvgl_disp_hres * lvgl_disp_vres * 2U);
    s_slice_base_valid[s_back_buf_index] = false; // 这一片现在是实时渲染帧，不是 compositor 底图
    present_record(slice_addr, "lvgl");
    disp_back_buf_advance();
}

bool sim_disp_compose_init(lv_display_t* disp_p)
{
    if ( disp_p == NULL || s_scan_pool != NULL )
    {
        return false;
    }
    const uint32_t hres = (uint32_t)lv_display_get_horizontal_resolution(disp_p);
    const uint32_t vres = (uint32_t)lv_display_get_vertical_resolution(disp_p);
    if ( hres != lvgl_disp_hres || vres != lvgl_disp_vres )
    {
        fprintf(stderr, "sim_disp_compose: 显示分辨率 %ux%u 与 lvgl_disp_hres/vres %ux%u 不一致\n", hres, vres, lvgl_disp_hres, lvgl_disp_vres);
        return false;
    }
    if ( lv_display_get_color_format(disp_p) != LV_COLOR_FORMAT_RGB565 )
    {
        fprintf(stderr, "sim_disp_compose: 需要 LV_COLOR_DEPTH 16（RGB565 直绘缓冲），当前 cf=%d\n", (int)lv_display_get_color_format(disp_p));
        return false;
    }
    const lv_draw_buf_t* draw_buf_p = lv_display_get_buf_active(disp_p);
    if ( lv_display_get_render_mode(disp_p) != LV_DISPLAY_RENDER_MODE_DIRECT || draw_buf_p == NULL || draw_buf_p->header.stride != hres * 2U )
    {
        fprintf(stderr, "sim_disp_compose: 需要 DIRECT 渲染模式且直绘缓冲 stride == hres*2（整帧拷贝假设），检查 lv_conf.h LV_SDL_RENDER_MODE\n");
        return false;
    }

    // 同真机：slice 大小按 32 字节对齐
    s_scan_buf_size = ((hres * vres * 2U) + 31U) & ~31U;
    s_scan_pool_bytes = DISP_SCAN_SLICE_COUNT * s_scan_buf_size;
    s_scan_pool = aligned_alloc(32, s_scan_pool_bytes);
    if ( s_scan_pool == NULL )
    {
        return false;
    }
    memset(s_scan_pool, 0, s_scan_pool_bytes);
    s_front_addr = FRAMEBUFFER_POOL_ADDR;
    s_active_scan_slice = 0;
    s_pending_scan_slice = -1;
    s_back_buf_index = 1U;

    s_disp = disp_p;
    s_renderer = (SDL_Renderer*)lv_sdl_window_get_renderer(disp_p);
    if ( s_renderer != NULL )
    {
        s_texture = SDL_CreateTexture(s_renderer, SDL_PIXELFORMAT_RGB565, SDL_TEXTUREACCESS_STREAMING, (int)hres, (int)vres);
        if ( s_texture == NULL )
        {
            fprintf(stderr, "sim_disp_compose: SDL_CreateTexture 失败: %s\n", SDL_GetError());
        }
    }

    // 包装 SDL 驱动的 flush_cb（LVGL 9 无 getter，走私有头读 disp->flush_cb）
    s_orig_flush_cb = disp_p->flush_cb;
    if ( s_orig_flush_cb == NULL )
    {
        return false;
    }
    lv_display_set_flush_cb(disp_p, sim_flush_cb);
    return true;
}

void sim_disp_frame_sink_set(SimFrameSink_t sink, void* user_p)
{
    s_frame_sink = sink;
    s_frame_sink_user = user_p;
}

uint32_t sim_disp_present_count(void)
{
    return s_present_count;
}

const uint16_t* sim_disp_front_frame(void)
{
    return s_scan_pool == NULL ? NULL : (const uint16_t*)s_front_addr;
}

// ── framebuffer.h 替身 ──
FramebufferConfig_t* framebuffer_get_handle(FramebufferChannel_t channel)
{
    if ( channel != FRAMEBUFFER_CHANNEL_SECONDARY || s_scan_pool == NULL )
    {
        return NULL;
    }
    s_fb_config = (FramebufferConfig_t){
        .addr = s_front_addr,
        .byte_size = s_scan_buf_size,
        .x_size = lvgl_disp_hres,
        .y_size = lvgl_disp_vres,
        .x_pos = 0,
        .y_pos = 0,
        .format = FRAMEBUFFER_FORMAT_RGB565,
    };
    return &s_fb_config;
}

// ── lv_port_disp.h 其余接口（UI 组件偶有引用）──
uint32_t lv_port_disp_present_count_get(void)
{
    return s_present_count;
}

// 真机：等待延迟 present 完成并确认扫描 slice 已切换。sim present 同步完成，恒 true。
bool lv_port_disp_present_fence(void)
{
    return true;
}

// 真机返回 32 位扫描地址给 activity_animation 读前台像素做蒙版。host 指针放不进 uint32_t，
// 返回 0 → 调用方按 "不可用" 降级（蒙版动效跳过）。sim 不追求该动效。
uint32_t lv_port_disp_active_scan_address_get(void)
{
    return 0U;
}

void lv_port_disp_present_sync(void) {}
void disp_enable_update(void)
{
    s_flush_enabled = true;
}
void disp_disable_update(void)
{
    s_flush_enabled = false;
}
