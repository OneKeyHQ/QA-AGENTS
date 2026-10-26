// 阶段B 业务层符号 stub —— 全量 pages 编入后链接缺的 sys/utils/SE 符号替身
//
// 策略 b：tasks/task_foreground 的业务 .c（utils/op_client、auth_manager、
// ui_state_cache、slip39_recovery、reset_device 等）依赖 zbus/ipc channel/SE
// 协处理器，sim 无对应硬件/RTOS，一律不编入，pages 引用到的符号在此给最小假实现。
//
// 设计原则：
//   - 真机行为在每个 stub 注释里写明（SE 异步操作、PIN 校验、auth 解锁…）
//   - sim 侧给"安全空操作 / 放行 / 空数据"：让页面 on_create 能完成布局，
//     事件回调（点按钮触发 SE 操作）走到 stub 即 no-op，不崩、不卡。
//   - async 类一律返回 false（"未发起/未 pending"），调用方据此走"无操作"分支，
//     避免页面误以为有挂起的 SE 请求而等回调（回调永不来）。
//   - is_pending 一律 false（无挂起请求），cached getter 给保守默认值。
//
// 头文件直接 include 固件声明，保证 stub 签名与真机一致（签名漂移 → 编译报错兜底）。
#include <stddef.h>
#include <stdbool.h>
#include <stdint.h>
#include <string.h>

#include "slip39_recovery.h" // SLIP39_FEED_ERR_* 枚举（桩返回值随固件漂移时编译期兜底）

// ── trezor-crypto 纯算法符号（pages/factory/mnemonic、passphrase 输入页用）──
// 真机由 modules/trezor-crypto 提供（bip39.c / slip39.c / memzero.c）。
// 那几个 .c 传递依赖 hmac/sha2/pbkdf2/rand，为保持编译集精简此处给最小替身：
//   - memzero：真机安全清零（防编译器优化掉的 memset）。sim 直接 memset 即可。
//   - mnemonic_check：真机校验 BIP-39 助记词校验和。sim 无校验需求，返回 1（有效）。
//   - mnemonic_get_word：返回 BIP-39 第 index 个词。sim 给空串（仅 needs_arg 输入页用）。
//   - get_word / word_index：SLIP-39 2048 词表查询。sim 给空串 / 查不到（false）。
// 用到它们的页面（factory/mnemonic、passphrase 输入）都是 needs_arg，snapshot 跳过，
// 离线打开不会真正走到助记词校验逻辑，安全。
void memzero(void* const pnt, const size_t len) { memset(pnt, 0, len); }
int mnemonic_check(const char* mnemonic)
{
    (void)mnemonic;
    return 1;
}
const char* mnemonic_get_word(int index)
{
    (void)index;
    return "";
}
const char* get_word(uint16_t index)
{
    (void)index;
    return "";
}
bool word_index(uint16_t* index, const char* word, uint8_t word_length)
{
    (void)word;
    (void)word_length;
    if ( index )
        *index = 0;
    return false; // 词表查不到 → 输入页提示"无效词"，离线安全
}

// ── keytag_dotmap（keytag_backup 页：助记词→点阵坐标解码，依赖 bip39 词表查找）──
// 真机用 mnemonic_find_word 查词表索引算点阵。sim 的 bip39 层是桩的（见下 mnemonic_* 桩），
// 无法真实解码；keytag_backup 是 needs_arg 页（快照跳过、不会无参打开），故返回 0（解码失败，
// 缓冲清零）——与 sim 既有 bip39 桩一致，不在页面上捏造假点阵。
uint8_t keytag_dotmap_decode(const char* mnemonic, void* front, size_t* front_count, void* back,
                             size_t* back_count)
{
    (void)mnemonic;
    (void)front;
    (void)back;
    if ( front_count )
        *front_count = 0;
    if ( back_count )
        *back_count = 0;
    return 0;
}

// ── mnemonic_wordlist（factory 输入页联想用）──
// 真机返回当前 word_count 对应的词表指针 + 词数。sim 给空表（无联想）。
void mnemonic_wordlist_for_count(uint8_t word_count, const char* const** out_words, uint16_t* out_count)
{
    (void)word_count;
    if ( out_words )
        *out_words = NULL;
    if ( out_count )
        *out_count = 0;
}
bool mnemonic_wordlist_has_prefix(uint8_t word_count, const char* prefix, size_t len)
{
    (void)word_count;
    (void)prefix;
    (void)len;
    return false;
}
// 真机判断词数是否属 SLIP-39（20/33 词）。sim 给 false（按 BIP-39 处理），
// 用到的 check/restore 页都是 needs_arg，离线 snapshot 跳过。
bool mnemonic_word_count_is_slip39(uint8_t word_count)
{
    (void)word_count;
    return false;
}

// ── auth_manager（lock_screen / 设备解锁）──
// 真机管理设备锁态 + SE 会话。sim 无 SE，全部空操作 / 放行（视为已解锁/已初始化）。
void auth_manager_unlock_device(void) {}
void auth_manager_lock_se_only(void) {}
void auth_manager_mark_pin_set(void) {}
void auth_manager_mark_initialized(void) {}
// 真机锁定设备（清 SE 会话 + 回锁屏）。sim 空操作。
void auth_manager_lock_device(void) {}

