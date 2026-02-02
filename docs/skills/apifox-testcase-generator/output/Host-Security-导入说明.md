# Host Security API 测试用例导入说明

## 概述

本测试用例集合包含域名安全信息管理的完整 API 测试，共 **34 个测试用例**。

## 接口覆盖

| 接口 | 方法 | 说明 | 用例数 |
|------|------|------|--------|
| `/utility/v1/discover/check-host` | GET | **检索域名安全信息（专项测试）** | 10 |
| `/dashboard/v1/host-security/list` | GET | 获取域名安全信息列表 | 4 |
| `/dashboard/v1/host-security/` | POST | 创建域名安全信息 | 3 |
| `/dashboard/v1/host-security/` | PUT | 更新域名安全信息 | 2 |
| `/dashboard/v1/host-security/` | DELETE | 删除域名安全信息 | 1 |
| `/utility/v1/discover/host-security/reset-cache` | GET | 清除host缓存（客户端） | 1 |
| `/dashboard/v1/host-security/reset-cache` | GET | 删除host缓存（后台） | 2 |
| 边界测试 | - | 参数校验、异常情况 | 9 |
| 清理测试数据 | DELETE | 清理创建的测试数据 | 2 |

## 测试分组

### 1. 基础功能测试（4 个用例）
- 获取域名安全信息列表-默认分页
- 获取域名安全信息列表-筛选黑名单
- 获取域名安全信息列表-筛选白名单
- 获取域名安全信息列表-关键字搜索

### 2. 检索域名安全信息-专项测试（10 个用例）

| 用例名 | URL 示例 | 预期 level | 说明 |
|--------|----------|-----------|------|
| 安全网站 | `https://app.uniswap.org` | security | 已认证的 DeFi 协议 |
| 钓鱼网站 | `https://metamask-io.phishing.example` | high | phishingSite=true |
| 恶意网站 | `https://cryptodoggies.xyz` | high | 包含 attackTypes |
| 不安全的HTTP连接 | `http://app.sablier.com/` | medium/high | HTTP 协议风险 |
| 包含特殊字符 | URL 带中文/特殊参数 | - | 验证 URL 解析 |
| 疑似恶意行为 | `https://swarm.city` | medium | 中等风险 |
| 已认证的网站 | `https://opensea.io` | security | 知名 NFT 平台 |
| 未认证的网站 | 随机未知域名 | unknown | 未收录的网站 |
| from参数-script来源 | - | - | 验证 from=script |
| 边界-url为空 | - | - | 空值边界测试 |

### 3. CRUD 操作测试（6 个用例）
- 创建域名安全信息-仅host
- 创建域名安全信息-设为黑名单
- 创建域名安全信息-设为白名单
- 更新域名安全信息-改为黑名单
- 更新域名安全信息-改为白名单
- 删除域名安全信息

### 4. 缓存操作测试（3 个用例）
- 清除host缓存-客户端接口
- 删除host缓存-后台接口-指定host
- 删除host缓存-后台接口-不指定host

### 5. 边界测试（9 个用例）
- 创建域名-缺失必填参数host
- 创建域名-host为空字符串
- 更新域名-缺失必填参数hostSecurityId
- 更新域名-无效的hostSecurityId
- 删除域名-缺失必填参数id
- 删除域名-无效的id
- 清除缓存-客户端-缺失必填参数host
- 列表查询-分页边界-page为0
- 列表查询-分页边界-limit为负数

### 6. 清理测试数据（2 个用例）
- 清理-删除黑名单测试数据
- 清理-删除白名单测试数据

## 导入步骤

### Apifox 导入

1. 打开 Apifox 项目
2. 点击 **设置** → **导入数据**
3. 选择 **Postman Collection v2** 格式
4. 上传 `Host-Security-Apifox-TestCases.json` 文件
5. 确认导入

### Postman 导入

1. 打开 Postman
2. 点击 **Import** 按钮
3. 选择 `Host-Security-Apifox-TestCases.json` 文件
4. 确认导入

## 环境变量配置

导入后需要配置以下环境变量：

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `X-Onekey-Request-Token` | 后台登录 Token | 从登录接口获取 |

## 执行顺序

建议按以下顺序执行测试：

1. **基础功能测试** - 验证列表查询功能正常
2. **CRUD 操作测试** - 按顺序执行（创建 → 更新 → 删除）
3. **缓存操作测试** - 验证缓存清除功能
4. **边界测试** - 验证异常情况处理
5. **清理测试数据** - 清理测试过程中创建的数据

## 注意事项

1. **执行前提**：需要有效的 `X-Onekey-Request-Token`，该 Token 需要有后台管理权限
2. **测试数据**：CRUD 测试会创建测试域名，建议在测试环境执行
3. **数据传递**：部分用例会自动保存创建的 `hostSecurityId` 供后续用例使用
4. **清理数据**：执行完毕后记得运行"清理测试数据"分组

## 响应结构说明

### 检索域名安全信息接口响应

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "host": "cryptodoggies.xyz",
    "level": "high",
    "attackTypes": [
      {
        "name": "SignatureFarming",
        "description": "恶意的eth_sign JSON-RPC尝试从用户处发出原始交易签名"
      },
      {
        "name": "TransferFarming",
        "description": "A malicious transaction causes a Transfer event"
      }
    ],
    "phishingSite": false,
    "alert": "被标记为恶意网站",
    "detail": {
      "title": "风险提示",
      "content": "该网站存在安全风险"
    },
    "checkSources": [
      {
        "name": "Blockaid",
        "riskLevel": "high"
      }
    ]
  }
}
```

### 列表接口响应

```json
{
  "code": 0,
  "message": "成功",
  "data": {
    "data": [
      {
        "host": "example.com",
        "hostSecurityId": "uuid",
        "riskLevel": "high|medium|low|security|unknown",
        "isBlackList": false,
        "isWhiteList": false,
        "isMalicious": true,
        "attackTypes": ["TransferFarming", "PhishingActivities"],
        "maliciousScore": 1,
        "phishingSite": false,
        "isWeb3Site": true,
        "goplusTrust": false,
        "hasContractCreatorMalicious": false,
        "hasContractMalicious": false,
        "hostMiss": {
          "goplusUrl": false,
          "blockaid": false,
          "goplusDapp": true
        },
        "isAudit": false,
        "immediateUpdate": false,
        "projectName": "Project Name"
      }
    ],
    "count": 100
  }
}
```

### riskLevel 枚举值

| 值 | 说明 |
|----|------|
| `high` | 高风险 |
| `medium` | 中风险 |
| `low` | 低风险 |
| `security` | 安全 |
| `unknown` | 未知 |

### attackTypes 枚举值

| 值 | 说明 |
|----|------|
| `TransferFarming` | 转账钓鱼 |
| `SignatureFarming` | 签名钓鱼 |
| `PhishingActivities` | 钓鱼活动 |
| `MaliciousSdk` | 恶意 SDK |
| `BlurFarming` | Blur 钓鱼 |
| `RawEtherTransfer` | 原始 ETH 转账 |
| `MaliciousNetworkInteraction` | 恶意网络交互 |
| `Cybercrime` | 网络犯罪 |
| `BlacklistDoubt` | 黑名单疑似 |
| `HoneypotRelatedAddress` | 蜜罐相关地址 |

## 文件信息

- **文件名**：`Host-Security-Apifox-TestCases.json`
- **格式**：Postman Collection v2.1
- **用例数量**：34 个
- **生成时间**：2026-02-02
- **更新说明**：添加"检索域名安全信息"专项测试用例（10 个场景）
