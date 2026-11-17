// host 版硬件替身：src/hal.h / src/soc_cache.h / src/rng.h 里声明的那一小撮 HAL 接口。
//
// 对应真机：
//   - DMA2D（hal/soc/dma2d/dma2d.c）：2D 搬运引擎。compositor 与 lv_port_disp 合成段只用
//     convert（同格式拷贝）与 fill（纯色清屏），这里给逐行 memcpy / 逐像素写的软件版，
//     偏移语义照 dma2d_convert_config：src/dst 都按 (y * stride + x) * bpp 定位。
//   - DWT 周期计数器：只在 UI_SNAPSHOT_TEST 性能统计里用，host 用单调时钟折算。
//   - D-cache 维护：host 无 cache，空实现。
//   - 触摸面板（FT3519 事件队列）：sim 的事件源是 SDL 鼠标。场景脚本注入走固件
//     lv_port_indev.c 自带的测试触摸队列（UI_SNAPSHOT_TEST 下的 lv_port_indev_test_touch_*），
//     该队列在 touchpad_read 里先于 touch_panel_read() 被消费，这里不用管。
//   - RNG：键盘乱序用，arc4random。
#include <hal.h>
#include <rng.h>

#include <stdio.h>
#include <string.h>
#include <time.h>
#include <stdlib.h>

#include <SDL.h> // 同 lv_conf.h LV_SDL_INCLUDE_PATH：SDL2::SDL2 已把 include/SDL2 加入搜索路径

#include <lvgl.h>
#include <src/drivers/sdl/lv_sdl_window.h>

// ── D-cache ──
void soc_dcache_clean_aligned(uint8_t* data, uint32_t len)
{
    (void)data;
    (void)len;
}
void soc_dcache_invalidate_aligned(uint8_t* data, uint32_t len)
{
    (void)data;
    (void)len;
}
void soc_dcache_clean_invalidate_aligned(uint8_t* data, uint32_t len)
{
    (void)data;
    (void)len;
}
void soc_dcache_clean_all(void) {}
void soc_dcache_invalidate_all(void) {}
void soc_dcache_clean_invalidate_all(void) {}

// ── DWT ──
uint32_t dwt_get_counter(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    // 真机 DWT 按 CPU 频率（~480MHz）计数；这里 1 tick = 2ns，量级接近，只用于相对耗时。
    return (uint32_t)(((uint64_t)ts.tv_sec * 1000000000ULL + (uint64_t)ts.tv_nsec) / 2ULL);
}

// ── DMA2D ──
SimDma2dRegs_t sim_dma2d_regs = {0};

static uint32_t dma2d_bpp(uint32_t color_mode)
{
    // 只支持 RGB565=2 / ARGB8888=0（模式值与 STM32 HAL 一致）；其它格式 compositor 不用，出现即是接线错误
    if ( color_mode != DMA2D_INPUT_RGB565 && color_mode != DMA2D_INPUT_ARGB8888 )
    {
        fprintf(stderr, "sim dma2d: 不支持的颜色模式 %u\n", color_mode);
        abort();
    }
    return color_mode == DMA2D_INPUT_RGB565 ? 2U : 4U;
}

// 真机 dma2d_ready / *_config 的几何拒绝条件：尺寸为 0 或超寄存器位宽、stride < width（无符号回绕后 > 0x3FFF）、
// 行偏移超 0x3FFF。真机此时返回 false 让调用方退回在线渲染；sim 若不拒绝会越界读写 slice。
static bool dma2d_geometry_ok(uint32_t width, uint32_t height)
{
    return width != 0U && height != 0U && width <= 0x3FFFU && height <= 0xFFFFU;
}

static bool dma2d_stride_ok(uint32_t stride, uint32_t width)
{
    return stride >= width && (stride - width) <= 0x3FFFU;
}

static inline uint16_t argb8888_to_rgb565(uint32_t argb)
{
    return (uint16_t)(((argb >> 8) & 0xF800U) | ((argb >> 5) & 0x07E0U) | ((argb >> 3) & 0x001FU));
}

static inline uint32_t rgb565_to_argb8888(uint16_t rgb)
{
    const uint32_t r = (rgb >> 11) & 0x1FU;
    const uint32_t g = (rgb >> 5) & 0x3FU;
    const uint32_t b = rgb & 0x1FU;
    return 0xFF000000U | ((r << 3) | (r >> 2)) << 16 | ((g << 2) | (g >> 4)) << 8 | ((b << 3) | (b >> 2));
}

