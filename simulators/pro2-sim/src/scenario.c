// 场景执行器（见 scenario.h）。
//
// 设计要点：
//   - 虚拟时钟：lv_tick 不走墙钟，主循环每步按真机周期推进（compositor 活跃 1ms / 否则 5ms，
//     同 task_foreground.c）。同一场景在任何机器上得到完全相同的帧序列，修复前后才可逐帧比对。
//   - 触摸注入：走固件 lv_port_indev.c 自带的测试触摸队列（UI_SNAPSHOT_TEST 的
//     lv_port_indev_test_touch_*），手势算法照抄固件 ui_perf_runner.c inject_touch（线性插值、
//     每 step_ms 一个 MOVE）。注入事件经真实 indev 读回调、真实 hit-test，不是 lv_obj_send_event。
//   - 取证：sim_disp_compose.c 的帧接收器在每次上屏时回调，拿到的是面板真正显示的像素
//     （LVGL 直绘帧标 lvgl，compositor 合成帧标 compose）。逐帧 PNG + 与上一帧的差异像素/包围盒。
//   - 断言：watch 矩形在标了 assert_static 的步骤内，相邻两帧差异像素数 > tolerance_px 即失败。
//     OK-64012 这类"滚动中显示旧快照、静止显示实时绘制"的缺陷在这里表现为合成帧→直绘帧切换时
//     按钮区域跳变。
#include "scenario.h"
#include "sim_disp_compose.h"
#include "sim_hw_shims.h"
#include "page_registry.h"

#include <compositor.h>
#include <lv_port_indev.h>
#include <page_manager/page_manager.h>
#include <navigation_coordinator.h>
#include <lvgl.h>
#include <cJSON.h>
#include <lodepng.h>

#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>

// 固件 lv_port_indev.h 只在 UI_SNAPSHOT_TEST 下声明这组 API；sim 按该宏编译 lv_port_indev.c，
// 其它 TU 不开该宏（避免 compositor.h 里受它影响的结构体布局在 TU 间不一致），这里手写原型。
void lv_port_indev_test_touch_reset(void);
bool lv_port_indev_test_touch_start(uint16_t x, uint16_t y);
bool lv_port_indev_test_touch_move(uint16_t x, uint16_t y);
bool lv_port_indev_test_touch_end(uint16_t x, uint16_t y);
bool lv_port_indev_test_touch_pending(void);

#define SCN_MAX_WATCH       8
#define SCN_MAX_STEPS       64
#define SCN_MAX_VIOLATIONS  256
#define SCN_NAME_MAX        48
#define SCN_DEFAULT_STEPS   20
#define SCN_DEFAULT_STEP_MS 12 // 同固件 UI_PERF_GESTURE_STEP_MS
#define SCN_DEFAULT_TAP_MS  60
#define SCN_DEFAULT_SETTLE  500

typedef enum
{
    SCN_CAPTURE_ALL = 0,
    SCN_CAPTURE_CHANGED,
    SCN_CAPTURE_NONE,
} ScnCapture_t;

typedef struct
{
    char name[SCN_NAME_MAX];
    lv_area_t rect;
    uint32_t change_frames; // 整个场景里该区域变化的帧数（诊断用）
    uint8_t max_delta;      // 整个场景里该区域相邻帧最大通道差（8 位量纲，诊断用）
} Watch_t;

typedef struct
{
    uint32_t index;
    uint32_t tick;
    uint32_t step;         // 1-based；0 = 页面稳定期
    char source[8];        // lvgl / compose
    uint32_t changed_px;   // 与上一帧全帧差异像素
    lv_area_t bbox;        // 差异包围盒（changed_px>0 时有效）
    uint32_t watch_px[SCN_MAX_WATCH]; // 各 watch 矩形内差异像素（通道差 > tolerance_delta 才计）
    uint8_t watch_delta[SCN_MAX_WATCH]; // 各 watch 矩形内相邻帧最大通道差
    bool violated;
} FrameRec_t;

typedef struct
{
    uint32_t frame;
    uint32_t step;
    uint8_t watch;
    uint32_t px;
    uint8_t delta;
} Violation_t;

typedef struct
{
    // 配置
    char name[96];
    char page[64];
    ScnCapture_t capture;
    uint32_t tolerance_px;    // watch 内差异像素数 ≤ 此值视为未变
    uint8_t tolerance_delta;  // 通道差（8 位量纲）≤ 此值的像素不计为差异（吸收 DMA2D/LVGL 混合舍入）
    Watch_t watch[SCN_MAX_WATCH];
    uint8_t watch_count;
    // 运行态
    uint32_t tick;
    uint32_t step;               // 当前步骤（1-based）
    bool step_assert[SCN_MAX_WATCH];
    uint32_t step_frames;        // 当前步骤帧数
    uint32_t step_compose_frames;
    // 帧
    char frames_dir[512];
    uint16_t* prev_frame;
    bool prev_valid;
    FrameRec_t* frames;
    uint32_t frame_count;
    uint32_t frame_cap;
    uint32_t lvgl_frames;
    uint32_t compose_frames;
    Violation_t violations[SCN_MAX_VIOLATIONS];
    uint32_t violation_count;
    uint32_t dropped_violations;
    // 步骤结果（写报告用）
    struct
    {
        char desc[160];
        uint32_t frames;
        uint32_t compose_frames;
        uint32_t violations;
        bool expect_compose;
        bool compose_missing;
    } step_result[SCN_MAX_STEPS];
    uint8_t step_count;
    bool error;
} Scenario_t;

static Scenario_t s_scn;

// ── 虚拟时钟 ──
static uint32_t scenario_tick_cb(void)
{
    return s_scn.tick;
}

static bool compositor_active(void)
{
    return compositor_pager_is_active() || compositor_content_scroll_is_active() || compositor_page_transition_is_active();
}

// 主循环一步：先推进虚拟时间（真机周期），再跑一轮前台循环
static void step_once(void)
{
    s_scn.tick += compositor_active() ? 1U : 5U;
    sim_loop_step();
}

static void run_for(uint32_t ms)
{
    const uint32_t end = s_scn.tick + ms;
    while ( s_scn.tick < end )
    {
        step_once();
    }
}

