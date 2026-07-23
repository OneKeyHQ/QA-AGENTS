// --snapshot 批量截图：按页子进程隔离。
//
// 进程模型（详见 snapshot.h 头注释）：
//   父进程 sim_snapshot_all = 纯编排器，不初始化 LVGL/SDL；
//   每页 fork+exec 自身跑 `--snapshot-page <id> <dir>`，waitpid 收 exit code。
// 为什么不在单进程里逐页渲染：固件 status_bar.c 等组件持有 static 单例且
// 实际挂在 lv_layer_top()，跨页复用必然留下状态污染面（悬空指针/无限自旋），
// 清理钩子方案（lv_anim_delete_all + layer_top 增量清理）已被证明打不干净。
// 子进程模型下每页单例/动画/timer/layer_top 天然归零，且单页崩溃不炸整批。
// SDL_VIDEODRIVER 等环境变量由子进程自然继承，无需特殊处理。
#include "snapshot.h"
#include "page_registry.h"

#include <lvgl.h>
#include <lodepng.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/wait.h>
#include <unistd.h>

#ifdef __APPLE__
#include <mach-o/dyld.h>
#endif

// 渲染 n 帧让动画/异步布局稳定
static void pump_frames(int n)
{
    for ( int i = 0; i < n; i++ )
    {
        lv_timer_handler();
        lv_refr_now(NULL);
    }
}

// lv_snapshot ARGB8888 输出为 BGRA 字节序，转 RGBA 并按 stride 去 padding。
// top 非 NULL 时按 alpha 把顶层（lv_layer_top，模态 sheet/backdrop/状态栏所在层）叠加到 screen 上。
// 注意：lvgl 内置 lodepng 的 *_file API 走 lv_fs（需要驱动盘符），且分配器映射到
// lv_malloc/lv_free——因此用内存版 lodepng_encode32 + stdio 落盘，编码缓冲用 lv_free 释放。
static int write_png(const char* path, const lv_draw_buf_t* buf, const lv_draw_buf_t* top)
{
    const uint32_t w = buf->header.w, h = buf->header.h, stride = buf->header.stride;
    unsigned char* rgba = malloc((size_t)w * h * 4);
    if ( rgba == NULL )
        return -1;
    for ( uint32_t y = 0; y < h; y++ )
    {
        const uint8_t* src = buf->data + (size_t)y * stride;
        unsigned char* dst = rgba + (size_t)y * w * 4;
        for ( uint32_t x = 0; x < w; x++ )
        {
            dst[x * 4 + 0] = src[x * 4 + 2]; // R
            dst[x * 4 + 1] = src[x * 4 + 1]; // G
            dst[x * 4 + 2] = src[x * 4 + 0]; // B
            dst[x * 4 + 3] = 0xFF;           // 截图固定不透明
        }
    }
    if ( top != NULL )
    {
        const uint32_t tw = top->header.w < w ? top->header.w : w;
        const uint32_t th = top->header.h < h ? top->header.h : h;
        for ( uint32_t y = 0; y < th; y++ )
        {
            const uint8_t* src = top->data + (size_t)y * top->header.stride;
            unsigned char* dst = rgba + (size_t)y * w * 4;
            for ( uint32_t x = 0; x < tw; x++ )
            {
                const uint32_t a = src[x * 4 + 3]; // straight alpha "over" 混合
                dst[x * 4 + 0] = (uint8_t)((src[x * 4 + 2] * a + dst[x * 4 + 0] * (255 - a)) / 255);
                dst[x * 4 + 1] = (uint8_t)((src[x * 4 + 1] * a + dst[x * 4 + 1] * (255 - a)) / 255);
                dst[x * 4 + 2] = (uint8_t)((src[x * 4 + 0] * a + dst[x * 4 + 2] * (255 - a)) / 255);
            }
        }
    }
    unsigned char* png      = NULL;
    size_t         png_size = 0;
    unsigned       err      = lodepng_encode32(&png, &png_size, rgba, w, h);
    free(rgba);
    if ( err != 0 || png == NULL )
    {
        lv_free(png);
        return -1;
    }
    FILE* fp = fopen(path, "wb");
    if ( fp == NULL )
    {
        perror(path);
        lv_free(png);
        return -1;
    }
    size_t written = fwrite(png, 1, png_size, fp);
    fclose(fp);
    lv_free(png);
    return written == png_size ? 0 : -1;
}

