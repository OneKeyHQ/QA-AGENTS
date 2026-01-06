# Apifox API 测试用例生成器

> 🔧 通过 Apifox MCP 读取 API 文档，自动生成可直接导入 Apifox 的接口测试用例

---

## 📋 功能概述

本 Skill 提供以下能力：
- 通过 MCP 读取 Apifox 项目的 OpenAPI 文档
- 解析接口定义，自动生成测试用例
- 包含完整的前置条件、变量、断言
- 输出 Postman Collection v2.1 格式（兼容 Apifox 导入）
- 自动生成导入说明

---

## 🎯 指令列表

| 指令 | 说明 | 示例 |
|------|------|------|
| `/api-list` | 列出所有可用的 API 接口 | `/api-list` |
| `/api-read <path>` | 读取指定接口的详细定义 | `/api-read /earn/v1/borrow/markets` |
| `/api-testcase <collection>` | 为指定接口集合生成测试用例 | `/api-testcase 5.19.0 Borrow` |
| `/api-testcase-single <path>` | 为单个接口生成测试用例 | `/api-testcase-single /earn/v1/borrow/markets` |
| `/api-refresh` | 刷新 API 文档缓存 | `/api-refresh` |

---

## 📖 详细指令说明

### `/api-list` - 列出所有 API 接口

**用途**：查看项目中所有可用的 API 接口列表

**操作步骤**：
1. 调用 `mcp_API__read_project_oas_qpu5ak` 获取 OpenAPI 文档
2. 解析 `paths` 字段，提取所有接口路径
3. 按模块分组展示

**输出格式**：
```markdown
## API 接口列表

| 模块 | 接口数 | 接口路径示例 |
|------|--------|-------------|
| Earn | 53 | /earn/v1/borrow/markets |
| Wallet | 47 | /wallet/v1/account/list |
| ... | ... | ... |

总计：XXX 个接口
```

---

### `/api-read <path>` - 读取接口详情

**用途**：查看指定接口的完整定义

**参数**：
- `<path>`: 接口路径，如 `/earn/v1/borrow/markets`

**操作步骤**：
1. 将路径转换为 ref 格式：`/paths/_earn_v1_borrow_markets.json`
2. 调用 `mcp_API__read_project_oas_ref_resources_qpu5ak` 获取接口详情
3. 解析并展示接口信息

**输出格式**：
```markdown
## 接口详情：获取 Market 列表

- **路径**：GET /earn/v1/borrow/markets
- **描述**：获取支持的借贷市场列表

### 请求参数
| 参数名 | 位置 | 必填 | 类型 | 说明 |
|--------|------|------|------|------|
| X-Onekey-Request-ID | header | 是 | string | 请求ID |
| ... | ... | ... | ... | ... |

### 响应结构
...
```

---

### `/api-testcase <collection>` - 生成测试用例集合

**用途**：为指定的接口集合批量生成测试用例

**参数**：
- `<collection>`: 接口集合名称，如 `5.19.0 Borrow`、`Swap`、`Wallet`

**操作步骤**：
1. 根据集合名称匹配相关接口
2. 批量读取接口定义
3. 生成测试用例 JSON 文件
4. 生成导入说明文档

**输出文件**：
```
docs/testcases/api/
├── {collection}-Apifox-TestCases.json    # 测试用例集合（包含所有参数）
└── {collection}-导入说明.md               # 导入指南
```

> ⚠️ **不单独生成环境变量文件**：参数直接在用例中传递，仅接口间传递的动态数据通过脚本自动写入环境变量。

**测试用例结构**：
```json
{
  "info": {
    "name": "集合名称",
    "description": "描述"
  },
  "variable": [...],  // 集合变量
  "item": [
    {
      "name": "接口名称",
      "event": [
        { "listen": "prerequest", "script": {...} },  // 前置脚本
        { "listen": "test", "script": {...} }         // 测试断言
      ],
      "request": {...}
    }
  ]
}
```

---

### `/api-testcase-single <path>` - 生成单接口测试用例

**用途**：为单个接口生成测试用例

**参数**：
- `<path>`: 接口路径

**输出**：直接输出测试用例代码块，可复制使用

---

### `/api-refresh` - 刷新 API 文档

**用途**：从服务器重新下载最新的 API 文档

**操作步骤**：
1. 调用 `mcp_API__refresh_project_oas_qpu5ak` 刷新文档
2. 显示更新时间和接口统计

---

## 🔧 测试用例生成规则

### 1. 前置脚本（Pre-request Script）

```javascript
// 标准前置脚本模板
pm.variables.set('requestId', pm.variables.replaceIn('{{$guid}}'));
console.log('开始测试: {接口名称}');

// 依赖检查（如果有前置依赖）
const requiredVar = pm.collectionVariables.get('varName');
if (!requiredVar) {
    console.warn('警告: varName 未设置，请先执行前置接口');
}
```

### 2. 变量设置规则

**原则**：参数直接硬编码在请求中，只有接口间需要传递的动态数据才存入环境变量。

#### 直接传参（硬编码）

| 参数类型 | 示例值 | 说明 |
|----------|--------|------|
| 基础地址 | `https://api.onekey.so` | 直接写在 URL 中 |
| 网络ID | `sol--101` | 直接写在 Query 参数中 |
| 协议 | `kamino` | 直接写在 Query 参数中 |
| 测试金额 | `0.01` | 直接写在请求中 |
| 请求头 | `5.19.0` | 直接写在 Header 中 |

