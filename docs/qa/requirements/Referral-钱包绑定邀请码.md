# Referral - 钱包绑定邀请码

## 需求背景

通过修改 Web 端邀请页面样式并结合 Deeplink 引导，将新用户从点击邀请链接到完成 Perps/DeFi 转化的流程从 20 步缩短至 12 步，提高转化率。

## 测试端

iOS / Android / Extension / Desktop / Web

## 改动总览

- **Web 端邀请落地页**（`/r/:code/app/:page`）由原先的 spinner + 自动唤起 App，重做为 3 步漏斗：**下载 → 绑定邀请码 → 立即交易 / Earn**
- **App 内**（iOS / Android / 桌面客户端 / 浏览器扩展）邀请页面保持原行为不变

## 一、Web 落地页结构

| 区块 | 内容 |
|------|------|
| 顶部 Header | 左：OneKey 字标 logo（点击回首页 `/`）；右：语言切换器；高度 52px |
| Hero（左 / 上） | 头图 + 主标题（含 10% 高亮）+ 副标题 |
| Step 1（右 / 下） | 标题「下载 OneKey App」+ 主按钮（按平台切换）+ 次按钮「我已有钱包」 |
| Step 2 | 标题「绑定邀请码」+ 邀请码框（点击复制）+ 主按钮「绑定」 |
| Step 3 | 标题 / CTA 按 variant 切换（见下表） |

## 二、Variant 差异（Perps vs DeFi）

由 URL `page` 参数驱动：

| URL 参数 | Variant | Hero 主标题 | Step 3 标题 | Step 3 按钮 |
|----------|---------|-------------|-------------|-------------|
| `perp` / `perps` | Perps | 朋友邀你享 10% Perps 手续费返还 | 立即交易，每笔自动返还 10% 手续费 | 去交易 |
| `earn` / `defi` | DeFi | 朋友邀你享 10% DeFi 收益返还 | 开启 Earn，自动多赚 10% 收益 | 去 Earn |
| 缺省 / 未识别 | Perps（默认） | 同 Perps | 同 Perps | 同 Perps |

折扣百分比（10%）由后端 `getPostConfig` 实时下发；请求未返回前默认显示 10%。

## 三、平台差异（下载 & Deeplink）

### Step 1 下载主按钮

| 平台 | 主按钮文案 | 行为 |
|------|------------|------|
| iOS Web | Download from App Store | `itms-apps://` 唤起 App Store；300ms 后页面仍可见且耗时 ≤1.5s 时回退 HTTPS App Store 链接 |
| Android Web | Download from Google Play | 直跳 Play Store |
| 桌面 Web | Download OneKey | 跳转下载页 |

### Step 2 / Step 3 Deeplink 唤起

| 平台 | 唤起方式 |
|------|----------|
| iOS / 桌面 Web | 直接 `onekey-wallet://invited_by_friend?code=<code>&page=<page>` |
| Android Web | 走 `intent://` URL（带 Play Store 兜底，避免 `ERR_UNKNOWN_URL_SCHEME` 白屏） |

Web 端「绑定」按钮先探测是否安装浏览器插件钱包（EIP-6963 等方式）：
- 已安装 → 直接唤起 OneKey 插件钱包，由插件完成连接 + 签名 + 绑定
- 未安装 → 走 Deeplink 唤起桌面端 / 移动端 App

## 四、多语言文案

Step 2「绑定」同步全语言；其中 zh_CN / zh_HK / zh_TW 已做本地化文案优化：
- 视角统一为被邀请者
- 避免「领取」误导，统一改为「绑定」

## 五、埋点

每次进入落地页与按钮点击均上报 `referralLanding`，`utmSource` 区分场景：

| 触发点 | utmSource |
|--------|-----------|
| Step 1「下载」 | `web_appstore` |
| Step 1「我已有钱包」 | `web_already_have_skip` |
| Step 2「绑定」（扩展） | `web_bind_extension` |
| Step 2「绑定」（Deeplink） | `web_bind_deep_link` |
| Step 3「去交易 / 去 Earn」 | `web_trade_deep_link` |
| Step 2「复制」 | `referral.page.copyReferralCode` |

## 六、测试入口示例

