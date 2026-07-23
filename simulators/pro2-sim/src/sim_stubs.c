// 模拟器侧最小 stub —— 固件 sys/hal 符号的 host 替身
//
// 阶段 A 策略（策略 b）：业务层 .c（tasks/task_foreground 根文件、utils/、
// ui_state_cache.c 等，依赖 zbus/ipc channel/SE）一律不编入，
// 编入的 UI 源码（ui/components、homescreen、page_manager）实际引用到的
// 少量符号在这里给最小假实现。stub 面越薄越好——新增页面缺什么补什么。
//
// lvgl_disp_hres / lvgl_disp_vres:
//   真机由 ui/lvgl_port/lv_port_disp.c 定义，display 初始化时从
//   display_get_params_p()->hres/vres 赋值（Pro 2 面板 G1354TU101GF 604x1024，
//   dev 分支 DP_UNIT ×1.25 设计基准）。
//   sim 不编译 lvgl_port（依赖 DMA2D/帧缓冲等硬件），直接给固定值，
//   与 src/main.c 的 SIM_HRES/SIM_VRES 保持一致。
//
// ⚠ 失败模式：若需要调整窗口分辨率，src/main.c 的 SIM_HRES/SIM_VRES
//   与本文件的 lvgl_disp_hres/lvgl_disp_vres 必须同步修改；
//   两处不一致会导致 LVGL disp 尺寸与 SDL 窗口不一致（渲染越界/黑边/崩溃）。
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>

#include <debug_log.h>                  // DEBUG_LOG_LEVEL_* 枚举
#include <ipc/messages/msg_sysctrl.h>   // Sysctrl_BackgroundData_t / HapticStyle_e
#include <resource_manager.h>           // ui_language.c 语言切换流程引用（sim 视为常驻已挂载）

uint16_t lvgl_disp_hres = 604;
uint16_t lvgl_disp_vres = 1024;

// ── debug_log（hal/utils/debug_log.h 的 LOG_* 宏展开目标）──
// 真机走 writer 注册 + 环形缓冲；sim 直接 printf 到 stderr。
void debug_log_log(DebugLogLevel_t level, const char* tag, const char* fmt, ...)
{
    static const char* lv[] = {"TRACE", "DEBUG", "INFO", "WARN", "ERROR"};
    fprintf(stderr, "[%s] %s: ", (unsigned)level < 5 ? lv[level] : "?", tag ? tag : "");
    va_list ap;
    va_start(ap, fmt);
    vfprintf(stderr, fmt, ap);
    va_end(ap);
    fputc('\n', stderr);
}

void debug_log_dump_buffer(DebugLogLevel_t level, const char* tag, const uint8_t* p_data, uint32_t data_len)
{
    (void)p_data;
    fprintf(stderr, "[DUMP lvl=%u] %s: %u bytes\n", (unsigned)level, tag ? tag : "", data_len);
}

// ── ui_state_cache（tasks/task_foreground/ui_state_cache.c 的 host 替身）──
// 真机由 BG 任务通过 zbus/ipc 同步；sim 给零值缓存：
//   - homescreen 读 sys_wallpaper_path（header inline getter 直读本全局）
//     → 空字符串 → 回退内置壁纸资产，正是 sim 想要的
Sysctrl_BackgroundData_t g_ui_state_cache;

// homescreen_create 落地时调用（真机重新使能电源管理）；sim 无 PM，空实现
void ui_state_set_power_manager_enabled(bool enabled)
{
    (void)enabled;
}

// 组件层触觉反馈请求（真机发 SYSCTRL_MSG_CMD_PLAY_HAPTIC zbus 消息）；sim 无马达
void ui_request_haptic(HapticStyle_e style)
{
    (void)style;
}

// ── hal/crypto（安全清零；页面清理助记词/PIN 缓冲用，sim 给等价实现）──
#include <string.h>
#include <secbool.h>

secbool_t crypto_utils_memzero_explicit(void* buf_p, size_t len)
{
    if ( buf_p == NULL || len == 0 )
        return secfalse;
    memset(buf_p, 0, len);
    return sectrue;
}

// ── resource_manager（ui/resource/resource_manager.c 的 host 替身）──
// 真机挂载签名 .okpkg 包后经 lv_port_fs 路由；sim 用 LV_USE_FS_STDIO 直接读
// resroot/resource/ 文件树，等价于"资源包永远已挂载"。仅 ui_language.c 的
// 语言切换流程引用这几个符号。
bool resource_manager_pkg_mounted(void)
{
    return true;
}

