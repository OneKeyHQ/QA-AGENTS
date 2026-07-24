// 页面注册表 — --page 路由与 --snapshot 批量截图的唯一数据源
//
// 阶段B step3：从固件 page_id.h + 各 page .c 的 PAGE_REGISTER 自动重建（160 页）。
// 表体由 CMake configure 时 tools/gen_page_list.py 生成到 build/generated/page_list.inc，
// page_registry.c #include 它。每页统一经 open_page(page_id) 打开（init→push→run→泵）。
#pragma once
#include <stdbool.h>

typedef struct
{
    const char* id;        // 文件名/--page 参数用（PAGE_ID 去前缀小写，如 "homescreen"）
    const char* name_zh;   // 日志/列表用（needs_arg 时附原因）
    int         page_id;   // 对应 PageId_t 枚举值（open_page 用）
    bool supported;        // false = needs_arg：snapshot 跳过（原因见 name_zh / .inc note）
} sim_page_t;

extern const sim_page_t SIM_PAGES[];
extern const int SIM_PAGE_COUNT;

// 按 id 查找，找不到返回 NULL
const sim_page_t* sim_page_find(const char* id);

// 打开指定页面（page_manager_init → push(page_id, NULL) → run → 5ms 导航泵）。
// main.c / snapshot.c 统一经此入口，避免 160 页各写一个 wrapper。
void sim_page_open(const sim_page_t* p);

// 带 arg 打开（needs_arg 页面配合 sim_demo_args.h 的演示参数用）
void sim_page_open_with_arg(const sim_page_t* p, void* arg);
