// 签名页目录数据 —— 每条链每种签名流程一条记录。
// 事实来源（dev 最新代码，firmware-pro2 提交 92bdbbf6，2026-07-15 全链重提取：
// 本轮引擎大改——e49a3935/441de890 几乎所有页新增 KEY_NETWORK(名称,icon) 行（盲签在
// Data 后、转账在 To 后）；03bac65e From 行统一在 To 之前；90c72209 删全部派生路径行；
// fafd729f 每流程单一滑动门（内容页 Continue，收尾 LayoutFinalConfirm 插画门）；
// aacd2c69 BTC 发送页 LayoutFlat；dca1813f EIP-712 最终门走 FinalConfirm；
// fb5710be 未知 EVM 链 Network 行回退 "Chain ID n"(无图标) 防冒充；
// 91ca1458 EIP-7702 专属 Layout7702 双 tab；99ea6e3f 启用 Cardano；
// 33759211 ASCII guard；aa85453b 代币表对齐 pro1（UNKNOWN_TOKEN symbol="UNKN"））：
//   注册表   tasks/task_mp_engine/micropython_port/frozen/main.py MESSAGE_HANDLER_MAP
//   行序/标题 frozen/app/<chain>/**/{layout,sign_*}.py 的 sign(title, [row(KEY,...)...], amount, tip, slide, layout)
// 值为演示样例（真机来自交易本体）；结构/键/标题/tip/多页拆分不虚构。
// layout: 0=Default 1=SafeTxCreate 2=FinalConfirm 3=7702 4=Flat（同 ViewSignLayout）。
#include "demo_catalog.h"

#include <txdetails_keys.h>

// 通用演示地址（公开可辨识样例）
#define A_BTC    "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
#define A_EVM_F  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
#define A_EVM_T  "0x28C6c06298d514Db089934071355E5743bf21d60"
#define A_USDT   "0xdac17f958d2ee523a2206206994597c13d831ec7"
#define A_SOL_F  "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"
#define A_SOL_T  "7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV"
#define A_TRX_F  "TJYeasTPa6gpEEfYYrhSbZjnAofYr5xs8R"
#define A_TRX_T  "TN3W4H6rK2ce4vX9YnFQHwKENnHjoxb3m9"

#define TIP_UNKNOWN_TX "Unknown Transaction"
#define TIP_UNRECOGNIZED_TOKEN "This token is not recognized by the hardware wallet. Please verify carefully."

// ════════ Bitcoin（LTC/DOGE/BCH 同流程；全部发送页 LayoutFlat + Continue，
//           单一滑动门是末尾 FinalConfirm；无 From 行（UTXO））════════
static const demo_row_t R_BTC_OUTPUT[] = {
    {TXDETAILS_KEY_TO_ADDRESS, A_BTC, false},
    {TXDETAILS_KEY_NETWORK, "Bitcoin", true},
};
static const demo_row_t R_BTC_TOTAL[] = {
    {TXDETAILS_KEY_NETWORK, "Bitcoin", true},
    {TXDETAILS_KEY_FEE, "0.00002 BTC", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "0.00502 BTC", false},
};
static const demo_row_t R_BTC_MSG[] = {
    {TXDETAILS_KEY_ADDRESS, A_BTC, false},
    {TXDETAILS_KEY_MESSAGE, "Hello OneKey", false},
    {TXDETAILS_KEY_NETWORK, "Bitcoin", true},
};
static const demo_row_t R_BTC_OMNI[] = {
    {TXDETAILS_KEY_NETWORK, "Bitcoin", true},
    {TXDETAILS_KEY_MESSAGE, "Simple send of 100.0 USDT", false},
};
// AuthorizeCoinJoin 单页：Coin Name（非 Network 行，无图标）
static const demo_row_t R_BTC_CJ_AUTH[] = {
    {TXDETAILS_KEY_MESSAGE, "Do you really want to take part in a CoinJoin transaction at: https://wasabiwallet.io", false},
    {TXDETAILS_KEY_COIN_NAME, "Bitcoin", false},
    {TXDETAILS_KEY_MAXIMUM_ROUNDS, "500", false},
    {TXDETAILS_KEY_MAXIMUM_MINING_FEE, "18 sat/vbyte", false},
};
static const demo_row_t R_BTC_OWNERSHIP[] = {
    {TXDETAILS_KEY_MESSAGE, "Do you want to create a proof of ownership?", false},
    {TXDETAILS_KEY_DATA, "534c001900020c2df1a6b52d", false},
};
static const demo_row_t R_BTC_JOINT[] = {
    {TXDETAILS_KEY_NETWORK, "Bitcoin", true},
    {TXDETAILS_KEY_AMOUNT_YOU_SPEND, "0.1 BTC", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "0.10004 BTC", false},
};
static const demo_row_t R_EMPTY[] = {{0, "", false}};

