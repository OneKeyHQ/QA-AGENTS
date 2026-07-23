// OneKey Pro 2 固件 UI 模拟器
// 用法:
//   ./onekey-sim                        交互模式（SDL 窗口，鼠标=触摸）
//   ./onekey-sim --frames N             跑 N 帧后退出（无头自检用，配合 SDL_VIDEODRIVER=dummy）
//   ./onekey-sim --page <id>            打开指定页面（默认 homescreen；全部 id 见 src/page_registry.c。
//                                       固件 dev 分支重构后阶段 A 暂只有 homescreen，阶段 B 重建全量）
//   ./onekey-sim --snapshot <dir>       遍历注册表逐页截图导出 PNG 到 <dir>（配合 SDL_VIDEODRIVER=dummy）。
//                                       编排器模式：本进程不初始化 LVGL/SDL，每页 fork+exec 自身跑
//                                       --snapshot-page，子进程天然无跨页状态（固件 status_bar 等
//                                       static 单例挂在 lv_layer_top，单进程逐页渲染必污染，见 snapshot.h）
//   ./onekey-sim --snapshot-page <id> <dir>
//                                       内部模式（--snapshot 的子进程）：初始化后只渲染一页，
//                                       落盘 <dir>/<id>.png 后退出（0=成功）。也可手动单页截图用
#include <lvgl.h>
#include <ui_font_manager.h>
#include <ui_language_translations.h>   // i18n 初始化（文案来自 A:/resource/i18n）
#include <i18n_tags.h>                  // I18N_M_SIGNING__* 等文案宏（--demo-catalog 用真机文案）
#include "page_registry.h"
#include "snapshot.h"
#include <txdetails_keys.h>
#include <assets/asset_paths.h>         // ASSET_TOKEN_ICON_CRYPTO_MORE_ICON（name_to_icon 回退图标）
#include <sign_page.h>                  // 真实交易确认页 SignPageConfig_t / PAGE_ID_SIGN_PAGE
#include "my_address_display.h"          // 真实地址展示页 PAGE_ID_ADDRESS_DISPLAY（--demo-myaddress）
#include "my_address_session.h"          // my_address_session_init（sim 桩在 sim_stubs_pages.c）
#include "page_manager/page_manager.h"  // shadow 拷贝
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

// ── 交易确认页 demo（--demo-tx）──────────────────────────────────────────
// 用真实代币数据驱动 ui/templates/template_txconfirm（程序化构建 API，挂 lv_layer_top）。
// 固件里这套页面是 needs_arg（真机由 MicroPython 喂交易数据），sim 不跑引擎，
// 这里用内置代币注册表的真实值（符号/精度/合约地址）合成一笔转账，验证页面展示。
typedef struct
{
    const char* preset;     // 命令行选择名
    const char* title;      // 顶部标题
    const char* num;        // 金额数字串
    uint32_t    decimals;   // 精度
    const char* symbol;     // 代币符号
    uint64_t    coin_type;  // slip44（set_network 据此显示网络图标+名称：BTC=0/ETH=60/TRX=195）
    uint64_t    chain_id;   // EVM chain_id（目前 set_network 忽略，仅备注）
    const char* to_addr;    // 收款地址
    const char* token_addr; // 代币合约地址（NULL=原生币转账）
} demo_tx_preset_t;