// ── 帧接收器 ──
static bool png_write_rgb565(const char* path, const uint16_t* px, uint32_t w, uint32_t h)
{
    uint8_t* rgba = malloc((size_t)w * h * 4U);
    if ( rgba == NULL )
    {
        fprintf(stderr, "scenario: PNG 内存分配失败: %s\n", path);
        return false;
    }
    for ( uint32_t i = 0; i < w * h; i++ )
    {
        const uint16_t c = px[i];
        const uint32_t r = (c >> 11) & 0x1FU;
        const uint32_t g = (c >> 5) & 0x3FU;
        const uint32_t b = c & 0x1FU;
        rgba[i * 4U + 0] = (uint8_t)((r << 3) | (r >> 2));
        rgba[i * 4U + 1] = (uint8_t)((g << 2) | (g >> 4));
        rgba[i * 4U + 2] = (uint8_t)((b << 3) | (b >> 2));
        rgba[i * 4U + 3] = 0xFF;
    }
    unsigned char* png = NULL;
    size_t png_size = 0;
    // lvgl 内置 lodepng 的分配器映射到 lv_malloc/lv_free（同 snapshot.c），落盘用 stdio
    const unsigned err = lodepng_encode32(&png, &png_size, rgba, w, h);
    free(rgba);
    bool ok = false;
    if ( err == 0 && png != NULL )
    {
        FILE* f = fopen(path, "wb");
        if ( f != NULL )
        {
            ok = fwrite(png, 1, png_size, f) == png_size && ferror(f) == 0;
            if ( fclose(f) != 0 )
                ok = false;
        }
    }
    if ( png != NULL )
    {
        lv_free(png);
    }
    if ( !ok )
        fprintf(stderr, "scenario: PNG 编码或写入失败: %s (encoder=%u)\n", path, err);
    return ok;
}

// RGB565 两像素的最大通道差，按 8 位量纲（R/B 5 位 ×8，G 6 位 ×4），便于和肉眼/截图工具口径一致
static uint8_t px_delta(uint16_t a, uint16_t b)
{
    if ( a == b )
    {
        return 0;
    }
    const int32_t dr = (int32_t)(((a >> 11) & 0x1FU) << 3) - (int32_t)(((b >> 11) & 0x1FU) << 3);
    const int32_t dg = (int32_t)(((a >> 5) & 0x3FU) << 2) - (int32_t)(((b >> 5) & 0x3FU) << 2);
    const int32_t db = (int32_t)((a & 0x1FU) << 3) - (int32_t)((b & 0x1FU) << 3);
    const int32_t m = LV_MAX(LV_ABS(dr), LV_MAX(LV_ABS(dg), LV_ABS(db)));
    return (uint8_t)LV_MIN(m, 255);
}

// 矩形内差异像素数（通道差 > tolerance_delta 才计）与最大通道差
static uint32_t rect_diff_px(const uint16_t* a, const uint16_t* b, uint32_t w, uint32_t h, const lv_area_t* r, uint8_t tolerance_delta, uint8_t* max_delta)
{
    const int32_t x1 = LV_MAX(0, r->x1);
    const int32_t y1 = LV_MAX(0, r->y1);
    const int32_t x2 = LV_MIN((int32_t)w - 1, r->x2);
    const int32_t y2 = LV_MIN((int32_t)h - 1, r->y2);
    uint32_t n = 0;
    uint8_t mx = 0;
    for ( int32_t y = y1; y <= y2; y++ )
    {
        const uint16_t* ra = a + (uint32_t)y * w;
        const uint16_t* rb = b + (uint32_t)y * w;
        for ( int32_t x = x1; x <= x2; x++ )
        {
            const uint8_t d = px_delta(ra[x], rb[x]);
            mx = LV_MAX(mx, d);
            n += d > tolerance_delta;
        }
    }
    *max_delta = mx;
    return n;
}

static void frame_sink(const uint16_t* px, uint32_t w, uint32_t h, const char* source, void* user)
{
    (void)user;
    Scenario_t* s = &s_scn;
    if ( s->frame_count == s->frame_cap )
    {
        const uint32_t cap = s->frame_cap == 0U ? 512U : s->frame_cap * 2U;
        FrameRec_t* grown = realloc(s->frames, (size_t)cap * sizeof(FrameRec_t));
        if ( grown == NULL )
        {
            // 记录丢失也要保持 prev_frame 与屏幕同步，并把场景标为错误，而不是悄悄少一帧
            memcpy(s->prev_frame, px, (size_t)w * h * 2U);
            s->prev_valid = true;
            s->error = true;
            return;
        }
        s->frames = grown;
        s->frame_cap = cap;
    }
    FrameRec_t* rec = &s->frames[s->frame_count];
    memset(rec, 0, sizeof(*rec));
    rec->index = s->frame_count;
    rec->tick = s->tick;
    rec->step = s->step;
    snprintf(rec->source, sizeof(rec->source), "%s", source);
    const bool is_compose = strcmp(source, "compose") == 0;
    if ( is_compose )
    {
        s->compose_frames++;
        s->step_compose_frames++;
    }
    else
    {
        s->lvgl_frames++;
    }
    s->step_frames++;

    // 全帧差异 + 包围盒
    if ( s->prev_valid )
    {
        rec->bbox = (lv_area_t){INT32_MAX, INT32_MAX, -1, -1};
        for ( uint32_t y = 0; y < h; y++ )
        {
            const uint16_t* ra = s->prev_frame + y * w;
            const uint16_t* rb = px + y * w;
            if ( memcmp(ra, rb, (size_t)w * 2U) == 0 )
            {
                continue;
            }
            for ( uint32_t x = 0; x < w; x++ )
            {
                if ( ra[x] != rb[x] )
                {
                    rec->changed_px++;
                    rec->bbox.x1 = LV_MIN(rec->bbox.x1, (int32_t)x);
                    rec->bbox.x2 = LV_MAX(rec->bbox.x2, (int32_t)x);
                    rec->bbox.y1 = LV_MIN(rec->bbox.y1, (int32_t)y);
                    rec->bbox.y2 = LV_MAX(rec->bbox.y2, (int32_t)y);
                }
            }
        }
        for ( uint8_t i = 0; i < s->watch_count; i++ )
        {
            rec->watch_px[i] = rect_diff_px(s->prev_frame, px, w, h, &s->watch[i].rect, s->tolerance_delta, &rec->watch_delta[i]);
            s->watch[i].max_delta = LV_MAX(s->watch[i].max_delta, rec->watch_delta[i]);
            if ( rec->watch_px[i] > s->tolerance_px )
            {
                s->watch[i].change_frames++;
                if ( s->step_assert[i] )
                {
                    rec->violated = true;
                    if ( s->violation_count < SCN_MAX_VIOLATIONS )
                    {
                        s->violations[s->violation_count++] = (Violation_t){
                            .frame = rec->index, .step = s->step, .watch = i, .px = rec->watch_px[i], .delta = rec->watch_delta[i]};
                    }
                    else
                    {
                        s->dropped_violations++;
                    }
                    if ( s->step > 0U && s->step <= SCN_MAX_STEPS )
                    {
                        s->step_result[s->step - 1U].violations++;
                    }
                }
            }
        }
    }
    else
    {
        rec->changed_px = w * h;
        rec->bbox = (lv_area_t){0, 0, (int32_t)w - 1, (int32_t)h - 1};
    }

    const bool write_png = s->capture == SCN_CAPTURE_ALL || (s->capture == SCN_CAPTURE_CHANGED && (rec->changed_px > 0U || !s->prev_valid));
    if ( write_png && s->frames_dir[0] != '\0' )
    {
        char path[640];
        snprintf(path, sizeof(path), "%s/f%05u_%s%s.png", s->frames_dir, rec->index, source, rec->violated ? "_VIOLATION" : "");
        if ( !png_write_rgb565(path, px, w, h) )
            s->error = true;
    }

    memcpy(s->prev_frame, px, (size_t)w * h * 2U);
    s->prev_valid = true;
    s->frame_count++;
}