#### 动态传递（环境变量）

仅以下场景使用环境变量：

| 变量 | 来源接口 | 使用接口 | 提取方式 |
|------|---------|---------|---------|
| `marketAddress` | 获取 Market 列表 | 后续所有接口 | `pm.environment.set('marketAddress', data.markets[0].address)` |
| `reserveAddress` | 获取 Reserve 列表 | Reserve 详情、交易构建等 | `pm.environment.set('reserveAddress', data.supply.items[0].reserveAddress)` |
| `orderId` | 交易构建接口 | 交易确认接口 | `pm.environment.set('orderId', data.orderId)` |

### 3. 断言规则

#### 必须包含的断言：
```javascript
// HTTP 状态码
pm.test('响应状态码为 200', function() {
    pm.response.to.have.status(200);
});

// 响应时间
pm.test('响应时间小于 3000ms', function() {
    pm.expect(pm.response.responseTime).to.be.below(3000);
});

// 业务状态码
pm.test('业务状态码为 0', function() {
    pm.expect(jsonData.code).to.eql(0);
});
```

#### 根据响应结构生成的断言：

| 响应类型 | 断言模板 |
|----------|---------|
| 数组 | `pm.expect(jsonData.data.xxx).to.be.an('array')` |
| 对象 | `pm.expect(jsonData.data).to.have.property('xxx')` |
| 字符串 | `pm.expect(jsonData.data.xxx).to.be.a('string')` |
| 数值 | `pm.expect(jsonData.data.xxx).to.be.a('number')` |
| 布尔 | `pm.expect(jsonData.data.xxx).to.be.a('boolean')` |
| 非空 | `pm.expect(jsonData.data.xxx.length).to.be.above(0)` |

### 4. 边界测试用例规则

自动生成以下边界测试：

| 测试类型 | 说明 |
|----------|------|
| 缺失必填参数 | 移除每个必填参数，验证返回错误 |
| 无效参数值 | 传入无效格式的参数值 |
| 边界值 | 数值类型测试 0、负数、超大值 |
| 空值 | 传入空字符串或 null |

---

## 📁 输出文件格式

### 测试用例 JSON 格式

遵循 Postman Collection v2.1 规范：

```json
{
  "info": {
    "name": "集合名称",
    "description": "集合描述",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "变量名",
      "value": "默认值",
      "type": "string",
      "description": "变量说明"
    }
  ],
  "item": [
    {
      "name": "分组名称",
      "item": [
        {
          "name": "用例名称",
          "event": [
            {
              "listen": "prerequest",
              "script": {
                "type": "text/javascript",
                "exec": ["// 前置脚本代码"]
              }
            },
            {
              "listen": "test",
              "script": {
                "type": "text/javascript",
                "exec": ["// 断言脚本代码"]
              }
            }
          ],
          "request": {
            "method": "GET/POST",
            "header": [...],
            "url": {...},
            "body": {...}
          }
        }
      ]
    }
  ]
}
```

## 🚀 使用示例

### 示例 1：生成 Borrow 模块测试用例

```
用户: /api-testcase 5.19.0 Borrow

AI: 正在为 5.19.0 Borrow 接口集合生成测试用例...

✅ 已生成以下文件：
- docs/testcases/api/5.19.0-Borrow-Apifox-TestCases.json (24 个用例)
- docs/testcases/api/5.19.0-Borrow-导入说明.md

导入步骤：
1. 打开 Apifox → 设置 → 导入数据
2. 选择 Postman Collection v2 格式
3. 上传 TestCases.json 文件
```

### 示例 2：查看单个接口详情

```
用户: /api-read /earn/v1/borrow/markets

AI: ## 接口详情：获取 Market 列表

- **路径**：GET /earn/v1/borrow/markets
- **描述**：获取支持的借贷市场列表
...
```

### 示例 3：为单个接口生成用例

```
用户: /api-testcase-single /earn/v1/borrow/check-amount

AI: 为 check-amount 接口生成的测试用例：

{
  "name": "金额校验",
  "event": [...],
  "request": {...}
}
```

---

## ⚙️ 配置项

### 默认配置

在生成测试用例时使用的默认值：

```yaml
# 基础配置
baseUrl: https://api.onekey.so
responseTimeout: 3000  # 响应超时时间 (ms)

# Solana 网络默认值
networkId: sol--101
provider: kamino
marketAddress: 7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF

# 请求头默认值
X-Onekey-Request-Currency: usd
X-Onekey-Request-Locale: en
X-Onekey-Request-Theme: light
X-Onekey-Request-Platform: android-apk
X-Onekey-Request-Version: 5.19.0
X-Onekey-Request-Build-Number: 2000000000
```

### 自定义配置

可通过指令参数覆盖默认配置：

```
/api-testcase 5.19.0 Borrow --network=eth--1 --version=5.20.0
```

---

## 📚 相关资源

- [Apifox 导入文档](https://apifox.com/help/api-docs/import)
- [Postman Collection 格式](https://schema.postman.com/)
- [项目 QA 规则](../../qa-rules.md)

---

## 🔄 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| 1.0.0 | 2026-01-05 | 初始版本，支持基础测试用例生成 |
