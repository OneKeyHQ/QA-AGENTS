# HW & App 模块测试规则

> 本文档定义 HW & App 模块的测试规则，生成硬件钱包相关测试用例时必须参考。

---

## 0. 输出格式规则（强制）

### 0.1 禁止输出自动化相关内容

**核心规则**：硬件相关的测试用例**禁止**输出自动化相关的校验和测试内容。

**禁止输出项**：
- 自动化层级（Unit / API / E2E）
- 自动化断言（如 `断言：xxx`、`assert`、`expect` 等）
- 自动化实施方案章节
- Mock 数据建议
- 关键拦截点说明

**原因**：
- 硬件交互依赖物理设备，无法完全自动化
- 硬件确认操作需要人工在设备上执行
- 测试用例以手工执行为主

**表格格式调整**：
- 表头使用：`| 优先级 | 输入数据 | 操作步骤 | 预期结果 |`
- 移除「自动化层级」列
- 预期结果中不包含断言语句

---

## 1. 设备管理测试规则

### 1.1 设备列表测试规则

| 规则项 | 规则描述 |
|--------|---------|
| 设备排序 | 与钱包账户选择器排序一致 |
| 设备图片 | 6 款设备图片需正确显示：Pure、Mini、Classic/1S、Touch、Pro 黑款、Pro 白款 |
| 设备信息 | 显示设备备注、设备蓝牙名称（无蓝牙设备不显示） |
| 验证状态 | Badge 显示已验证/未验证状态 |
| 固件版本 | 显示当前固件版本，有更新时显示更新提示 |

### 1.2 设备连接测试规则

| 场景 | 标准钱包规则 | QR 钱包规则 |
|------|-------------|------------|
| 同助记词同设备 | QR/标准钱包共用一个设备选项 | QR/标准钱包共用一个设备选项 |
| 设备重置后再连接 | 不创建新设备 | 创建新设备 |
| 不同助记词重置后创建 | 创建新钱包，旧钱包标记不可用 | 创建新钱包，不处理旧钱包 |
| 相同助记词重置后创建 | 不创建新钱包，重新启用旧钱包 | 创建新钱包，不处理旧钱包 |

### 1.3 QR 钱包限制规则

- QR 钱包**无法修改**硬件设置
- QR 钱包**可以修改**设备名称
- 修改设置需连接 USB 或蓝牙
- 同设备创建标准硬件钱包后，设备详情更新为标准硬件钱包样式
- 删除标准硬件钱包后，恢复为 QR 钱包样式

---

## 2. 通用设置测试规则（General Settings）

### 2.1 设置项硬件确认规则

| 设置项 | 需要硬件确认 | 确认文案模板 |
|--------|-------------|-------------|
| Language | ✓ | "Do you want to change language to [语言]?" |
| Auto Lock | ✓ | "Do you want to change Auto-Lock time to [时长]?" |
| Auto Shutdown | ✓ | "Do you want to change Auto Shutdown time to [时长]?" |
| Brightness | ✗ | 直接滑动调节 |
| Vibration & Haptic | ✓ | "Do you want to open/close Haptic?" |

### 2.2 设置值范围规则

| 设置项 | 可选值 |
|--------|-------|
| Language | English, 简体中文, 繁體中文, 日本語, 한국어, Español, Português (Brasil) |
| Auto Lock | 30 seconds, 1 minute, 2 minutes, 5 minutes, 10 minutes |
| Auto Shutdown | 1 minute, 2 minutes, 5 minutes, 10 minutes |
| Brightness | 0-100%（百分比滑动） |

### 2.3 设备型号支持规则

| 设置项 | Pro | Touch | Classic/1S | Mini | Pure |
|--------|-----|-------|------------|------|------|
| Language | ✓ | ✓ | ✓ | ✓ | ✓ |
| Brightness | ✓ | ✓ | ✗ | ✗ | ✗ |
| Auto Lock | ✓ | ✓ | ✓ | ✓ | ✓ |
| Auto Shutdown | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vibration & Haptic | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## 3. Passphrase 测试规则

### 3.1 开启/关闭流程规则

| 操作 | App 弹窗标题 | 硬件确认标题 | 硬件按钮 |
|------|-------------|-------------|---------|
| 开启 | Enable Passphrase | Enable Passphrase | Cancel / Enable |
| 关闭 | Disable Passphrase | Disable Passphrase | Cancel / Disable |

### 3.2 风险提示规则

- 开启时必须提示：If forgotten, funds are permanently lost.
- 关闭时必须提示：
  - Wallets created with a passphrase stay on-chain
  - Need to turn passphrase back on to access them
  - If you forget the passphrase, the funds are permanently lost.

---

## 4. Enter PIN on App 测试规则

| 规则项 | 规则描述 |
|--------|---------|
| 适用设备 | 仅 Mini / Classic / 1S |
| 默认状态 | 开启 |
| 切换确认 | 不需要硬件确认 |
| 关闭后行为 | 锁定再激活设备需在硬件上输入 PIN 码 |

---

## 5. Forget Device 测试规则

### 5.1 功能范围规则

| 操作类型 | 规则描述 |
|---------|---------|
| 删除范围 | 仅删除 App 内记录 |
| 不影响项 | 硬件设备数据、Recovery phrase、资金 |
| 可恢复性 | 可随时重新配对连接 |

### 5.2 弹窗信息规则

弹窗必须包含以下信息：
- **What will happen**:
  - Device will be disconnected
  - Active sessions will stop
- **What stays safe**:
  - Your data remains safe
  - You can reconnect anytime

### 5.3 成功状态规则

- 操作成功后显示 Toast："Wallet removed successfully"
- 设备从列表中移除

---

## 6. About Device 弹窗测试规则

### 6.1 信息字段规则

| 字段 | 显示规则 |
|------|---------|
| Model | 设备型号（如 OneKey Pro） |
| Serial number | 序列号 + 复制按钮 |
| Firmware | 固件版本 |
| Bluetooth | 蓝牙名称（Mini 显示 "--"） |
| Bluetooth firmware | 蓝牙固件版本（Mini 显示 "--"） |
| Bootloader | 引导程序版本 |
| Certifications | 认证信息（仅 Pro/1S/Pure 有） |

### 6.2 序列号复制规则

- 点击序列号旁的复制按钮
- 成功复制到剪贴板
- 显示复制成功提示

---

## 7. Genuine Check Badge 测试规则

### 7.1 状态显示规则

| 验证状态 | Badge 样式 | 文案 |
|---------|-----------|------|
| isVerified: True | 绿色 ✓ | Genuine verified |
| isVerified: False | 红色 ⚠ | Unverified |

### 7.2 交互规则

- 点击 Badge 进入正品验证流程
- 验证成功后 Badge 状态更新

---

## 8. 硬件转账测试规则

详见 `docs/rules/transfer-chain-rules.md` 中的硬件钱包相关规则。

---

## 变更记录

| 日期 | 变更内容 |
|------|---------|
| 2026-01-16 | 初始化文档，整合 5.20.0 设备管理改版规则 |