// ════════ Ethereum（EVM；From 在 To 之前，网络行经 network_identity_row）════════
static const demo_row_t R_ETH_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_EVM_T, false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "0.05105 ETH", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 ETH", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 ETH", false},
};
// 内置非 ETH 网络（chain_id=56）：单位=BNB；e49a3935 起 BSC 有真图标
// （view_sign_page.c 别名表 "BNB Smart Chain"→evm_bnb.bin）
static const demo_row_t R_EVM_BNB_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_EVM_T, false},
    {TXDETAILS_KEY_NETWORK, "BNB Smart Chain", true},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 BNB", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "0.50105 BNB", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 BNB", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 BNB", false},
};
// 非内置网络（fb5710be 链身份认证）：Network 行回退 "Chain ID n"（无图标，
// 不再显示 "Ethereum"+ETH 图标，防网络冒充）；金额单位 UNKNOWN
static const demo_row_t R_EVM_UNKNOWN_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_EVM_T, false},
    {TXDETAILS_KEY_NETWORK, "Chain ID 10143", false},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 UNKNOWN", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "0.05105 UNKNOWN", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 UNKNOWN", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 UNKNOWN", false},
};
static const demo_row_t R_ETH_ERC20[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_EVM_T, false},
    {TXDETAILS_KEY_TOKEN_ADDRESS, A_USDT, false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "100 USDT\n0.00105 ETH", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 ETH", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 ETH", false},
};
// 未内置 ERC20（aa85453b 对齐 pro1：UNKNOWN_TOKEN symbol="UNKN" decimals=0 →
// 原始整数金额）+ TIP_UNRECOGNIZED_TOKEN 警告
static const demo_row_t R_ETH_ERC20_UNKNOWN[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_EVM_T, false},
    {TXDETAILS_KEY_TOKEN_ADDRESS, "0x4c9EDD5852cd905f086C759E8383e09bff1E68B3", false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "100000000000000000000 UNKN\n0.00105 ETH", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 ETH", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 ETH", false},
};
static const demo_row_t R_ETH_NFT[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_EVM_T, false},
    {TXDETAILS_KEY_CONTRACT_ADDRESS, "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D", false},
    {TXDETAILS_KEY_TOKEN_ID, "8817", false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 ETH", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 ETH", false},
};
// 授权：Network 行插在 Spender 后、Approve Amount 前（layout.py:103）
static const demo_row_t R_ETH_APPROVE[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_SPENDER, "0x1111111254EEB25477B68fb85Ed929f73A960582", false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_APPROVE_AMOUNT, "Unlimited USDT", false},
    {TXDETAILS_KEY_PROVIDER, "1inch", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_TOKEN_ADDRESS, A_USDT, false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 ETH", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 ETH", false},
};
// EIP-7702（91ca1458 Layout7702 双 tab 表）：Overview 用 Account/Delegate to/
// Delegate on Network；Details 用 Account/Delegate To(地址)/Value/Nonce/网络
// (名称/链ID)/费三行。行按发出序，FG 表跨 tab 认领。
static const demo_row_t R_ETH_7702[] = {
    {TXDETAILS_KEY_ACCOUNT, A_EVM_F, false},
    {TXDETAILS_KEY_DELEGATE_TO_PROVIDER, "MetaMask", true},
    {TXDETAILS_KEY_DELEGATE_ON_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_ACCOUNT, A_EVM_F, false},
    {TXDETAILS_KEY_DELEGATE_TO, "0x63c0c19a282a1B52b07dD5a65b58948A07DAE32B", false},
    {TXDETAILS_KEY_VALUE, "0 ETH", false},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_DELEGATE_ON_NETWORK, "Ethereum/1", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_MAX_FEE_PER_GAS, "0.00000005 ETH", false},
    {TXDETAILS_KEY_PRIORITY_FEE, "0.000000002 ETH", false},
};
static const demo_row_t R_ETH_SAFE_TX[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, "0x3E5c63644E683549055b9Be8653de26E0B4CD36E", false},
    {TXDETAILS_KEY_MESSAGE, "execTransaction", false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_NONCE, "42", false},
    {TXDETAILS_KEY_MAX_FEE, "0.00105 ETH", false},
    {TXDETAILS_KEY_MESSAGE, "Target: 0x28C6c06298d514Db089934071355E5743bf21d60", false},
    {TXDETAILS_KEY_TOTAL, "0.1 ETH", false},
    {TXDETAILS_KEY_MESSAGE, "Operation: CALL", false},
};
static const demo_row_t R_ETH_SAFE_CREATE[] = {
    {TXDETAILS_KEY_VALUE, "0.5 ETH", false},
    {TXDETAILS_KEY_TO_ADDRESS, "0x3E5c63644E683549055b9Be8653de26E0B4CD36E", false},
    {TXDETAILS_KEY_SIGNER, A_EVM_F, false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
    {TXDETAILS_KEY_OPERATION, "0 (CALL)", false},
    {TXDETAILS_KEY_NONCE, "0", false},
    {TXDETAILS_KEY_VERIFYING_CONTRACT, "0x3E5c63644E683549055b9Be8653de26E0B4CD36E", false},
    {TXDETAILS_KEY_DOMAIN_HASH, "0x88fbc465dedd7fe71b7baef26a1f46cdaadd50b95c77cbe88569195a9fe589ab", false},
    {TXDETAILS_KEY_MESSAGE_HASH, "0xd2c3746fa77e35c8ee6b6f5b93b7a05d8db2fce9ccb44a3cb6d4d301c945d770", false},
    {TXDETAILS_KEY_SAFE_TX_HASH, "0x50be999a52c5be1f21ea29d91525aa0f6a5cf687b3ab6bb974c8bce4a04c8e3e", false},
    {TXDETAILS_KEY_SAFE_TX_GAS, "0", false},
    {TXDETAILS_KEY_BASE_GAS, "0", false},
    {TXDETAILS_KEY_GAS_PRICE, "0 ETH", false},
    {TXDETAILS_KEY_GAS_TOKEN, "0x0000000000000000000000000000000000000000", false},
    {TXDETAILS_KEY_REFUND_RECEIVER, "0x0000000000000000000000000000000000000000", false},
};
static const demo_row_t R_ETH_MSG[] = {
    {TXDETAILS_KEY_ADDRESS, A_EVM_F, false},
    {TXDETAILS_KEY_MESSAGE, "Welcome to OpenSea!\n\nClick to sign in and accept the Terms of Service.", false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
};
static const demo_row_t R_ETH_712_WARN[] = {
    {TXDETAILS_KEY_MESSAGE, "Permit", false},
};
static const demo_row_t R_ETH_712_DOMAIN[] = {
    {TXDETAILS_KEY_DOMAIN_NAME, "USD Coin", false},
    {TXDETAILS_KEY_DOMAIN_VERSION, "2", false},
    {TXDETAILS_KEY_DOMAIN_CHAIN_ID, "1", false},
    {TXDETAILS_KEY_DOMAIN_VERIFYING_CONTRACT, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", false},
};
static const demo_row_t R_ETH_712_STRUCT[] = {
    {TXDETAILS_KEY_STRUCT_NAME, "Permit", false},
};
static const demo_row_t R_ETH_712_VALUE[] = {
    {TXDETAILS_KEY_TYPED_DATA_FIELD, "spender (address)", false},
    {TXDETAILS_KEY_MESSAGE, "0x1111111254EEB25477B68fb85Ed929f73A960582", false},
};
static const demo_row_t R_ETH_712_HASH[] = {
    {TXDETAILS_KEY_DOMAIN_SEPARATOR_HASH,
     "0x06c37168a7db5138defc7866392bb87a741f9b3d104deb5094588ce041cae335", false},
    {TXDETAILS_KEY_MESSAGE_HASH, "0xc52c0ee5d84264471806290a3f2c4cecfc5490626bf912d01f240d7a274b371e", false},
};
static const demo_row_t R_ETH_712_HASH_FINAL[] = {
    {TXDETAILS_KEY_MESSAGE, "Do you want to sign this typed hash?", false},
    {TXDETAILS_KEY_NETWORK, "Ethereum", true},
};

// ════════ Conflux ════════
static const demo_row_t R_CFX_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "cfx:aarc9abycue0hhzgyrr53m6cxedgccrmmyybjgh4xg", false},
    {TXDETAILS_KEY_TO_ADDRESS, "cfx:aak2rra2njvd77ezwjvx04kkds9fzagfe6ku8scz91", false},
    {TXDETAILS_KEY_NETWORK, "Conflux", true},
    {TXDETAILS_KEY_MAX_FEE, "0.0021 CFX", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "100.0021 CFX", false},
};
static const demo_row_t R_CFX_UNKNOWN_TOKEN[] = {
    {TXDETAILS_KEY_ADDRESS, "cfx:acepe88unk7fvs18436178up33hb4zkuf62a9dk1gv", false},
};
static const demo_row_t R_CFX_MSG[] = {
    {TXDETAILS_KEY_ADDRESS, "cfx:aarc9abycue0hhzgyrr53m6cxedgccrmmyybjgh4xg", false},
    {TXDETAILS_KEY_MESSAGE, "Hello Conflux", false},
    {TXDETAILS_KEY_NETWORK, "Conflux", true},
};
static const demo_row_t R_CFX_CIP23[] = {
    {TXDETAILS_KEY_ADDRESS, "cfx:aarc9abycue0hhzgyrr53m6cxedgccrmmyybjgh4xg", false},
    {TXDETAILS_KEY_MESSAGE,
     "domain_hash: 0x9c8f5be9b6b3ff6d5b8f6ee1d2b7c33e7f3e1c25a06e08f5c2ac0e1a7a83b0f4\n"
     "message_hash: 0x0e1d2c3b4a5968778695a4b3c2d1e0f0e1d2c3b4a5968778695a4b3c2d1e0f0e",
     false},
    {TXDETAILS_KEY_NETWORK, "Conflux", true},
};

// ════════ Tron（内容页 Continue，末尾 FinalConfirm 滑动门）════════
static const demo_row_t R_TRX_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_TRX_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_TRX_T, false},
    {TXDETAILS_KEY_NETWORK, "Tron", true},
};
static const demo_row_t R_TRX_UNKNOWN_TOKEN[] = {
    {TXDETAILS_KEY_ADDRESS, "TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf", false},
};
static const demo_row_t R_TRX_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_FROM_ADDRESS, A_TRX_F, false},
    {TXDETAILS_KEY_SIZE, "68 bytes", false},
    {TXDETAILS_KEY_DATA,
     "0x095ea7b3000000000000000000000000e95812e07c206b30ae4b586ce6c5e5099f5c7ac2"
     "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
     false},
    {TXDETAILS_KEY_NETWORK, "Tron", true},
};
static const demo_row_t R_TRX_FREEZE[] = {
    {TXDETAILS_KEY_TYPE, "Freeze Balance V2 Contract", false},
    {TXDETAILS_KEY_FROM_ADDRESS, A_TRX_F, false},
    {TXDETAILS_KEY_AMOUNT, "1000 TRX", false},
    {TXDETAILS_KEY_RESOURCE, "Energy", false},
    {TXDETAILS_KEY_NETWORK, "Tron", true},
};
// 投票（无 Network 行——真机当前如此）
static const demo_row_t R_TRX_VOTE[] = {
    {TXDETAILS_KEY_TYPE, "Vote for Witness", false},
    {TXDETAILS_KEY_VOTER, A_TRX_F, false},
    {TXDETAILS_KEY_CANDIDATE, "TGj1Ej1qRzL9feLTLhjwgxXF4Ct6GTWg2U", false},
    {TXDETAILS_KEY_VOTE_COUNT, "1000", false},
};
static const demo_row_t R_TRX_MSG[] = {
    {TXDETAILS_KEY_ADDRESS, A_TRX_F, false},
    {TXDETAILS_KEY_MESSAGE, "Hello TRON", false},
    {TXDETAILS_KEY_NETWORK, "Tron", true},
};