int sim_snapshot_current(const char* path)
{
    lv_draw_buf_t* buf = lv_snapshot_take(lv_screen_active(), LV_COLOR_FORMAT_ARGB8888);
    // 模态组件（action/page sheet）和 status_bar 渲染在 lv_layer_top，单独截取后叠加。
    // 单页进程内 layer_top 初始为空，有子对象 = 本页创建的，直接全量叠加。
    lv_draw_buf_t* top = NULL;
    if ( lv_obj_get_child_count(lv_layer_top()) > 0 )
        top = lv_snapshot_take(lv_layer_top(), LV_COLOR_FORMAT_ARGB8888);
    int rc = (buf != NULL) ? write_png(path, buf, top) : -1;
    if ( buf != NULL )
        lv_draw_buf_destroy(buf);
    if ( top != NULL )
        lv_draw_buf_destroy(top);
    return rc;
}

int sim_snapshot_page(const char* page_id, const char* out_dir)
{
    const sim_page_t* p = sim_page_find(page_id);
    if ( p == NULL )
    {
        fprintf(stderr, "sim: --snapshot-page 未知页面 '%s'\n", page_id);
        return 2;
    }
    if ( mkdir(out_dir, 0755) != 0 && errno != EEXIST )
    {
        perror(out_dir);
        return 1;
    }
    // 看门狗：单页渲染若意外进入无限自旋（历史上 lv_obj_invalidate 自旋 6min+），
    // SIGALRM 终止本进程，编排器把该页记为 FAIL，整批不挂死。
    alarm(60);
    sim_page_open(p);
    pump_frames(10);
    char path[512];
    snprintf(path, sizeof(path), "%s/%s.png", out_dir, p->id);
    return sim_snapshot_current(path) == 0 ? 0 : 1;
}

// exec 自身的可执行路径：macOS 优先 _NSGetExecutablePath（不依赖 argv[0] 形态），
// 失败则回退 argv[0]（子进程继承 cwd，相对路径同样可达）。
static const char* resolve_self_exe(const char* argv0, char* buf, uint32_t bufsize)
{
#ifdef __APPLE__
    uint32_t size = bufsize;
    if ( _NSGetExecutablePath(buf, &size) == 0 )
        return buf;
#else
    (void)buf;
    (void)bufsize;
#endif
    return argv0;
}

int sim_snapshot_all(const char* out_dir, const char* argv0)
{
    if ( mkdir(out_dir, 0755) != 0 && errno != EEXIST )
    {
        perror(out_dir);
        return -1;
    }
    char        exe_buf[1024];
    const char* exe = resolve_self_exe(argv0, exe_buf, sizeof(exe_buf));

    int failed = 0;
    for ( int i = 0; i < SIM_PAGE_COUNT; i++ )
    {
        const sim_page_t* p = &SIM_PAGES[i];
        if ( !p->supported )
        {
            printf("SKIP  %-16s %s\n", p->id, p->name_zh);
            continue;
        }
        // fork 前必须刷新 stdout：管道/重定向下 stdout 全缓冲，未刷新的缓冲会被
        // 子进程继承并在其退出时重复输出；同时保证 OK/FAIL 行与子进程日志顺序正确。
        fflush(stdout);
        pid_t pid = fork();
        if ( pid < 0 )
        {
            perror("fork");
            failed++;
            continue;
        }
        if ( pid == 0 )
        {
            // 子进程：全新进程跑单页模式（环境变量含 SDL_VIDEODRIVER 自然继承）
            execl(exe, exe, "--snapshot-page", p->id, out_dir, (char*)NULL);
            perror("execl"); // exec 失败才会走到这里
            _exit(127);
        }
        int status = 0;
        if ( waitpid(pid, &status, 0) < 0 )
        {
            perror("waitpid");
            failed++;
            continue;
        }
        if ( WIFEXITED(status) && WEXITSTATUS(status) == 0 )
        {
            printf("OK    %-16s %s -> %s/%s.png\n", p->id, p->name_zh, out_dir, p->id);
        }
        else if ( WIFSIGNALED(status) )
        {
            printf("FAIL  %-16s %s (signal %d: %s)\n", p->id, p->name_zh, WTERMSIG(status),
                   strsignal(WTERMSIG(status)));
            failed++;
        }
        else
        {
            printf("FAIL  %-16s %s (exit %d)\n", p->id, p->name_zh,
                   WIFEXITED(status) ? WEXITSTATUS(status) : -1);
            failed++;
        }
        fflush(stdout);
    }
    printf("snapshot 完成: %d/%d 失败\n", failed, SIM_PAGE_COUNT);
    return failed;
}