// ── 手势注入（同固件 ui_perf_runner.c inject_touch）──
typedef struct
{
    uint16_t x0, y0, x1, y1;
    uint16_t steps;
    uint16_t step_ms;
} Gesture_t;

static bool inject_touch(const Gesture_t* g, uint32_t step)
{
    const int32_t dx = (int32_t)g->x1 - g->x0;
    const int32_t dy = (int32_t)g->y1 - g->y0;
    const uint16_t x = (uint16_t)((int32_t)g->x0 + dx * (int32_t)step / (int32_t)g->steps);
    const uint16_t y = (uint16_t)((int32_t)g->y0 + dy * (int32_t)step / (int32_t)g->steps);
    if ( step == 0U )
        return lv_port_indev_test_touch_start(x, y);
    if ( step == g->steps )
        return lv_port_indev_test_touch_end(x, y);
    return lv_port_indev_test_touch_move(x, y);
}

// 按虚拟时间投递：第 i 个事件在 t0 + i*step_ms 入队，队列由 indev 5ms 读周期消费
static bool run_gesture(const Gesture_t* g)
{
    if ( g->steps == 0U )
    {
        return false;
    }
    lv_port_indev_test_touch_reset();
    const uint32_t t0 = s_scn.tick;
    for ( uint32_t i = 0; i <= g->steps; i++ )
    {
        const uint32_t due = t0 + i * g->step_ms;
        while ( s_scn.tick < due )
        {
            step_once();
        }
        if ( !inject_touch(g, i) )
        {
            // 队列容量 64（固件 TEST_TOUCH_QUEUE_CAPACITY）：steps 太多且 step_ms < indev 5ms 读周期时会满
            fprintf(stderr, "scenario: 第 %u/%u 个触摸事件入队失败（队列满？steps 太多或 step_ms 太小）\n", i, g->steps);
            (void)lv_port_indev_test_touch_end(g->x1, g->y1); // 尽量补一个 END，不留按下状态
            return false;
        }
    }
    // 等队列被 indev 读空。队列只经 touchpad_read 消费；页面若 lv_port_indev_enable(false)（如 ui_state 冻结输入）
    // 读回调不再被调，这里有界等待后报错，而不是让虚拟时钟空转到天荒地老。
    for ( uint32_t n = 0; lv_port_indev_test_touch_pending(); n++ )
    {
        if ( n >= 2000U )
        {
            fprintf(stderr, "scenario: 触摸队列 %ums 内未被 indev 消费（indev 被禁用？），放弃本步\n", 2000U);
            s_scn.error = true;
            return false;
        }
        step_once();
    }
    return true;
}

// ── 按文本找对象（tap_text）──
static lv_obj_t* find_label_by_text(lv_obj_t* root, const char* text, bool exact)
{
    if ( root == NULL )
    {
        return NULL;
    }
    if ( lv_obj_check_type(root, &lv_label_class) && !lv_obj_has_flag(root, LV_OBJ_FLAG_HIDDEN) )
    {
        const char* t = lv_label_get_text(root);
        if ( t != NULL && (exact ? strcmp(t, text) == 0 : strstr(t, text) != NULL) )
        {
            return root;
        }
    }
    const uint32_t n = lv_obj_get_child_count(root);
    for ( uint32_t i = 0; i < n; i++ )
    {
        lv_obj_t* hit = find_label_by_text(lv_obj_get_child(root, (int32_t)i), text, exact);
        if ( hit != NULL )
        {
            return hit;
        }
    }
    return NULL;
}

static bool locate_text(const char* text, uint16_t* x, uint16_t* y)
{
    lv_obj_t* roots[] = {lv_layer_top(), lv_screen_active()};
    for ( int pass = 0; pass < 2; pass++ )
    {
        for ( size_t r = 0; r < sizeof(roots) / sizeof(roots[0]); r++ )
        {
            lv_obj_update_layout(roots[r]);
            lv_obj_t* obj = find_label_by_text(roots[r], text, pass == 0);
            if ( obj != NULL )
            {
                lv_area_t a;
                lv_obj_get_coords(obj, &a);
                *x = (uint16_t)((a.x1 + a.x2) / 2);
                *y = (uint16_t)((a.y1 + a.y2) / 2);
                return true;
            }
        }
    }
    return false;
}