// ════════ Solana（内容页 Continue，末尾 FinalConfirm；无 Path 行）════════
static const demo_row_t R_SOL_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, A_SOL_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_SOL_T, false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
    {TXDETAILS_KEY_FEE_PAYER, A_SOL_F, false},
};
static const demo_row_t R_SOL_SPL_UNKNOWN[] = {
    {TXDETAILS_KEY_MINT_ADDRESS, "3iQL8BFS2vE7mww4ehAqQHAsbmRNCrPxizWAT2Zfyr9y", false},
    {TXDETAILS_KEY_FROM_ADDRESS, A_SOL_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_SOL_T, false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
    {TXDETAILS_KEY_SIGNER, "GmFcbXvVDTqWMEVFBX6ZKUmG5CNSKKDYw8jCTfwHNRJh", false},
    {TXDETAILS_KEY_FEE_PAYER, A_SOL_F, false},
};
static const demo_row_t R_SOL_ATA[] = {
    {TXDETAILS_KEY_ADDRESS, "Bii3ReAT2LqYVWnyQPbmSJWqhehcT72zSuu6LAgpjcFQ", false},
    {TXDETAILS_KEY_FROM_ADDRESS, A_SOL_F, false},
    {TXDETAILS_KEY_TO_ADDRESS, A_SOL_T, false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
    {TXDETAILS_KEY_TOKEN_ADDRESS, "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", false},
};
static const demo_row_t R_SOL_MEMO[] = {
    {TXDETAILS_KEY_ADDRESS, A_SOL_F, false},
    {TXDETAILS_KEY_MEMO, "order #20260707", false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
};
// Solana 自建盲签（非 blind_sign 模板）：FeePayer + Format + Network + 裸 hex Data
// （无 Size、无 0x 前缀）。Data 超 5 行折叠 View Data。
static const demo_row_t R_SOL_BLIND[] = {
    {TXDETAILS_KEY_FEE_PAYER, A_SOL_F, false},
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
    {TXDETAILS_KEY_DATA,
     "01000205c8d842a2f17fd7aab608ce2ea535a6e958dffa20caf669b347b911c4171965530f957620b228bae2b94c82ddd4"
     "c093983a67365555b737ec7ddc1117e61c72e06ddf6e1d765a193d9cbe146ceeb79ac1cb485ed5f5b37913a8cf5857eff0"
     "0a90000000000000000000000000000000000000000000000000000000000000000000306466fe5211732ffecadba72c39"
     "be7bc8ce5bbc5f7126b2c439b3a4000000004", false},
};
static const demo_row_t R_SOL_OFFCHAIN[] = {
    {TXDETAILS_KEY_ADDRESS, A_SOL_F, false},
    {TXDETAILS_KEY_MESSAGE, "Sign in to Magic Eden", false},
    {TXDETAILS_KEY_APP_DOMAIN, "GfKcs5DmDfBhqfKuxsoKvFT4TU4RTs59TN2RfQaEJPmU", false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
};
static const demo_row_t R_SOL_UNSAFE[] = {
    {TXDETAILS_KEY_ADDRESS, A_SOL_F, false},
    {TXDETAILS_KEY_MESSAGE, "0xa1b2c3d4e5f60718293a4b5c6d7e8f90", false},
    {TXDETAILS_KEY_NETWORK, "Solana", true},
};

// ════════ TON ════════
static const demo_row_t R_TON_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "UQBFz01R2CU7YA8pevYaNIu3e0vyw3zwFn6HP7pFUFHJIK3M", false},
    {TXDETAILS_KEY_TO_ADDRESS, "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs", false},
    {TXDETAILS_KEY_NETWORK, "Ton", true},
    {TXDETAILS_KEY_COMMENT, "gm", false},
};
static const demo_row_t R_TON_UNKNOWN_TOKEN[] = {
    {TXDETAILS_KEY_TOKEN_ADDRESS, "EQBynBO23ywHy_CgarY9NK9FTz0yDsG82PtcbSTQgGoXwiuA", false},
};
static const demo_row_t R_TON_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_ADDRESS, "UQBFz01R2CU7YA8pevYaNIu3e0vyw3zwFn6HP7pFUFHJIK3M", false},
    {TXDETAILS_KEY_SIZE, "112 bytes", false},
    {TXDETAILS_KEY_DATA, "0xb5ee9c724101030100e60002cf8801144a1069a05ecc6e909d1e688ac97682f883e01f38", false},
    {TXDETAILS_KEY_NETWORK, "Ton", true},
};
static const demo_row_t R_TON_PROOF[] = {
    {TXDETAILS_KEY_ADDRESS, "UQBFz01R2CU7YA8pevYaNIu3e0vyw3zwFn6HP7pFUFHJIK3M", false},
    {TXDETAILS_KEY_NETWORK, "Ton", true},
    {TXDETAILS_KEY_APP_DOMAIN, "ton.org", false},
    {TXDETAILS_KEY_COMMENT, "ton-proof-item-v2", false},
};