// ── ui_state_cache（settings/security/findmy 等读写 BG 状态）──
// 真机经 zbus 把 UI 请求发给 BG/sysctrl 任务并缓存回执。sim 无 BG：
//   - ui_state_set_request：丢弃请求，返回 0（成功，调用方继续 UI 流程）
//   - ui_state_is_bg_ready：返回 true（BG 已就绪），避免页面卡在"等待后台"
#include <ipc/messages/msg_sysctrl.h> // Sysctrl_MsgType_t/FingerprintStatus_t（下方指纹桥桩也用）
int ui_state_set_request(Sysctrl_MsgType_t msg_type, const void* value, uint16_t value_size)
{
    (void)msg_type;
    (void)value;
    (void)value_size;
    return 0;
}
bool ui_state_is_bg_ready(void) { return true; }
// 真机读 BG 缓存的"电源管理已启用"。sim 给 false（未启用），settings 关机页走默认分支。
bool ui_state_get_power_manager_enabled(void) { return false; }

// ── ui_global_alert（findmy 搜索抽屉）──
// 真机标记 FindMy 搜索告警已被用户关闭。sim 空操作。
void ui_findmy_searching_mark_dismissed(void) {}

// ── ui_msg_queue（sign_page/uiview 审批回执）──
// 真机：UI 把签名审批结果（confirmed/cancelled）经 zbus 回给发起的 uiview 请求。
// sign_page_destroy 析构时若仍 pending 会自动回 CANCELLED。sim 无 uiview 请求：
// is_pending 恒 false（destroy 不触发回复），reply 空操作。
bool ui_uiview_is_pending(void) { return false; }
void ui_uiview_reply(int result) { (void)result; }

// ── pin_verify cached（passphrase enable 状态缓存）──
// 真机缓存"passphrase 是否启用"避免每次问 SE。sim 给固定 false（未启用）。
void pin_set_passphrase_enabled_cached(bool enabled) { (void)enabled; }
bool pin_is_passphrase_enabled_cached(void) { return false; }
// 真机判断"本次是否经 passphrase-pin 解锁进入隐藏钱包"。sim 给 false（普通解锁）。
bool pin_is_unlocked_via_passphrase_pin(void) { return false; }

// ── passphrase_runtime（lock_screen attach-pin 解锁路径）──
// 真机记录"本次解锁是否经 attach-pin 进入隐藏钱包"。sim 空操作。
void passphrase_runtime_set_unlocked_via_attach_pin(bool unlocked) { (void)unlocked; }

// ── op_client async（PIN / mnemonic / passphrase 的 SE 异步操作）──
// 真机：发布 SE 请求消息 → SE 协处理器处理 → 回执经 zbus 派发到 cb。
// sim 无 SE：一律返回 false（"未发起请求"），调用页据此走无挂起分支，cb 永不触发。
// is_pending 一律 false。这些都在按钮事件里触发，离线打开页面（仅布局）不会调用。
// main 2026-10 起直接 include 固件头（回调类型 / 签名随固件漂移时编译期兜底）
#include "mnemonic_op_client.h"
#include "pin_op_client.h"
#include "passphrase_op_client.h"

// pin_op_client
bool pin_op_verify_async(const char* pin, uint8_t pin_type, pin_op_client_cb_t cb)
{
    (void)pin;
    (void)pin_type;
    (void)cb;
    return false;
}
bool pin_op_set_async(const char* pin, pin_op_client_cb_t cb)
{
    (void)pin;
    (void)cb;
    return false;
}
bool pin_op_change_async(const char* old_pin, const char* new_pin, pin_op_client_cb_t cb)
{
    (void)old_pin;
    (void)new_pin;
    (void)cb;
    return false;
}
bool pin_op_get_retry_times_async(pin_op_client_cb_t cb)
{
    (void)cb;
    return false; // 未发起 SE 查询，verify_device_pin 页不等回调
}
bool pin_op_client_is_pending(void) { return false; }

// mnemonic_op_client
bool mnemonic_op_generate_async(uint8_t word_count, bool use_multiple_entropy, mnemonic_op_client_cb_t cb)
{
    (void)use_multiple_entropy;
    (void)word_count;
    (void)cb;
    return false;
}
bool mnemonic_op_commit_async(mnemonic_op_client_cb_t cb)
{
    (void)cb;
    return false;
}
bool mnemonic_op_verify_async(const char* mnemonic, uint16_t mnemonic_len, mnemonic_op_client_cb_t cb)
{
    (void)mnemonic;
    (void)mnemonic_len;
    (void)cb;
    return false;
}
bool mnemonic_op_generate_multi_share_async(uint8_t total_shares, uint8_t threshold, bool use_multiple_entropy, mnemonic_op_client_cb_t cb)
{
    (void)use_multiple_entropy;
    (void)total_shares;
    (void)threshold;
    (void)cb;
    return false;
}
bool mnemonic_op_stash(const char* mnemonic, uint16_t mnemonic_len)
{
    (void)mnemonic;
    (void)mnemonic_len;
    return false;
}
bool mnemonic_op_stash_slip39(const uint8_t* ems, uint8_t ems_len, uint8_t backup_type, uint16_t identifier,
                              uint8_t iteration_exponent)
{
    (void)ems;
    (void)ems_len;
    (void)backup_type;
    (void)identifier;
    (void)iteration_exponent;
    return false;
}
uint8_t mnemonic_op_get_indices(uint16_t* out_indices)
{
    (void)out_indices;
    return 0; // 0 个词缓存
}
uint8_t mnemonic_op_get_slip39_share_indices(uint8_t share_idx, uint16_t* out_indices)
{
    (void)share_idx;
    (void)out_indices;
    return 0;
}
bool mnemonic_op_client_is_pending(void) { return false; }