bool resource_manager_pkg_open_async(void)
{
    return true;
}

ResourceAsyncResult_t resource_manager_pkg_poll(ResourceAsyncStatus_t* status)
{
    if ( status != NULL )
        *status = (ResourceAsyncStatus_t) {0};
    return RESOURCE_ASYNC_DONE;
}

void resource_manager_pkg_abort(void)
{
}

// ── lv_port_slide_compositor（ui/lvgl_port/lv_port_slide_compositor.c 的 host 替身）──
// 真机用它冻结 LVGL 刷新、按滚动位置逐帧合成（依赖 framebuffer/DMA2D）；
// sim 全部返回 false/no-op，等价于"捕获永远未就绪"，滑动/pop 走 LVGL 正常在线渲染路径。
#include <lv_port_slide_compositor.h>

bool lv_port_slide_compositor_capture(lv_obj_t* tileview_p, lv_obj_t* wallpaper_p)
{
    (void)tileview_p;
    (void)wallpaper_p;
    return false;
}

void lv_port_slide_compositor_invalidate(void)
{
}

bool lv_port_slide_compositor_is_ready(void)
{
    return false;
}

bool lv_port_slide_compositor_is_active(void)
{
    return false;
}

void lv_port_slide_compositor_slide_begin(lv_obj_t* tileview_p)
{
    (void)tileview_p;
}

void lv_port_slide_compositor_slide_end(void)
{
}

bool lv_port_slide_compositor_capture_begin(lv_obj_t* tileview_p, lv_obj_t* wallpaper_p)
{
    (void)tileview_p;
    (void)wallpaper_p;
    return false;
}

bool lv_port_slide_compositor_capture_tile(lv_obj_t* tileview_p, uint32_t tile_index)
{
    (void)tileview_p;
    (void)tile_index;
    return false;
}

bool lv_port_slide_compositor_recapture_tile(lv_obj_t* tileview_p, uint32_t tile_index)
{
    (void)tileview_p;
    (void)tile_index;
    return false;
}

// 页面转场合成器（7b39e210 起替代 pop_begin/pop_end）：sim 返回 false，
// 转场走 LVGL 常规动画路径。
bool lv_port_slide_compositor_transition_begin(
    LvPortPageTransitionType_t type, lv_obj_t* moving_p, lv_obj_t* from_page_p, lv_obj_t* to_page_p, lv_obj_t* overlay_p
)
{
    (void)type;
    (void)moving_p;
    (void)from_page_p;
    (void)to_page_p;
    (void)overlay_p;
    return false;
}

void lv_port_slide_compositor_transition_end(void)
{
}

bool lv_port_slide_compositor_transition_is_active(void)
{
    return false;
}

// ── lv_port_disp 静态 backdrop（真机 DMA2D 底图恢复机制）──
// is_ready 恒 false：homescreen 轮询 40 次后自行 homescreen_backdrop_stop()，
// 壁纸保持 LVGL 常规渲染，视觉结果一致。
void lv_port_disp_backdrop_capture_arm(void)
{
}

bool lv_port_disp_backdrop_is_ready(void)
{
    return false;
}

void lv_port_disp_backdrop_disable(void)
{
}

void lv_port_disp_backdrop_set_fault_cb(void (*fault_cb)(void))
{
    (void)fault_cb;
}

// ── 垂直滚动合成器（1f08264b 折叠导航标题/弹性滚动）：sim 返回 false 走在线渲染 ──
bool lv_port_slide_compositor_vertical_capture(
    lv_obj_t* scroll_obj_p, lv_obj_t* moving_content_p, lv_obj_t* page_p, lv_obj_t* fixed_overlay_p,
    lv_obj_t* system_overlay_p, lv_obj_t* bottom_overlay_p, uint32_t band_y0, uint32_t band_y1
)
{
    (void)scroll_obj_p;
    (void)moving_content_p;
    (void)page_p;
    (void)fixed_overlay_p;
    (void)system_overlay_p;
    (void)bottom_overlay_p;
    (void)band_y0;
    (void)band_y1;
    return false;
}

void lv_port_slide_compositor_vertical_begin(lv_obj_t* scroll_obj_p)
{
    (void)scroll_obj_p;
}

void lv_port_slide_compositor_vertical_release(void)
{
}

// ── wallpaper_source（文件系统用户壁纸，sim 恒用内置默认壁纸）──
#include "utils/wallpaper_source.h"
const char* wallpaper_source_lock_path(void)
{
    return WALLPAPER_LOCK_DEFAULT_PATH;
}