bool dma2d_fill(uint32_t* addr_dest, uint32_t offset, uint32_t width, uint32_t height, uint32_t color, uint32_t output_color_mode)
{
    if ( addr_dest == NULL || !dma2d_geometry_ok(width, height) || offset > 0x3FFFU )
    {
        return false;
    }
    const uint32_t bpp = dma2d_bpp(output_color_mode);
    uint8_t* row_p = (uint8_t*)addr_dest;
    const uint32_t stride_bytes = (width + offset) * bpp;
    if ( bpp == 2U )
    {
        // 真机 R2M 的 color 为 ARGB8888，引擎按输出格式打包。
        const uint16_t c = argb8888_to_rgb565(color);
        for ( uint32_t y = 0; y < height; y++ )
        {
            uint16_t* px = (uint16_t*)row_p;
            for ( uint32_t x = 0; x < width; x++ )
            {
                px[x] = c;
            }
            row_p += stride_bytes;
        }
    }
    else
    {
        for ( uint32_t y = 0; y < height; y++ )
        {
            uint32_t* px = (uint32_t*)row_p;
            for ( uint32_t x = 0; x < width; x++ )
            {
                px[x] = color;
            }
            row_p += stride_bytes;
        }
    }
    return true;
}

bool dma2d_convert(
    uint32_t* addr_src, uint32_t src_stride, uint32_t input_color_mode, uint32_t* addr_dst, uint32_t dst_stride, uint32_t output_color_mode, uint32_t x,
    uint32_t y, uint32_t width, uint32_t height
)
{
    if ( addr_src == NULL || addr_dst == NULL || !dma2d_geometry_ok(width, height) || !dma2d_stride_ok(src_stride, width)
         || !dma2d_stride_ok(dst_stride, width) )
    {
        return false;
    }
    const uint32_t in_bpp = dma2d_bpp(input_color_mode);
    const uint32_t out_bpp = dma2d_bpp(output_color_mode);
    const uint8_t* src_p = (const uint8_t*)addr_src + (y * src_stride + x) * in_bpp;
    uint8_t* dst_p = (uint8_t*)addr_dst + (y * dst_stride + x) * out_bpp;
    for ( uint32_t row = 0; row < height; row++ )
    {
        if ( in_bpp == out_bpp )
        {
            memmove(dst_p, src_p, (size_t)width * in_bpp);
        }
        else if ( in_bpp == 4U )
        {
            const uint32_t* s = (const uint32_t*)src_p;
            uint16_t* d = (uint16_t*)dst_p;
            for ( uint32_t col = 0; col < width; col++ )
            {
                d[col] = argb8888_to_rgb565(s[col]);
            }
        }
        else
        {
            const uint16_t* s = (const uint16_t*)src_p;
            uint32_t* d = (uint32_t*)dst_p;
            for ( uint32_t col = 0; col < width; col++ )
            {
                d[col] = rgb565_to_argb8888(s[col]);
            }
        }
        src_p += (size_t)src_stride * in_bpp;
        dst_p += (size_t)dst_stride * out_bpp;
    }
    return true;
}

// STM32 DMA2D 混合（BG alpha 固定 255）：C = (C_fg·a + C_bg·(255−a)) / 255，
// a = opacity==255 ? fg 自身 alpha : fg_alpha·opacity/255（COMBINE_ALPHA）。RGB565 的 fg 自身 alpha 视为 255。
bool dma2d_blend_opa(
    uint32_t* addr_fg, uint32_t fg_stride, uint32_t fg_color_mode, uint8_t opacity, uint32_t* addr_bg, uint32_t bg_stride, uint32_t bg_color_mode,
    uint32_t* addr_dst, uint32_t dst_stride, uint32_t output_color_mode, uint32_t x, uint32_t y, uint32_t width, uint32_t height
)
{
    if ( addr_fg == NULL || addr_bg == NULL || addr_dst == NULL || !dma2d_geometry_ok(width, height) || !dma2d_stride_ok(fg_stride, width)
         || !dma2d_stride_ok(bg_stride, width) || !dma2d_stride_ok(dst_stride, width) || bg_color_mode != DMA2D_INPUT_RGB565 )
    {
        return false; // 背景只支持 RGB565（alpha 视为 255）：compositor 的 BG 永远是扫描 slice
    }
    const uint32_t fg_bpp = dma2d_bpp(fg_color_mode);
    const uint32_t bg_bpp = dma2d_bpp(bg_color_mode);
    const uint32_t out_bpp = dma2d_bpp(output_color_mode);
    const uint8_t* fg_p = (const uint8_t*)addr_fg + (y * fg_stride + x) * fg_bpp;
    const uint8_t* bg_p = (const uint8_t*)addr_bg + (y * bg_stride + x) * bg_bpp;
    uint8_t* dst_p = (uint8_t*)addr_dst + (y * dst_stride + x) * out_bpp;
    for ( uint32_t row = 0; row < height; row++ )
    {
        for ( uint32_t col = 0; col < width; col++ )
        {
            const uint32_t fg = fg_bpp == 4U ? ((const uint32_t*)fg_p)[col] : rgb565_to_argb8888(((const uint16_t*)fg_p)[col]);
            const uint32_t bg = bg_bpp == 4U ? ((const uint32_t*)bg_p)[col] : rgb565_to_argb8888(((const uint16_t*)bg_p)[col]);
            uint32_t a = fg >> 24;
            if ( opacity != 0xFFU )
            {
                a = (a * opacity) / 255U;
            }
            const uint32_t ia = 255U - a;
            const uint32_t r = (((fg >> 16) & 0xFFU) * a + ((bg >> 16) & 0xFFU) * ia) / 255U;
            const uint32_t g = (((fg >> 8) & 0xFFU) * a + ((bg >> 8) & 0xFFU) * ia) / 255U;
            const uint32_t b = ((fg & 0xFFU) * a + (bg & 0xFFU) * ia) / 255U;
            const uint32_t out = 0xFF000000U | (r << 16) | (g << 8) | b;
            if ( out_bpp == 4U )
            {
                ((uint32_t*)dst_p)[col] = out;
            }
            else
            {
                ((uint16_t*)dst_p)[col] = argb8888_to_rgb565(out);
            }
        }
        fg_p += (size_t)fg_stride * fg_bpp;
        bg_p += (size_t)bg_stride * bg_bpp;
        dst_p += (size_t)dst_stride * out_bpp;
    }
    return true;
}

