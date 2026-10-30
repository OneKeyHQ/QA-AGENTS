# Prime - 3 天免费试用期配置

## 背景

为 Prime 订阅增加 `3 天免费试用`，覆盖 iOS / Android / Web 三端订阅入口与回调链路，确保 trial 展示、购买链路、权益生效和 eligibility 限制一致。

- 需求来源：OK-53205
- 关联版本：App-6.3.0
- 标签：prime / revenuecat / trial

## 范围与目标

### 范围
- 客户端 Prime 订阅页 CTA 与订阅流程展示
- RevenueCat 商品配置与 offering 挂载（Web）
- iOS / Android 商店订阅试用配置
- 服务端 webhook 对 trial 事件处理

### 非范围
- 既有已订阅用户的订阅迁移
- 非 Prime 订阅体系改造

## 功能规则

### 1. Prime 免费试用展示规则

| 规则项 | 规则描述 |
| --- | --- |
| trial 文案展示 | 符合对应渠道资格的用户在 Prime 订阅入口可看到 `Start 3-day free trial`（或等价本地化文案） |
| 支付弹窗展示 | App Store / Google Play / 信用卡支付流程按各自资格展示 3 天试用信息 |
| 试用后续费提示 | 试用结束后自动续费的金额和周期需在订阅流程中可见 |

### 2. 资格（Eligibility）规则

| 规则项 | 规则描述 |
| --- | --- |
| 信用卡资格 | 当前用户 ID 从未激活过 Prime 时可获得一次 3 天试用 |
| 信用卡历史激活限制 | 当前用户 ID 曾经激活过 Prime，无论来源是任意付费订阅、兑换码或后端直接赠送，信用卡的 3 天免费试用均失效 |
| 商店资格 | iOS App Store、Android Google Play 的免费试用资格由对应商店独立控制，不受 OneKey ID 历史 Prime 激活状态影响 |
| 商店与信用卡隔离 | 商店试用资格和信用卡试用资格分别判断，不能用一方资格推断另一方资格 |
| 加密货币支付 | 加密货币支付不支持 3 天免费试用，不进入 trial 资格或商品链路 |
| 资格绑定主体 | 信用卡 trial 资格绑定用户 ID；删除并重新注册 OneKey ID 生成新的用户 ID 后，可以重新获得信用卡 trial；商店 trial 资格以对应商店账户和商店规则为准 |

### 3. 平台配置规则

| 平台 | 配置位置 | 配置要求 | 生效规则 |
| --- | --- | --- | --- |
| iOS | App Store Connect → Subscriptions → `Prime_Monthly` / `Prime_Yearly` | Introductory Offer: Free / 3 days / All Regions | 沙箱一般 ≤1h，生产按 Start Date 自动生效 |
| Android | Play Console → Subscriptions → `prime-monthly` / `prime-yearly` | Offer: Free trial 3 days；Eligibility: Has never subscribed | 配置后即时生效 |
| Web | RevenueCat Dashboard → Offerings → `Default_offering` | 使用 `Web_Prime_Monthly_Trial` / `Web_Prime_Yearly_Trial` 替换非 trial 产品 | 配置后即时生效 |

### 4. Web Offering 挂载规则

| 规则项 | 规则描述 |
| --- | --- |
| Default offering | 生产使用 `Web_Prime_Monthly_Trial` 与 `Web_Prime_Yearly_Trial` |
| Sandbox offering | `Sandbox_testing` 保留用于沙箱验证，不替换 |
| 替换约束 | 只替换 Default offering 的 package，不影响 sandbox 回归链路 |

### 5. 服务端回调规则

| 规则项 | 规则描述 |
| --- | --- |
| 事件类型 | Webhook handler 支持 `INITIAL_PURCHASE` / `RENEWAL` / `EXPIRATION` |
| trial 标识 | 通过 `period_type: TRIAL` 识别试用周期事件 |
| entitlement | trial 购买完成后用户应获得 Prime entitlement；到期后按状态流转 |

### 6. 兼容与影响规则

| 规则项 | 规则描述 |
| --- | --- |
| trial_duration 不可编辑 | RevenueCat 旧产品 trial 时长不可直接修改，需新建 trial 产品 |
| 现有订阅用户影响 | 现有订阅用户继续在旧产品续费，不受 trial 产品变更影响 |
| 新购路径 | 新购买用户优先走 trial 产品路径 |

## 验证清单（需求验收）

| 端 | 验证项 | 验收标准 |
| --- | --- | --- |
| iOS | Sandbox 购买 | 显示 trial 信息，完成购买后权益生效 |
| Android | Internal Testing + License Tester | Play 弹窗显示 trial，购买后权益生效 |
| Web | 当前用户 ID 从未激活 Prime 的信用卡购买 | 展示 trial CTA，试用期内不扣款且 entitlement 生效 |
| 信用卡 | 历史激活限制 | 付费订阅、兑换码或后端赠送任一方式激活 Prime 后，信用卡不展示 3 天 trial |
| 商店渠道 | 独立资格 | iOS / Android 免费试用按对应商店资格返回，不受 OneKey ID 历史激活状态影响 |
| 全端 | 加密货币限制 | 加密货币支付始终不展示 trial |
| 信用卡 | 删除重注册 | 删除并重新注册 OneKey ID 生成新的用户 ID 后，可重新获得信用卡 trial |

## 风险与关注点

- 商店配置存在发布延迟，需区分沙箱与生产验证窗口。
- Web offering 若替换错误，可能导致生产用户仍走非 trial 包。
- webhook 解析 `period_type` 异常会影响 entitlement 判断。

## 关联资源

- Jira: OK-53205（Prime 3 天免费试用期配置）
- 客户端 PR: https://github.com/OneKeyHQ/app-monorepo/pull/11385
- 关联测试任务：OK-54091

## 变更记录

| 日期 | 版本 | 变更内容 |
| --- | --- | --- |
| 2026-05-08 | v1.1 | 补充 trial 资格跨端/跨支付方式去重规则，新增对应验收项 |
| 2026-10-29 | v1.2 | 修正信用卡 trial 资格绑定用户 ID；删除并重新注册 OneKey ID 生成新用户 ID 后可重新获得信用卡 trial |
| 2026-05-08 | v1.0 | 基于 OK-53205 新增 Prime 3 天免费试用期需求文档 |
