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
bool resource_manager_pkg_mounted(const char* pkg_path)
{
    (void)pkg_path;
    return true;
}

bool resource_manager_pkg_open_async(const char* pkg_path)
{
    (void)pkg_path;
    return true;
}

ResourceAsyncResult_t resource_manager_pkg_poll(const char* pkg_path, ResourceAsyncStatus_t* status)
{
    (void)pkg_path;
    if ( status != NULL )
        *status = (ResourceAsyncStatus_t) {0};
    return RESOURCE_ASYNC_DONE;
}

void resource_manager_pkg_abort(void)
{
}

// ── wallpaper_source（文件系统用户壁纸，sim 恒用内置默认壁纸）──
#include "utils/wallpaper_source.h"
// main 2026-10：该宏改为 wallpaper_source.c 文件私有（按机型选色），Pro2 取值照抄
#define WALLPAPER_LOCK_DEFAULT_PATH "A:/resource/wallpapers/wallpapers_orange_1.bin"
const char* wallpaper_source_lock_path(void)
{
    return WALLPAPER_LOCK_DEFAULT_PATH;
}