// ════════ Sui / Aptos（一律盲签，blind_sign 模板 + Network 行）════════
static const demo_row_t R_SUI_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_ADDRESS, "0xc4173a804406a365e69dfb297d4eaaf002546ebd21396e731b8caf9c9b78878b", false},
    {TXDETAILS_KEY_SIZE, "40 bytes", false},
    {TXDETAILS_KEY_DATA, "0x000000000002002086ba5d61b17f1b1806b224e10a0b8503c852b4f52149ebca9ae90e4d0c53f2ba", false},
    {TXDETAILS_KEY_NETWORK, "Sui", true},
};
static const demo_row_t R_SUI_MSG[] = {
    {TXDETAILS_KEY_ADDRESS, "0xc4173a804406a365e69dfb297d4eaaf002546ebd21396e731b8caf9c9b78878b", false},
    {TXDETAILS_KEY_MESSAGE, "Sign in to Sui Wallet", false},
    {TXDETAILS_KEY_NETWORK, "Sui", true},
};
static const demo_row_t R_APT_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_ADDRESS, "0x1cf3a87c9b6f2e4d5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b", false},
    {TXDETAILS_KEY_SIZE, "32 bytes", false},
    {TXDETAILS_KEY_DATA, "0xb5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193", false},
    {TXDETAILS_KEY_NETWORK, "Aptos", true},
};
static const demo_row_t R_APT_MSG[] = {
    {TXDETAILS_KEY_ADDRESS, "0x1cf3a87c9b6f2e4d5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b", false},
    {TXDETAILS_KEY_MESSAGE, "APTOS\nmessage: Welcome to Petra\nnonce: 12345", false},
    {TXDETAILS_KEY_NETWORK, "Aptos", true},
};
static const demo_row_t R_APT_SIWA[] = {
    {TXDETAILS_KEY_ADDRESS, "0x1cf3a87c9b6f2e4d5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b", false},
    {TXDETAILS_KEY_MESSAGE, "aptoslabs.com wants you to sign in with your Aptos account", false},
    {TXDETAILS_KEY_NETWORK, "Aptos", true},
};

// ════════ Near ════════
static const demo_row_t R_NEAR_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de", false},
    {TXDETAILS_KEY_TO_ADDRESS, "alice.near", false},
    {TXDETAILS_KEY_NETWORK, "Near", true},
};
static const demo_row_t R_NEAR_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_FROM_ADDRESS, "98793cd91a3f870fb126f66285808c7e094afcfc4eda8a970f6648cdf0dbd6de", false},
    {TXDETAILS_KEY_SIZE, "47 bytes", false},
    {TXDETAILS_KEY_DATA, "0x09000000616c6963652e6e65617200917b3d268d4b58f7fec1b150bd68d69be3ee5d4cc39855e341538465bb77860d", false},
    {TXDETAILS_KEY_NETWORK, "Near", true},
};

// ════════ Polkadot（Network 行值=链名，动态）════════
static const demo_row_t R_DOT_TRANSFER[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5", false},
    {TXDETAILS_KEY_TO_ADDRESS, "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3", false},
    {TXDETAILS_KEY_NETWORK, "Polkadot", true},
};
static const demo_row_t R_DOT_KEEPALIVE[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5", false},
    {TXDETAILS_KEY_TO_ADDRESS, "14E5nqKAp3oAJcmzgZhUD2RcptBeUBScxKHgJKU4HPNcKVf3", false},
    {TXDETAILS_KEY_METHOD, "TransferKeepAlive", false},
    {TXDETAILS_KEY_NETWORK, "Polkadot", true},
};
static const demo_row_t R_DOT_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_ADDRESS, "15oF4uVJwmo4TdGW7VfQxNLavjCXviqxT9S1MgbjMNHr6Sp5", false},
    {TXDETAILS_KEY_SIZE, "41 bytes", false},
    {TXDETAILS_KEY_DATA, "0x0700aa0f7cf7a4d8be966bad51e8bb1e288aaad8e5e26327ec9dbb2d1497e0837d450b00a0724e1809", false},
    {TXDETAILS_KEY_NETWORK, "Polkadot", true},
};