// passphrase_op_client
bool passphrase_op_enable_set_async(bool enable, passphrase_op_client_cb_t cb)
{
    (void)enable;
    (void)cb;
    return false;
}
bool passphrase_op_attach_async(const char* pin, const char* passphrase_pin, const char* passphrase,
                                passphrase_op_client_cb_t cb)
{
    (void)pin;
    (void)passphrase_pin;
    (void)passphrase;
    (void)cb;
    return false;
}
bool passphrase_op_detach_async(const char* passphrase_pin, passphrase_op_client_cb_t cb)
{
    (void)passphrase_pin;
    (void)cb;
    return false;
}
bool passphrase_op_pin_check_async(const char* passphrase_pin, passphrase_op_client_cb_t cb)
{
    (void)passphrase_pin;
    (void)cb;
    return false;
}
// 查询 passphrase-PIN 剩余可绑定槽位（SE 异步）。sim 无 SE → 同其它 op：未发起，返回 false。
bool passphrase_op_get_space_async(passphrase_op_client_cb_t cb)
{
    (void)cb;
    return false;
}
bool passphrase_op_client_is_pending(void) { return false; }

// ── reset_device（settings reset/erase）──
// 真机发起 SE 擦除请求。sim 返回 false（未发起），erase 页停在确认态。
bool reset_device_request(void) { return false; }
// 真机：擦除请求 + 完成回调（暴力 PIN 触发的 wipe 走此路径）。sim 返回 false（未发起）。
bool reset_device_request_cb(void (*on_done)(void))
{
    (void)on_done;
    return false;
}
// 真机擦除完成后重启设备。sim 空操作。
void reset_device_reboot(void) {}

// ── slip39_recovery（factory/mnemonic check/restore 的 SLIP-39 会话）──
// 真机维护 SLIP-39 分片恢复会话状态机。sim 无会话：begin 返回 false（无法启动），
// is_active false，其余 getter 给 0。用到的页面都是 needs_arg（恢复流），snapshot 跳过。
bool slip39_recovery_begin(bool dry_run)
{
    (void)dry_run;
    return false;
}
// slip39_recovery_feed 返回 Slip39FeedResult_t；SLIP39_FEED_ERR_STATE = "not active / bad args"，
// sim 无会话恒返回它（枚举来自固件头，值漂移编译期兜底）。
Slip39FeedResult_t slip39_recovery_feed(const uint16_t* word_indices, uint8_t word_count, uint8_t* secret_out, size_t* secret_len)
{
    (void)word_indices;
    (void)word_count;
    (void)secret_out;
    if ( secret_len )
        *secret_len = 0;
    return SLIP39_FEED_ERR_STATE;
}
// dev 2026-08 新增：续片前四个 metadata 词的预校验。sim 无会话，同 feed 恒 ERR_STATE。
Slip39FeedResult_t slip39_recovery_validate_prefix(const uint16_t* word_indices, uint8_t prefix_word_count)
{
    (void)word_indices;
    (void)prefix_word_count;
    return SLIP39_FEED_ERR_STATE;
}
void     slip39_recovery_end(void) {}
bool     slip39_recovery_is_active(void) { return false; }
// 真机：当前恢复会话是否为 extendable backup。sim 无会话恒 false。
bool     slip39_recovery_extendable(void) { return false; }
uint16_t slip39_recovery_identifier(void) { return 0; }
uint8_t  slip39_recovery_iteration_exponent(void) { return 0; }
uint8_t  slip39_recovery_group_count(void) { return 0; }
uint8_t  slip39_recovery_backup_type(void) { return 0; }
void     slip39_recovery_last_share_progress(uint8_t* group_index, uint8_t* entered, uint8_t* member_threshold)
{
    if ( group_index )
        *group_index = 0;
    if ( entered )
        *entered = 0;
    if ( member_threshold )
        *member_threshold = 0;
}

// ── slip39_generate（settings → create multi-share backup 的分片生成）──
// 真机维护 SLIP-39 分片生成上下文（从 EMS 切分出新分片集）。Slip39GenerateCtx_t
// 真定义在 utils/slip39_generate.h；此 stub 文件不 include 它，用不透明前向声明
// （C 链接不校验跨 TU 参数类型，符号名一致即可解析）。sim 不实际生成分片：
// init 清零上下文、from_ems 返回 false（未生成），用到的 multi_share_create 是
// needs_arg 流，离线 snapshot 跳过，点按钮才触发、走 false 分支不崩。
typedef struct Slip39GenerateCtx_sim Slip39GenerateCtx_t;
void slip39_generate_init(Slip39GenerateCtx_t* ctx, uint8_t share_count, uint8_t threshold, bool is_single)
{
    (void)ctx;
    (void)share_count;
    (void)threshold;
    (void)is_single;
}
bool slip39_generate_from_ems(Slip39GenerateCtx_t* ctx, const uint8_t* ems, uint8_t ems_len,
                              uint8_t iteration_exponent)
{
    (void)ctx;
    (void)ems;
    (void)ems_len;
    (void)iteration_exponent;
    return false;
}
void slip39_generate_clear(Slip39GenerateCtx_t* ctx) { (void)ctx; }