// ── JSON 读取辅助 ──
static int json_int(const cJSON* obj, const char* key, int def)
{
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(obj, key);
    return cJSON_IsNumber(v) ? v->valueint : def;
}

// 带范围校验的整数读取；越界打印并返回 false（调用方以 2 退出）
static bool json_int_range(const cJSON* obj, const char* key, int def, int lo, int hi, int* out)
{
    const int v = json_int(obj, key, def);
    if ( v < lo || v > hi )
    {
        fprintf(stderr, "scenario: %s=%d 超出 [%d, %d]\n", key, v, lo, hi);
        return false;
    }
    *out = v;
    return true;
}

static const char* json_str(const cJSON* obj, const char* key)
{
    const cJSON* v = cJSON_GetObjectItemCaseSensitive(obj, key);
    return cJSON_IsString(v) ? v->valuestring : NULL;
}

static bool json_point(const cJSON* arr, uint16_t* x, uint16_t* y)
{
    if ( !cJSON_IsArray(arr) || cJSON_GetArraySize(arr) != 2 )
    {
        return false;
    }
    *x = (uint16_t)cJSON_GetArrayItem(arr, 0)->valueint;
    *y = (uint16_t)cJSON_GetArrayItem(arr, 1)->valueint;
    return true;
}

static int watch_index(const char* name)
{
    for ( uint8_t i = 0; i < s_scn.watch_count; i++ )
    {
        if ( strcmp(s_scn.watch[i].name, name) == 0 )
        {
            return i;
        }
    }
    return -1;
}

// mkdir -p：--out 可以指向尚不存在的多级目录
static bool ensure_dir(const char* path)
{
    char buf[640];
    if ( path == NULL || path[0] == '\0' || snprintf(buf, sizeof(buf), "%s", path) >= (int)sizeof(buf) )
    {
        fprintf(stderr, "scenario: 输出目录为空或过长\n");
        return false;
    }
    for ( char* p = buf + 1; *p != '\0'; p++ )
    {
        if ( *p == '/' )
        {
            *p = '\0';
            if ( mkdir(buf, 0755) != 0 && errno != EEXIST )
            {
                fprintf(stderr, "scenario: 无法创建目录 %s: %s\n", buf, strerror(errno));
                return false;
            }
            *p = '/';
        }
    }
    if ( mkdir(buf, 0755) == 0 || errno == EEXIST )
    {
        return true;
    }
    fprintf(stderr, "scenario: 无法创建目录 %s: %s\n", path, strerror(errno));
    return false;
}

// ── 步骤执行 ──
static bool validate_step_assertions(uint32_t index, const cJSON* step)
{
    const cJSON* compose = cJSON_GetObjectItemCaseSensitive(step, "expect_compose");
    const cJSON* assertions = cJSON_GetObjectItemCaseSensitive(step, "assert_static");
    if ( !cJSON_IsObject(step) || (compose != NULL && !cJSON_IsBool(compose))
         || (assertions != NULL && !cJSON_IsArray(assertions)) )
    {
        fprintf(stderr, "scenario: 步骤 %u 需要对象，expect_compose 需为布尔值，assert_static 需为字符串数组\n", index);
        return false;
    }
    const cJSON* item;
    cJSON_ArrayForEach(item, assertions)
    {
        if ( !cJSON_IsString(item) || watch_index(item->valuestring) < 0 )
        {
            fprintf(stderr, "scenario: 步骤 %u 的 assert_static 需引用已定义的 watch 名称\n", index);
            return false;
        }
    }
    return true;
}

static void begin_step(uint32_t index, const cJSON* step, const char* desc)
{
    Scenario_t* s = &s_scn;
    s->step = index;
    s->step_frames = 0;
    s->step_compose_frames = 0;
    memset(s->step_assert, 0, sizeof(s->step_assert));
    if ( index > 0U && index <= SCN_MAX_STEPS )
    {
        snprintf(s->step_result[index - 1U].desc, sizeof(s->step_result[0].desc), "%s", desc);
        s->step_result[index - 1U].expect_compose = cJSON_IsTrue(cJSON_GetObjectItemCaseSensitive(step, "expect_compose"));
    }
    const cJSON* as = cJSON_GetObjectItemCaseSensitive(step, "assert_static");
    const cJSON* item;
    cJSON_ArrayForEach(item, as)
    {
        const int wi = watch_index(item->valuestring);
        if ( wi < 0 )
        {
            fprintf(stderr, "scenario: 步骤 %u 的 assert_static 引用了未定义的 watch '%s'\n", index, item->valuestring);
            s->error = true;
            continue;
        }
        s->step_assert[wi] = true;
    }
}

static void end_step(void)
{
    Scenario_t* s = &s_scn;
    if ( s->step > 0U && s->step <= SCN_MAX_STEPS )
    {
        s->step_result[s->step - 1U].frames = s->step_frames;
        s->step_result[s->step - 1U].compose_frames = s->step_compose_frames;
        if ( s->step_result[s->step - 1U].expect_compose && s->step_compose_frames == 0U )
        {
            s->step_result[s->step - 1U].compose_missing = true;
        }
        bool asserting = false;
        for ( uint8_t i = 0; i < s->watch_count; i++ )
        {
            asserting = asserting || s->step_assert[i];
        }
        if ( asserting && s->step_frames == 0U )
        {
            fprintf(stderr, "scenario: 步骤 %u 带 assert_static 但没有任何帧上屏，断言没有检查到东西\n", s->step);
            s->error = true;
        }
        printf("SCENARIO|step %u|%s|frames %u (compose %u)|violations %u%s\n", s->step, s->step_result[s->step - 1U].desc, s->step_frames,
               s->step_compose_frames, s->step_result[s->step - 1U].violations, s->step_result[s->step - 1U].compose_missing ? "|COMPOSE MISSING" : "");
    }
    memset(s->step_assert, 0, sizeof(s->step_assert));
}