// ════════ Cosmos（已识别链 Network 行=链名+图标；未识别回退 Chain ID）════════
static const demo_row_t R_ATOM_SEND[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "cosmos1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u2lcnj0", false},
    {TXDETAILS_KEY_TO_ADDRESS, "cosmos1qy352eufqy352eufqy352eufqy35qqqejrxws", false},
    {TXDETAILS_KEY_MAX_FEE, "0.005 ATOM", false},
    {TXDETAILS_KEY_NETWORK, "Cosmos Hub", true},
    {TXDETAILS_KEY_MEMO, "OneKey", false},
};
static const demo_row_t R_ATOM_DELEGATE[] = {
    {TXDETAILS_KEY_VALIDATOR, "cosmosvaloper1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u2lcnj0", false},
    {TXDETAILS_KEY_DELEGATOR, "cosmos1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u2lcnj0", false},
    {TXDETAILS_KEY_MAX_FEE, "0.005 ATOM", false},
    {TXDETAILS_KEY_NETWORK, "Cosmos Hub", true},
};
static const demo_row_t R_ATOM_VOTE[] = {
    {TXDETAILS_KEY_ADDRESS, "cosmos1sjllsnramtg3ewxqwwrwjxfgc4n4ef9u2lcnj0", false},
    {TXDETAILS_KEY_MAX_FEE, "0.005 ATOM", false},
    {TXDETAILS_KEY_MESSAGE, "proposal_id: 848", false},
    {TXDETAILS_KEY_MESSAGE, "option: VOTE_OPTION_YES", false},
    {TXDETAILS_KEY_NETWORK, "Cosmos Hub", true},
};

// ════════ Ripple ════════
static const demo_row_t R_XRP_SEND[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh", false},
    {TXDETAILS_KEY_TO_ADDRESS, "rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT", false},
    {TXDETAILS_KEY_NETWORK, "Ripple", true},
    {TXDETAILS_KEY_MAX_FEE, "0.000012 XRP", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "500.000012 XRP", false},
    {TXDETAILS_KEY_TAG, "12345", false},
};

// ════════ Cardano（99ea6e3f 启用；properties 页 Continue，唯一滑动门=FinalConfirm）════════
static const demo_row_t R_ADA_SEND[] = {
    {TXDETAILS_KEY_TO_ADDRESS,
     "addr1q84sh2j72ux0l03fxndjnhctdg7hcppsaejafsa84vh7lwgmcs5wgus8qt4atk45lvt4xfxpjtwfhdmvchdf2m3u3hlsd5tq5r", false},
    {TXDETAILS_KEY_NETWORK, "Cardano", true},
};
static const demo_row_t R_ADA_TX[] = {
    {TXDETAILS_KEY_MESSAGE, "Transaction fee: 0.171045 ADA", false},
    {TXDETAILS_KEY_MESSAGE, "Valid since: 118576739", false},
    {TXDETAILS_KEY_MESSAGE, "TTL: 118583939", false},
    {TXDETAILS_KEY_NETWORK, "Cardano", true},
};
static const demo_row_t R_ADA_CERT[] = {
    {TXDETAILS_KEY_MESSAGE, "Transaction type: Stake delegation", false},
    {TXDETAILS_KEY_MESSAGE, "for account #1:", false},
    {TXDETAILS_KEY_MESSAGE, "To pool: pool1z5uqdk7dzdxaae5633fqfcu2eqzy3a3rgtuvy087fdld7yws0xt", false},
};
static const demo_row_t R_ADA_MSG[] = {
    {TXDETAILS_KEY_ADDRESS,
     "addr1q84sh2j72ux0l03fxndjnhctdg7hcppsaejafsa84vh7lwgmcs5wgus8qt4atk45lvt4xfxpjtwfhdmvchdf2m3u3hlsd5tq5r", false},
    {TXDETAILS_KEY_MESSAGE, "Hello Cardano", false},
    {TXDETAILS_KEY_NETWORK, "Cardano", true},
};

// ════════ Algorand ════════
static const demo_row_t R_ALGO_PAY[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "6ZHGHH5Z5CTPCF5WCESXMGRSVK7QJETR63M3NY5FJCUYDHO57VTCMJOBGY", false},
    {TXDETAILS_KEY_TO_ADDRESS, "ZW3ISEHZUHPO7OZGMKLKIIMKVICOUDRCERI454I3DB2BH52HGLSO67W754", false},
    {TXDETAILS_KEY_NETWORK, "Algorand", true},
    {TXDETAILS_KEY_MAX_FEE, "0.001 ALGO", false},
    {TXDETAILS_KEY_MEMO, "Note: hello", false},
};
static const demo_row_t R_ALGO_ASSET[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "6ZHGHH5Z5CTPCF5WCESXMGRSVK7QJETR63M3NY5FJCUYDHO57VTCMJOBGY", false},
    {TXDETAILS_KEY_TO_ADDRESS, "ZW3ISEHZUHPO7OZGMKLKIIMKVICOUDRCERI454I3DB2BH52HGLSO67W754", false},
    {TXDETAILS_KEY_NETWORK, "Algorand", true},
    {TXDETAILS_KEY_MAX_FEE, "0.001 ALGO", false},
    {TXDETAILS_KEY_ASSET, "Asset ID: 31566704", false},
};
static const demo_row_t R_ALGO_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_ADDRESS, "6ZHGHH5Z5CTPCF5WCESXMGRSVK7QJETR63M3NY5FJCUYDHO57VTCMJOBGY", false},
    {TXDETAILS_KEY_SIZE, "37 bytes", false},
    {TXDETAILS_KEY_DATA, "0x8aa3616d74ce002dc6c0a3666565cd03e8a26676ce02f9c95ca367656eac6d61696e6e65", false},
    {TXDETAILS_KEY_NETWORK, "Algorand", true},
};