// ── my_address_session 桩（真机走 zbus/channel/nanopb 向 MP 引擎发地址派生请求）──
// 真机：session 保存当前 coin/chain/account/derive，send_request 经 channel_proto_mp
// 发 GetAddress 给 MP，回包再走 task_foreground → my_address_display_build。
// sim 无引擎：session 只做内存状态（display 页 create/refresh 读 coin_type/derive_type
// 决定标题/派生行），send_request 返回 false（未发起，调用方据此不等回包）。
#include "my_address_session.h"
static my_address_session_t s_sim_my_addr_session;
void my_address_session_reset(void) { memset(&s_sim_my_addr_session, 0, sizeof(s_sim_my_addr_session)); }
void my_address_session_init(uint32_t coin_type, uint32_t chain_id)
{
    s_sim_my_addr_session.coin_type   = coin_type;
    s_sim_my_addr_session.chain_id    = chain_id;
    s_sim_my_addr_session.derive_type = 0;
}
const my_address_session_t* my_address_session_get(void) { return &s_sim_my_addr_session; }
void my_address_session_set_derive_type(uint32_t derive_type) { s_sim_my_addr_session.derive_type = derive_type; }
void my_address_session_set_account_index(uint32_t account_index) { s_sim_my_addr_session.account_index = account_index; }
bool my_address_session_send_request(void) { return false; }

// ── ui_fingerprint_bridge 桩（真机经 zbus 镜像 BG 指纹子系统状态）──
// sim 无传感器/SE：一律呈现"未就绪、未录入、不可指纹解锁"，页面自然走 PIN/占位分支。
#include "ui_fingerprint_bridge.h"
uint32_t ui_fingerprint_alloc_request_id(void)
{
    static uint32_t s_req_id = 0;
    return ++s_req_id;
}
int ui_fingerprint_publish_request(const Fingerprint_ReqMsg_t* req) { (void)req; return -1; }
void ui_fingerprint_snapshot(Sysctrl_FingerprintStatus_t* out) { memset(out, 0, sizeof(*out)); }
bool ui_fingerprint_is_ready(void) { return false; }
bool ui_fingerprint_has_enrolled(void) { return false; }
bool ui_fingerprint_serial_number_set(void) { return false; }
bool ui_fingerprint_unlock_requires_pin(void) { return false; }
bool ui_fingerprint_unlock_eligible(void) { return false; }
bool ui_fingerprint_unlock_provisioned(void) { return false; }
void ui_fingerprint_maybe_prompt_reenroll(void) {}
uint32_t ui_fingerprint_request_runtime_init(void) { return 0; }
void ui_fingerprint_finalize_post_load(void) {}

// ── ui_state_when_bg_ready（ui_state_cache.c 业务层）──
// 真机等 BG 首包后回调；sim 视 BG 常驻就绪，立即回调。
#include "ui_state_cache.h"
void ui_state_when_bg_ready(ui_state_bg_ready_cb_t cb)
{
    if ( cb != NULL )
        cb();
}

// ── SeedCard 备份/恢复流程：dev 2026-08 重命名挪入 pages/backup/（backup_seedcard_flow.c
//    / _steps.c / _name_flow.c / backup_restore_seedcard.c），配合 nfc_trigger_* 桩后可在
//    sim 整组真实编入 —— 原 no-op 桩（seedcard_backup_start 等 9 个）已删除，避免重复符号。

// ── ui_fingerprint_receipt_take（ui_fingerprint_bridge.c）──
// sim 无指纹事件源，恒无回执。
#include "ui_fingerprint_bridge.h"
bool ui_fingerprint_receipt_take(uint32_t op_id, Fingerprint_EvtMsg_t* out)
{
    (void)op_id;
    (void)out;
    return false;
}

// ── portfolio_data（7b39e210 起依赖 vol1: 文件系统，被排除出 sim 构建）──
// homescreen 只在有数据时才渲染资产面板；sim 恒"无数据"，走空面板路径。
#include "pages/standalone/portfolio_data.h"
const UiPortfolioData_t* portfolio_data_get(void) { return NULL; }
bool portfolio_data_is_available(void) { return false; }
bool portfolio_data_ensure_loaded(void) { return false; }

// ── onboarding_backup（依赖 BG NFC 备份链，被排除出 sim 构建）──
#include "pages/onboarding/onboarding_backup.h"
void onboarding_backup_start(void) {}

