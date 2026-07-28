# Perps 快捷交易（加仓/追单/BBO 5 档）代码审查发现

**时间：** 2026-07-27
**范围：** app-monorepo PR #12554（主改动）、#12613（确认弹窗打磨）、#12621（官方后续修复）+ `x` 分支当前源码
**对照用例：** `2026-07-27_Perps-加仓与追单.md`、`2026-01-03_Perps-限价单最优价格BBO.md`
**背景：** PR #12621 已官方修复 #12554 的 3 个 bug（TP/SL 种子截断偏差 OK-58396、加仓校验静默禁用 OK-58391、缺滑杆 OK-58389），现用例按修复后行为编写。

---

## 一、确认 Bug（建议提单）

| # | 模块 | 问题 | 位置 | 失败场景 |
|---|------|------|------|---------|
| B1 | BBO | **现货限价单最优价入口丢失**（需求要求现货支持，已确认为 bug） | `LimitOrderForm.tsx` / `PerpTradingForm.tsx` `!isSpot` 屏蔽 | 现货限价单无「最优价」按钮；修复回归清单见下方「现货修复范围」 |
| B2 | BBO | **订单票（图表限价弹窗）提交用按下瞬间的 BBO 快照价，非确认时最新价** | `LimitOrderForm.tsx:767-897` + `OrderConfirmModal.tsx:455-458`（override 不重算） | 确认页停留期间 BBO 100.05→100.08，点确认提交 100.05。违反「提交用最新 BBO」需求；主面板路径正确，两路径不一致 |
| B3 | BBO | **订单票展示价不随 BBO 实时更新** | `LimitOrderForm.tsx:265-288`（bbo 走 ref，不在 memo 依赖里） | ticket 内启用 BBO 后 SizeInput 换算参考价/订单价值冻结在启用瞬间；提交价不受影响，纯展示 bug |
| B4 | BBO | **订单票无「BBO 不可用」禁用态** | `LimitOrderForm.tsx:517-519, 768-775` | BBO 订阅失败时买卖按钮仍可点，点击报「输入价格」toast；主面板正确（禁用+「最优价不可用」） |
| B5 | 加仓 | **下单失败双重 Toast，第二条为英文拼接串** | `AddPositionModal.tsx:416-424` + `withToast` 双弹 | HL 拒单时先弹本地化错误，再弹 `Failed to place market order open: ...` 英文 |
| B6 | 加仓 | **USD 单位最小金额提示死循环** | `addPosition.ts:117`（usd 单位未按 lot 上取整） | szDecimals 粗的币（如 1 位、价 3.4567）：输 $10 → floor 后名义 $9.68 <$10 → 提示「Min $10」→ 按提示输入仍失败 |
| B7 | 加仓 | **限价加仓 maxSize 未按限价折算** | `AddPositionModal.tsx:193,364`（直接用 maxTradeSzs，主面板会按限价重折算） | 限价>标记价时 100% 滑杆超出可用保证金 → 本地校验放行 → HL 拒单（叠加 B5 双 Toast） |
| B8 | 加仓 | **资产数据加载失败按钮永久静默禁用** | `AddPositionModal.tsx:163-167`（错误吞掉）+ `:612` disabled | 断网打开弹窗 → 按钮 disabled、无提示、无重试；恢复网络也不恢复，与 OK-58391「不静默禁用」意图相悖 |
| B9 | 加仓 | **市价单 mid 缺失时提示「输入价格」** | `AddPositionModal.tsx:194,116` | allMids 未就绪时提交市价单报「输入价格」，但市价界面无价格框；USD/保证金换算也不可用 |
| B10 | 追单 | **弹窗勾选「不再显示」后点取消，开关已持久化** | `ChaseOrderConfirmModal.tsx:133-148`（勾选即写 atom） | 勾选→反悔取消→下次点任意「追单」无弹窗直接改单；且下单确认弹窗同步被跳过（共用 skipOrderConfirm）。OrderConfirmModal 同模式属既有行为，追单场景风险放大 |

## 二、高优先实测项（SUSPICIOUS）

| # | 模块 | 问题 | 说明 |
|---|------|------|------|
| S1 | 追单 | **`alwaysPlace`（`a` 字段）依赖手工 patch 的 SDK，未线上验证** | commit 自述未测 live 执行。若服务端拒绝 → 追单全挂；若静默按 ALO 处理 → 追到对手价也不成交。**回归必须真实成交一次**（用例 §6 行 2） |
| S2 | 加仓 | **TP/SL 价格方向无本地校验** | 多仓 TP 输入低于现价直接发 HL（SetTpslModal 有完整校验，加仓弹窗没有）→ 英文报错+双 Toast。建议补用例+建议开发补校验 |
| S3 | BBO | **订单票 szDecimals 兜底 `?? 2`** | universe 未加载瞬间用错网格算 5 档偏移 → 提交可能被 HL 拒；主面板是报 bbo_unavailable，两侧策略不一致 |
| S4 | BBO | **低价币「同向价 5」下偏越 0 保护返回 null** | 不会出负价（✓），但显示「最优价不可用」语义误导（BBO 数据实际正常）。需确认 HL 是否存在该价格量级币种 |
| S5 | 追单 | 后台 modify 无 expectedAccountAddress 守卫（下单有） | UI 三重比对已覆盖绝大多数场景，毫秒级窗口靠 HL 拒外部 oid 兜底；防御深度与加仓不一致 |
| S6 | 追单 | modify size 用 atom 快照剩余量 | WS 推送与改单落地间又部分成交 → 累计成交可能超原始委托量（HL modify 撤旧下新固有），知悉即可 |
| S7 | 加仓 | scope 重查通过后到落地间仓位被全平 → 开出新仓而非加仓 | 后端无持仓校验，极小窗口，实测确认级别 |