// ════════ Filecoin ════════
static const demo_row_t R_FIL_SEND[] = {
    {TXDETAILS_KEY_FROM_ADDRESS, "f1zlkjwo5pnm6petm4u4luj35nrs2f2spglpuqvsi", false},
    {TXDETAILS_KEY_TO_ADDRESS, "f1abjxfbp274xpdqcpuaykwkfb43omjotacm2p3za", false},
    {TXDETAILS_KEY_NETWORK, "Filecoin", true},
    {TXDETAILS_KEY_GAS_LIMIT, "2154824", false},
    {TXDETAILS_KEY_GAS_FEE_CAP, "0.00000015 FIL", false},
    {TXDETAILS_KEY_GAS_PREMIUM, "0.00000012 FIL", false},
    {TXDETAILS_KEY_TOTAL_AMOUNT, "12.000000323223 FIL", false},
};

// ════════ Kaspa ════════
static const demo_row_t R_KAS_BLIND[] = {
    {TXDETAILS_KEY_FORMAT, "Unknown", false},
    {TXDETAILS_KEY_ADDRESS, "kaspa:qqkqkzjvr7zwxxmnp7q9z8xk6cvk7g4x9tqmrjc8e6dhqxk4jkl5wkjw97kq7", false},
    {TXDETAILS_KEY_SIZE, "32 bytes", false},
    {TXDETAILS_KEY_DATA, "0xa0b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9", false},
    {TXDETAILS_KEY_NETWORK, "Kaspa", true},
};

// ════════ Nostr（无 Path 行；事件/schnorr 有 Network 行，加解密无）════════
static const demo_row_t R_NOSTR_EVENT[] = {
    {TXDETAILS_KEY_ADDRESS, "npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9", false},
    {TXDETAILS_KEY_MESSAGE, "{\"kind\":1,\"content\":\"gm nostr\",\"created_at\":1719000000}", false},
    {TXDETAILS_KEY_NETWORK, "Nostr", true},
};
static const demo_row_t R_NOSTR_SCHNORR[] = {
    {TXDETAILS_KEY_ADDRESS, "npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9", false},
    {TXDETAILS_KEY_MESSAGE, "5f0c2b7e9a4d1836c4f5e6a7b8091a2b3c4d5e6f708192a3b4c5d6e7f8091a2b", false},
    {TXDETAILS_KEY_NETWORK, "Nostr", true},
};