// ── passkey 服务（41af156b CTAP2/U2F，依赖 FIDO 传输/SE，仅 security_keys 页查询）──
// sim 恒"无凭据、不在刷新"：security_keys 列表渲染为空态。
#include "passkey/passkey_service.h"
void passkey_discoverable_credential_request_refresh(void) {}
bool passkey_discoverable_credential_is_refreshing(void) { return false; }
uint32_t passkey_discoverable_credential_get_version(void) { return 0; }
size_t passkey_discoverable_credential_get_count(void) { return 0; }
const PasskeyDiscoverableCredentialSummary_t* passkey_discoverable_credential_get(size_t index)
{
    (void)index;
    return NULL;
}
const PasskeyDiscoverableCredentialSummary_t* passkey_discoverable_credential_find_slot(uint32_t slot_index)
{
    (void)slot_index;
    return NULL;
}
bool passkey_discoverable_credential_get_credential_id(
    size_t index, uint8_t credential_id[PASSKEY_CREDENTIAL_ID_MAX], uint16_t* credential_id_len
)
{
    (void)index;
    (void)credential_id;
    if ( credential_id_len != NULL )
        *credential_id_len = 0;
    return false;
}
bool passkey_discoverable_credential_get_slot_credential_id(
    uint32_t slot_index, uint8_t credential_id[PASSKEY_CREDENTIAL_ID_MAX], uint16_t* credential_id_len
)
{
    (void)slot_index;
    (void)credential_id;
    if ( credential_id_len != NULL )
        *credential_id_len = 0;
    return false;
}
bool passkey_discoverable_credential_matches(uint32_t slot_index, const uint8_t* credential_id, size_t credential_id_len)
{
    (void)slot_index;
    (void)credential_id;
    (void)credential_id_len;
    return false;
}
bool passkey_discoverable_credential_remove(size_t index)
{
    (void)index;
    return false;
}
bool passkey_discoverable_credential_remove_slot(uint32_t slot_index)
{
    (void)slot_index;
    return false;
}
bool passkey_discoverable_credential_take_remove_result(bool* success)
{
    (void)success;
    return false;
}

// ── b0ef9830 批次新增缺符号 ──
// （seedcard_flow_exit / seedcard_holding_disarm 桩已删：dev 2026-08 起真实实现编入，见上）
// SE 助记词类型/密文校验异步查询：同其余 op_client 桩，恒"未发起"
bool mnemonic_op_get_type_async(mnemonic_op_client_cb_t cb)
{
    (void)cb;
    return false;
}
bool mnemonic_op_verify_secret_async(const uint8_t* secret, uint16_t secret_len, mnemonic_op_client_cb_t cb)
{
    (void)secret;
    (void)secret_len;
    (void)cb;
    return false;
}

// ── device_control flow（561be533 起设置页经 foreground_device_control_flow.h
//    传递依赖生成的 device_control pb.h + IPC；sim 用占位头 + 这里的桩）──
#include "latest/messages_device_control.pb.h"
#include "foreground_device_control_flow.h"
// nanopb field 描述符：真机在 .pb.c；sim 不做 encode/decode，给空描述符即可满足链接
const pb_msgdesc_t DeviceSettings_msg = {0};
const pb_msgdesc_t DeviceSettingsGet_msg = {0};
const pb_msgdesc_t DeviceSettingsSet_msg = {0};
const pb_msgdesc_t DeviceSettingsPageShow_msg = {0};
void foreground_device_control_flow_init(void) {}
void foreground_device_control_flow_process(void) {}
bool foreground_device_control_flow_try_consume_message(const Proto_Msg_t* message)
{
    (void)message;
    return false;
}
bool foreground_device_control_flow_busy(void) { return false; }
void foreground_device_control_start_settings_set(const DeviceSettings* settings, IpcSource_t source)
{
    (void)settings;
    (void)source;
}
void foreground_device_control_start_settings_page_show(const DeviceSettingsPageShow* request, IpcSource_t source)
{
    (void)request;
    (void)source;
}
void foreground_device_control_page_show_confirmed(DeviceSettingsPage page) { (void)page; }
void foreground_device_control_page_show_cancelled(DeviceSettingsPage page) { (void)page; }
void foreground_device_control_page_show_failed(DeviceSettingsPage page, DeviceErrorCode subcode, const char* message)
{
    (void)page;
    (void)subcode;
    (void)message;
}

// ── 561be533 批次新增缺符号 ──
void auth_manager_on_fingerprint_attempts_exhausted(void) {}
bool passkey_discoverable_credential_take_added_notification(void) { return false; }

// ── dev daad16c4 批次：device_rename_confirm 页（dfff5b4a）确认/取消回调 ──
bool foreground_device_control_rename_confirmed(void) { return false; }
bool foreground_device_control_rename_cancelled(void) { return false; }

// ── dev 89c4ceb3 批次（2026-08-04 多语言走查）：链接缺符号最小桩 ──
// auth_manager：SE 绑定失效后的锁定入口。sim 无 SE，空实现。
void auth_manager_lock_after_binding_invalidated(void) {}

// change_pin_flow：Change PIN 状态机（dev 2eebfd2c 移出页面层）。sim 无 SE 会话：
// start 返回 false（无法启动），覆盖确认/取消回调空实现。
bool change_pin_flow_start(void) { return false; }
void change_pin_flow_overwrite_confirmed(void) {}
void change_pin_flow_overwrite_cancelled(void) {}