// 数据取自固件内置代币注册表真实值（符号/精度/合约地址）；coin_type=slip44 决定网络图标/名称。
static const demo_tx_preset_t DEMO_TX_PRESETS[] = {
    // ───── 原生主币（每条内置链代表，token_addr=NULL）─────
    {"btc", "Send", "0.005", 8, "BTC", 0, 0, "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", NULL},
    {"ltc", "Send", "2.5", 8, "LTC", 2, 0, "ltc1qg9p7nkqffmcjz5q0js2vd3xphzqcq5y7n3xpml", NULL},
    {"doge", "Send", "1200", 8, "DOGE", 3, 0, "DH5yaieqoZN36fDVciNyRueRGvGLR3mr7L", NULL},
    {"bch", "Send", "3.0", 8, "BCH", 145, 0, "qr95sy3j9xwd2ap32xkykttr4cvcu7as4y0qverfuy", NULL},
    {"eth", "Send", "0.05", 18, "ETH", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60", NULL},
    {"trx", "Send", "5000", 6, "TRX", 195, 0, "TJYeasTPa6gpEEfYYrhSbZjnAofYr5xs8R", NULL},
    {"sol", "Send", "10", 9, "SOL", 501, 0, "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV", NULL},
    {"xrp", "Send", "500", 6, "XRP", 144, 0, "rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT", NULL},
    {"ada", "Send", "1000", 6, "ADA", 1815, 0, "addr1qxy2lpan99fcnhhyk9vsvh9xrf2v0cnv5", NULL},
    {"dot", "Send", "50", 10, "DOT", 354, 0, "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3", NULL},
    {"atom", "Send", "100", 6, "ATOM", 118, 0, "cosmos1qy352eufqy352eufqy352eufqy35qqqejrxws", NULL},
    {"ton", "Send", "100", 9, "TON", 607, 0, "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", NULL},
    {"sui", "Send", "25", 9, "SUI", 784, 0, "0xc4173a804406a365e69dfb297d4eaaf002546ebd", NULL},
    {"aptos", "Send", "25", 8, "APT", 637, 0, "0x1cf3a87c9b6f2e4d5a6b7c8d9e0f1a2b3c4d5e6f", NULL},
    {"near", "Send", "30", 24, "NEAR", 397, 0, "alice.near", NULL},
    {"kaspa", "Send", "500", 8, "KAS", 111111, 0, "kaspa:qqkqkzjvr7zwxxmnp7q9z8x", NULL},
    {"algo", "Send", "300", 6, "ALGO", 283, 0, "ZW3ISEHZUHPO7OZGMKLKIIMKVICOUDRCERI454I3DB2BH52HGLSO67W754", NULL},
    {"fil", "Send", "12", 18, "FIL", 461, 0, "f1abjxfbp274xpdqcpuaykwkfb43omjotacm2p3za", NULL},
    {"cfx", "Send", "800", 18, "CFX", 503, 0, "cfx:aak2rra2njvd77ezwjvx04kkds9fzagfe6ku8scz91", NULL},
    // ───── 代币（带真实合约地址）─────
    {"eth-usdt", "Send", "100", 6, "USDT", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0xdac17f958d2ee523a2206206994597c13d831ec7"},
    {"eth-usdc", "Send", "250.5", 6, "USDC", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48"},
    {"eth-dai", "Send", "500", 18, "DAI", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x6b175474e89094c44da98b954eedeac495271d0f"},
    {"eth-link", "Send", "75", 18, "LINK", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x514910771af9ca656af840dff83e8264ecf986ca"},
    {"eth-wbtc", "Send", "0.8", 8, "WBTC", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"},
    {"tron-usdt", "Send", "100", 6, "USDT", 195, 0, "TJYeasTPa6gpEEfYYrhSbZjnAofYr5xs8R",
     "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t"},
    {"sol-usdc", "Send", "100", 6, "USDC", 501, 0, "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV",
     "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"},
    {"ton-usdt", "Send", "100", 6, "USDT", 607, 0, "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs",
     "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs"},
    // 未内置代币示例（USDe，真机回退 UNKNOWN_TOKEN）
    {"eth-usde-unkn", "Send", "100", 0, "UNKN", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34"},
    // ───── 精度测试（不同 decimals + 不同数值，看金额怎么显示）─────
    {"prec-dai", "Send", "0.000000000000000001", 18, "DAI", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x6b175474e89094c44da98b954eedeac495271d0f"},
    {"prec-usdt", "Send", "1234567.891234", 6, "USDT", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0xdac17f958d2ee523a2206206994597c13d831ec7"},
    {"prec-wbtc", "Send", "0.00000001", 8, "WBTC", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599"},
    {"prec-link", "Send", "999.999999999999999999", 18, "LINK", 60, 1, "0x28C6c06298d514Db089934071355E5743bf21d60",
     "0x514910771af9ca656af840dff83e8264ecf986ca"},
};
#define DEMO_TX_PRESET_COUNT ((int)(sizeof(DEMO_TX_PRESETS) / sizeof(DEMO_TX_PRESETS[0])))

static void demo_tx_slide_confirm_cb(lv_obj_t* slider)
{
    (void)slider; // demo：滑动确认后不做实际签名
}

// ── 内置代币表 + 金额换算（真实转换逻辑）──────────────────────────────────
// 真机链路：token_by_chain_address(合约) 查内置表 → symbol+decimals（查不到=UNKNOWN_TOKEN/精度0）
//   → 金额(最小单位整数) ÷ 10^decimals 格式化显示。
// 这里查表数据来自固件提取的真实表 token_registry.inc（503 条），换算逻辑在 sim 复刻。
typedef struct
{
    const char* addr;
    const char* symbol;
    uint8_t     decimals;
    const char* chain;    // 真实链名（EVM 取 networks.py name；非 EVM 固定标签）
    uint64_t    chain_id; // EVM chain_id（非 EVM = 0）
} token_reg_t;
static const token_reg_t TOKEN_REGISTRY[] = {
#include "token_registry.inc"
};
#define TOKEN_REGISTRY_COUNT ((int)(sizeof(TOKEN_REGISTRY) / sizeof(TOKEN_REGISTRY[0])))

// 在内置代币表里按合约地址查（大小写不敏感，EVM 地址常被传入混合大小写）。
// 命中返回该行（真机 token_by_chain_address 命中），未命中 NULL（真机回退 UNKNOWN_TOKEN）。
static const token_reg_t* registry_lookup(const char* contract)
{
    if ( !contract || !contract[0] )
        return NULL;
    for ( int i = 0; i < TOKEN_REGISTRY_COUNT; i++ )
    {
        const char* a = TOKEN_REGISTRY[i].addr;
        const char* b = contract;
        while ( *a && *b && tolower((unsigned char)*a) == tolower((unsigned char)*b) )
        {
            a++;
            b++;
        }
        if ( *a == '\0' && *b == '\0' )
            return &TOKEN_REGISTRY[i];
    }
    return NULL;
}

// 金额换算：raw（最小单位整数串）÷ 10^decimals → 人类可读串（含千分位，去尾零）。
// 复刻固件 format_amount 的展示口径：整数部分加千分位逗号，小数部分按 decimals 取、去末尾 0。
static void format_amount(const char* raw, uint32_t decimals, char* out, size_t outsz)
{
    // 1) 清洗：只保留数字
    char   digits[160];
    size_t dn = 0;
    for ( const char* p = raw; *p && dn < sizeof(digits) - 1; p++ )
        if ( isdigit((unsigned char)*p) )
            digits[dn++] = *p;
    digits[dn] = '\0';
    if ( dn == 0 )
    {
        digits[0] = '0';
        digits[1] = '\0';
        dn        = 1;
    }

    // 2) 按 decimals 切分整数/小数部分（位数不足时小数左侧补零）
    char intpart[160];
    char frac[160];
    if ( dn <= decimals )
    {
        intpart[0]  = '0';
        intpart[1]  = '\0';
        size_t pad  = decimals - dn;
        size_t fi   = 0;
        for ( size_t i = 0; i < pad; i++ )
            frac[fi++] = '0';
        for ( size_t i = 0; i < dn; i++ )
            frac[fi++] = digits[i];
        frac[fi] = '\0';
    }
    else
    {
        size_t ilen = dn - decimals;
        memcpy(intpart, digits, ilen);
        intpart[ilen] = '\0';
        memcpy(frac, digits + ilen, decimals);
        frac[decimals] = '\0';
    }

    // 3) 去掉小数末尾的 0
    size_t fl = strlen(frac);
    while ( fl > 0 && frac[fl - 1] == '0' )
        frac[--fl] = '\0';

    // 4) 整数部分加千分位
    char   grouped[200];
    size_t il = strlen(intpart);
    size_t gi = 0;
    for ( size_t i = 0; i < il && gi < sizeof(grouped) - 2; i++ )
    {
        if ( i > 0 && (il - i) % 3 == 0 )
            grouped[gi++] = ',';
        grouped[gi++] = intpart[i];
    }
    grouped[gi] = '\0';

    // 5) 组装
    if ( fl > 0 )
        snprintf(out, outsz, "%s.%s", grouped, frac);
    else
        snprintf(out, outsz, "%s", grouped);
}

// 把网络/币种显示名反查图标——严格复刻固件 approval_txconfirm.c::name_to_icon：
// proto 丢了 coin_type，前端按 coin_type_to_name 反查名字拿回图标，未命中回退 more_icon。
// 92bdbbf6 起（e49a3935/4fb17cca）：图标解析改为"别名表 + 按 norm(name) 探测
// network_icons/<族>_<词干>.bin 文件"——逐行复刻 view_sign_page.c 的 name_to_icon
// （该文件依赖 nanopb 头不能编入）。BSC 等 EVM 网络现在有真图标。
// 图标解析（e4884ae8→561be533 起资源加尺寸后缀 _36dp，且真机改用 crypto_icon 模块）：
// demo 直接按新命名探测 network_icons/<fam>_<norm(name)>_36dp.bin，回退通用 more 图标。
// 这是签名 demo 的装饰性图标；性能测试路径（--click-test / 页面计时）不经过此函数。
static void demo_network_name_norm(const char* name, char* out, size_t out_size)
{
    size_t n = 0;
    for ( const char* p = name; *p && n + 1 < out_size; p++ )
    {
        char c = *p;
        if ( c >= 'A' && c <= 'Z' )
            c += 'a' - 'A';
        if ( c == ' ' || c == '.' || c == '-' )
            c = '_';
        if ( (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '_' )
            out[n++] = c;
    }
    out[n] = '\0';
}

static bool demo_res_file_exists(const char* path)
{
    lv_fs_file_t f;
    if ( lv_fs_open(&f, path, LV_FS_MODE_RD) != LV_FS_RES_OK )
        return false;
    lv_fs_close(&f);
    return true;
}

static char    s_demo_icon_paths[4][96];
static uint8_t s_demo_icon_path_n;

static const char* demo_name_to_icon(const char* name)
{
    if ( !name || !name[0] || s_demo_icon_path_n >= (uint8_t)(sizeof(s_demo_icon_paths) / sizeof(s_demo_icon_paths[0])) )
        return ASSET_NETWORK_ICONS_CRYPTO_MORE_ICON_36DP;
    char stem[48];
    demo_network_name_norm(name, stem, sizeof(stem));
    static const char* const fams[] = {"crypto", "evm", "cosmos", "dot", "btc_fork"};
    char*                    path = s_demo_icon_paths[s_demo_icon_path_n];
    for ( size_t f = 0; f < sizeof(fams) / sizeof(fams[0]); f++ )
    {
        snprintf(path, sizeof(s_demo_icon_paths[0]), RES("network_icons/") "%s_%s_36dp.bin", fams[f], stem);
        if ( demo_res_file_exists(path) )
        {
            s_demo_icon_path_n++;
            return path;
        }
    }
    return ASSET_NETWORK_ICONS_CRYPTO_MORE_ICON_36DP;
}

// 核心构建器：用已解析好的字段构建并 push 真实 sign_page。
// 字段样式复刻 approval_txconfirm.c::field_from_detail：
//   Network → ICON_TEXT（图标按 slip44 取）；To → LONG_TEXT+mono+recolor；
//   From/Token → LONG_TEXT+mono；其它 → LONG_TEXT。
// 字段集按币种家族复刻引擎真实发送的行（Overview/Details 分栏 =
// txdetails_key_is_overview 白名单：To/Network/Maximum Fee/Spender 进 Overview）：
//   EVM   = app/ethereum/eth_utils/layout.py::confirm_tx：
//           From, To, [Token], Network, Nonce, Maximum Fee,
//           [Total Amount(原生币)], Max Fee Per Gas, Priority Fee（无 Chain ID 行）
//   BTC 系 = app/bitcoin/sign_tx/layout.py：真机分两页（①To+金额 ②Fee+Total Amount，
//           无 From/Network 行——UTXO 无单一 from），demo 合并为一页展示
//   其他链 = 各链 layout.py 行集不同，demo 保持通用最小集（Network/To/Amount/[Token]）
// fee/nonce 等真机来自交易本体，demo 用固定演示值合成（金额换算是真实的）。
typedef enum
{
    DEMO_FAMILY_GENERIC = 0,
    DEMO_FAMILY_BTC,
    DEMO_FAMILY_EVM,
} demo_family_t;

// ── SLIP-44 币种常量 + 名称/图标（固件把这套从 txdetails_keys.h 移到 crypto_icon 模块了，
//    这里给 --demo-tx 预设路径本地补上；仅旧预设 demo 用，性能测试路径不经过）──
#define COIN_TYPE_BTC  0
#define COIN_TYPE_LTC  2
#define COIN_TYPE_DOGE 3
#define COIN_TYPE_ETH  60
#define COIN_TYPE_BCH  145
static const char* coin_type_to_name(uint64_t ct)
{
    switch ( ct )
    {
    case COIN_TYPE_BTC:  return "Bitcoin";
    case COIN_TYPE_LTC:  return "Litecoin";
    case COIN_TYPE_DOGE: return "Dogecoin";
    case COIN_TYPE_BCH:  return "Bcash";
    case COIN_TYPE_ETH:  return "Ethereum";
    default:             return "Ethereum";
    }
}
static const char* coin_type_to_icon_small(uint64_t ct)
{
    return demo_name_to_icon(coin_type_to_name(ct));
}

static demo_family_t demo_family_of(uint64_t coin_type)
{
    switch ( coin_type )
    {
    case COIN_TYPE_BTC:
    case COIN_TYPE_LTC:
    case COIN_TYPE_DOGE:
    case COIN_TYPE_BCH:
        return DEMO_FAMILY_BTC;
    case COIN_TYPE_ETH:
        return DEMO_FAMILY_EVM;
    default:
        return DEMO_FAMILY_GENERIC;
    }
}

// "数值 + 空格 + 符号"串（同引擎 format_coin_amount 的成品形态），去尾零。
static void demo_amount_str(double v, const char* sym, char* out, size_t n)
{
    char raw[64];
    snprintf(raw, sizeof(raw), "%.8f", v);
    char* end = raw + strlen(raw) - 1;
    while ( end > raw && *end == '0' )
        *end-- = '\0';
    if ( end > raw && *end == '.' )
        *end = '\0';
    snprintf(out, n, "%s %s", raw, sym);
}

static char s_chain_id_buf[32];
static int  build_sign_page(const char* title, const char* num, const char* symbol, const char* net_name,
                            const char* net_icon, uint64_t chain_id, uint64_t coin_type, const char* to_addr,
                            const char* token_addr)
{
    // demo 演示值（真机来自交易本体/费率估算）
    static const char* DEMO_FROM_EVM     = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
    static const char* DEMO_NONCE        = "42";
    static const char* DEMO_FEE_PER_GAS  = "50 Gwei";
    static const char* DEMO_PRIORITY_FEE = "2 Gwei";
    const double       DEMO_FEE_EVM      = 0.00105;  // 21000 gas × 50 Gwei
    const double       DEMO_FEE_BTC      = 0.00002;

    demo_family_t      family = demo_family_of(coin_type);
    static char        fee_buf[64], total_buf[80];
    static SignField_t overview[3], details[6];
    uint16_t           ov_n = 0, dt_n = 0;

    if ( family == DEMO_FAMILY_EVM )
    {
        // Overview（引擎发送序：To → Network → Maximum Fee）
        overview[ov_n++] = (SignField_t){.label         = txdetails_key_to_label(TXDETAILS_KEY_TO_ADDRESS),
                                         .variant       = SIGN_FIELD_VARIANT_LONG_TEXT,
                                         .value_text    = to_addr,
                                         .value_mono    = true,
                                         .value_recolor = true};
        overview[ov_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_NETWORK),
                                         .variant    = SIGN_FIELD_VARIANT_ICON_TEXT,
                                         .value_text = net_name,
                                         .value_icon = net_icon};
        demo_amount_str(DEMO_FEE_EVM, "ETH", fee_buf, sizeof(fee_buf));
        overview[ov_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_MAX_FEE),
                                         .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                         .value_text = fee_buf};
        // Details（同引擎序：From → [Token] → Nonce → [Total Amount] → gas 两行）
        details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_FROM_ADDRESS),
                                        .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                        .value_text = DEMO_FROM_EVM,
                                        .value_mono = true};
        if ( token_addr )
            details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_TOKEN_ADDRESS),
                                            .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                            .value_text = token_addr,
                                            .value_mono = true};
        details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_NONCE),
                                        .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                        .value_text = DEMO_NONCE};
        if ( !token_addr )
        {
            // 原生币转账才有 Total Amount（金额+费）；代币转账引擎不发
            demo_amount_str(strtod(num, NULL) + DEMO_FEE_EVM, symbol, total_buf, sizeof(total_buf));
            details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_TOTAL_AMOUNT),
                                            .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                            .value_text = total_buf};
        }
        details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_MAX_FEE_PER_GAS),
                                        .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                        .value_text = DEMO_FEE_PER_GAS};
        details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_PRIORITY_FEE),
                                        .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                        .value_text = DEMO_PRIORITY_FEE};
    }
    else if ( family == DEMO_FAMILY_BTC )
    {
        overview[ov_n++] = (SignField_t){.label         = txdetails_key_to_label(TXDETAILS_KEY_TO_ADDRESS),
                                         .variant       = SIGN_FIELD_VARIANT_LONG_TEXT,
                                         .value_text    = to_addr,
                                         .value_mono    = true,
                                         .value_recolor = true};
        demo_amount_str(DEMO_FEE_BTC, symbol, fee_buf, sizeof(fee_buf));
        details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_FEE),
                                        .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                        .value_text = fee_buf};
        demo_amount_str(strtod(num, NULL) + DEMO_FEE_BTC, symbol, total_buf, sizeof(total_buf));
        details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_TOTAL_AMOUNT),
                                        .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                        .value_text = total_buf};
    }
    else
    {
        overview[ov_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_NETWORK),
                                         .variant    = SIGN_FIELD_VARIANT_ICON_TEXT,
                                         .value_text = net_name,
                                         .value_icon = net_icon};
        overview[ov_n++] = (SignField_t){.label         = txdetails_key_to_label(TXDETAILS_KEY_TO_ADDRESS),
                                         .variant       = SIGN_FIELD_VARIANT_LONG_TEXT,
                                         .value_text    = to_addr,
                                         .value_mono    = true,
                                         .value_recolor = true};
        details[dt_n++]  = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_AMOUNT),
                                         .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                         .value_text = num};
        if ( token_addr )
            details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_TOKEN_ADDRESS),
                                            .variant    = SIGN_FIELD_VARIANT_LONG_TEXT,
                                            .value_text = token_addr,
                                            .value_mono = true};
        if ( chain_id )
        {
            snprintf(s_chain_id_buf, sizeof(s_chain_id_buf), "%llu", (unsigned long long)chain_id);
            details[dt_n++] = (SignField_t){.label      = txdetails_key_to_label(TXDETAILS_KEY_CHAIN_ID),
                                            .variant    = SIGN_FIELD_VARIANT_TEXT,
                                            .value_text = s_chain_id_buf};
        }
    }
    static SignTab_t tabs[2];
    tabs[0] = (SignTab_t){.name = "Overview", .fields = overview, .field_count = ov_n};
    tabs[1] = (SignTab_t){.name = "Details", .fields = details, .field_count = dt_n};
    static char subtitle[120];
    snprintf(subtitle, sizeof(subtitle), "%s %s", num, symbol);
    // sign_page 不再深拷贝 config（d10b3be2 起），cfg/字符串必须活到页面销毁 → static
    static SignPageConfig_t cfg;
    cfg = (SignPageConfig_t){.title           = title,
                             .subtitle        = subtitle,
                             .tip_text        = NULL,
                             .tip_type        = SIGN_TIP_NONE,
                             .tabs            = tabs,
                             .tab_count       = 2,
                             .slide_label     = "Slide to Sign",
                             .slider_disabled = false,
                             .on_confirm      = demo_tx_slide_confirm_cb};
    page_manager_init();
    page_manager_push(PAGE_ID_SIGN_PAGE, &cfg);
    page_manager_run();
    return 0;
}

