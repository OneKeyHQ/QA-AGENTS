// sim shim: 配套 FreeRTOS.h（<task.h>）。同理 UI 页面未用 task API，空头即可。
#pragma once

// main 2026-10：固件 lv_port_indev.c 在 UI_SNAPSHOT_TEST 下用临界区保护测试触摸队列复位。
// sim 单线程，空实现。
#define taskENTER_CRITICAL() ((void)0)
#define taskEXIT_CRITICAL()  ((void)0)