// ── 触摸面板（SDL 鼠标 → FT3519 风格事件）──
// 固件 touchpad_read 每 5ms 调一次 touch_panel_read()，按 START/MOVE/END/NONE 更新按下状态。
// 这里把鼠标左键的沿变化翻译成同样的事件；按住期间每次读都回 MOVE（坐标可能不变，无副作用）。
bool touch_panel_init(void)
{
    return true;
}

static bool s_mouse_was_down = false;
static bool s_mouse_enabled = true;

// 场景模式下关掉鼠标源，避免无头/CI 环境里偶然的鼠标状态干扰注入序列。
void sim_touch_mouse_enable(bool enable)
{
    s_mouse_enabled = enable;
}

TouchPanelData_t touch_panel_read(void)
{
    TouchPanelData_t data = {.x = 0, .y = 0, .event = TOUCH_PANEL_EVENT_NONE};
    if ( !s_mouse_enabled )
    {
        return data;
    }
    int mx = 0;
    int my = 0;
    const bool down = (SDL_GetMouseState(&mx, &my) & SDL_BUTTON(SDL_BUTTON_LEFT)) != 0;
    lv_display_t* disp = lv_display_get_default();
    float zoom = 1.0f;
    if ( disp != NULL )
    {
        // lv_sdl 的窗口按 zoom 缩放；鼠标坐标是窗口坐标，换回面板坐标。
        const int32_t hres = lv_display_get_horizontal_resolution(disp);
        int win_w = 0;
        int win_h = 0;
        SDL_Window* win = lv_sdl_window_get_window(disp);
        if ( win != NULL )
        {
            SDL_GetWindowSize(win, &win_w, &win_h);
            if ( win_w > 0 && hres > 0 )
            {
                zoom = (float)win_w / (float)hres;
            }
        }
    }
    if ( zoom <= 0.0f )
    {
        zoom = 1.0f;
    }
    const int32_t px = (int32_t)((float)mx / zoom);
    const int32_t py = (int32_t)((float)my / zoom);
    // 负坐标（鼠标在窗口外）→ 置成超界值，让 touch_point_valid 判无效
    data.x = px < 0 ? UINT32_MAX : (uint32_t)px;
    data.y = py < 0 ? UINT32_MAX : (uint32_t)py;
    if ( down && !s_mouse_was_down )
    {
        data.event = TOUCH_PANEL_EVENT_START;
    }
    else if ( down && s_mouse_was_down )
    {
        data.event = TOUCH_PANEL_EVENT_MOVE;
    }
    else if ( !down && s_mouse_was_down )
    {
        data.event = TOUCH_PANEL_EVENT_END;
    }
    s_mouse_was_down = down;
    return data;
}

bool touch_panel_irq_read(void)
{
    // 鼠标源没有积压队列；注入队列的 pending 由 lv_port_indev_input_is_pending 自行判断。
    return false;
}

TouchPanelData_t touch_panel_click(void)
{
    return (TouchPanelData_t){.x = 0, .y = 0, .event = TOUCH_PANEL_EVENT_NONE};
}

// ── fault handler ──
// 真机：记录致命错误后复位。sim：打印并 abort，让场景/截图进程以信号退出被编排器记为 FAIL。
__attribute__((noreturn)) void fault_handler_fatal_error(const char* tag_p, const char* msg_p)
{
    fprintf(stderr, "sim: FATAL [%s] %s\n", tag_p != NULL ? tag_p : "?", msg_p != NULL ? msg_p : "");
    abort();
}

// ── RNG ──
bool rng_get(uint32_t* out)
{
    if ( out == NULL )
    {
        return false;
    }
    *out = arc4random();
    return true;
}

bool rng_get_buffer(uint8_t* buffer, size_t length)
{
    if ( buffer == NULL )
    {
        return false;
    }
    arc4random_buf(buffer, length);
    return true;
}