// ── 签名页目录（--demo-catalog）───────────────────────────────────────────
// 每条链每种签名流程一条记录，行序照抄引擎 frozen/app/<chain>/**/layout.py 里
// sign(title, general=[row(KEY,...)...], amount=...) 的真实发送序（值为演示样例，
// 结构/键/标题/多页拆分不虚构）。构建逻辑逐行复刻 view_sign_page_build（d10b3be2 起
// approval_txconfirm 更名并改版）：
//   样式 = field_from_detail（icon→ICON_TEXT，To→mono+recolor，From/Address→mono，其他→LONG_TEXT）
//   Overview = txdetails_key_is_overview 白名单子集（保持发送序）
//   Details  = 全部行（含 Overview 键；icon 行降级为纯文本），经真机
//              view_sign_page_details_build_groups 按 key 分组成固定序卡片
//   Data 行  = 超过 5 行(32 字/行)折叠成预览 + "View Data" 按钮（TEXT_FIELD）
//   标签 = 真实 i18n（Overview/Details/Slide to Sign 同真机文案）
#include "demo_catalog.h" // 目录数据在 src/demo_catalog.c，行序提取自 dev 最新引擎代码
// register_ui_components 所需工厂/渲染器（真机在 task_foreground.c 注册）
#include <keyboard/keyboard_mnemonic.h>
#include <keyboard/keyboard_passphrase.h>
#include <keyboard/keyboard_number.h>
#include <loading/loading.h>
#include <stepper/stepper.h>
#include <list/list_group.h>
#include <page_template/page_template.h>
#include "view_sign_page_details.h" // 真机 Details 分组（纯查表，直接编入）

