# Swap - Private Send 测试

> 生成时间：2026-05-22
> 规则文档：`docs/qa/rules/swap-rules.md`、`docs/qa/qa-rules.md`
> 需求文档：`docs/qa/requirements/Swap-Private-Send.md`
> 测试端：Android / iOS / Desktop / Extension / Web
> 关联资源：设计稿见需求文档；Private Send 使用 RocketX 能力

## 测试范围说明

**功能范围**：Send 流程内的 Private Send 模式可见性、模式切换、金额输入页信息卡片、帮助中心跳转、订单提交流转、History Details、后台配置联动、多端布局差异。

**覆盖重点**：
- 可见性依赖「全局总开关 + OneKey 白名单 ∩ RocketX 支持范围」
- 进入 Send 页面默认 `Public`；Private 仅在支持组合下可切换
- History Details 按发送语义展示，不把目标币种作为主资产
- 慢链需覆盖 `Submitting` 中间态

---

## 前置条件

1. 已登录 HD 钱包 / HW 钱包，且账户内有可发送资产与网络手续费余额
2. 后端已提供 Private Send 可用性接口、报价接口、ETA、订单状态机、History 接口
3. Dashboard 可配置全局开关与「代币 + 网络」白名单
4. 已准备一组支持 Private Send 的快链组合、一组支持 Private Send 的慢链组合、一组不支持组合

## 1. 模式可见性与切换

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 当前代币 + 网络命中 Private Send 支持组合<br>2. 全局总开关=开启 | 1. 进入 Send 页面<br>2. 观察模式切换区域 | 1. 显示 `Public / Private` 切换控件<br>2. 默认选中 `Public`<br>3. Public 页面字段与现有 Send 流程一致 |
| ❗️❗️P0❗️❗️ | 1. 当前代币 + 网络不命中支持组合<br>2. 全局总开关=开启 | 1. 进入 Send 页面<br>2. 观察页面顶部与金额区 | 1. 不显示 `Public / Private` 切换控件<br>2. 页面仅保留原有 Public 发送流程元素<br>3. 不显示 Private 专属信息卡片 |
| ❗️❗️P0❗️❗️ | 1. 当前代币 + 网络命中支持组合<br>2. Send 页面已打开 | 1. 点击 `Private` | 1. `Private` 状态=选中<br>2. 页面切换到 Private 金额输入页<br>3. 显示 Private 专属信息卡片 |
| ❗️❗️P0❗️❗️ | 1. 当前位于 Private 模式<br>2. 初始组合=支持 | 1. 切换网络或代币到不支持组合 | 1. 模式自动切回 `Public`<br>2. `Public / Private` 切换控件隐藏<br>3. 页面继续显示 Public 流程字段 |
| ❗️❗️P0❗️❗️ | 1. 当前代币 + 网络命中支持组合<br>2. Dashboard 全局总开关从开启改为关闭 | 1. 返回 Send 页面或刷新当前页面 | 1. 不显示 `Public / Private` 切换控件<br>2. 页面按 Public 流程展示<br>3. 已关闭原因不通过 Private UI 暴露内部字段 |
| P1 | 1. 当前位于 Private 模式<br>2. 支持组合 A 与支持组合 B 均可用 | 1. 切换代币或网络到支持组合 B | 1. 仍显示 `Public / Private` 切换控件<br>2. 已选模式保持 `Private`<br>3. 金额输入页报价信息按新组合刷新 |

## 2. Private 金额输入页

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Private 模式<br>2. 当前组合支持 Private Send | 1. 查看金额输入页信息卡片 | 1. 显示 `Estimated received` 字段<br>2. 显示 `Arrival in` 字段<br>3. 显示 `Provider` 字段 |
| ❗️❗️P0❗️❗️ | 1. 已进入 Private 模式 | 1. 输入可报价金额 | 1. `Estimated received` 显示目标币种数量<br>2. `Estimated received` 同时显示法币价值<br>3. `Arrival in` 显示 ETA 结果<br>4. `Provider` 显示 `RocketX` |
| ❗️❗️P0❗️❗️ | 1. 已进入 Private 模式<br>2. 已输入金额并获得报价 | 1. 修改金额 | 1. `Estimated received` 随金额变化刷新<br>2. `Arrival in` 随最新报价刷新或保持最新返回值<br>3. 不显示 Public 模式专属文案替代 Private 字段 |
| P1 | 1. 已进入 Private 模式 | 1. 点击 `How it works?` | 1. 跳转至帮助中心文章页<br>2. 地址栏或 WebView URL 变为帮助中心链接<br>3. 当前点击有可观察反馈 |
| P1 | 1. Desktop / Extension / Web 进入 Private 模式 | 1. 观察 `How it works?` 与模式切换控件位置 | 1. `Public / Private` 位于页面右上角<br>2. `How it works?` 位于金额输入页左下角 |
| P1 | 1. Android / iOS 进入 Private 模式 | 1. 观察模式切换控件与 `How it works?` 位置 | 1. `Public / Private` 位于金额输入区域上方<br>2. `How it works?` 位于 `Preview` 下方 |