// filesystem（NFT 存储）：sim 无 eMMC 文件系统，全部保守失败 → NFT Gallery 走空态分支
// （与真机"无 NFT"路径一致，非捏造）。secbool 语义：sectrue=0x55AA55AA，此处返回 secfalse=0。
#include <filesystem.h>
secbool_t filesystem_path_exist(const char* path_buff)
{
    (void)path_buff;
    return secfalse;
}
secbool_t filesystem_path_info(const char* path_buff, FilesystemPathInfo_t* file_info)
{
    (void)path_buff;
    (void)file_info;
    return secfalse;
}
secbool_t filesystem_file_read(
    const char* path_buff, uint32_t offset, void* buff, uint32_t target_len, uint32_t* processed_len
)
{
    (void)path_buff;
    (void)offset;
    (void)buff;
    (void)target_len;
    if ( processed_len )
        *processed_len = 0;
    return secfalse;
}
secbool_t filesystem_file_delete(const char* path_buff)
{
    (void)path_buff;
    return secfalse;
}
secbool_t filesystem_dir_list(
    const char* path_buff, char* list_subdirs_buff, uint32_t list_subdirs_len, char* list_files_buff,
    uint32_t list_files_len, uint32_t depth
)
{
    (void)path_buff;
    (void)depth;
    if ( list_subdirs_buff && list_subdirs_len )
        list_subdirs_buff[0] = '\0';
    if ( list_files_buff && list_files_len )
        list_files_buff[0] = '\0';
    return secfalse;
}

// lv_gif_set_loop_start_frame：main 2026-10 起 sim 编入固件补丁版 lv_gif.c（含该扩展），不再桩

// mnemonic_op：导出开关 get/set（dev 新增）。async 返回 false = op 未启动。
bool mnemonic_op_get_export_enabled_async(mnemonic_op_client_cb_t cb)
{
    (void)cb;
    return false;
}
bool mnemonic_op_set_export_enabled_async(bool enable, const char* pin, uint8_t pin_len, mnemonic_op_client_cb_t cb)
{
    (void)pin;
    (void)pin_len;
    (void)enable;
    (void)cb;
    return false;
}

// nfc_trigger（SeedCard NFC 会话触发）：sim 无 BG NFC，全部空实现（页面停留在等待态）。
void nfc_trigger_seedcard_detect(bool is_restore) { (void)is_restore; }
void nfc_trigger_seedcard_execute(
    bool is_restore, const char* card_pin, uint8_t card_pin_len, const char* device_pin, uint8_t device_pin_len,
    const char* mnemonic, uint16_t mnemonic_len
)
{
    (void)is_restore;
    (void)card_pin;
    (void)card_pin_len;
    (void)device_pin;
    (void)device_pin_len;
    (void)mnemonic;
    (void)mnemonic_len;
}
void nfc_trigger_seedcard_verify_pin(const char* card_pin, uint8_t pin_len, const char* expected_serial)
{
    (void)card_pin;
    (void)pin_len;
    (void)expected_serial;
}
void nfc_trigger_seedcard_change_pin(
    const char* old_pin, uint8_t old_len, const char* new_pin, uint8_t new_len, const char* expected_serial
)
{
    (void)old_pin;
    (void)old_len;
    (void)new_pin;
    (void)new_len;
    (void)expected_serial;
}
void nfc_trigger_seedcard_set_lock(bool enable, const char* card_pin, uint8_t pin_len, const char* expected_serial)
{
    (void)enable;
    (void)card_pin;
    (void)pin_len;
    (void)expected_serial;
}
void nfc_trigger_seedcard_set_name(
    const uint8_t* name, uint8_t name_len, const char* card_pin, uint8_t pin_len, const char* expected_serial
)
{
    (void)name;
    (void)name_len;
    (void)card_pin;
    (void)pin_len;
    (void)expected_serial;
}
void nfc_trigger_seedcard_reset_card(const char* expected_serial) { (void)expected_serial; }

// passkey：网站图标路径解析（dev ba362d6e sized icons）。返回 NULL = 无图标，
// 页面走默认占位图标分支。
#include "passkey/passkey_ui.h"
const char* passkey_ui_website_icon(char* path, size_t path_size, const char* rp_id, PasskeyWebsiteIconSize_t size)
{
    (void)path;
    (void)path_size;
    (void)rp_id;
    (void)size;
    return NULL;
}

// passphrase runtime：是否经 attach-PIN 解锁。sim 恒 false（未解锁常规态）。
bool passphrase_runtime_is_unlocked_via_attach_pin(void) { return false; }

// pin_op_client：取消挂起 PIN 操作。sim 无挂起 op，空实现。
void pin_op_client_cancel(void) {}

// ═══════════════════════════════════════════════════════════════════════════
// main 2026-10（d7e612e6）追平：pages/ 新引用的业务层符号
// ═══════════════════════════════════════════════════════════════════════════