// 同 view_sign_page.c 的折叠参数/逻辑（该文件依赖 protobuf 不能编入，此处复刻）
#define SIM_DATA_CHARS_PER_LINE 32
#define SIM_DATA_VISIBLE_LINES  5
#define SIM_DATA_PREVIEW_MAX    (SIM_DATA_CHARS_PER_LINE * SIM_DATA_VISIBLE_LINES + 4)

static uint16_t sim_estimate_data_lines(const char* text)
{
    uint16_t    lines = 1, col = 0;
    const char* q = text ? text : "";
    for ( ; *q; q++ )
    {
        if ( *q == '\n' )
        {
            lines++;
            col = 0;
        }
        else if ( ++col > SIM_DATA_CHARS_PER_LINE )
        {
            lines++;
            col = 1;
        }
    }
    return lines;
}

static void sim_make_data_preview(char* dst, size_t dst_size, const char* src)
{
    const char* value = src ? src : "";
    size_t      out = 0;
    uint16_t    line = 1, col = 0;
    while ( *value && out + 4 < dst_size )
    {
        if ( *value == '\n' )
        {
            if ( line >= SIM_DATA_VISIBLE_LINES )
                break;
            dst[out++] = *value++;
            line++;
            col = 0;
            continue;
        }
        if ( col >= SIM_DATA_CHARS_PER_LINE )
        {
            if ( line >= SIM_DATA_VISIBLE_LINES )
                break;
            line++;
            col = 0;
        }
        if ( line == SIM_DATA_VISIBLE_LINES && col + 3 >= SIM_DATA_CHARS_PER_LINE )
            break;
        dst[out++] = *value++;
        col++;
    }
    if ( *value && out + 4 <= dst_size )
        memcpy(dst + out, "...", 4);
    else
        dst[out] = '\0';
}

