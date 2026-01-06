# 🚀 Apifox 测试用例生成器 - 快速参考

## 指令速查表

| 指令 | 功能 | 示例 |
|------|------|------|
| `/api-list` | 列出所有 API | `/api-list` |
| `/api-read <path>` | 查看接口详情 | `/api-read /earn/v1/borrow/markets` |
| `/api-testcase <name>` | 生成测试集合 | `/api-testcase 5.19.0 Borrow` |
| `/api-testcase-single <path>` | 单接口用例 | `/api-testcase-single /earn/v1/borrow/check-amount` |
| `/api-refresh` | 刷新 API 文档 | `/api-refresh` |

---

## 快速开始

### 1. 生成测试用例
```
/api-testcase 5.19.0 Borrow
```

### 2. 输出文件
```
docs/testcases/api/
├── 5.19.0-Borrow-Apifox-TestCases.json  ← 导入这个
└── 5.19.0-Borrow-导入说明.md
```

### 3. 导入 Apifox
1. Apifox → 设置 → 导入数据
2. 选择 **Postman Collection v2**
3. 上传 `*-TestCases.json`

---

## 支持的接口集合

| 集合名称 | 路径前缀 | 模块 |
|---------|---------|------|
| `5.19.0 Borrow` | `/earn/v1/borrow` | Earn |
| `Swap` | `/swap/v1` | Swap |
| `Wallet` | `/wallet/v1` | Wallet |
| `Lightning` | `/lightning/v1` | Lightning |

---

## 测试用例包含

✅ **前置脚本** - 生成请求ID、依赖检查  
✅ **变量** - 网络、地址、金额等  
✅ **断言** - 状态码、响应时间、业务逻辑  
✅ **边界测试** - 负数、零值、超大值

---

## 常用变量

| 变量 | 默认值 |
|------|--------|
| `baseUrl` | `https://api.onekey.so` |
| `networkId` | `sol--101` |
| `provider` | `kamino` |
| `testAmount` | `0.01` |

---

## 需要帮助？

查看完整文档：[SKILL.md](./SKILL.md)
