#pragma once
// SIM-ONLY 占位：固件真机的 legacy/messages_uiview.pb.h 是 nanopb 生成产物（不在源码树）。
// my_address_display.h 只用到 ViewVerifyPage 结构体（build() 读 ->address / ->path），
// 不碰 pb_decode/fields，故这里给最小结构体即可让 my_address 页面编入 sim。
// 字段大小对齐 messages_uiview.options：title=64 / address=128 / path=64。
#include <stdint.h>

typedef struct
{
    char title[64];
    char address[128];
    char path[64];
} ViewVerifyPage;