static int build_demo_catalog(const char* id)
{
    if ( strcmp(id, "list") == 0 ) // 机器可读清单：id|组|流程|Overview行数|Details行数
    {
        for ( int i = 0; i < DEMO_CATALOG_COUNT; i++ )
        {
            const demo_catalog_page_t* c = &DEMO_CATALOG[i];
            int                        ov = 0;
            for ( uint16_t j = 0; j < c->row_count; j++ )
                if ( txdetails_key_is_overview(c->rows[j].key) )
                    ov++;
            // 新版适配器：Details = 全部行（Overview 是白名单子集，行会重复出现）；
            // 单平铺 layout（1/2/4）无 tab 栏 → ov 报 0 不截 Details 图；
            // Layout7702(3) 是 Overview/Details 双 tab → ov 报 1 让调用方截两张
            if ( c->layout == 3 )
                ov = 1;
            else if ( c->layout != 0 )
                ov = 0;
            printf("%s|%s|%s|%d|%d\n", c->id, c->group, c->flow, ov, (int)c->row_count);
        }
        return 1; // 非 0：调用方直接退出，不进渲染循环
    }
    const demo_catalog_page_t* p = NULL;
    for ( int i = 0; i < DEMO_CATALOG_COUNT; i++ )
        if ( strcmp(DEMO_CATALOG[i].id, id) == 0 )
            p = &DEMO_CATALOG[i];
    if ( p == NULL )
    {
        fprintf(stderr, "sim: 未知 --demo-catalog id '%s'，可用:\n", id);
        for ( int i = 0; i < DEMO_CATALOG_COUNT; i++ )
            fprintf(stderr, "  %-24s %-10s %s\n", DEMO_CATALOG[i].id, DEMO_CATALOG[i].group, DEMO_CATALOG[i].flow);
        return -1;
    }
    // 同 view_sign_page.c：general[] 一趟；Overview=白名单子集，Details=全部行
    static SignField_t ov_f[16], dt_f[VIEW_SIGN_PAGE_DETAILS_MAX_FIELDS];
    static uint32_t    dt_keys[VIEW_SIGN_PAGE_DETAILS_MAX_FIELDS];
    static char        dt_previews[VIEW_SIGN_PAGE_DETAILS_MAX_FIELDS][SIM_DATA_PREVIEW_MAX];
    static ViewSignPageDetailsGroups_t dt_groups;
    uint16_t           ov_n = 0, dt_n = 0;
    for ( uint16_t i = 0; i < p->row_count; i++ )
    {
        const demo_row_t* r = &p->rows[i];
        SignField_t       f = {.label = txdetails_key_to_label(r->key), .value_text = r->value};
        if ( r->icon )
        {
            f.variant    = SIGN_FIELD_VARIANT_ICON_TEXT;
            f.value_icon = demo_name_to_icon(r->value);
        }
        else if ( r->key == TXDETAILS_KEY_TO_ADDRESS )
        {
            f.variant       = SIGN_FIELD_VARIANT_LONG_TEXT;
            f.value_mono    = true;
            f.value_recolor = true;
        }
        else if ( r->key == TXDETAILS_KEY_FROM_ADDRESS || r->key == TXDETAILS_KEY_ADDRESS )
        {
            f.variant    = SIGN_FIELD_VARIANT_LONG_TEXT;
            f.value_mono = true;
        }
        else
        {
            f.variant = SIGN_FIELD_VARIANT_LONG_TEXT;
        }
        if ( txdetails_key_is_overview(r->key) && ov_n < 16 )
            ov_f[ov_n++] = f;
        if ( dt_n < VIEW_SIGN_PAGE_DETAILS_MAX_FIELDS )
        {
            SignField_t df = f;
            // Data 行超 5 行折叠成预览 + View Data 按钮（同 data_field_from_detail）
            if ( r->key == TXDETAILS_KEY_DATA &&
                 sim_estimate_data_lines(r->value) > SIM_DATA_VISIBLE_LINES )
            {
                sim_make_data_preview(dt_previews[dt_n], SIM_DATA_PREVIEW_MAX, r->value);
                df.variant         = SIGN_FIELD_VARIANT_TEXT_FIELD;
                df.value_text      = dt_previews[dt_n];
                df.full_value_text = r->value;
                df.action_text     = I18N_M_SIGNING__I_VIEWDATA;
            }
            // Details 里 icon 行降级为纯文本（同 view_sign_page_build）
            if ( df.variant == SIGN_FIELD_VARIANT_ICON_TEXT )
            {
                df.variant    = SIGN_FIELD_VARIANT_LONG_TEXT;
                df.value_icon = NULL;
            }
            dt_f[dt_n]      = df;
            dt_keys[dt_n++] = r->key;
        }
    }
    static SignTab_t tabs[2];
    uint8_t          tab_count = 0;
    // ── 布局分发（92bdbbf6，同 view_sign_page_build）──
    // 0=Default 双 tab；1=SafeTxCreate 单平铺表；2=FinalConfirm FG 自有内容；
    // 3=7702 双 tab 表；4=Flat 内置分组单平铺。表驱动路径复刻真机
    // view_sign_page_layouts.c（依赖 nanopb 头不能编入）+ build_layout_tabs。
    static const uint32_t SAFE_G1[] = {TXDETAILS_KEY_VALUE, TXDETAILS_KEY_TO_ADDRESS, TXDETAILS_KEY_SIGNER,
                                       TXDETAILS_KEY_NETWORK};
    static const uint32_t SAFE_G2[] = {TXDETAILS_KEY_OPERATION, TXDETAILS_KEY_NONCE, TXDETAILS_KEY_VERIFYING_CONTRACT,
                                       TXDETAILS_KEY_CHAIN_ID};
    static const uint32_t SAFE_G3[] = {TXDETAILS_KEY_DOMAIN_HASH, TXDETAILS_KEY_MESSAGE_HASH,
                                       TXDETAILS_KEY_SAFE_TX_HASH};
    static const uint32_t SAFE_G4[] = {TXDETAILS_KEY_SAFE_TX_GAS, TXDETAILS_KEY_BASE_GAS, TXDETAILS_KEY_GAS_PRICE,
                                       TXDETAILS_KEY_GAS_TOKEN, TXDETAILS_KEY_REFUND_RECEIVER};
    static const uint32_t E7702_OV[] = {TXDETAILS_KEY_ACCOUNT, TXDETAILS_KEY_DELEGATE_TO_PROVIDER,
                                        TXDETAILS_KEY_DELEGATE_ON_NETWORK, TXDETAILS_KEY_REVOKE_ON_NETWORK};
    static const uint32_t E7702_D1[] = {TXDETAILS_KEY_ACCOUNT, TXDETAILS_KEY_DELEGATE_TO};
    static const uint32_t E7702_D2[] = {TXDETAILS_KEY_VALUE, TXDETAILS_KEY_NONCE, TXDETAILS_KEY_DELEGATE_ON_NETWORK,
                                        TXDETAILS_KEY_REVOKE_ON_NETWORK};
    static const uint32_t E7702_D3[] = {TXDETAILS_KEY_MAX_FEE, TXDETAILS_KEY_MAX_FEE_PER_GAS,
                                        TXDETAILS_KEY_PRIORITY_FEE};
    typedef struct
    {
        const uint32_t* keys;
        uint8_t         n;
    } sim_lg_t;
    typedef struct
    {
        const sim_lg_t* groups;
        uint8_t         group_count;
    } sim_ltab_t;
    static const sim_lg_t   SAFE_GROUPS[]  = {{SAFE_G1, 4}, {SAFE_G2, 4}, {SAFE_G3, 3}, {SAFE_G4, 5}};
    static const sim_ltab_t SAFE_TABS[]    = {{SAFE_GROUPS, 4}};
    static const sim_lg_t   E7702_OV_G[]   = {{E7702_OV, 4}};
    static const sim_lg_t   E7702_DT_G[]   = {{E7702_D1, 2}, {E7702_D2, 4}, {E7702_D3, 3}};
    static const sim_ltab_t E7702_TABS[]   = {{E7702_OV_G, 1}, {E7702_DT_G, 3}};
    const sim_ltab_t*       lt      = NULL;
    uint8_t                 lt_n    = 0;
    if ( p->layout == 1 )
    {
        lt   = SAFE_TABS;
        lt_n = 1;
    }
    else if ( p->layout == 3 )
    {
        lt   = E7702_TABS;
        lt_n = 2;
    }

    if ( p->layout == 2 )
    {
        // LayoutFinalConfirm：FG 自有内容（插画+居中 i18n 标题+滑条，无卡片），
        // mp 的 title/general 只是回退——tab_count 保持 0。
    }
    else if ( p->layout == 4 )
    {
        // LayoutFlat：内置分组单平铺页——无 Overview 子集，icon 行保留图标、
        // To 高亮保留（collect_details(downgrade=false) 的效果）
        for ( uint16_t i = 0; i < dt_n; i++ )
            if ( p->rows[i].icon )
            {
                dt_f[i].variant    = SIGN_FIELD_VARIANT_ICON_TEXT;
                dt_f[i].value_icon = demo_name_to_icon(p->rows[i].value);
                dt_f[i].value_recolor = false;
            }
        uint8_t dt_group_count = view_sign_page_details_build_groups(&dt_groups, dt_f, dt_keys, dt_n);
        if ( dt_group_count > 0 )
            tabs[tab_count++] = (SignTab_t){.name        = I18N_M_SIGNING__T_DETAILS,
                                            .groups      = dt_groups.groups,
                                            .group_count = dt_group_count};
    }
    else if ( lt != NULL )
    {
        // 表驱动布局（Safe/7702）：表序即显示序，claimed 跨 tab；未入表行进
        // 末 tab 兜底卡；icon 行在此路径保留图标。双 tab 命名 Overview/Details。
        bool    claimed[VIEW_SIGN_PAGE_DETAILS_MAX_FIELDS] = {false};
        uint8_t group_n = 0;
        memset(&dt_groups, 0, sizeof(dt_groups));
        for ( uint8_t t = 0; t < lt_n; t++ )
        {
            uint8_t tab_group_base = group_n;
            for ( uint8_t g = 0; g < lt[t].group_count && group_n < VIEW_SIGN_PAGE_DETAILS_MAX_GROUPS - 1; g++ )
            {
                uint8_t field_n = 0;
                for ( uint8_t k = 0; k < lt[t].groups[g].n; k++ )
                    for ( uint16_t i = 0; i < dt_n; i++ )
                    {
                        if ( claimed[i] || dt_keys[i] != lt[t].groups[g].keys[k] )
                            continue;
                        claimed[i] = true;
                        SignField_t lf = dt_f[i];
                        if ( p->rows[i].icon )
                        {
                            lf.variant    = SIGN_FIELD_VARIANT_ICON_TEXT;
                            lf.value_icon = demo_name_to_icon(p->rows[i].value);
                        }
                        dt_groups.fields[group_n][field_n++] = lf;
                        break;
                    }
                if ( field_n )
                {
                    dt_groups.groups[group_n] = (SignFieldGroup_t){.fields      = dt_groups.fields[group_n],
                                                                   .field_count = field_n};
                    group_n++;
                }
            }
            if ( group_n > tab_group_base && tab_count < 2 )
                tabs[tab_count++] = (SignTab_t){.groups      = &dt_groups.groups[tab_group_base],
                                                .group_count = (uint8_t)(group_n - tab_group_base)};
        }
        uint8_t fb_n = 0;
        for ( uint16_t i = 0; i < dt_n; i++ )
            if ( !claimed[i] )
                dt_groups.fields[group_n][fb_n++] = dt_f[i];
        if ( fb_n )
        {
            dt_groups.groups[group_n] = (SignFieldGroup_t){.fields = dt_groups.fields[group_n], .field_count = fb_n};
            group_n++;
            if ( tab_count == 0 )
                tabs[tab_count++] = (SignTab_t){.groups = &dt_groups.groups[group_n - 1], .group_count = 1};
            else
                tabs[tab_count - 1].group_count++;
        }
        if ( tab_count == 2 )
        {
            tabs[0].name = I18N_M_SIGNING__T_OVERVIEW;
            tabs[1].name = I18N_M_SIGNING__T_DETAILS;
        }
        else if ( tab_count == 1 )
            tabs[0].name = I18N_M_SIGNING__T_DETAILS;
    }
    else
    {
        // Default：Details 降级副本（icon→纯文本 + To 去高亮，3c3430da）
        for ( uint16_t i = 0; i < dt_n; i++ )
            dt_f[i].value_recolor = false;
        uint8_t dt_group_count = view_sign_page_details_build_groups(&dt_groups, dt_f, dt_keys, dt_n);
        if ( ov_n > 0 )
            tabs[tab_count++] = (SignTab_t){.name = I18N_M_SIGNING__T_OVERVIEW, .fields = ov_f, .field_count = ov_n};
        if ( dt_n > 0 )
            tabs[tab_count++] = (SignTab_t){
                .name        = I18N_M_SIGNING__T_DETAILS,
                .groups      = dt_groups.groups,
                .group_count = dt_group_count,
                .fields      = dt_f,
                .field_count = dt_n,
            };
    }
    // 页级 Data 卡（sign_with_data）：同真机对 mp 输入再过一遍预览截断
    static char raw_preview[SIM_DATA_PREVIEW_MAX];
    const char* raw = NULL;
    if ( p->raw_data != NULL && p->raw_data[0] )
    {
        sim_make_data_preview(raw_preview, sizeof(raw_preview), p->raw_data);
        raw = raw_preview;
    }
    // sign_page 不再深拷贝 config（d10b3be2 起），cfg 必须活到页面销毁 → static
    bool final_confirm = p->layout == 2;
    static SignPageConfig_t cfg;
    cfg = (SignPageConfig_t){// FinalConfirm：FG 自有插画 + 居中 i18n 标题（92bdbbf6 dca1813f）
                             .title           = final_confirm ? I18N_M_SIGNING__I_CONFIRMTHISTRANSACTION : p->title,
                             .lead_icon       = final_confirm ? ASSET_ILLUSTRATION_CONFIRM_TRANSACTION : NULL,
                             .subtitle        = p->amount,
                             .tip_text        = p->tip,
                             .tip_type        = p->tip ? p->tip_type : SIGN_TIP_NONE,
                             // 7702 双 tab：横幅只挂 Overview（tip_first_tab_only）
                             .tip_first_tab_only = lt != NULL && tab_count == 2,
                             .tabs            = tabs,
                             .tab_count       = tab_count,
                             .slide_label     = I18N_M_SIGNING__T_SLIDETOCONFIRM,
                             .slider_disabled = false,
                             .on_confirm      = demo_tx_slide_confirm_cb,
                             // slide=False 的中间页（EIP-712 walkthrough 等）渲染 Continue 按钮
                             .bottom_kind     = p->continue_btn ? SIGN_BOTTOM_BUTTON : SIGN_BOTTOM_SLIDER,
                             .raw_initial_data = raw,
                             .on_view_data    = NULL, // demo：点 View Data 无后续页
                             .on_destroyed    = NULL};
    page_manager_init();
    page_manager_push(PAGE_ID_SIGN_PAGE, &cfg);
    page_manager_run();
    return 0;
}

