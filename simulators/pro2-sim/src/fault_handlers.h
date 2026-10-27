#pragma once
// sim shim：遮蔽固件 sys/fault_handler/fault_handlers.h（硬件 fault 处理 + 致命错误落盘重启）。
// main 2026-10 起 ui/components/keyboard/keyboard_layout.c（RNG 失败）、
// pages/factory/mnemonic/mnemonic_record_verify.c 直接调用。host 实现：打印后 abort（sim_hw_shims.c）。
#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

__attribute__((noreturn)) void fault_handler_fatal_error(const char* tag_p, const char* msg_p);