static bool run_step(uint32_t index, const cJSON* step)
{
    char desc[160];
    const cJSON* wait = cJSON_GetObjectItemCaseSensitive(step, "wait");
    const cJSON* tap = cJSON_GetObjectItemCaseSensitive(step, "tap");
    const char* tap_text = json_str(step, "tap_text");
    const cJSON* drag = cJSON_GetObjectItemCaseSensitive(step, "drag");
    int settle_i = 0;
    if ( !json_int_range(step, "settle_ms", SCN_DEFAULT_SETTLE, 0, 60000, &settle_i) )
    {
        return false;
    }
    const uint32_t settle_ms = (uint32_t)settle_i;

    if ( cJSON_IsNumber(wait) )
    {
        if ( wait->valueint < 0 || wait->valueint > 60000 )
        {
            fprintf(stderr, "scenario: 步骤 %u wait=%d 超出 [0, 60000]\n", index, wait->valueint);
            return false;
        }
        snprintf(desc, sizeof(desc), "wait %dms", wait->valueint);
        begin_step(index, step, desc);
        run_for((uint32_t)wait->valueint);
        end_step();
        return true;
    }
    if ( tap != NULL || tap_text != NULL )
    {
        uint16_t x = 0;
        uint16_t y = 0;
        if ( tap_text != NULL )
        {
            if ( !locate_text(tap_text, &x, &y) )
            {
                fprintf(stderr, "scenario: 步骤 %u tap_text 未找到文本 '%s'\n", index, tap_text);
                return false;
            }
            snprintf(desc, sizeof(desc), "tap_text \"%s\" -> (%u,%u)", tap_text, x, y);
        }
        else
        {
            if ( !json_point(tap, &x, &y) )
            {
                fprintf(stderr, "scenario: 步骤 %u tap 需要 [x, y]\n", index);
                return false;
            }
            snprintf(desc, sizeof(desc), "tap (%u,%u)", x, y);
        }
        int hold_ms = 0;
        if ( !json_int_range(step, "hold_ms", SCN_DEFAULT_TAP_MS, 0, 10000, &hold_ms) )
        {
            return false;
        }
        begin_step(index, step, desc);
        const Gesture_t g = {.x0 = x, .y0 = y, .x1 = x, .y1 = y, .steps = 1, .step_ms = (uint16_t)hold_ms};
        const bool ok = run_gesture(&g);
        run_for(settle_ms);
        end_step();
        return ok;
    }
    if ( cJSON_IsObject(drag) )
    {
        int steps_i = 0;
        int step_ms_i = 0;
        if ( !json_int_range(drag, "steps", SCN_DEFAULT_STEPS, 1, 60, &steps_i) || !json_int_range(drag, "step_ms", SCN_DEFAULT_STEP_MS, 1, 1000, &step_ms_i) )
        {
            return false; // steps ≤ 60：固件测试触摸队列容量 64
        }
        Gesture_t g = {.steps = (uint16_t)steps_i, .step_ms = (uint16_t)step_ms_i};
        if ( !json_point(cJSON_GetObjectItemCaseSensitive(drag, "from"), &g.x0, &g.y0)
             || !json_point(cJSON_GetObjectItemCaseSensitive(drag, "to"), &g.x1, &g.y1) )
        {
            fprintf(stderr, "scenario: 步骤 %u drag 需要 from/to [x, y]\n", index);
            return false;
        }
        snprintf(desc, sizeof(desc), "drag (%u,%u)->(%u,%u) steps %u x %ums", g.x0, g.y0, g.x1, g.y1, g.steps, g.step_ms);
        begin_step(index, step, desc);
        const bool ok = run_gesture(&g);
        // 惯性/弹性回弹在 END 之后继续，settle 期间 compositor 仍在合成，断言覆盖这一段
        run_for(settle_ms);
        end_step();
        return ok;
    }
    const char* nav = json_str(step, "nav");
    if ( nav != NULL )
    {
        // 非触摸导航：模拟主机指令 / 定时器 / 业务回调驱动的 push、pop（没有按下的触发对象，
        // 不经过 ui_press_feedback_hold 的缓存失效路径）。
        NavigationOp_t op;
        PageId_t target = PAGE_ID_NONE;
        if ( strcmp(nav, "push") == 0 )
        {
            const char* page_id = json_str(step, "page");
            const sim_page_t* p = page_id != NULL ? sim_page_find(page_id) : NULL;
            if ( p == NULL )
            {
                fprintf(stderr, "scenario: 步骤 %u nav push 需要已注册的 page（得到 '%s'）\n", index, page_id != NULL ? page_id : "");
                return false;
            }
            op = NAV_OP_PUSH;
            target = (PageId_t)p->page_id;
            snprintf(desc, sizeof(desc), "nav push %s", page_id);
        }
        else if ( strcmp(nav, "pop") == 0 )
        {
            op = NAV_OP_POP;
            snprintf(desc, sizeof(desc), "nav pop");
        }
        else
        {
            fprintf(stderr, "scenario: 步骤 %u nav 只支持 push / pop（得到 '%s'）\n", index, nav);
            return false;
        }
        begin_step(index, step, desc);
        const bool ok = navigation_coordinator_navigate(op, NAV_LANE_USER, target, NULL);
        if ( !ok )
        {
            fprintf(stderr, "scenario: 步骤 %u 导航被拒绝\n", index);
        }
        run_for(settle_ms);
        end_step();
        return ok;
    }
    fprintf(stderr, "scenario: 步骤 %u 不认识（需要 wait / tap / tap_text / drag / nav）\n", index);
    return false;
}