// 预设模式：金额是预设里写死的格式化串（仅演示页面长相）。
static int build_demo_tx(const char* preset)
{
    const demo_tx_preset_t* p = NULL;
    for ( int i = 0; i < DEMO_TX_PRESET_COUNT; i++ )
        if ( strcmp(DEMO_TX_PRESETS[i].preset, preset) == 0 )
            p = &DEMO_TX_PRESETS[i];
    if ( p == NULL )
    {
        fprintf(stderr, "sim: 未知 --demo-tx 预设 '%s'，可用:\n", preset);
        for ( int i = 0; i < DEMO_TX_PRESET_COUNT; i++ )
            fprintf(stderr, "  %-12s %s %s%s\n", DEMO_TX_PRESETS[i].preset, DEMO_TX_PRESETS[i].num,
                    DEMO_TX_PRESETS[i].symbol, DEMO_TX_PRESETS[i].token_addr ? " (token)" : " (native)");
        return -1;
    }
    return build_sign_page(p->title, p->num, p->symbol, coin_type_to_name(p->coin_type),
                           coin_type_to_icon_small(p->coin_type), p->chain_id, p->coin_type, p->to_addr,
                           p->token_addr);
}

// 真实转换模式：传【原始整数金额 + 合约地址】，查内置表得 decimals → 换算 → 构建页面。
// 这才是真机的行为：是否内置决定 decimals，进而决定金额怎么显示。
static int build_demo_tx_raw(const char* contract, const char* raw_amount)
{
    const token_reg_t* t        = registry_lookup(contract);
    const char*        symbol   = t ? t->symbol : "UNKN";
    uint32_t           decimals = t ? t->decimals : 0;
    const char*        net_name = t ? t->chain : "Ethereum"; // 未内置无法判链，默认 Ethereum
    uint64_t           chain_id = t ? t->chain_id : 1;
    const char*        net_icon = demo_name_to_icon(net_name); // 严格按固件 name_to_icon 反查
    static char        amount[200];
    format_amount(raw_amount, decimals, amount, sizeof(amount));
    printf("───── 真实转换（按是否内置）─────\n");
    printf("合约地址 : %s\n", contract);
    printf("是否内置 : %s\n", t ? "YES" : "NO  (token_by_chain_address 查不到 → UNKNOWN_TOKEN)");
    if ( t )
        printf("内置信息 : symbol=%s  decimals=%u  网络=%s  chain_id=%llu\n", symbol, decimals, net_name,
               (unsigned long long)chain_id);
    else
        printf("回退     : symbol=UNKN  decimals=0  网络=Ethereum(默认)\n");
    printf("原始金额 : %s  (最小单位整数)\n", raw_amount);
    printf("换算显示 : %s %s   (= 原始 / 10^%u, 含千分位, 同固件 format_amount)\n", amount, symbol, decimals);
    printf("网络图标 : %s\n", net_icon);
    printf("─────────────────────────────\n");
    fflush(stdout); // 重定向到文件时也立即刷出
    // EVM 合约代币按以太坊家族布局（From/Nonce/gas 行）；非 EVM 内置代币走通用布局
    return build_sign_page("Send", amount, symbol, net_name, net_icon, chain_id,
                           chain_id ? COIN_TYPE_ETH : 0xFFFFFFFFu,
                           "0x28C6c06298d514Db089934071355E5743bf21d60", contract);
}

