#pragma once
// SIM-ONLY 占位：固件真机的 latest/messages_device_session.pb.h 是 nanopb 生成产物（不在源码树）。
// 设置类页面经 foreground_access_flow.h 传递依赖它，只用到枚举常量。
// 枚举值对齐 sys/protobuf/onekey_protocol/latest/messages_device_session.proto。
#include <stdint.h>
#include <stdbool.h>

typedef enum _DeviceSessionPinType
{
    DeviceSessionPinType_Any = 1,
    DeviceSessionPinType_Main = 2,
    DeviceSessionPinType_AttachToPin = 3,
} DeviceSessionPinType;
