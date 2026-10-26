#pragma once
// 场景执行器：JSON 描述的触摸序列 → 虚拟时钟驱动 → 每一帧上屏像素落盘 → 帧间差异 + 静态区域断言。
//
// 用法：./build/onekey-sim --scenario scenarios/ok-64012.json --out out/ok-64012
// 产物：<out>/frames/f00042_compose.png（逐帧）、<out>/report.json、<out>/report.md
// 退出码：0 全部断言通过；1 有断言失败；2 场景文件/页面错误
//
// 场景文件格式见 scenarios/README.md。
#include <stdint.h>

// 主循环一步（main.c 提供）：compositor_content_scroll_drive → page_manager_run → lv_timer_handler
uint32_t sim_loop_step(void);

int sim_scenario_run(const char* scenario_path, const char* out_dir, const char* firmware_commit);