// ── 真实地址展示页 demo（--demo-myaddress）───────────────────────────────────
// 渲染固件 my_address_display.c（PAGE_ID_ADDRESS_DISPLAY）——设置里"我的地址"的真实页面。
// 真机链路：MP 引擎回 GetAddress → task_foreground → my_address_display_build(ViewVerifyPage)。
// sim 直接喂一个 ViewVerifyPage（地址+路径）走同一个 build() 入口，渲染页面本身的最终效果：
//   分块地址(LIST_ITEM_PRIVATE_KEY，首尾各 6 字符 accent recolor) + 派生行 + QR Code 按钮。
// coin_type=0(slip44 BTC) → coin_display_name 得 "Bitcoin"、coin_has_derive_choice 为真显示派生行。
static int build_demo_myaddress(void)
{
    page_manager_init();
    my_address_session_init(0, 0); // COIN_TYPE_BTC = slip44 0
    static ViewVerifyPage pg;
    memset(&pg, 0, sizeof(pg));
    strncpy(pg.address, "1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH", sizeof(pg.address) - 1);
    strncpy(pg.path, "m/44'/0'/0'/0/0", sizeof(pg.path) - 1);
    if ( !my_address_display_build(&pg) )
        return -1;
    page_manager_run();
    return 0;
}

// 递归在对象树里找文字为 text 的 label，返回它。用于程序化切 Details 标签页。
static lv_obj_t* find_label_by_text(lv_obj_t* root, const char* text)
{
    if ( !root )
        return NULL;
    if ( lv_obj_check_type(root, &lv_label_class) )
    {
        const char* t = lv_label_get_text(root);
        if ( t && strcmp(t, text) == 0 )
            return root;
    }
    uint32_t n = lv_obj_get_child_count(root);
    for ( uint32_t i = 0; i < n; i++ )
    {
        lv_obj_t* hit = find_label_by_text(lv_obj_get_child(root, i), text);
        if ( hit )
            return hit;
    }
    return NULL;
}

// 切到名为 tab_name 的标签页：找到该 label 的父对象（segmented_control 的 tab 按钮），
// 发 LV_EVENT_CLICKED 触发真实 tab_click_cb 切换（含 bar 高亮 + 内容滚动）。
static void demo_tx_switch_tab(const char* tab_name)
{
    lv_obj_t* label = find_label_by_text(lv_screen_active(), tab_name);
    if ( !label )
        return;
    lv_obj_t* tab_btn = lv_obj_get_parent(label);
    if ( tab_btn )
        lv_obj_send_event(tab_btn, LV_EVENT_CLICKED, NULL);
}

// Pro 2 面板 G1354TU101GF = 604×1024（dev 分支 DP_UNIT ×1.25 设计基准，
// 壁纸也按 604×1024 作图）。改动时必须同步 src/sim_stubs.c 的 lvgl_disp_hres/vres
#define SIM_HRES 604
#define SIM_VRES 1024

static uint32_t sim_tick_ms(void)
{
    struct timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (uint32_t)((uint64_t)ts.tv_sec * 1000 + ts.tv_nsec / 1000000);
}