// ── 报告 ──
static bool write_markdown_report(const char* out_dir, const char* scenario_path, const char* firmware_commit, bool passed)
{
    Scenario_t* s = &s_scn;
    char path[640];
    // Markdown 摘要
    snprintf(path, sizeof(path), "%s/report.md", out_dir);
    FILE* fm = fopen(path, "w");
    if ( fm == NULL )
    {
        fprintf(stderr, "scenario: 无法写入报告: %s\n", path);
        return false;
    }
    fprintf(fm, "# 场景 %s — %s\n\n", s->name, passed ? "PASS" : "FAIL");
    fprintf(fm, "- 场景文件：%s\n- 固件 commit：%s\n- 页面：%s\n", scenario_path, firmware_commit != NULL ? firmware_commit : "(未知)", s->page);
    fprintf(fm, "- 帧数：%u（lvgl 直绘 %u / compositor 合成 %u）\n- watch 容差：差异像素 > %u px 且通道差 > %u 才判变化\n- 断言失败：%u\n\n",
            s->frame_count, s->lvgl_frames, s->compose_frames, s->tolerance_px, s->tolerance_delta, s->violation_count + s->dropped_violations);
    fprintf(fm, "## 步骤\n\n| # | 步骤 | 帧数 | 合成帧 | 失败 | 备注 |\n|---|---|---|---|---|---|\n");
    for ( uint8_t i = 0; i < s->step_count; i++ )
    {
        fprintf(fm, "| %u | %s | %u | %u | %u | %s |\n", i + 1, s->step_result[i].desc, s->step_result[i].frames, s->step_result[i].compose_frames,
                s->step_result[i].violations, s->step_result[i].compose_missing ? "期望走合成路径但没有合成帧" : "");
    }
    if ( s->watch_count > 0U )
    {
        fprintf(fm, "\n## watch 区域\n\n| 名称 | 矩形 [x,y,w,h] | 变化帧数 | 最大通道差 |\n|---|---|---|---|\n");
        for ( uint8_t i = 0; i < s->watch_count; i++ )
        {
            fprintf(fm, "| %s | [%d,%d,%d,%d] | %u | %u |\n", s->watch[i].name, s->watch[i].rect.x1, s->watch[i].rect.y1,
                    lv_area_get_width(&s->watch[i].rect), lv_area_get_height(&s->watch[i].rect), s->watch[i].change_frames, s->watch[i].max_delta);
        }
    }
    if ( s->violation_count > 0U )
    {
        fprintf(fm, "\n## 断言失败明细（静态区域在步骤内发生变化）\n\n| 帧 | 步骤 | watch | 差异像素 | 最大通道差 | 文件 |\n|---|---|---|---|---|---|\n");
        for ( uint32_t i = 0; i < s->violation_count; i++ )
        {
            const FrameRec_t* r = &s->frames[s->violations[i].frame];
            fprintf(fm, "| %u | %u | %s | %u | %u | frames/f%05u_%s_VIOLATION.png |\n", s->violations[i].frame, s->violations[i].step,
                    s->watch[s->violations[i].watch].name, s->violations[i].px, s->violations[i].delta, r->index, r->source);
        }
        if ( s->dropped_violations > 0U )
        {
            fprintf(fm, "\n（另有 %u 条未列出）\n", s->dropped_violations);
        }
    }
    fprintf(fm, "\n## 帧间差异（仅列有变化的帧）\n\n| 帧 | tick | 来源 | 步骤 | 差异像素 | 包围盒 [x1,y1,x2,y2] |\n|---|---|---|---|---|---|\n");
    for ( uint32_t i = 0; i < s->frame_count; i++ )
    {
        const FrameRec_t* r = &s->frames[i];
        if ( r->changed_px == 0U )
        {
            continue;
        }
        fprintf(fm, "| %u | %u | %s | %u | %u | [%d,%d,%d,%d] |\n", r->index, r->tick, r->source, r->step, r->changed_px, r->bbox.x1, r->bbox.y1,
                r->bbox.x2, r->bbox.y2);
    }
    bool ok = ferror(fm) == 0;
    if ( fclose(fm) != 0 )
        ok = false;
    if ( !ok )
        fprintf(stderr, "scenario: 报告写入失败: %s\n", path);
    return ok;
}

