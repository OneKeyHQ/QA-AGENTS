#pragma once
// SIM-ONLY 占位：固件真机的 latest/messages_device_control.pb.h 是 nanopb 生成产物（不在源码树）。
// 设置类页面（settings_change_pin / settings_passphrase / settings_reset_device / settings_wallet）
// 经 foreground_device_control_flow.h 传递依赖它，但只用到：枚举常量、消息结构体、_fields 描述符、
// _init_zero 宏。这里给最小定义让页面编入 sim；_fields 描述符符号在 sim_stubs_pages.c 给桩，
// flow 函数（start_settings_* 等）同样在桩里 no-op。枚举值精确对齐
// sys/protobuf/onekey_protocol/latest/messages_device_control.proto。
#include <stdbool.h>
#include <stdint.h>

// nanopb 子模块在 sim 未检出（无 pb.h）；sim 不做 encode/decode，_fields 描述符只被
// 页面按地址取用（传给被桩掉的 encode/decode），故给一个占位完整类型即可定义符号。
typedef struct
{
    uint8_t sim_placeholder;
} pb_msgdesc_t;

// nanopb 枚举成员名带类型前缀（<EnumName>_<Value>），照此命名
typedef enum _DeviceErrorCode
{
    DeviceErrorCode_DeviceError_None = 0,
    DeviceErrorCode_DeviceError_Busy = 1,
    DeviceErrorCode_DeviceError_NotInitialized = 2,
    DeviceErrorCode_DeviceError_ActionCancelled = 3,
    DeviceErrorCode_DeviceError_PinAlreadyUsed = 4,
    DeviceErrorCode_DeviceError_PersistFailed = 5,
    DeviceErrorCode_DeviceError_SeError = 6,
    DeviceErrorCode_DeviceError_InvalidLanguage = 7,
    DeviceErrorCode_DeviceError_WallpaperNotUsable = 8,
    DeviceErrorCode_DeviceError_DeviceLocked = 9,
} DeviceErrorCode;
// 裸名别名（部分代码/桩按短名引用）
#define DeviceError_None            DeviceErrorCode_DeviceError_None
#define DeviceError_Busy            DeviceErrorCode_DeviceError_Busy
#define DeviceError_ActionCancelled DeviceErrorCode_DeviceError_ActionCancelled
#define DeviceError_SeError         DeviceErrorCode_DeviceError_SeError
#define DeviceError_DeviceLocked    DeviceErrorCode_DeviceError_DeviceLocked

typedef enum _DeviceSettingsPage
{
    DeviceSettingsPage_DeviceReset = 0,
    DeviceSettingsPage_DevicePinChange = 1,
    DeviceSettingsPage_DevicePassphrase = 2,
    DeviceSettingsPage_DeviceAirgap = 3,
} DeviceSettingsPage;

typedef struct _DeviceSettings
{
    char label[64];
    bool bt_enable;
    char language[24];
    char wallpaper_path[256];
    uint32_t brightness;
    uint32_t autolock_delay_ms;
    uint32_t autoshutdown_delay_ms;
    bool animation_enable;
    bool tap_to_wake;
    bool haptic_feedback;
    bool device_name_display_enabled;
    bool airgap_mode;
    bool usb_lock_enable;
    bool random_keypad;
    bool passphrase_enable;
    bool fido_enabled;
} DeviceSettings;

typedef struct _DeviceSettingsGet
{
    char dummy_field;
} DeviceSettingsGet;

typedef struct _DeviceSettingsSet
{
    DeviceSettings settings;
} DeviceSettingsSet;

typedef struct _DeviceSettingsPageShow
{
    DeviceSettingsPage page;
    char field_name[64];
} DeviceSettingsPageShow;

#define DeviceSettings_init_zero          {0}
#define DeviceSettingsGet_init_zero       {0}
#define DeviceSettingsSet_init_zero       {0}
#define DeviceSettingsPageShow_init_zero  {0}

// nanopb field 描述符：真机在 .pb.c，sim 在 sim_stubs_pages.c 给空描述符桩
extern const pb_msgdesc_t DeviceSettings_msg;
extern const pb_msgdesc_t DeviceSettingsGet_msg;
extern const pb_msgdesc_t DeviceSettingsSet_msg;
extern const pb_msgdesc_t DeviceSettingsPageShow_msg;
#define DeviceSettings_fields          &DeviceSettings_msg
#define DeviceSettingsGet_fields       &DeviceSettingsGet_msg
#define DeviceSettingsSet_fields       &DeviceSettingsSet_msg
#define DeviceSettingsPageShow_fields  &DeviceSettingsPageShow_msg
