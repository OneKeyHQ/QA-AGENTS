// 签名页目录（--demo-catalog）数据结构。
// 行序照抄引擎 frozen/app/<chain>/**/layout 的 sign(title, [row(KEY,...)...], amount)
// 真实发送序；值为演示样例，结构/键/标题/多页拆分不虚构。数据在 demo_catalog.c。
#pragma once

#include <stdbool.h>
#include <stdint.h>

#include <sign_page.h> // SignTipType_t

typedef struct
{
    uint32_t    key;   // TXDETAILS_KEY_*
    const char* value; // 演示值（真机来自交易本体）
    bool        icon;  // ViewDetail.has_icon（Network 行）
} demo_row_t;

typedef struct
{
    const char*       id;       // 命令行 id，如 "eth-transfer"
    const char*       group;    // 报告分组（链名）
    const char*       flow;     // 触发的 wire 消息，如 "EthereumSignTxEIP1559OneKey"
    const char*       title;    // sign() 标题（真实串）
    const char*       amount;   // 头部金额串，NULL = 无
    const char*       tip;      // tip 文案，NULL = 无
    SignTipType_t     tip_type;
    const demo_row_t* rows;
    uint16_t          row_count;
    // ── 7b39e210 起的新维度（默认 0/NULL = 滑动确认、内置分组、无 Data 卡）──
    bool        continue_btn; // 引擎 sign(slide=False)：底部 Continue 按钮替代滑条
    uint8_t     layout;       // ViewSignLayout：0=内置分组，1=LayoutSafeTxCreate
    const char* raw_data;     // sign_with_data 的页级 Data 卡预览串，NULL = 无
} demo_catalog_page_t;

extern const demo_catalog_page_t DEMO_CATALOG[];
extern const int                 DEMO_CATALOG_COUNT;
