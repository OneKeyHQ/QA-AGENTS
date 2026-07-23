// 页面注册表 — 固件 dev 分支 page_manager 框架接入（阶段B 全量重建）
//
// dev 分支删除了 ui/demo，页面统一由 tasks/task_foreground 的 page_manager
// 管理（PAGE_REGISTER 宏注册到自定义段，page_manager_init 扫描）。
// sim 侧的入口 wrapper 统一为：init → push(PAGE_ID_x) → run（执行排队的导航），
// 再挂一个周期 timer 持续泵 page_manager_run，模拟固件 task_foreground 主循环，
// 让页面内的导航（点图标 push 其他页）在已注册页面范围内可用。
//
// 阶段B step3：SIM_PAGES 表体从 build/generated/page_list.inc 自动生成
// （tools/gen_page_list.py 解析固件 page_id.h + PAGE_REGISTER）。共 160 个注册页，
// 其中 supported 页 NULL 可开，needs_arg 页（on_create 解引用 arg）snapshot 跳过。
#include "page_registry.h"
#include <lvgl.h>
#include <string.h>

#include "page_manager/page_manager.h" // shadow 拷贝（Mach-O 段语法），见 CMakeLists.txt
#include <page_template/page_template.h> // ui_page_template_set_swipe_back_cb
#include <templates/menu_page.h>         // ui_menu_page_set_default_back_cb

static void pm_pump_cb(lv_timer_t* t)
{
    (void)t;
    page_manager_run();
}

// 默认返回回调：复刻固件 task_foreground.c::swipe_back_pop_cb（只 pop 栈顶）。
// 固件在 task 初始化时注册（task_foreground.c:522/526），但 sim 不编译 task_foreground.c，
// 不注册的话 menu_page 返回按钮 / 滑动返回的回调为 NULL → 点击无反应（返回键失效）。
static void sim_back_pop_cb(lv_event_t* e)
{
    (void)e;
    page_manager_pop();
}

// 通用入口：page_manager 初始化 + push 指定页面 + 启动导航泵
static void open_page(PageId_t id)
{
    page_manager_init();
    // 注册默认返回回调（菜单页返回按钮 + 滑动返回手势），对齐固件 task_foreground 行为。
    ui_menu_page_set_default_back_cb(sim_back_pop_cb);
    ui_page_template_set_swipe_back_cb(sim_back_pop_cb);
    page_manager_push(id, NULL);
    page_manager_run(); // 立即执行排队的 push（不等 timer 首跳）
    lv_timer_create(pm_pump_cb, 5, NULL);
}

void sim_page_open(const sim_page_t* p)
{
    open_page((PageId_t)p->page_id);
}

// 表体：CMake configure 时由 tools/gen_page_list.py 生成。
// 行格式 { id_str, PAGE_ID 枚举, supported(1/0), note }，note 转成 name_zh 后缀。
const sim_page_t SIM_PAGES[] = {
#include "page_list.inc"
};
const int SIM_PAGE_COUNT = (int)(sizeof(SIM_PAGES) / sizeof(SIM_PAGES[0]));

const sim_page_t* sim_page_find(const char* id)
{
    for ( int i = 0; i < SIM_PAGE_COUNT; i++ )
    {
        if ( strcmp(SIM_PAGES[i].id, id) == 0 )
            return &SIM_PAGES[i];
    }
    return NULL;
}