const demo_catalog_page_t DEMO_CATALOG[] = {
    // ── Bitcoin 系（发送流：output/total 页 Continue+Flat，btc-final 滑动收尾）──
    {"btc-send-output", "Bitcoin", "SignTx", "Send", "0.005 BTC", NULL, SIGN_TIP_NONE, R_BTC_OUTPUT, 2,
     .continue_btn = true, .layout = 4},
    {"btc-send-total", "Bitcoin", "SignTx", "Send", "0.005 BTC", NULL, SIGN_TIP_NONE, R_BTC_TOTAL, 3,
     .continue_btn = true, .layout = 4},
    {"btc-omni-output", "Bitcoin", "SignTx", "OMNI transaction", NULL, NULL, SIGN_TIP_NONE, R_BTC_OMNI, 2,
     .continue_btn = true, .layout = 4},
    {"btc-joint-total", "Bitcoin", "SignTx(CoinJoin)", "Sign Bitcoin Joint Transaction", NULL, NULL, SIGN_TIP_NONE,
     R_BTC_JOINT, 3, .continue_btn = true, .layout = 4},
    {"btc-final", "Bitcoin", "SignTx", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_EMPTY, 0, .layout = 2},
    {"btc-coinjoin-auth", "Bitcoin", "AuthorizeCoinJoin", "Authorize CoinJoin", NULL, NULL, SIGN_TIP_NONE,
     R_BTC_CJ_AUTH, 4},
    {"btc-ownership-proof", "Bitcoin", "GetOwnershipProof", "Proof of ownership", NULL, NULL, SIGN_TIP_NONE,
     R_BTC_OWNERSHIP, 2},
    {"btc-sign-message", "Bitcoin", "SignMessage", "Sign Bitcoin Message", NULL, NULL, SIGN_TIP_NONE, R_BTC_MSG, 3,
     .layout = 4},

    // ── Ethereum / EVM ──
    {"eth-transfer", "Ethereum", "EthereumSignTxEIP1559OneKey", "Send", "0.05 ETH", NULL, SIGN_TIP_NONE,
     R_ETH_TRANSFER, 8},
    {"evm-bnb-transfer", "Ethereum", "EthereumSignTxEIP1559OneKey", "Send", "0.5 BNB", NULL, SIGN_TIP_NONE,
     R_EVM_BNB_TRANSFER, 8},
    {"evm-unknown-transfer", "Ethereum", "EthereumSignTxEIP1559OneKey", "Send", "0.05 UNKNOWN", NULL, SIGN_TIP_NONE,
     R_EVM_UNKNOWN_TRANSFER, 8},
    {"eth-erc20", "Ethereum", "EthereumSignTxEIP1559OneKey", "Send", "100 USDT", NULL, SIGN_TIP_NONE, R_ETH_ERC20, 9},
    {"eth-erc20-unknown", "Ethereum", "EthereumSignTxEIP1559OneKey", "Send", "100000000000000000000 UNKN",
     TIP_UNRECOGNIZED_TOKEN, SIGN_TIP_WARNING, R_ETH_ERC20_UNKNOWN, 9},
    {"eth-nft", "Ethereum", "EthereumSignTxEIP1559OneKey", "Send", "1 NFT", NULL, SIGN_TIP_NONE, R_ETH_NFT, 9},
    {"eth-approve", "Ethereum", "EthereumSignTx(EIP1559)OneKey", "Approve unlimited USDT for 1inch", NULL,
     "This action grants the contract unlimited access to this asset. Trust the dApp before proceeding.",
     SIGN_TIP_WARNING, R_ETH_APPROVE, 10},
    {"eth-safe-tx", "Ethereum", "EthereumSignTx(EIP1559)OneKey", "Gnosis Safe", NULL, NULL, SIGN_TIP_NONE,
     R_ETH_SAFE_TX, 9},
    {"eth-safe-create", "Ethereum", "EthereumSignTypedDataOneKey(SafeTx)", "Confirm Safe Transaction", NULL, NULL,
     SIGN_TIP_NONE, R_ETH_SAFE_CREATE, 15, .layout = 1,
     .raw_data = "0xa9059cbb00000000000000000000000028c6c06298d514db089934071355e5743bf21d60"
                 "00000000000000000000000000000000000000000000000000000005f5e100"},
    {"eth-7702-upgrade", "Ethereum", "EthereumSignTxEIP7702OneKey", "7702 Upgrade", NULL,
     "You are upgrading this account to MetaMask smart account. Sign only if you understand the risks.",
     SIGN_TIP_DANGER, R_ETH_7702, 11, .layout = 3},
    {"eth-sign-message", "Ethereum", "EthereumSignMessageOneKey", "Sign Ethereum Message", NULL, NULL, SIGN_TIP_NONE,
     R_ETH_MSG, 3, .layout = 4},
    // ── EIP-712 门禁流：warning/domain/message(三态)/value 页 Continue，final=FinalConfirm ──
    {"eth-712-warning", "Ethereum", "EthereumSignTypedDataOneKey", "Ethereum Typed Data", NULL,
     "You are using Permit authorization, ensure the dApp is trustworthy to avoid asset loss.", SIGN_TIP_WARNING,
     R_ETH_712_WARN, 1, .continue_btn = true},
    {"eth-712-domain", "Ethereum", "EthereumSignTypedDataOneKey", "Ethereum Typed Data", NULL, NULL, SIGN_TIP_NONE,
     R_ETH_712_DOMAIN, 4, .continue_btn = true},
    {"eth-712-message", "Ethereum", "EthereumSignTypedDataOneKey", "Confirm Message", NULL, NULL, SIGN_TIP_NONE,
     R_ETH_712_STRUCT, 1, .continue_btn = true,
     .raw_data = "Contains 5 keys: owner, spender, value, nonce, deadline"},
    {"eth-712-value", "Ethereum", "EthereumSignTypedDataOneKey", "Permit", NULL, NULL, SIGN_TIP_NONE,
     R_ETH_712_VALUE, 2, .continue_btn = true},
    {"eth-712-final", "Ethereum", "EthereumSignTypedDataOneKey", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE,
     R_EMPTY, 0, .layout = 2},
    {"eth-712-hash", "Ethereum", "EthereumSignTypedHashOneKey", "Ethereum Typed Hash", NULL,
     "Signing this message may have security risk. Only sign these on sites you fully trust.", SIGN_TIP_WARNING,
     R_ETH_712_HASH, 2, .continue_btn = true},
    {"eth-712-hash-final", "Ethereum", "EthereumSignTypedHashOneKey", "Sign Ethereum Typed Hash", NULL, NULL,
     SIGN_TIP_NONE, R_ETH_712_HASH_FINAL, 2, .layout = 4},

    // ── Conflux ──
    {"cfx-transfer", "Conflux", "ConfluxSignTx", "Send", "100 CFX", NULL, SIGN_TIP_NONE, R_CFX_TRANSFER, 5},
    {"cfx-unknown-token", "Conflux", "ConfluxSignTx", "Unknown Token", NULL, TIP_UNRECOGNIZED_TOKEN, SIGN_TIP_WARNING,
     R_CFX_UNKNOWN_TOKEN, 1, .continue_btn = true},
    {"cfx-sign-message", "Conflux", "ConfluxSignMessage", "Sign Conflux Message", NULL, NULL, SIGN_TIP_NONE,
     R_CFX_MSG, 3, .layout = 4},
    {"cfx-typed-hash", "Conflux", "ConfluxSignMessageCIP23", "Conflux Typed Hash", NULL,
     "Signing this message may have security risk. Only sign these on sites you fully trust.", SIGN_TIP_WARNING,
     R_CFX_CIP23, 3, .layout = 4},

    // ── Tron（内容页 Continue，trx-final=FinalConfirm 滑动门）──
    {"trx-transfer", "Tron", "TronSignTx", "Send", "5000 TRX", NULL, SIGN_TIP_NONE, R_TRX_TRANSFER, 3,
     .continue_btn = true},
    {"trx-trc20", "Tron", "TronSignTx", "Send", "100 USDT", NULL, SIGN_TIP_NONE, R_TRX_TRANSFER, 3,
     .continue_btn = true},
    {"trx-unknown-token", "Tron", "TronSignTx", "Unknown Token", NULL, TIP_UNRECOGNIZED_TOKEN, SIGN_TIP_WARNING,
     R_TRX_UNKNOWN_TOKEN, 1, .continue_btn = true},
    {"trx-blind", "Tron", "TronSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_TRX_BLIND, 5,
     .continue_btn = true, .layout = 4},
    {"trx-freeze", "Tron", "TronSignTx", "View Transaction", NULL, NULL, SIGN_TIP_NONE, R_TRX_FREEZE, 5,
     .continue_btn = true, .layout = 4},
    {"trx-vote", "Tron", "TronSignTx", "View Transaction", NULL, NULL, SIGN_TIP_NONE, R_TRX_VOTE, 4,
     .continue_btn = true},
    {"trx-final", "Tron", "TronSignTx", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_EMPTY, 0, .layout = 2},
    {"trx-sign-message", "Tron", "TronSignMessage", "Sign Tron Message", NULL, NULL, SIGN_TIP_NONE, R_TRX_MSG, 3,
     .layout = 4},

    // ── Solana（内容页 Continue，sol-final=FinalConfirm；无 Path 行）──
    {"sol-transfer", "Solana", "SolanaSignTx", "Send", "10 SOL", NULL, SIGN_TIP_NONE, R_SOL_TRANSFER, 4,
     .continue_btn = true},
    {"sol-spl-unknown", "Solana", "SolanaSignTx", "Send", "1000000 Lamports Token", TIP_UNRECOGNIZED_TOKEN,
     SIGN_TIP_WARNING, R_SOL_SPL_UNKNOWN, 6, .continue_btn = true},
    {"sol-create-ata", "Solana", "SolanaSignTx", "Create Token Account", NULL, NULL, SIGN_TIP_NONE, R_SOL_ATA, 5,
     .continue_btn = true},
    {"sol-memo", "Solana", "SolanaSignTx", "Memo", NULL, NULL, SIGN_TIP_NONE, R_SOL_MEMO, 3, .continue_btn = true,
     .layout = 4},
    {"sol-blind", "Solana", "SolanaSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_SOL_BLIND, 4,
     .layout = 4},
    {"sol-final", "Solana", "SolanaSignTx", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_EMPTY, 0,
     .layout = 2},
    {"sol-offchain-message", "Solana", "SolanaSignOffChainMessage", "Sign Solana Message", NULL, NULL, SIGN_TIP_NONE,
     R_SOL_OFFCHAIN, 4, .layout = 4},
    {"sol-unsafe-message", "Solana", "SolanaSignUnsafeMessage", "Sign Solana Message", NULL,
     "Risk of phishing & blind signing. Proceed only if you trust the source.", SIGN_TIP_WARNING, R_SOL_UNSAFE, 3,
     .layout = 4},

    // ── TON ──
    {"ton-transfer", "Ton", "TonSignMessage", "Send", "5 TON", NULL, SIGN_TIP_NONE, R_TON_TRANSFER, 4},
    {"ton-unknown-token", "Ton", "TonSignMessage", "Unknown Token", NULL, TIP_UNRECOGNIZED_TOKEN, SIGN_TIP_WARNING,
     R_TON_UNKNOWN_TOKEN, 1, .continue_btn = true},
    {"ton-blind", "Ton", "TonSignMessage", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_TON_BLIND, 5,
     .layout = 4},
    {"ton-proof", "Ton", "TonSignProof", "Sign TON Message", NULL, NULL, SIGN_TIP_NONE, R_TON_PROOF, 4, .layout = 4},

    // ── Sui ──
    {"sui-blind", "Sui", "SuiSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_SUI_BLIND, 5,
     .layout = 4},
    {"sui-sign-message", "Sui", "SuiSignMessage", "Sign Sui Message", NULL, NULL, SIGN_TIP_NONE, R_SUI_MSG, 3,
     .layout = 4},

    // ── Aptos ──
    {"apt-blind", "Aptos", "AptosSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_APT_BLIND, 5,
     .layout = 4},
    {"apt-sign-message", "Aptos", "AptosSignMessage", "Sign Aptos Message", NULL, NULL, SIGN_TIP_NONE, R_APT_MSG, 3,
     .layout = 4},
    {"apt-siwa-message", "Aptos", "AptosSignSIWAMessage", "Sign SIWA Message", NULL, NULL, SIGN_TIP_NONE, R_APT_SIWA,
     3, .layout = 4},

    // ── Near ──
    {"near-transfer", "Near", "NearSignTx", "Send", "30 NEAR", NULL, SIGN_TIP_NONE, R_NEAR_TRANSFER, 3},
    {"near-blind", "Near", "NearSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_NEAR_BLIND, 5,
     .layout = 4},

    // ── Polkadot ──
    {"dot-transfer", "Polkadot", "PolkadotSignTx", "Send", "50 DOT", NULL, SIGN_TIP_NONE, R_DOT_TRANSFER, 3},
    {"dot-keepalive", "Polkadot", "PolkadotSignTx", "Send", "50 DOT", NULL, SIGN_TIP_NONE, R_DOT_KEEPALIVE, 4},
    {"dot-blind", "Polkadot", "PolkadotSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING,
     R_DOT_BLIND, 5, .layout = 4},

    // ── Cosmos ──
    {"atom-send", "Cosmos", "CosmosSignTx", "Send", "100 ATOM", NULL, SIGN_TIP_NONE, R_ATOM_SEND, 5},
    {"atom-delegate", "Cosmos", "CosmosSignTx", "Delegate", "100 ATOM", NULL, SIGN_TIP_NONE, R_ATOM_DELEGATE, 4},
    {"atom-vote", "Cosmos", "CosmosSignTx", "Vote", NULL, NULL, SIGN_TIP_NONE, R_ATOM_VOTE, 5},

    // ── Ripple ──
    {"xrp-send", "Ripple", "RippleSignTx", "Send", "500 XRP", NULL, SIGN_TIP_NONE, R_XRP_SEND, 6},

    // ── Cardano ──
    {"ada-send-output", "Cardano", "CardanoSignTxInit", "Send", "1000 ADA", NULL, SIGN_TIP_NONE, R_ADA_SEND, 2,
     .continue_btn = true},
    {"ada-tx-confirm", "Cardano", "CardanoSignTxInit", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_ADA_TX, 4,
     .continue_btn = true, .layout = 4},
    {"ada-stake-cert", "Cardano", "CardanoSignTxInit", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_ADA_CERT,
     3, .continue_btn = true, .layout = 4},
    {"ada-final", "Cardano", "CardanoSignTxInit", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_EMPTY, 0,
     .layout = 2},
    {"ada-sign-message", "Cardano", "CardanoSignMessage", "Sign Cardano Message", NULL, NULL, SIGN_TIP_NONE,
     R_ADA_MSG, 3, .layout = 4},

    // ── Algorand ──
    {"algo-payment", "Algorand", "AlgorandSignTx", "Send", "300 ALGO", NULL, SIGN_TIP_NONE, R_ALGO_PAY, 5},
    {"algo-asset-xfer", "Algorand", "AlgorandSignTx", "Send", "100 USDC", NULL, SIGN_TIP_NONE, R_ALGO_ASSET, 5},
    {"algo-blind", "Algorand", "AlgorandSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING,
     R_ALGO_BLIND, 5, .layout = 4},

    // ── Filecoin ──
    {"fil-send", "Filecoin", "FilecoinSignTx", "Send", "12 FIL", NULL, SIGN_TIP_NONE, R_FIL_SEND, 7},

    // ── Kaspa（盲签页 Continue，kaspa-final=FinalConfirm）──
    {"kaspa-view-tx", "Kaspa", "KaspaSignTx", "View Transaction", NULL, TIP_UNKNOWN_TX, SIGN_TIP_WARNING, R_KAS_BLIND,
     5, .continue_btn = true, .layout = 4},
    {"kaspa-final", "Kaspa", "KaspaSignTx", "Confirm Transaction", NULL, NULL, SIGN_TIP_NONE, R_EMPTY, 0,
     .layout = 2},

    // ── Nostr ──
    {"nostr-sign-event", "Nostr", "NostrSignEvent", "Sign Nostr Message", NULL, NULL, SIGN_TIP_NONE, R_NOSTR_EVENT, 3,
     .layout = 4},
    {"nostr-schnorr", "Nostr", "NostrSignSchnorr", "Sign Nostr Message", NULL, NULL, SIGN_TIP_NONE, R_NOSTR_SCHNORR,
     3, .layout = 4},
};

const int DEMO_CATALOG_COUNT = (int)(sizeof(DEMO_CATALOG) / sizeof(DEMO_CATALOG[0]));