## 三、需产品确认

| # | 问题 | 现状 |
|---|------|------|
| P1 | 加仓单附带 TP/SL 只覆盖**加仓数量**、触发价参考**加仓价**（非新加权均价、非全仓） | `grouping:'normalTpsl'`，方向正确；size/参考价语义需产品定调后补用例说明 |
| P2 | 加仓**无二次确认弹窗**（弹窗内按钮即「确认订单」，不读 skipOrderConfirm） | 用例 §2 行 5 假设有确认弹窗，与代码不符；需确认是否要求补确认弹窗 |
| P3 | 观察模式（watch 自己地址）**追单按钮可见**，确认后才引导启用交易 | 用例 §4 行 3 预期「不可用」；「不发起改单」成立。确认是否 by design |
| P4 | **现货切币重置 BBO 选项和订单类型**，合约切币则保留 | `changeActiveSpotAsset` 强制 `type:'market', bboPriceMode:null`；修 B1 时需定调现货是否对齐合约保留语义 |
| P5 | 限价默认价 = **弹窗打开时**的 mid（非切到限价时），停留后偏离 | 可点 Mid 手动刷新；确认是否接受 |
| P6 | 滑杆 N% 提交时按最新 max 重算，保证金**变大**方向也静默放大下单量 | 防越界正确（OK-58389 目的）；放大方向无提示，确认是否接受 |
| P7 | 未启用交易追单：英文「Trading not enabled」toast + 启用弹窗双重反馈 | `actions.ts:3479` 硬编码英文 |

## 四、现货 BBO 修复范围（B1 修复时的回归清单）

后端链路现货已具备（BBO 订阅/updateBbo/freshness 均模式无关），缺口全在 UI/计算层，**只删 `!isSpot` 不够**：
1. `LimitOrderForm.tsx`：`:207` isBBOActive、`:270` bboPriceMode 传参、`:721-725` 强清 effect、`:1095` 入口渲染
2. `PerpTradingForm.tsx`：`:515`、`:930-933` 强清 effect、`:2187` 入口
3. `useOrderPrice.ts:184,237-241`：现货需传 `universe.baseSzDecimals`（字段名与 perp 的 szDecimals 不同，直读会 undefined → 永远 bbo_unavailable）
4. `perpsUtils.ts:689`：`getNextHlPrice(..., 'perp')` 硬编码——现货网格是 8-szDecimals，需贯穿 instrument type，否则现货 5 档 tick 算错
5. `actions.ts:1812-1817`：现货切币重置逻辑（见 P4）
6. 订单票 `:777` 用 perp 格式化，现货需换 `formatSpotPriceToValid`
7. `minimumOrderGuard.ts`：现货有 BBO 时恢复 $10 校验的差异需产品确认
8. `useOrderPrice.test.ts` 中 "ignores a stale BBO selection after switching to spot" 测试固化了 bug 行为，修复时必须改写

## 五、已验证无问题的维度（摘要）

- tick 数学：getHlPriceTick 各量级正确；跨数量级双向对称（patch 15 已修早期 snap 缺陷）；1 档价原样返回不被改写；提交格式化为恒等变换
- BBO：8 种 side×type×offset 组合与用例 §1a 语义表完全一致；freshness 节流无回归；确认页显示选项名、默认对手价 1 ✓
- 追单：bid/ask 索引方向正确；弹窗展示价即提交价 ✓；跳过弹窗实时取价 ✓；loading 锁 finally 释放无永久卡死；canChase 过滤（IOC/ALO/触发/TPSL/现货/TWAP 均无按钮）✓；cloid/reduceOnly/tif 完整保留 ✓；19 语言文案已落 locale
- 加仓：isBuy/reduceOnly/TIF 正确；市价用提交时新拉 markPx（非 stale mid）；账户切换双层拦截有效；$10 恰好边界放行 ✓；滑杆互斥 ✓；PR #12621 的 nearest 取整无回归

## 六、用例修正记录

已修正（截图+代码双重确认）：
- 5 档标识：确认页/下拉显示「对手价 5 / 同向价 5」全名，非「+5」后缀（用例、规则、需求文档同步改）
- BBO 启用后价格输入框被选择器替换：数值观察点改为多空按钮价格/提交后委托价

待产品定调后修正：P2（加仓确认弹窗）、P3（观察模式追单入口）、P1（TP/SL 覆盖范围）、§3 行 1 文案（数量为空的 Toast 实为「最小 $10」）、B8（断网行为按 bug 跟踪，用例保留需求口径）
