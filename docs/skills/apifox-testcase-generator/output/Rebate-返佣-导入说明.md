# Rebate 返佣接口测试用例 - 导入说明

## 文件信息

| 项目 | 说明 |
|------|------|
| **文件名** | `Rebate-返佣-Apifox-TestCases.json` |
| **用例数量** | 25 个测试用例 |
| **生成日期** | 2026-01-30 |
| **依赖模块** | Prime 登录认证 |

---

## ⚠️ 重要提示

**所有 Rebate 接口需要 Prime 登录认证！**

执行测试前必须：
1. 先运行「00-前置登录」分组
2. 获取有效的 `X-Onekey-Request-Token`
3. Token 会自动存入环境变量供后续接口使用

---

## 导入步骤

### 1. 打开 Apifox

进入你的项目工作区

### 2. 导入测试用例

1. 点击左侧菜单「设置」→「导入数据」
2. 选择「Postman Collection v2」格式
3. 上传 `Rebate-返佣-Apifox-TestCases.json` 文件
4. 确认导入

### 3. 配置环境变量

#### 必须手动设置的变量

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `phone` | 测试账号手机号 | `5555552894` |
| `smsToken` | 短信验证码（每次登录需更新） | `485414` |

#### 自动获取的变量

| 变量名 | 说明 | 获取方式 |
|--------|------|----------|
| `X-Onekey-Request-Token` | Prime 登录 Token | 执行「02-Supabase验证获取Token」自动从 `access_token` 写入 |
| `uuid` | 随机ID | 执行「01-获取随机ID」自动写入（可选） |
| `inviteCode` | 邀请码 | 执行「02-01-获取邀请码列表」自动写入 |

#### 设置步骤

1. 在 Apifox 左侧点击「环境管理」
2. 选择或创建一个环境（如 `测试环境`）
3. 添加变量：
   - `phone` = 你的测试手机号
   - `smsToken` = 收到的短信验证码（先空着，获取验证码后再填）

### 4. 设置 baseUrl

在 Apifox 环境配置中设置：

```
baseUrl: https://api.onekey.so
```

---

## 测试用例分组

| 分组 | 用例数 | 说明 |
|------|--------|------|
| 00-前置登录 | 2 | Prime 登录流程，**必须先执行** |
| 01-邀请总览 | 4 | 推荐页面总览、等级详情 |
| 02-邀请码管理 | 4 | 邀请码创建、查询、更新、折扣码反查 |
| 03-返佣记录 | 9 | 各类返佣记录查询（硬件/Earn/Perps/历史/发放） |
| 04-地址管理 | 1 | 提现地址列表 |
| 05-钱包绑定 | 2 | 地址绑定状态检查、签名消息 |
| 06-边界测试 | 4 | 缺少Token、无效Token、缺少参数等 |

---

## 执行顺序

### 前置登录流程（必须先执行）

```
步骤 1: 设置环境变量 phone = 5555552894（或其他测试手机号）
步骤 2: 获取验证码（通过 App 或发送 OTP 接口触发）
步骤 3: 设置环境变量 smsToken = 收到的验证码（如 485414）
步骤 4: 执行「02-Supabase验证获取Token」
        → 自动提取 access_token 写入 X-Onekey-Request-Token ★
步骤 5: 后续所有 Rebate 接口自动使用这个 Token
```

### 用例执行顺序

```
00-前置登录（必须先执行）
    ├── 01-获取随机ID → 获取 uuid（可选）
    └── 02-Supabase验证获取Token → 获取 X-Onekey-Request-Token ★（需要 phone + smsToken）

01-邀请总览
    ├── 01-获取推荐页面总览
    ├── 02-获取推荐页面总览-带时间范围
    ├── 03-获取Earn推荐总览
    └── 04-获取当前等级详情

02-邀请码管理
    ├── 01-获取用户所有邀请码列表 → 提取 inviteCode
    ├── 02-创建邀请码
    ├── 03-更新邀请码备注
    └── 04-使用邀请码反查折扣码

03-返佣记录
    ├── 01-获取硬件销售推荐记录
    ├── 02-获取Earn推荐记录
    ├── 03-获取用户Earn返佣记录
    ├── 04-获取历史推荐记录
    ├── 05-获取佣金历史发放记录
    ├── 06-获取硬件累计奖励
    ├── 07-获取Perps推荐记录
    ├── 08-获取Perps被邀请人奖励
    └── 09-导出记录

04-地址管理
    └── 01-获取用户提现地址列表

05-钱包绑定
    ├── 01-批量检查地址绑定状态
    └── 02-创建签名消息体

06-边界测试（可独立执行）
```

