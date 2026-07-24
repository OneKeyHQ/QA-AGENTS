// needs_arg 页面的演示参数表 —— 提高 --snapshot / --click-test 覆盖。
//
// 真机上这些页面的 arg 由调用方（导航流/指纹桥/MP 引擎）在运行时传入；
// snapshot 生成器把「create 回调解引用 arg」的页面标记 needs_arg 并跳过。
// 这里按各页面真实的 arg 语义合成最小演示值（值为演示样例，结构不虚构，
// 语义注释标注了固件源码出处），让这些页面也能进批量截图/点击测试。
//
// 维护：拉新 dev 后若 gen_page_list.py 报出新的 needs_arg 页，在此按同样方式
// 补一行；arg 结构看对应页面 on_create 的强转类型。
#include "sim_demo_args.h"

#include <stdint.h>
#include <string.h>

#include <ui_fingerprint_bridge.h> // Fingerprint_EnrollPageArg_t / Fingerprint_AddedPageArg_t

// fingerprint_enroll / fingerprint_timeout / fingerprint_failed：
// fingerprint_enroll.c:402 强转 Fingerprint_EnrollPageArg_t*
static const Fingerprint_EnrollPageArg_t s_fp_enroll_arg = {
    .request_id          = 1,
    .is_first_time_setup = true,
};

// fingerprint_added：fingerprint_added.c:78 强转 Fingerprint_AddedPageArg_t*
static const Fingerprint_AddedPageArg_t s_fp_added_arg = {
    .request_id          = 1,
    .slot_id             = 0,
    .is_first_time_setup = true,
};

const void* sim_demo_arg_for(const char* page_id)
{
    // onboarding_device_name_done.c:24 —— (const char*)arg = 设备名
    if ( strcmp(page_id, "onboarding_device_name_done") == 0 )
        return "OneKey Pro 2";
    // onboarding_one_moment.c —— (const char*)arg = 切换目标语言 BCP-47 码
    if ( strcmp(page_id, "onboarding_one_moment") == 0 )
        return "zh-Hans-CN";
    // settings_language_loading.c:60 —— (const char*)arg = 切换目标语言码
    if ( strcmp(page_id, "settings_language_loading") == 0 )
        return "zh-Hans-CN";
    // settings_ble_pair_code.c:59 —— (const char*)arg = 6 位配对码
    if ( strcmp(page_id, "settings_ble_pair_code") == 0 )
        return "123456";
    // onboarding_restore_share_entered.c:42 —— uintptr 编码 (group_no<<8)|met_threshold，
    // 非 0 走 SLIP-39 group-complete 分支（0 分支要查 restore 会话，sim 无会话）
    if ( strcmp(page_id, "onboarding_restore_share_entered") == 0 )
        return (const void*)(uintptr_t)((2u << 8) | 3u); // 组 2 已输入 3 份
    // keytag_backup.c:242 kt_chart_on_create —— uintptr = 助记词单词数
    if ( strcmp(page_id, "settings_keytag_backup_chart") == 0 )
        return (const void*)(uintptr_t)12;
    if ( strcmp(page_id, "fingerprint_enroll") == 0 || strcmp(page_id, "fingerprint_timeout") == 0 ||
         strcmp(page_id, "fingerprint_failed") == 0 )
        return &s_fp_enroll_arg;
    if ( strcmp(page_id, "fingerprint_added") == 0 )
        return &s_fp_added_arg;
    // slide_unlock：arg 仅存入 user_data（slide_unlock.c:85/104），NULL 安全
    if ( strcmp(page_id, "slide_unlock") == 0 )
        return SIM_DEMO_ARG_NULL_OK;
    return NULL;
}