// ── navigation_coordinator（tasks/task_foreground/utils/navigation_coordinator.c）──
// 真机：所有页面导航经协调器统一排队（锁屏/启动/渲染暂停时拒绝或延后），最终构造 PageNavRequest_t 交
// page_manager_submit。sim 无锁屏/启动门禁，跳过守卫，op → PageNavRequest_t 的映射逐条照抄固件
// navigate_ex 的 switch（scope / dedup / axis / chain_transient 决定转场轴向与栈形态，关系 compositor 走哪条转场路径）。
#include "navigation_coordinator.h"
#include "page_manager/page_manager.h"
NavigationNavResult_t navigation_coordinator_navigate_ex(NavigationOp_t op, NavigationLane_t lane, PageId_t id, void* arg)
{
    (void)lane;
    bool accepted = false;
    switch ( op )
    {
    case NAV_OP_PUSH:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_PUSH, .target_id = id, .arg = arg});
        break;
    case NAV_OP_PUSH_UP:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_PUSH, .target_id = id, .arg = arg, .axis = PAGE_NAV_AXIS_VERTICAL});
        break;
    case NAV_OP_REPLACE:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_PUSH, .target_id = id, .arg = arg, .scope = PAGE_NAV_SCOPE_REPLACE_TOP});
        break;
    case NAV_OP_REPLACE_TOP_INPLACE:
        accepted = page_manager_submit(&(PageNavRequest_t){
            .action = PAGE_NAV_PUSH, .target_id = id, .arg = arg, .scope = PAGE_NAV_SCOPE_REPLACE_TOP, .dedup = PAGE_NAV_DEDUP_NONE});
        break;
    case NAV_OP_PUSH_ROOT:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_PUSH, .target_id = id, .arg = arg, .scope = PAGE_NAV_SCOPE_CLEAR_STACK});
        break;
    case NAV_OP_PUSH_ROOT_UP:
        accepted = page_manager_submit(&(PageNavRequest_t){
            .action = PAGE_NAV_PUSH, .target_id = id, .arg = arg, .scope = PAGE_NAV_SCOPE_CLEAR_STACK, .axis = PAGE_NAV_AXIS_VERTICAL});
        break;
    case NAV_OP_POP_TO_ROOT:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_POP_TO_ROOT, .target_id = id, .arg = arg, .axis = PAGE_NAV_AXIS_VERTICAL});
        break;
    case NAV_OP_PUSH_ROOT_INTERRUPT_INTERACTIVE:
        accepted = page_manager_submit(&(PageNavRequest_t){
            .action = PAGE_NAV_PUSH, .target_id = id, .arg = arg, .scope = PAGE_NAV_SCOPE_CLEAR_STACK, .abort_interactive = true});
        break;
    case NAV_OP_JUMP_TO_EXISTING:
        accepted = page_manager_contains(id)
                && page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_PUSH, .target_id = id, .dedup = PAGE_NAV_DEDUP_JUMP_TO_EXISTING});
        break;
    case NAV_OP_CANCEL_PENDING_PUSH:
        accepted = page_manager_cancel_pending_push(id);
        break;
    case NAV_OP_BACK:
        accepted = page_manager_back();
        break;
    case NAV_OP_POP:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_POP, .chain_transient = true});
        break;
    case NAV_OP_POP_NO_CHAIN:
        accepted = page_manager_submit(&(PageNavRequest_t){.action = PAGE_NAV_POP});
        break;
    case NAV_OP_REMOVE_BURIED:
        accepted = page_manager_remove_buried(id);
        break;
    case NAV_OP_REBUILD_STACK:
        accepted = page_manager_rebuild_stack();
        break;
    default:
        break;
    }
    return accepted ? NAV_RESULT_ACCEPTED : NAV_RESULT_REFUSED;
}
bool navigation_coordinator_navigate(NavigationOp_t op, NavigationLane_t lane, PageId_t id, void* arg)
{
    return navigation_coordinator_navigate_ex(op, lane, id, arg) != NAV_RESULT_REFUSED;
}
NavigationNavResult_t
navigation_coordinator_navigate_with_press(NavigationOp_t op, NavigationLane_t lane, PageId_t id, void* arg_p, uint32_t press_token)
{
    (void)press_token;
    return navigation_coordinator_navigate_ex(op, lane, id, arg_p);
}
uint32_t navigation_coordinator_press_begin(uint32_t timeout_ms)
{
    (void)timeout_ms;
    return 1U;
}
bool navigation_coordinator_press_pending(uint32_t token)
{
    (void)token;
    return false;
}
void navigation_coordinator_press_cancel(uint32_t token) { (void)token; }
bool navigation_coordinator_register_busy_source(NavigationCoordinatorBusy_func_t is_busy)
{
    (void)is_busy;
    return true;
}
void navigation_coordinator_on_lock_screen_revealed(void) {}

// ── auth_manager（SE 鉴权/锁屏/指纹匹配编排）：sim 永远"已解锁"，PIN 重试次数未知（0）──
#include "auth_manager.h"
bool auth_manager_is_locked(void) { return false; }
bool auth_manager_is_ui_locked(void) { return false; }
uint8_t auth_manager_known_pin_retry_times(void) { return 0; }
void auth_manager_set_known_pin_retry_times(uint8_t remaining) { (void)remaining; }
void auth_manager_refresh_known_pin_retry_times(void) {}
void auth_manager_cancel_pin_retry_refresh(void) {}
void auth_manager_on_lock_request(void) {}
void auth_manager_fingerprint_match_start(const AuthFingerprintMatchHooks_t* hooks) { (void)hooks; }
void auth_manager_fingerprint_match_stop(void (*owner_on_unlock)(void)) { (void)owner_on_unlock; }
bool auth_manager_request_home_navigation(AuthHomeNavAction_t action)
{
    (void)action;
    return false; // 未处理 → 调用方自行导航
}