## 3. 提交与订单创建

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已进入 Private 模式<br>2. 已填写接收地址与金额<br>3. 当前报价有效 | 1. 点击 `Preview` 或等效下一步按钮<br>2. 核对预览信息 | 1. 预览页保留 Private 模式语义<br>2. 显示发送金额与网络信息<br>3. 显示 Provider=RocketX<br>4. 不把目标币种作为主发送资产展示 |
| ❗️❗️P0❗️❗️ | 1. Private 预览页已打开 | 1. 提交订单并完成钱包确认 | 1. 生成 Private Send 订单<br>2. History 中新增一条 Private Send 记录<br>3. 初始状态显示 `Submitted` 或链路定义的首个状态 |
| P1 | 1. Private 预览页已打开<br>2. 提交按钮可点击 | 1. 连续点击提交按钮 | 1. 仅生成一笔 Private Send 订单<br>2. 不出现重复 History 记录 |

## 4. History 列表与详情

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 已提交 Private Send 订单 | 1. 打开 History 列表 | 1. 新记录类型显示为 `Private Send`<br>2. 记录可进入详情页 |
| ❗️❗️P0❗️❗️ | 1. 已打开 Private Send History Details | 1. 查看 Token 区域 | 1. Token 区域仅显示 `Send Amount`<br>2. 不显示目标币种接收数量<br>3. 不显示 Swap 双资产主卡片样式 |
| ❗️❗️P0❗️❗️ | 1. 已打开 Private Send History Details | 1. 查看基础字段 | 1. `From` 显示当前钱包地址<br>2. `To` 显示用户在 Send 流程填写的目标接收地址<br>3. `Transaction ID` 显示用户付款链上 TxHash<br>4. `Provider` 显示 `RocketX` |
| P1 | 1. 链上实际收款地址与用户填写地址不同 | 1. 打开 Private Send History Details<br>2. 对比链上浏览器与详情页 | 1. 详情页 `To` 显示用户填写地址<br>2. 不把链上实际收款地址覆盖到 `To` 字段 |

## 5. 状态机与异常流转

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 使用快链支持组合提交 Private Send 订单 | 1. 观察 History 列表与详情状态变化 | 1. 状态按 `Submitted -> Pending -> Done` 流转<br>2. 状态条高亮位置与当前状态一致 |
| ❗️❗️P0❗️❗️ | 1. 使用慢链支持组合提交 Private Send 订单 | 1. 观察 History 列表与详情状态变化 | 1. 状态按 `Submitted -> Submitting -> Pending -> Done` 流转<br>2. `Submitting` 位于 `Submitted` 与 `Pending` 之间 |
| ❗️❗️P0❗️❗️ | 1. 订单被渠道或链上状态判定为失败 | 1. 打开 History 列表与详情 | 1. 记录终态显示 `Failed`<br>2. 列表与详情状态一致<br>3. 已完成步骤保持已点亮，不回退到未提交状态 |
| P1 | 1. 慢链订单停留在 `Submitting` 较长时间 | 1. 持续观察 History 状态 | 1. 状态持续显示 `Submitting`<br>2. 不自动切换为 `Failed`<br>3. 不显示与失败态冲突的文案 |

## 6. 配置联动

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. Dashboard 白名单包含组合 A<br>2. RocketX 当前支持组合 A | 1. 保存配置<br>2. 打开组合 A 的 Send 页面 | 1. 显示 `Public / Private` 切换控件<br>2. 可切换到 Private 模式 |
| ❗️❗️P0❗️❗️ | 1. Dashboard 白名单包含组合 B<br>2. RocketX 当前不支持组合 B | 1. 保存配置<br>2. 打开组合 B 的 Send 页面 | 1. 不显示 `Public / Private` 切换控件<br>2. 页面按 Public 流程展示 |
| P1 | 1. Dashboard 从白名单移除当前组合 | 1. 返回 Send 页面或重新进入当前代币发送页 | 1. Private 入口消失<br>2. 页面自动回到 Public 流程 |

## 7. 多端回归

| 优先级 | 场景 | 操作步骤 | 预期结果 |
|---|---|---|---|
| ❗️❗️P0❗️❗️ | 1. 分别在 Android / iOS / Desktop / Extension / Web 准备同一组支持 Private Send 的测试资产 | 1. 进入 Send 页面<br>2. 切换到 Private<br>3. 输入金额并提交订单 | 1. 各端均可显示 Private 模式入口<br>2. 三个信息字段与 Provider 展示一致<br>3. History 中均生成 `Private Send` 记录 |
| P1 | 1. 分别在移动端与桌面端进入 Private 模式 | 1. 对比控件位置与状态条布局 | 1. 移动端与桌面端位置差异符合需求文档说明<br>2. 状态条字段名称与顺序一致 |

## 变更记录

| 日期 | 版本说明 |
|------|----------|
| 2026-05-22 | 初版：新增 Private Send 测试用例，覆盖模式可见性、金额输入页、提交流程、History Details、状态机、配置联动、多端回归 |
