// needs_arg 页面的演示参数表（见 sim_demo_args.c 头注释）
#pragma once

// 页面 create 回调 NULL 安全、可直接用 NULL arg 打开的标记值
#define SIM_DEMO_ARG_NULL_OK ((const void*)-1)

// 返回该页面的演示 arg：
//   NULL              —— 无演示参数，页面仍跳过
//   SIM_DEMO_ARG_NULL_OK —— 用 NULL arg 打开
//   其他              —— 直接作为 arg 传给 page_manager_push
const void* sim_demo_arg_for(const char* page_id);