int main(int argc, char** argv)
{
    long        max_frames    = -1;   // -1 = 无限（交互模式）
    const char* page          = NULL; // NULL = 默认 demo
    const char* snapshot_dir  = NULL; // 非 NULL = 批量截图编排器模式
    const char* snap_page_id  = NULL; // 非 NULL = 单页截图模式（--snapshot-page）
    const char* snap_page_dir = NULL;
    const char* demo_tx       = NULL; // 非 NULL = 交易确认页 demo（用真实代币数据）
    const char* demo_tx_snap  = NULL; // 非 NULL = demo-tx 渲染后落盘 PNG 路径（无头）
    const char* demo_tx_tab   = NULL; // 非 NULL = 渲染前切到该标签页（如 "Details"）
    const char* demo_raw_addr = NULL; // 真实转换模式：合约地址
    const char* demo_raw_amt  = NULL; // 真实转换模式：原始整数金额（最小单位）
    bool        demo_myaddress = false; // true = 渲染真实地址展示页 my_address_display
    const char* demo_catalog  = NULL;  // 非 NULL = 按签名页目录 id 渲染（--demo-catalog）
    const char* click_test_id = NULL;  // 非 NULL = 单页点击测试（--click-test）
    const char* click_shots   = NULL;  // --click-test 的落图目录（可选）

    for ( int i = 1; i < argc; i++ )
    {
        if ( strcmp(argv[i], "--frames") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --frames 缺少参数\n");
                return 2;
            }
            char* end = NULL;
            max_frames = strtol(argv[++i], &end, 10);
            if ( end == argv[i] || *end != '\0' || max_frames < 0 )
            {
                fprintf(stderr, "sim: --frames 需要非负整数, 收到 '%s'\n", argv[i]);
                return 2;
            }
        }
        else if ( strcmp(argv[i], "--page") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --page 缺少参数\n");
                return 2;
            }
            page = argv[++i];
        }
        else if ( strcmp(argv[i], "--snapshot") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --snapshot 缺少参数\n");
                return 2;
            }
            snapshot_dir = argv[++i];
        }
        else if ( strcmp(argv[i], "--snapshot-page") == 0 )
        {
            if ( i + 2 >= argc )
            {
                fprintf(stderr, "sim: --snapshot-page 需要 <id> <dir> 两个参数\n");
                return 2;
            }
            snap_page_id  = argv[++i];
            snap_page_dir = argv[++i];
        }
        else if ( strcmp(argv[i], "--click-test") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --click-test 缺少页面 id\n");
                return 2;
            }
            click_test_id = argv[++i];
            if ( i + 1 < argc && argv[i + 1][0] != '-' )
                click_shots = argv[++i];
        }
        else if ( strcmp(argv[i], "--demo-tx") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --demo-tx 缺少预设名（如 eth-usdt / tron-usdt / btc）\n");
                return 2;
            }
            demo_tx = argv[++i];
        }
        else if ( strcmp(argv[i], "--demo-tx-snap") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --demo-tx-snap 缺少 PNG 输出路径\n");
                return 2;
            }
            demo_tx_snap = argv[++i];
        }
        else if ( strcmp(argv[i], "--demo-tx-tab") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --demo-tx-tab 缺少标签名（Overview / Details）\n");
                return 2;
            }
            demo_tx_tab = argv[++i];
        }
        else if ( strcmp(argv[i], "--demo-tx-raw") == 0 )
        {
            if ( i + 2 >= argc )
            {
                fprintf(stderr, "sim: --demo-tx-raw 需要 <合约地址> <原始整数金额>\n");
                return 2;
            }
            demo_raw_addr = argv[++i];
            demo_raw_amt  = argv[++i];
        }
        else if ( strcmp(argv[i], "--demo-catalog") == 0 )
        {
            if ( i + 1 >= argc )
            {
                fprintf(stderr, "sim: --demo-catalog 缺少页面 id（--demo-catalog list 列全部）\n");
                return 2;
            }
            demo_catalog = argv[++i];
        }
        else if ( strcmp(argv[i], "--demo-myaddress") == 0 )
        {
            demo_myaddress = true;
        }
    }

    // 编排器模式：本进程不碰 LVGL/SDL，只 fork+exec 子进程逐页截图（见 snapshot.h 进程模型）
    if ( snapshot_dir != NULL )
        return sim_snapshot_all(snapshot_dir, argv[0]);

    lv_init();
    lv_tick_set_cb(sim_tick_ms);

    lv_display_t* disp = lv_sdl_window_create(SIM_HRES, SIM_VRES);
    lv_sdl_window_set_title(disp, "OneKey Pro 2 Simulator");
    lv_sdl_mouse_create();

    // 同真机 task_foreground.c register_ui_components()（01bfae6e 起：重量级组件
    // 改为 app 启动注册，bootloader 不注册则渲染为空——sim 必须照抄注册，
    // 否则 list 行/键盘/loading/stepper 全部空白）。
    ui_page_template_register_keyboards(ui_create_mnemonicKeyboard, ui_create_passphraseKeyboard,
                                        ui_create_numberKeyboard);
    ui_page_template_register_loading(ui_loading_create, ui_loading_close, ui_loading_set_text);
    ui_page_template_register_stepper(ui_create_stepper);
    ui_list_item_register_portfolio_renderer(ui_list_item_render_portfolio);
    ui_list_item_register_text_left_aligned_renderer(ui_list_item_render_text_left_aligned);
    ui_list_item_register_private_key_renderer(ui_list_item_render_private_key);
    ui_list_item_register_text_field_renderer(ui_list_item_render_text_field);

    if ( !ui_font_manager_init() )
    {
        fprintf(stderr, "sim: font manager init 失败 — 检查 resroot/resource/font/（CMake 装配自固件资源管线 output/fonts/roobert）\n");
        return 1;
    }

    // 同真机 task_foreground 初始化顺序：字体就绪后加载 i18n 翻译
    // （A:/resource/i18n/en-Latn-US.json，缺文件时容忍降级为空串文案）
    if ( !ui_language_translations_init() )
        fprintf(stderr, "sim: i18n 初始化失败 — 检查 resroot/resource/i18n/，页面文案将为空\n");

    // 单页截图模式（--snapshot 编排器的子进程入口；也可手动调用）
    if ( snap_page_id != NULL )
        return sim_snapshot_page(snap_page_id, snap_page_dir);

    // 单页点击测试模式（子进程隔离跑；崩溃/超时由编排器聚合）
    if ( click_test_id != NULL )
        return sim_click_test_page(click_test_id, click_shots);

    // demo 渲染：交易确认页(demo_tx/demo_raw_addr) / 地址核对模板(demo_address) / 地址展示页(demo_myaddress)
    if ( demo_tx != NULL || demo_raw_addr != NULL || demo_myaddress || demo_catalog != NULL )
    {
        int rc_build = demo_catalog    ? build_demo_catalog(demo_catalog)
                       : demo_myaddress ? build_demo_myaddress()
                       : demo_raw_addr ? build_demo_tx_raw(demo_raw_addr, demo_raw_amt)
                                       : build_demo_tx(demo_tx);
        if ( rc_build != 0 )
            return 2;
        const char* demo_label = demo_catalog   ? demo_catalog
                                 : demo_myaddress ? "my_address_display"
                                 : (demo_tx ? demo_tx : "demo-tx-raw");
        if ( demo_tx_snap != NULL )
        {
            for ( int f = 0; f < 30; f++ ) // 泵帧让布局/动画稳定
            {
                lv_timer_handler();
                lv_refr_now(NULL);
            }
            if ( demo_tx_tab != NULL ) // 切到指定标签页(如 Details)
            {
                demo_tx_switch_tab(demo_tx_tab);
                // 切换是横向 scroll-snap 动画（基于时间）。无头泵帧必须真实推进时间，
                // 否则动画不前进、内容停在半路。每帧 usleep 16ms 让动画跑完再截图。
                for ( int f = 0; f < 40; f++ )
                {
                    lv_timer_handler();
                    lv_refr_now(NULL);
                    usleep(16000);
                }
            }
            int rc = sim_snapshot_current(demo_tx_snap);
            printf("sim: demo '%s' -> %s (%s)\n", demo_label, demo_tx_snap, rc == 0 ? "OK" : "FAIL");
            return rc == 0 ? 0 : 1;
        }
        // 否则进入交互循环（GUI 窗口展示）
        for ( long frame = 0; max_frames < 0 || frame < max_frames; frame++ )
        {
            uint32_t delay = lv_timer_handler();
            if ( delay == LV_NO_TIMER_READY )
                delay = 5;
            if ( delay > 33 )
                delay = 33;
            usleep(delay * 1000);
        }
        return 0;
    }

    const char*       page_id = (page != NULL) ? page : "homescreen";
    const sim_page_t* p       = sim_page_find(page_id);
    if ( p == NULL )
    {
        fprintf(stderr, "sim: 未知页面 '%s'，可用页面:\n", page_id);
        for ( int i = 0; i < SIM_PAGE_COUNT; i++ )
            fprintf(stderr, "  %-16s %s\n", SIM_PAGES[i].id, SIM_PAGES[i].name_zh);
        return 2;
    }
    sim_page_open(p);

    for ( long frame = 0; max_frames < 0 || frame < max_frames; frame++ )
    {
        uint32_t delay = lv_timer_handler();
        if ( delay == LV_NO_TIMER_READY )
            delay = 5;
        if ( delay > 33 )
            delay = 33; // clamp，保持帧率/输入响应
        usleep(delay * 1000);
    }
    printf("sim: exit after %ld frames\n", max_frames);
    return 0;
}
