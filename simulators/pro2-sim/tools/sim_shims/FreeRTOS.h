// sim shim: 固件 settings_about.c 等 include <FreeRTOS.h> 但实际未用任何 FreeRTOS 符号。
// 真机由 FreeRTOS 内核提供；sim 无 RTOS，给空头让编译通过。新增页面若真用到 RTOS 符号，
// 在这里补最小声明（多半也用不到——UI 页面不直接碰内核）。
#pragma once