// ── --click-test 实现 ────────────────────────────────────────────────
// 模拟"用户点击每个可点击控件"：递归收集 CLICKABLE 且非 HIDDEN 的对象，
// 逐个 lv_obj_send_event(CLICKED)（等价于 indev 点击的最终事件），
// 计时两段：handler 同步耗时（send_event 往返）、点击后 20 帧内单帧最大耗时
// （动画/重排/新页创建的成本）。对象被点击销毁（页面导航）时用
// lv_obj_is_valid 跳过后续失效指针——这本身作为 "page_changed" 信号上报。
#include <time.h>

static uint64_t now_us(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint64_t)ts.tv_sec * 1000000ull + (uint64_t)ts.tv_nsec / 1000ull;
}

#define CLICK_MAX 24

static void collect_clickables(lv_obj_t* obj, lv_obj_t** out, int* n)
{
    if ( *n >= CLICK_MAX || lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN) )
        return;
    if ( lv_obj_has_flag(obj, LV_OBJ_FLAG_CLICKABLE) )
        out[(*n)++] = obj;
    uint32_t cnt = lv_obj_get_child_count(obj);
    for ( uint32_t i = 0; i < cnt && *n < CLICK_MAX; i++ )
        collect_clickables(lv_obj_get_child(obj, i), out, n);
}

int sim_click_test_page(const char* page_id, const char* shots_dir)
{
    const sim_page_t* p = sim_page_find(page_id);
    if ( p == NULL )
    {
        fprintf(stderr, "sim: --click-test 未知页面 '%s'\n", page_id);
        return 2;
    }
    alarm(90); // 看门狗：点击若触发无限自旋，SIGALRM 终止，编排器记 TIMEOUT
    sim_page_open(p);
    pump_frames(30);

    lv_obj_t* objs[CLICK_MAX];
    int       n = 0;
    collect_clickables(lv_screen_active(), objs, &n);
    collect_clickables(lv_layer_top(), objs, &n);
    printf("CLICKTEST|%s|clickables=%d\n", page_id, n);

    int  clicked = 0;
    bool page_changed = false;
    for ( int i = 0; i < n; i++ )
    {
        if ( !lv_obj_is_valid(objs[i]) )
        {
            page_changed = true;
            continue;
        }
        lv_area_t a;
        lv_obj_get_coords(objs[i], &a);
        uint64_t t0 = now_us();
        lv_obj_send_event(objs[i], LV_EVENT_CLICKED, NULL);
        uint64_t handler_us = now_us() - t0;
        // 点击后 20 帧：单帧最大耗时（含动画推进/新页布局）
        double max_frame_ms = 0;
        for ( int f = 0; f < 20; f++ )
        {
            uint64_t f0 = now_us();
            lv_timer_handler();
            lv_refr_now(NULL);
            double ms = (now_us() - f0) / 1000.0;
            if ( ms > max_frame_ms )
                max_frame_ms = ms;
        }
        bool valid_after = lv_obj_is_valid(objs[i]);
        if ( !valid_after )
            page_changed = true;
        printf("CLICK|%d|at=%d,%d %dx%d|handler_us=%llu|post_max_frame_ms=%.2f|valid_after=%d\n", i,
               (int)a.x1, (int)a.y1, (int)(a.x2 - a.x1 + 1), (int)(a.y2 - a.y1 + 1),
               (unsigned long long)handler_us, max_frame_ms, valid_after ? 1 : 0);
        clicked++;
    }
    printf("CLICKDONE|%s|clicked=%d|page_changed=%d\n", page_id, clicked, page_changed ? 1 : 0);
    if ( shots_dir != NULL )
    {
        if ( mkdir(shots_dir, 0755) != 0 && errno != EEXIST )
            perror(shots_dir);
        char path[512];
        snprintf(path, sizeof(path), "%s/%s--after-clicks.png", shots_dir, page_id);
        sim_snapshot_current(path);
    }
    fflush(stdout);
    return 0;
}
