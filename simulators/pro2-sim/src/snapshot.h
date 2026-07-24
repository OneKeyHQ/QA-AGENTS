#pragma once

// ── 进程模型说明（为什么是子进程，不要改回单进程）──────────────────────────
// 固件 UI 存在跨页污染面：如 ui/components/status_bar/status_bar.c 的
// g_status_bar_ctx 是 static 单例，容器实际创建在 lv_layer_top()（忽略 parent 参数）。
// 单进程逐页 snapshot 时，第 14 页 status-bar demo 创建它之后，后续换 screen/清理
// 与单例残留状态冲突，曾导致 homescreen 页 SIGSEGV / lv_obj_invalidate 100% CPU 自旋。
// 单进程内加清理钩子（lv_anim_delete_all + layer_top 增量清理）已被证明打不干净。
// 因此 --snapshot 改为编排器：每页 fork+exec 一个全新子进程跑 --snapshot-page，
// 单例/动画/timer/layer_top 天然归零；单页崩溃只 FAIL 该页，不炸整批。

// 编排器（父进程，无需初始化 LVGL/SDL）：遍历页面注册表，每页 fork+exec 自身
// 跑 `--snapshot-page <id> <out_dir>`，按 exit code / 信号汇总 OK/FAIL。
// argv0 用于 exec 自身（macOS 上优先 _NSGetExecutablePath 解析）。
// 返回失败页数（0 = 全部成功）。
int sim_snapshot_all(const char* out_dir, const char* argv0);

// 单页模式（子进程入口，要求 LVGL/SDL/字体已初始化）：
// 渲染注册表中的 page_id 一页，落盘 <out_dir>/<page_id>.png。
// 返回 0 成功；1 截图/落盘失败；2 未知页面。
int sim_snapshot_page(const char* page_id, const char* out_dir);

// 把当前 screen（叠加 lv_layer_top 上的模态层/状态栏，如有）截图编码为 PNG 写到 path。
// 返回 0 成功，-1 失败。
int sim_snapshot_current(const char* path);

// --click-test：单页进程内枚举可点击控件并注入点击，测 handler 耗时与点击后帧耗时，
// stdout 机器可读行（CLICK|...）。shots_dir 非 NULL 时点击结束后落一张 PNG。
int sim_click_test_page(const char* page_id, const char* shots_dir);

// --click-test-all 编排器：逐页子进程点击测试 + 交互态截图，返回失败页数
int sim_click_test_all(const char* out_dir, const char* argv0);