---

## Token 传递机制

### 登录流程
```javascript
// 02-Prime登录获取Token 的 Test 脚本
if (jsonData.data && jsonData.data.token) {
    pm.environment.set('X-Onekey-Request-Token', jsonData.data.token);
    console.log('★ 已写入环境变量: X-Onekey-Request-Token');
}
```

### 后续接口使用
所有 Rebate 接口的 Header 中包含：
```json
{
  "key": "X-Onekey-Request-Token",
  "value": "{{X-Onekey-Request-Token}}",
  "type": "text"
}
```

### 前置检查
每个 Rebate 接口的 Pre-request 脚本会检查 Token：
```javascript
const token = pm.environment.get('X-Onekey-Request-Token');
if (!token) {
    console.warn('⚠️ X-Onekey-Request-Token 未设置，请先执行「00-前置登录」');
}
```

---

## 常见问题

### Q: 登录接口返回 token 为空？

A: Prime 登录需要 Privy 认证。实际测试时有两种方式：
1. **手动设置**：在环境变量中手动填入有效的 Token
2. **自动登录**：确保登录请求包含正确的 Privy 认证信息

### Q: 返佣接口返回 401 或 code 不为 0？

A: 检查以下内容：
1. Token 是否已设置（查看环境变量）
2. Token 是否有效（未过期）
3. 是否先执行了登录流程

### Q: 如何获取有效的测试账号 Token？

A: 推荐方式：
1. 在 App 中登录 Prime 账号
2. 通过抓包工具获取 Token
3. 手动设置到 Apifox 环境变量

---

## 接口覆盖清单

| 接口路径 | 方法 | 说明 |
|----------|------|------|
| `/prime/v1/general/get-random-id` | GET | 获取随机ID |
| `/prime/v1/user/login` | POST | Prime 登录 |
| `/rebate/v1/invite/summary` | GET | 推荐页面总览 |
| `/rebate/v1/invite/summary/earn` | GET | Earn 推荐总览 |
| `/rebate/v1/invite/level-detail` | GET | 当前等级详情 |
| `/rebate/v1/invite-codes` | GET | 获取邀请码列表 |
| `/rebate/v1/invite-codes` | POST | 创建邀请码 |
| `/rebate/v1/invite-codes/note` | PUT | 更新邀请码备注 |
| `/rebate/v1/invite/discount-code` | GET | 反查折扣码 |
| `/rebate/v1/invite/records` | GET | 推荐记录 |
| `/rebate/v1/invite/earn-records` | GET | Earn返佣记录 |
| `/rebate/v1/invite/history` | GET | 历史推荐记录 |
| `/rebate/v1/invite/paid` | GET | 佣金发放记录 |
| `/rebate/v1/invite/hardware-cumulative-rewards` | GET | 硬件累计奖励 |
| `/rebate/v1/invite/perps-records` | GET | Perps推荐记录 |
| `/rebate/v1/invite/perps-invitee-rewards` | GET | Perps被邀请人奖励 |
| `/rebate/v1/invite/export` | GET | 导出记录 |
| `/rebate/v1/address/list` | GET | 提现地址列表 |
| `/rebate/v1/wallet/batch-check` | POST | 批量检查地址绑定 |
| `/rebate/v1/wallet/message` | POST | 创建签名消息体 |

---

## 更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| 1.0.0 | 2026-01-30 | 初始版本，包含 Prime 登录 + Rebate 完整接口 |
