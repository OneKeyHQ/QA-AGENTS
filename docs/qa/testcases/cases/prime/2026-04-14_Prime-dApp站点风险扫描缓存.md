# Prime - dApp 站点风险扫描缓存测试用例

> 需求文档：`docs/qa/requirements/Prime-dApp站点风险扫描缓存.md`  
> 规则文档：`docs/qa/rules/prime-rules.md` 第 `4.10` 节  
> 测试端：iOS / Android / Desktop / Extension / Web（Browser / DApp 场景）  
> 更新日期：2026-04-16

## 前置条件

1. 已准备 A URL 与 B URL 两组可复现测试地址
2. 当前环境可访问 Browser / DApp 页面并可调用 `/utility/v1/discover/check-host`
3. 已准备 Prime 用户与非 Prime 用户两类测试账号

### 验证方法

- Blockaid 风险状态通过 `/utility/v1/discover/check-host` 接口查看
- 测试用 URL 需满足前提：scamsniffer 和 goplus 两项基础风险检查结果均未返回风险

---

## 1. 缓存写入与复用 — Blockaid 结果为其他风险等级

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. A URL 为风险站点（Blockaid 应返回非 `security` 的风险等级）<br>2. scamsniffer、goplus 对 A URL 均无风险<br>3. 当前用户未登录或为非 Prime 用户<br>4. A URL 无已有缓存 | 1. 访问 A URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. Blockaid 风险状态为 `unknown` |
| ❗️❗️P0❗️❗️ | 1. 紧接上一步<br>2. 切换为 Prime 用户 | 1. Prime 用户访问相同 A URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. 触发 Blockaid Site Scan 请求<br>2. Blockaid 风险状态为具体风险等级（非 `unknown`、非 `security`） |
| ❗️❗️P0❗️❗️ | 1. 紧接上一步<br>2. 切换为未登录或非 Prime 用户 | 1. 再次访问相同 A URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. Blockaid 风险状态与 Prime 用户看到的风险等级一致<br>2. 复用服务端缓存结果 |

---

## 2. 缓存写入与复用 — Blockaid 结果为 security

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. B URL 为安全站点（Blockaid 应返回 `security`）<br>2. scamsniffer、goplus 对 B URL 均无风险<br>3. 当前用户未登录或为非 Prime 用户<br>4. B URL 无已有缓存 | 1. 访问 B URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. Blockaid 风险状态为 `unknown` |
| P1 | 1. 紧接上一步<br>2. 切换为 Prime 用户 | 1. Prime 用户访问相同 B URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. 触发 Blockaid Site Scan 请求<br>2. Blockaid 风险状态为 `security` |
| P1 | 1. 紧接上一步<br>2. 切换为未登录或非 Prime 用户 | 1. 再次访问相同 B URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. Blockaid 风险状态为 `security`（与 Prime 用户看到的一致）<br>2. 复用服务端缓存结果 |

---

## 3. 缓存隔离与过期

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. dApp URL A 已存在有效缓存 | 1. 打开不同的 dApp URL B<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. URL B 不复用 URL A 的缓存结果 |
| P1 | 1. 某 dApp URL 的缓存已超过 3 天 | 1. 再次打开相同 dApp URL<br>2. 调用 `/utility/v1/discover/check-host` 查看 Blockaid 状态 | 1. Blockaid 风险状态为 `unknown` |

---

## 4. 原有链路与异常兜底

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 任意用户访问 dApp URL | 1. 打开 dApp URL<br>2. 观察原有 dApp URL 风险检测链路 | 1. 原有 dApp URL 风险检测链路继续执行 |
| P1 | 1. Blockaid 请求失败、超时或缓存不可用 | 1. 打开 dApp URL | 1. 当前异常不阻断原有 dApp URL 风险检测链路 |
