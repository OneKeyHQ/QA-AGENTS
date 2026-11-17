#pragma once
// SIM-ONLY 占位：固件真机的 latest/messages_uiview.pb.h 是 nanopb 生成产物（不在源码树）。
// dev 2026-08 起 my_address_display.h 由 legacy/ 切换到 latest/。当前 my_address_display.c
// 只读 ->address / ->path，但按 latest proto（messages_uiview.proto ViewVerifyPage）完整
// 铺开字段，避免后续固件用到 network/derive_type/value_key 时 shim 再炸。
// 字段大小对齐 messages_uiview.options：title=64 / address=128 / path=64 / network=40 / derive_type=24。
#include <stdint.h>
#include <stdbool.h>

typedef struct
{
    char     title[64];
    char     address[128];
    char     path[64];
    bool     has_network;
    char     network[40];
    bool     has_derive_type;
    char     derive_type[24];
    bool     has_value_key;
    uint32_t value_key;
} ViewVerifyPage;

// main 2026-10：sign_data_page.c 按 ViewContentPage 分页承载 Data 内容。
// nanopb 对 bytes 字段生成 {size, bytes[max_size]}；max_size 对齐 messages_uiview.options
// （ViewContentEntry.value=120 / ViewContentPage.chunk=233，后者被 sign_data_page.c 静态断言）。
typedef struct
{
    uint16_t size;
    uint8_t  bytes[120];
} ViewContentEntry_value_t;

typedef struct
{
    uint32_t                 entry_key;
    ViewContentEntry_value_t value;
} ViewContentEntry;

typedef struct
{
    uint16_t size;
    uint8_t  bytes[233];
} ViewContentPage_chunk_t;

typedef struct
{
    uint32_t                page_index;
    uint32_t                page_count;
    bool                    has_chunk;
    ViewContentPage_chunk_t chunk;
    bool                    has_entry;
    ViewContentEntry        entry;
} ViewContentPage;