static bool write_reports(const char* out_dir, const char* scenario_path, const char* firmware_commit, bool passed)
{
    Scenario_t* s = &s_scn;
    char path[640];

    const bool markdown_ok = write_markdown_report(out_dir, scenario_path, firmware_commit, passed);
    passed = passed && markdown_ok;
    cJSON* root = cJSON_CreateObject();
    if ( root == NULL )
    {
        fprintf(stderr, "scenario: 报告内存分配失败\n");
        return false;
    }
    cJSON_AddStringToObject(root, "name", s->name);
    cJSON_AddStringToObject(root, "scenario_file", scenario_path);
    cJSON_AddStringToObject(root, "firmware_commit", firmware_commit != NULL ? firmware_commit : "");
    cJSON_AddStringToObject(root, "page", s->page);
    cJSON_AddBoolToObject(root, "passed", passed);
    cJSON_AddNumberToObject(root, "frames", s->frame_count);
    cJSON_AddNumberToObject(root, "lvgl_frames", s->lvgl_frames);
    cJSON_AddNumberToObject(root, "compose_frames", s->compose_frames);
    cJSON_AddNumberToObject(root, "tolerance_px", s->tolerance_px);
    cJSON_AddNumberToObject(root, "tolerance_delta", s->tolerance_delta);
    cJSON_AddNumberToObject(root, "violations", s->violation_count + s->dropped_violations);

    cJSON* watches = cJSON_AddArrayToObject(root, "watch");
    for ( uint8_t i = 0; i < s->watch_count; i++ )
    {
        cJSON* w = cJSON_CreateObject();
        cJSON_AddStringToObject(w, "name", s->watch[i].name);
        cJSON* rect = cJSON_AddArrayToObject(w, "rect");
        cJSON_AddItemToArray(rect, cJSON_CreateNumber(s->watch[i].rect.x1));
        cJSON_AddItemToArray(rect, cJSON_CreateNumber(s->watch[i].rect.y1));
        cJSON_AddItemToArray(rect, cJSON_CreateNumber(lv_area_get_width(&s->watch[i].rect)));
        cJSON_AddItemToArray(rect, cJSON_CreateNumber(lv_area_get_height(&s->watch[i].rect)));
        cJSON_AddNumberToObject(w, "change_frames", s->watch[i].change_frames);
        cJSON_AddNumberToObject(w, "max_delta", s->watch[i].max_delta);
        cJSON_AddItemToArray(watches, w);
    }
    cJSON* steps = cJSON_AddArrayToObject(root, "steps");
    for ( uint8_t i = 0; i < s->step_count; i++ )
    {
        cJSON* st = cJSON_CreateObject();
        cJSON_AddNumberToObject(st, "index", i + 1);
        cJSON_AddStringToObject(st, "desc", s->step_result[i].desc);
        cJSON_AddNumberToObject(st, "frames", s->step_result[i].frames);
        cJSON_AddNumberToObject(st, "compose_frames", s->step_result[i].compose_frames);
        cJSON_AddNumberToObject(st, "violations", s->step_result[i].violations);
        cJSON_AddBoolToObject(st, "compose_missing", s->step_result[i].compose_missing);
        cJSON_AddItemToArray(steps, st);
    }
    cJSON* viol = cJSON_AddArrayToObject(root, "violation_list");
    for ( uint32_t i = 0; i < s->violation_count; i++ )
    {
        cJSON* v = cJSON_CreateObject();
        cJSON_AddNumberToObject(v, "frame", s->violations[i].frame);
        cJSON_AddNumberToObject(v, "step", s->violations[i].step);
        cJSON_AddStringToObject(v, "watch", s->watch[s->violations[i].watch].name);
        cJSON_AddNumberToObject(v, "changed_px", s->violations[i].px);
        cJSON_AddNumberToObject(v, "max_delta", s->violations[i].delta);
        cJSON_AddItemToArray(viol, v);
    }
    cJSON* frames = cJSON_AddArrayToObject(root, "frame_list");
    for ( uint32_t i = 0; i < s->frame_count; i++ )
    {
        const FrameRec_t* r = &s->frames[i];
        cJSON* f = cJSON_CreateObject();
        cJSON_AddNumberToObject(f, "index", r->index);
        cJSON_AddNumberToObject(f, "tick", r->tick);
        cJSON_AddNumberToObject(f, "step", r->step);
        cJSON_AddStringToObject(f, "source", r->source);
        cJSON_AddNumberToObject(f, "changed_px", r->changed_px);
        if ( r->changed_px > 0U )
        {
            cJSON* bb = cJSON_AddArrayToObject(f, "bbox");
            cJSON_AddItemToArray(bb, cJSON_CreateNumber(r->bbox.x1));
            cJSON_AddItemToArray(bb, cJSON_CreateNumber(r->bbox.y1));
            cJSON_AddItemToArray(bb, cJSON_CreateNumber(r->bbox.x2));
            cJSON_AddItemToArray(bb, cJSON_CreateNumber(r->bbox.y2));
        }
        if ( s->watch_count > 0U )
        {
            cJSON* wp = cJSON_AddArrayToObject(f, "watch_px");
            cJSON* wd = cJSON_AddArrayToObject(f, "watch_delta");
            for ( uint8_t k = 0; k < s->watch_count; k++ )
            {
                cJSON_AddItemToArray(wp, cJSON_CreateNumber(r->watch_px[k]));
                cJSON_AddItemToArray(wd, cJSON_CreateNumber(r->watch_delta[k]));
            }
        }
        if ( r->violated )
        {
            cJSON_AddBoolToObject(f, "violated", true);
        }
        cJSON_AddItemToArray(frames, f);
    }
    char* text = cJSON_Print(root);
    cJSON_Delete(root);
    if ( text == NULL )
    {
        fprintf(stderr, "scenario: JSON 报告编码失败\n");
        return false;
    }
    snprintf(path, sizeof(path), "%s/report.json", out_dir);
    FILE* fj = fopen(path, "w");
    bool json_ok = false;
    if ( fj != NULL )
    {
        json_ok = fputs(text, fj) >= 0 && fputc('\n', fj) != EOF && ferror(fj) == 0;
        if ( fclose(fj) != 0 )
            json_ok = false;
    }
    cJSON_free(text);
    if ( !json_ok )
        fprintf(stderr, "scenario: JSON 报告写入失败: %s\n", path);
    return markdown_ok && json_ok;
}