// ── boot_loading / device_state / foreground_power_hold / foreground_access ──
#include "boot_loading.h"
#include "device_state.h"
#include "foreground_power_hold.h"
#include "foreground_access_flow.h"
bool boot_loading_is_active(void) { return false; }
void device_state_set_unlock_settling(bool settling) { (void)settling; }
void device_state_shutdown_commit(void) {}
void device_state_suppress_usb_homescreen_reset(void) {}
void foreground_power_hold_acquire(void) {}
void foreground_power_hold_release(void) {}
void foreground_access_abandon_interactive_flows(void) {}

// ── change_pin_flow / passphrase_op_client / mnemonic_op_client / reset_device（SE 异步操作）──
#include "change_pin_flow.h"
#include "passphrase_op_client.h"
#include "mnemonic_op_client.h"
#include "reset_device.h"
bool change_pin_flow_busy(void) { return false; }
void change_pin_flow_abandon(void) {}
void change_pin_flow_lock_after_success(void) {}
void passphrase_op_client_cancel(void) {}
void mnemonic_op_clear_local(void) {}
void mnemonic_op_client_cancel(mnemonic_op_client_cb_t cb) { (void)cb; }
bool mnemonic_op_export_async(const char* pin, uint8_t pin_len, mnemonic_op_client_cb_t cb)
{
    (void)pin;
    (void)pin_len;
    (void)cb;
    return false; // 未发起
}
bool mnemonic_op_take_exported(char* out, size_t cap)
{
    (void)out;
    (void)cap;
    return false;
}
bool reset_device_request_delayed(uint32_t delay_ms)
{
    (void)delay_ms;
    return false;
}

// ── host_asset_package / host_firewall（主机侧资源包、协议防火墙）──
#include "host_asset_package.h"
#include "host_firewall.h"
HostAssetPackageResult_t host_asset_package_extract(const char* package_path_p, const HostAssetPackageEntry_t* entries_p, size_t entry_count)
{
    (void)package_path_p;
    (void)entries_p;
    (void)entry_count;
    return HOST_ASSET_PACKAGE_INVALID;
}
void host_asset_package_remove_outputs(const HostAssetPackageEntry_t* entries_p, size_t entry_count)
{
    (void)entries_p;
    (void)entry_count;
}
secbool_t host_firewall_boot_language_synced(void) { return sectrue; }

// ── my_address_session 展示会话（main 2026-10 新增 display_* 四件套）──
#include "my_address_session.h"
bool my_address_session_display_busy(void) { return false; }
void my_address_session_display_begin(void) {}
void my_address_session_display_done(void) {}
bool my_address_session_request_busy(void) { return false; }

// ── passkey 可发现凭据刷新（FIDO）──
#include "passkey/passkey_service.h"
bool passkey_discoverable_credential_is_refresh_queued(void) { return false; }
bool passkey_discoverable_credential_needs_refresh(void) { return false; }
bool passkey_discoverable_credential_take_refresh_failure(void) { return false; }

// ── ui_state_cache：蜂鸣器请求（BG 播放）──
#include "ui_state_cache.h"
void ui_request_buzzer(BuzzerMelodyId_t melody) { (void)melody; }

// ── filesystem 文件句柄 API（nft_storage / 壁纸等；sim 无 vol1 文件系统，一律失败）──
#include <filesystem.h>
secbool_t filesystem_file_open(FilesystemFile_t* file_p, const char* path_buff, FilesystemFileMode_t mode)
{
    (void)file_p;
    (void)path_buff;
    (void)mode;
    return secfalse;
}
secbool_t filesystem_file_read_at(FilesystemFile_t* file_p, uint32_t offset, void* buff, uint32_t target_len, uint32_t* processed_len)
{
    (void)file_p;
    (void)offset;
    (void)buff;
    (void)target_len;
    if ( processed_len != NULL )
        *processed_len = 0;
    return secfalse;
}
secbool_t filesystem_file_write_at(FilesystemFile_t* file_p, uint32_t offset, const void* buff, uint32_t target_len, uint32_t* processed_len)
{
    (void)file_p;
    (void)offset;
    (void)buff;
    (void)target_len;
    if ( processed_len != NULL )
        *processed_len = 0;
    return secfalse;
}
secbool_t filesystem_file_sync(FilesystemFile_t* file_p)
{
    (void)file_p;
    return secfalse;
}
secbool_t filesystem_file_close(FilesystemFile_t* file_p)
{
    (void)file_p;
    return secfalse;
}
secbool_t filesystem_file_touch(const char* path_buff)
{
    (void)path_buff;
    return secfalse;
}
secbool_t filesystem_file_rename(const char* path_buff_old, const char* path_buff_new)
{
    (void)path_buff_old;
    (void)path_buff_new;
    return secfalse;
}

// ── resource_manager：noto 字体包路径（sim 资源树里 noto 目录直接可读，pkg 视为恒挂载）──
#include <resource_manager.h>
const char* resource_manager_noto_pkg_path(const char* lang_tag)
{
    (void)lang_tag;
    return "A:/resource/font/noto";
}