| URL | Variant |
|-----|---------|
| `/r/TESTCODE/app/perps` | Perps |
| `/r/TESTCODE/app/earn` | DeFi |
| `/r/TESTCODE/app/defi` | DeFi |
| `/r/TESTCODE/app` | 默认 Perps |
| `/r/TESTCODE` | 默认 Perps |
| `/r/invite?code=TESTCODE` | 兼容 query 参数形式（默认 Perps） |

## 七、App 内绑定流程（保持原行为）

### 钱包首页 Banner

- 新创建钱包后，钱包首页顶部展示「加入 onekey 推荐计划」banner
- 仅未绑定且具备私钥的钱包展示（HD / HW / Keyless / 私钥钱包）
- 已绑定钱包不展示
- 用户可点击「加入」或主动关闭（关闭仅当前会话生效，下次进入仍展示）

### 输入邀请码与签名

| 钱包类型 | 签名方式 | 备注 |
|----------|----------|------|
| HD 钱包 | 静默 EVM 消息签名 | 无需用户操作 |
| HW 钱包（标准固件） | EVM 消息签名 | 用户在 HW 设备上确认 |
| HW 钱包（BTC-only 固件） | Taproot 签名 | 用户在 HW 设备上确认 |
| Keyless Wallet | 静默签名 | 与 HD 一致 |

签名页规则：
- 网络与地址不可切换（绑定固定为账户 1 EVM / Taproot 地址）
- 签名内容包含邀请码 + 待绑定地址
- 「查看详情」展示完整内容
- 「取消」关闭签名页，不发起绑定
- 「授权」签名后绑定成功，banner 消失

### 邀请码输入校验

| 输入异常 | 提示 |
|----------|------|
| 空 + 点击「加入」 | 输入框红色边框提示 |
| 超过 30 字符 | 无法输入（前端拦截） |
| 非字母 / 数字（特殊字符 / 中文 / 空格 / Emoji） | 前端 / 后端提示「邀请码不存在」 |
| 不存在的码 | 后端提示「邀请码不存在」 |

### 钱包入口规则

| 钱包类型 | Banner | 钱包更多 -「邀请码」选项 |
|----------|--------|--------------------------|
| HD 钱包（未绑定，14 天内） | 显示 | 可点击 |
| HW 钱包（未绑定，14 天内） | 显示 | 可点击 |
| Keyless Wallet（未绑定，14 天内） | 显示 | 可点击 |
| 未绑定 + **创建超过 14 天** | 不显示 | 显示「不适用」+ 置灰 + (i) 提示 |
| 已绑定钱包 | 不显示 | 显示「已绑定」+ 置灰 |
| 私钥钱包 | 不显示 | 不显示选项 |
| 观察账户 / 外部账户 / QR Wallet | 不显示 | 不显示选项 |
| 隐藏钱包 | 不显示 | 不显示选项 |
| Ton 助记词钱包 | 不显示 | 不显示选项 |

### 14 天有效期规则

- 钱包创建后 **14 天内**未绑定可继续绑定；超过 14 天后无法再绑定
- 「不适用」徽章右侧显示 (i) 信息图标，点击提示：**「该钱包创建已超过 14 天，无法绑定邀请码」**

### 异常场景

- HW 重置后再次创建 → 跟随助记词判断
- 弱网 → 弹窗加载与交互不卡顿
- 未备份 HD 钱包 → 仍支持绑定
- 未绑定钱包重新导入 → 提示「钱包已存在」，进入后仍可绑定

## 八、不在改动范围

- App 内 InvitedByFriend 弹窗（保持原「自动切 tab → 弹模态」逻辑）
- 浏览器扩展 popup 邀请流程
- 后端绑定接口 / Deeplink 注册

## 关联资源

- 需求文档（Confluence）：https://onekeyhq.atlassian.net/wiki/spaces/ONEKEY/pages/edit-v2/1771864070
- Slack 讨论：https://onekeygroup.slack.com/archives/C01M04NC6MT/p1776835761630219

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-05-08 | v1.0 | 首版：Web 端邀请落地页改版为 3 步漏斗（下载 → 绑定 → 交易 / Earn）；App 内行为保持不变 |