// ── 入口 ──
int sim_scenario_run(const char* scenario_path, const char* out_dir, const char* firmware_commit)
{
    Scenario_t* s = &s_scn;
    memset(s, 0, sizeof(*s));

    FILE* f = fopen(scenario_path, "rb");
    if ( f == NULL )
    {
        fprintf(stderr, "scenario: 无法打开 %s: %s\n", scenario_path, strerror(errno));
        return 2;
    }
    fseek(f, 0, SEEK_END);
    const long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    if ( len < 0 || len > (1L << 20) )
    {
        fprintf(stderr, "scenario: %s 大小异常（%ld）\n", scenario_path, len);
        fclose(f);
        return 2;
    }
    char* text = malloc((size_t)len + 1U);
    if ( text == NULL || fread(text, 1, (size_t)len, f) != (size_t)len )
    {
        fclose(f);
        free(text);
        return 2;
    }
    fclose(f);
    text[len] = '\0';
    cJSON* root = cJSON_Parse(text);
    if ( root == NULL )
    {
        fprintf(stderr, "scenario: JSON 解析失败（%.40s 附近）\n", cJSON_GetErrorPtr() != NULL ? cJSON_GetErrorPtr() : "?");
        free(text);
        return 2;
    }
    free(text);

    const char* name = json_str(root, "name");
    const char* page = json_str(root, "page");
    if ( name == NULL || page == NULL )
    {
        fprintf(stderr, "scenario: 需要 name 与 page 字段\n");
        cJSON_Delete(root);
        return 2;
    }
    snprintf(s->name, sizeof(s->name), "%s", name);
    snprintf(s->page, sizeof(s->page), "%s", page);
    const int tolerance_px = json_int(root, "tolerance_px", 0);
    if ( tolerance_px < 0 )
    {
        fprintf(stderr, "scenario: tolerance_px 不能为负\n");
        cJSON_Delete(root);
        return 2;
    }
    s->tolerance_px = (uint32_t)tolerance_px;
    // 默认 8 = RGB565 一个 LSB（R/B 5 位）。compositor 合成帧与 LVGL 直绘帧在抗锯齿边缘上有 ±1 LSB 的
    // 混合舍入差（真机 DMA2D 与 LVGL 混合公式本就不同），不是缺陷；真正的状态跳变（禁用灰→启用白）通道差 >100。
    s->tolerance_delta = (uint8_t)LV_CLAMP(0, json_int(root, "tolerance_delta", 8), 255);
    const char* capture = json_str(root, "capture");
    s->capture = capture == NULL || strcmp(capture, "all") == 0 ? SCN_CAPTURE_ALL : strcmp(capture, "changed") == 0 ? SCN_CAPTURE_CHANGED : SCN_CAPTURE_NONE;

    const cJSON* watch = cJSON_GetObjectItemCaseSensitive(root, "watch");
    const cJSON* item;
    cJSON_ArrayForEach(item, watch)
    {
        const char* wname = json_str(item, "name");
        const cJSON* rect = cJSON_GetObjectItemCaseSensitive(item, "rect");
        if ( wname == NULL || !cJSON_IsArray(rect) || cJSON_GetArraySize(rect) != 4 || s->watch_count >= SCN_MAX_WATCH )
        {
            fprintf(stderr, "scenario: watch 需要 name + rect [x,y,w,h]（最多 %d 个）\n", SCN_MAX_WATCH);
            cJSON_Delete(root);
            return 2;
        }
        int rv[4];
        bool rect_ok = true;
        for ( int k = 0; k < 4; k++ )
        {
            const cJSON* n = cJSON_GetArrayItem(rect, k);
            rect_ok = rect_ok && cJSON_IsNumber(n) && n->valueint > -100000 && n->valueint < 100000;
            rv[k] = rect_ok ? n->valueint : 0;
        }
        const int32_t disp_w = lv_display_get_horizontal_resolution(NULL);
        const int32_t disp_h = lv_display_get_vertical_resolution(NULL);
        if ( !rect_ok || rv[2] <= 0 || rv[3] <= 0 || rv[0] + rv[2] <= 0 || rv[1] + rv[3] <= 0 || rv[0] >= disp_w || rv[1] >= disp_h )
        {
            fprintf(stderr, "scenario: watch '%s' 的 rect 非法或完全在屏幕外（屏幕 %dx%d）\n", wname, (int)disp_w, (int)disp_h);
            cJSON_Delete(root);
            return 2;
        }
        Watch_t* w = &s->watch[s->watch_count++];
        snprintf(w->name, sizeof(w->name), "%s", wname);
        w->rect = (lv_area_t){rv[0], rv[1], rv[0] + rv[2] - 1, rv[1] + rv[3] - 1};
    }

    const cJSON* steps = cJSON_GetObjectItemCaseSensitive(root, "steps");
    const int step_total = cJSON_IsArray(steps) ? cJSON_GetArraySize(steps) : 0;
    if ( step_total <= 0 || step_total > SCN_MAX_STEPS )
    {
        fprintf(stderr, "scenario: steps 需要 1..%d 个步骤\n", SCN_MAX_STEPS);
        cJSON_Delete(root);
        return 2;
    }
    s->step_count = (uint8_t)step_total;
    uint32_t validation_index = 0;
    cJSON_ArrayForEach(item, steps)
    {
        if ( !validate_step_assertions(++validation_index, item) )
        {
            cJSON_Delete(root);
            return 2;
        }
    }

    const sim_page_t* p = sim_page_find(page);
    if ( p == NULL )
    {
        fprintf(stderr, "scenario: 未知页面 '%s'（--page 可用 id 见 page_registry）\n", page);
        cJSON_Delete(root);
        return 2;
    }

    if ( !ensure_dir(out_dir) )
    {
        cJSON_Delete(root);
        return 2;
    }
    if ( s->capture != SCN_CAPTURE_NONE )
    {
        snprintf(s->frames_dir, sizeof(s->frames_dir), "%s/frames", out_dir);
        if ( !ensure_dir(s->frames_dir) )
        {
            cJSON_Delete(root);
            return 2;
        }
    }

    const uint32_t hres = (uint32_t)lv_display_get_horizontal_resolution(NULL);
    const uint32_t vres = (uint32_t)lv_display_get_vertical_resolution(NULL);
    s->prev_frame = malloc((size_t)hres * vres * 2U);
    if ( s->prev_frame == NULL )
    {
        cJSON_Delete(root);
        return 2;
    }

    // 场景模式：虚拟时钟 + 关闭鼠标源 + 挂帧接收器
    s->tick = 1000U;
    lv_tick_set_cb(scenario_tick_cb);
    sim_touch_mouse_enable(false);
    lv_port_indev_test_touch_reset();
    sim_disp_frame_sink_set(frame_sink, NULL);

    printf("SCENARIO|begin|%s|page %s|steps %d|firmware %s\n", s->name, page, step_total, firmware_commit != NULL ? firmware_commit : "?");
    sim_page_open(p);
    s->step = 0;
    run_for((uint32_t)json_int(root, "settle_ms", SCN_DEFAULT_SETTLE));

    bool ok = true;
    int index = 0;
    cJSON_ArrayForEach(item, steps)
    {
        index++;
        if ( !run_step((uint32_t)index, item) )
        {
            ok = false;
            break;
        }
    }
    sim_disp_frame_sink_set(NULL, NULL);

    bool compose_missing = false;
    for ( uint8_t i = 0; i < s->step_count; i++ )
    {
        compose_missing = compose_missing || s->step_result[i].compose_missing;
    }
    bool passed = ok && !s->error && s->violation_count == 0U && s->dropped_violations == 0U && !compose_missing;
    const bool reports_ok = write_reports(out_dir, scenario_path, firmware_commit, passed);
    if ( !reports_ok )
        s->error = true;
    passed = passed && !s->error;
    printf("SCENARIO|end|%s|frames %u (lvgl %u, compose %u)|violations %u|%s\n", s->name, s->frame_count, s->lvgl_frames, s->compose_frames,
           s->violation_count + s->dropped_violations, s->error || !ok ? "ERROR" : passed ? "PASS" : "FAIL");
    if ( reports_ok )
        printf("SCENARIO|report|%s/report.md\n", out_dir);

    cJSON_Delete(root);
    free(s->prev_frame);
    free(s->frames);
    s->prev_frame = NULL;
    s->frames = NULL;
    if ( !ok || s->error )
    {
        return 2;
    }
    return passed ? 0 : 1;
}
