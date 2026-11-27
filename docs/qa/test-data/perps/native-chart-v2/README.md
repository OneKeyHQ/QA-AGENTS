# Perps 原生图表独立数值样本 v2

覆盖6.8.0新增25类指标及TRIX / EMV / ROC / MTM主体和新增均线。2026-11-27补齐批采用JSON schema 4：在两组Perps参数、行情清洗分层、连续快照及四图基础负载上，增加同一面板往返切周期的行情与独立期望。消费文件完整性校验包括新增帧，旧schema文件不能沿用。v1的17类、90项绘图和指纹保持不变。测试自选参数不确认产品默认值。

## 来源与独立性

- [reference.py](reference.py) 只用Python标准库按[固定SHA指标兼容公式](https://github.com/OneKeyHQ/app-monorepo/blob/054fa331a4053e079ccd73a0ffa551c5910d3237/packages/kit/src/components/TradingView/TradingViewNative/utils/chartIndicators/SUB_CHART_INDICATORS.md#8-indicators-added-after-the-legacy-set)独立计算；[scenarios.py](scenarios.py) 独立构造清洗后行情、连续快照、有效性时间标记及负载输入，均不导入或运行产品代码。未重新采集外部交易所数据。
- [test_reference.py](test_reference.py) 保留手算、闭式结果、预热、因果性及缩放测试；[test_contract.py](test_contract.py) 验证Perps零量口径、MTM可达来源约束、清洗窗口、连续快照、公共时钟、恢复会话、手算周期聚合、往返恢复及真实CLI拒绝缺组／篡改的行为。
- [fingerprints.json](fingerprints.json) 冻结整份文档及53个分组。数值按12位有效数字归一化后SHA-256；整文包括元数据、参数组、场景集合、输入、期望、时标及负载。原compact的12条算术指纹保持不变；MTM界面参数可达性修正后，按独立参考重新冻结受影响组；未使用产品返回值生成期望或刷新指纹。
- [compare-product.mjs](compare-product.mjs) 先读取一次待消费JSON，将同一份字节交 `generate.py --verify-stdin` 核验，再解析比较；缺参数组、缺行情组、整批空数组、改输入／参数／期望、删序列／负载均须非零退出。合法empty场景随完整语料保留，不能整批只跑empty。
- 对照只读 `git show` 的固定SHA `054fa331a4053e079ccd73a0ffa551c5910d3237`，运行原始数学函数、真实Hyperliquid provider及精确提取的历史清洗函数。逐系列核对57条输出，严格区分null与0并拒绝NaN / Infinity。不修改产品checkout，不连接App，不执行交易。
- 该对照验证每个快照的清洗和计算。UI缓存、实时消息合并、图例、填充、颜色、持久化及性能仍需App执行；四图计算通过不代表四图性能通过。现有UI脚本未接入这些样本。

## 容易混淆的兼容口径

| 名称 | 本样本采用的口径 |
| --- | --- |
| SMI | Squeeze Momentum：线性回归动量及挤压状态，SQZ 为 1 / -1 / 0；不是随机动量指数 |
| TSI | Trend Strength Index：价格与时间的 Pearson 相关系数，范围 -1～1，平价为 null；不是 True Strength Index；参见 [TradingView 说明](https://www.tradingview.com/support/solutions/43000730926-trend-strength-index/) |
| RVI | Relative Volatility Index，标准差按涨跌分配，内部两侧 EMA 固定 14，Signal 为 SMA；不是 Relative Vigor Index |
| ENV | 因果高斯加权中心与绝对偏差带；中心、偏差窗口在短历史时收缩，满 3 个带宽且不晚于 lookback 开始显示；不是固定百分比包络 |
| VWAP | TP=(H+L+C)/3 的滚动成交量加权窗口，不按交易日锚定 |
| SUPERTREND | ATR 首根为空，RMA 用首个完整窗口 SMA 起算；初始下行，越过上界转上行，低于下界转下行，相等保持；通道递推另见 [TradingView 公式](https://www.tradingview.com/support/solutions/43000634738-supertrend/) |
| NVI / PVT | 无任何正成交量时全部为空；缺量、缺价跳过，下一有效点比较上一个有效点。两组Perps参数均将0当实际零量。股票“零量当缺量”的口径仅保留在算术辅助测试，不能用作Perps UI参数。NVI 均线从首个 NVI 起算 EMA，非完整窗口 SMA |
| RCI | 并列取平均名次后仍使用平方名次差公式，平价读 50。这是项目兼容口径，与 [TradingView 的精确名次相关系数定义](https://www.tradingview.com/support/solutions/43000765570-rank-correlation-index-rci/)在并列值时有差异，不据此改产品预期 |
| SLOPE | EMA 相对变化乘 6392；6392 是项目记录的兼容尺度，不是通用斜率定义 |
| TRIX / EMV / ROC / MTM | TRIX=10000×三重 EMA(ln C) 的一阶差，EMV 使用参数 divisor；四类新增均线均为主体输出的 SMA，不是价格均线。ROC 与 MTM 对比较基价为 0 的点留空；TRIX 对非正价格留空并重新预热 |
| QQE | RSI 经 EMA 后，以双重 EMA 的绝对变化形成带宽。快慢线保留前两根带状态，跨越判定比较 band[t-1] 与 band[t-2]，缺失点保留带状态。项目说明记录短历史下快慢线与外部参考读数约有 0.05 差异；本样本未重新核实该外部差异，不把源码相等视作外部一致 |

除上述累计状态外，SMA 要求完整连续有效窗口；EMA / RMA 缺失后重新用完整 SMA 预热。KDJ 的递归状态和上一 RSV 保留；SuperTrend 无有效带时重新从下行起算。ENV 的缺失影响需等中心及偏差窗口恢复。PVT / NVI 的“整段是否有正成交量”门控允许首次正量到来后补出此前零量段，这是已记录的全段门控例外；因果性测试单独排除此例外，不把未来数据用于其他公式。

## 输入层、参数与断言

市场为虚构 `QA-NATIVE-USD`，基础12类行情为1m、UTC、秒时间戳，起点2026-01-01。只在隔离环境注入，历史、实时推送、市场元数据和受控时钟须配套；连续更新随当前帧末桶推进，切周期阶段固定时钟，不混入实盘行情。未接入则记录环境阻塞，不用离线结果代替实机结果。

两组参数为 `compact` 和 `alternate-perps`，两组PVT/NVI均 `zeroVolumeIsMissing=false`，与Perps的Hyperliquid来源一致。第二组改变周期、带宽、倍数及EMV divisor；两组MTM均使用close。当前设置适配器只保存数值输入，MTM来源在实际UI运行时为close；open仅由标明calculator-only的手算辅助测试覆盖，不作为界面选项或四图输入。完整参数在JSON中；不能改UI参数而沿用另一组期望。

| JSON字段 | 用途与输入边界 |
| --- | --- |
| `profiles.*.variants` | 24组计算器输入与期望。包含null OHLCV，专门验证计算器防御；不能直接套到普通UI行情 |
| `profiles.*.feedVariants` | 24组Perps行情期望。`inputBars` 是provider清洗前的OHLCV数值表示；独立过滤非有限OHLCV/time和H<L，排序后得到 `bars`，再计算 `expected`。对照器会转换为真实provider字段并经过真实清洗函数 |
| `droppedTimes` / `checkpoints` | 剔除时间及每条系列的 `firstValidTime / missingTimes / recoveryTimes`；均为秒时间戳。逐桶按时间对齐，不能沿用清洗前数组下标。趋势线显隐也会产生有效性变化，不一概当作数据缺失 |
| `profiles.*.sequences` | 两组参数下的22个连续快照；每帧给出输入、清洗结果和全部系列期望，事件语义见下文 |
| `workloads.four-panel` | 四个受控市场的16个基础负载快照、启用集合、完整参数及20轮采样说明 |
| `workloads.four-panel.panels.*.periodSwitch` | 同一市场源周期→目标周期→源周期的12个快照，含逐帧周期、完整参数、独立行情及57条系列期望；采用独立会话和冻结时钟 |
| `workloads.four-panel.periodSwitchTiming` | 冷／热缓存各方向至少20次的操作与计时契约，四图共320次；不是离线性能结果 |

12类基础输入为mixed、short（2根）、empty、flat、zero-volume、missing-volume、missing-price、zero-close、ascending、descending、zero-volume-prefix、squeeze-release，其余均96根。mixed第i根：C=100+(17i mod 23)-11+7×(floor(i/8) mod 3)，O=C+(-1若i偶数否则1)，H=C+2+(i mod 3)，L=C-2-(i mod 2)，V=100+10×(i mod 7)。变体按脚本显式替换。

清洗后missing-price的35–38号输入被删，96→92根；missing-volume的8、9、48号被删，96→93根。保留下来的0量不是缺量。UTC 00:39的WMA(3)在原始计算器输入为107.5，在清洗后行情为108；UI采用后者。预热及公式无值的点仍按清洗后窗口断言null，不补零。

原始容差为 `1e-8 + 1e-8×|期望|`，null位置必须完全一致。UI使用实际显示精度的半个末位单位作为舍入容差。

## 连续更新与恢复

`sequences.realtime` 在每组参数下顺序执行：

| 事件 | 输入与预期条数 |
| --- | --- |
| initial | mixed的16–63号，共48根 |
| volume-only | 仅末桶V加140；OHLC/time不变，仍48根 |
| price-only | 末桶C加2，必要时调高H保持合法；V/time不变，仍48根 |
| append | 加入64号新桶，共49根 |
| history-prepend | 补入0–15号历史，共65根；用更长窗口的本帧期望 |
| repeat-last | 再发送同一末桶更新，保留65根及同一组期望，不重复累加 |

逐帧核对当前桶、影响窗口、首有效点和后续有效性变化标记，不能只看末根。只改量时重点覆盖VWMA / VWAP / EMV / PVT / NVI，价格指标不应由改量被改写。

`sequences.history-recovery` 为完整→缺价→恢复→缺量→恢复，清洗后依次96 / 92 / 96 / 93 / 96。每帧标记 `reloadHistory=true`：必须在独立行情会话清空旧历史与实时缓存后加载，避免把增量合并保留旧有效K线误判为应删除。恢复阶段核对原有效快照及剔除点附近的时间桶；不把计算器原始null窗口套给UI。

## 四图负载参数

每图初始256根，ENV lookback=64；JSON给出价格缩放、完整参数和全部57条系列期望。四图不同周期共用一个受控实时钟，追加帧的末桶时间相同。仅启用表内指标进行UI负载，额外输出供离线全系列核验。

| 面板 | 基础周期／切周期往返 | 启用集合 |
| --- | --- | --- |
| P1 | 1m→5m→1m | ENV / WMA / VWAP / QQE / SMI / TRIX / EMV |
| P2 | 5m→15m→5m | ENV / VWMA / DC / QQE / RVI / ROC / MTM |
| P3 | 15m→1H→15m | ENV / SUPERTREND / WMA / QQE / KST / MASS / NVI |
| P4 | 1H→4H→1H | ENV / VWAP / DC / QQE / SMI / RCI / SLOPE |

基础负载每轮依次initial、只改末桶量、修改ENV multiplier与QQE fastFactor、追加第257根；参数变化及追加帧使用帧内 `parameters`。下一轮建立独立受控行情会话，清空上轮历史及实时缓存并重载initial参数与行情；冷／热组按既有规范分别预置，各执行20轮，联动原生图表§7及分屏图表的多副图用例。

### 同一面板切周期的输入与操作

另建独立受控行情会话，将四图恢复为各面板初始 `parameters` 及表内7类指标，关闭五项同步，加载各自 `periodSwitch.frames[0]`。这批聚合行情与基础负载历史不同，不能直接接在其追加帧后，也不能带入基础负载改过的ENV / QQE参数。

每个面板有 `interval-source / interval-target / interval-return` 三帧，各256根；市场不变，`intervalSeconds` 是该帧周期，`fromIntervalSeconds` 是切换前周期。首帧用于准备，后两帧 `measure=true`。选中该面板后点击周期控件，依表执行往返；选中另一面板不算切周期。四图始终保持加载，其他三图市场、周期、参数和数据不变。

各图的源、目标历史均由同一份确定性1m行情按UTC完整桶聚合：O取首根、H取最大、L取最小、C取末根、V求和，缺分钟的桶不填补。`historyRecipe` 记录起止、分钟数及缩放，价格和量采用上文mixed生成式。目标周期包含256个完整桶，源周期取同源历史末256桶。所有图时钟固定为 `clockTime=1768147199`（2026-01-11 15:59:59 UTC），不再追加新行情；每帧末桶结束秒与该时钟相同。返回帧从源行情重新独立计算，行情和全部系列期望须恢复；不能只换时间标签或复用源周期指标值。原始分钟数组仅在生成时存在，不写入仓库。

每图冷／热缓存各往返20轮，去、回方向分别统计，即4图×2缓存组×2方向×20次=320次。冷组在每次点击前只清除目标市场／周期的历史及实时缓存，保留当前源图和其他三图；热组先在计时外预载两个周期并回到源周期，采样期间保留缓存。每次从点击目标周期项开始，到所选周期、目标K线和所启用指标读数均匹配本帧，遮罩消失且首次十字线有反馈为止；等待期间不得用旧周期数据提前结束。Desktop每组沿用切周期P95≤2秒、单次≤4秒，未完成计失败，报告N / P50 / P95 / 最大值 / 超时数。此320次为实机执行要求，本地比较器只验证12个静态快照。

P2的MTM使用close：源5m末根主体18、均线27，目标15m为30、16，切回恢复18、27；open算术结果不能作为这些UI帧的期望。

目标帧末桶抽查值如下（12位有效数字），时间为桶起点UTC；完整逐根OHLCV、57条系列及空值以展开JSON为准。四图末桶均在15:59:59结束，切回按源帧核对。

| 面板／目标周期 | 末桶UTC | O / H / L / C / V | ENV upper / lower | QQE rsi / fast / slow |
| --- | --- | --- | --- | --- |
| P1／5m | 2026-01-11 15:55:00 | 99 / 113 / 90 / 97 / 650 | 114.799547276 / 98.6281508684 | 36.7786251645 / 65.6514028347 / 22.1687383273 |
| P2／15m | 2026-01-11 15:45:00 | 202 / 248 / 192 / 230 / 3900 | 238.010772643 / 201.764422613 | 56.8204070147 / 49.2785761402 / 41.7367452657 |
| P3／1H | 2026-01-11 15:00:00 | 11.1 / 12.7 / 8.6 / 11 / 23400 | 12.1503682214 / 10.551511335 | 46.9077096889 / 67.1054239245 / 28.812187031 |
| P4／4H | 2026-01-11 12:00:00 | 1060 / 1290 / 860 / 1130 / 124800 | 1201.46517077 / 1013.11017108 | 47.8129922546 / 52.5635347578 / 42.5137102435 |

记录加载、切周期、布局恢复、交互延迟及退出后订阅／内存趋势。Desktop沿用现有加载与布局阈值并报告N/P50/P95/最大值/超时；Web / Extension及资源趋势记录同机基线差异，不新增FPS、CPU、内存硬阈值。本地脚本没有测量设备性能。

## 本地验证与展开

在QA-AGENTS根目录执行，使用Python 3.10+和本仓库的TypeScript；产品对照另需app-monorepo已有的bignumber.js依赖，Node需支持toSorted（本次Node 22）：

```bash
python3 -B docs/qa/test-data/perps/native-chart-v2/test_reference.py
python3 -B docs/qa/test-data/perps/native-chart-v2/test_contract.py
python3 -B docs/qa/test-data/perps/native-chart-v2/generate.py --check
python3 -B docs/qa/test-data/perps/native-chart-v2/generate.py --output /tmp/perps-native-chart-v2
python3 -B docs/qa/test-data/perps/native-chart-v2/generate.py --verify /tmp/perps-native-chart-v2/indicators.json
node docs/qa/test-data/perps/native-chart-v2/compare-product.mjs --self-test
node docs/qa/test-data/perps/native-chart-v2/compare-product.mjs \
  --app-repo /absolute/path/to/app-monorepo \
  --fixtures /tmp/perps-native-chart-v2/indicators.json
python3 -B docs/qa/test-data/perps/native-chart-v1/generate.py --check
python3 -B docs/qa/test-data/perps/native-chart-v1/test_generate.py
```

生成器默认只校验，展开JSON只能写到仓库外。`PYTHON_BIN` 可指定比较器的Python；`APP_MONOREPO_PATH` 可指定契约测试的产品仓库，默认同级app-monorepo。`--ref <完整SHA>`用于明确比较其他提交；输出记录实际SHA，不把旧结果称作最新分支结果。

本批覆盖24组计算器、24组行情、22帧连续快照、16帧四图基础负载和12帧切周期及其清洗后输入。指纹更新须有独立算术和数据契约依据，禁止按产品结果自动放行。完成本地验证后仍不代表TF实机通过。随后按用户授权同步关联手动用例的Jira描述，独立数值样本文件仍在本地维护。

2026-11-27本地验证：v2算术30项、契约21项及v1辅助5项，共56项测试通过。固定SHA逐点核对718,086个指标位置及64,044个清洗行情字段，差异0；删除切周期帧或仅改周期标签均被真实CLI拒绝。提交前按真实设置链修正MTM来源，Perps样本均为close，open保留独立手算辅助测试。原v1代码与数据、compact的12条算术指纹保持不变。未执行实机或性能测量。关联手动用例已按后续授权同步Jira，样本文件未上传。

## compact / mixed 末根数值预览

下表是独立期望的便于检查版本（12 位有效数字），不是唯一断言点。末根 UTC `2026-01-01T01:35:00Z`；完整 JSON 另含完整参数及每根输入、预热与空值，执行时以完整精度 JSON 为准。其他参数组、短历史和故障组不能复用此表。

| 指标 | 自选测试参数 | 末根全部系列期望 |
| --- | --- | --- |
| WMA | `{"periods":[2,3,5]}` | line:0=110；line:1=112；line:2=111.4 |
| VWMA | `{"periods":[2,3,5]}` | line:0=110.888888889；line:1=113.692307692；line:2=110.95 |
| SUPERTREND | `{"atrPeriod":3,"multiplier":1.5}` | upTrend=102.279501798；downTrend=null |
| ENV | `{"bandwidth":2,"lookback":9,"multiplier":1.5}` | upper=118.711083398；lower=104.956734788 |
| VWAP | `{"period":5}` | vwap=111.155555556 |
| DC | `{"period":5}` | upper=122；lower=101；basis=111.5 |
| KDJ | `{"period":5,"kPeriod":3,"dPeriod":2}` | k=47.4606500385；d=49.3240186232；j=43.7339128692 |
| SKDJ | `{"period":5,"smoothingPeriod":2}` | k=47.5387502571；d=52.4735626304 |
| DMA | `{"shortPeriod":3,"longPeriod":7,"movingAveragePeriod":4}` | dif=1.14285714286；movingAverage=0.25 |
| VR | `{"period":5,"movingAveragePeriod":3}` | vr=25；movingAverage=40.6576576577 |
| BRAR | `{"period":5}` | ar=107.142857143；br=55.8823529412 |
| PSY | `{"period":5,"movingAveragePeriod":3}` | psy=20；movingAverage=26.6666666667 |
| PVT | `{"zeroVolumeIsMissing":false}` | pvt=78.7815753718 |
| ATR | `{"period":3}` | atr=10.4514054732 |
| SMI | `{"bollingerPeriod":5,"bollingerMultiplier":2,"keltnerPeriod":5,"keltnerMultiplier":1.5,"momentumPeriod":5}` | momentum=0.8；squeeze=1 |
| TSI | `{"period":5}` | tsi=0.220365948093 |
| RVI | `{"period":3,"signalPeriod":3}` | rvi=32.026179991；signal=36.8452636258 |
| QQE | `{"rsiPeriod":3,"smoothingPeriod":2,"fastFactor":2,"slowFactor":4}` | rsi=44.8520142891；fast=58.2206584753；slow=26.1243818783 |
| MASS | `{"period":5}` | mass=5.02320537899 |
| KST | `{"rocPeriods":[2,3,4,5],"smoothingPeriods":[2,2,3,3],"signalPeriod":3}` | kst=11.8512678908；signal=18.3880170098 |
| BBP | `{"period":5}` | bbp=-5.44893743471 |
| NVI | `{"movingAveragePeriod":7,"zeroVolumeIsMissing":false}` | nvi=979.305672422；movingAverage=993.314445814 |
| PMO | `{"firstPeriod":5,"secondPeriod":3,"signalPeriod":3}` | pmo=1.38131271559；signal=6.51898524168 |
| RCI | `{"periods":[3,5,7]}` | short=-100；middle=10；long=-50 |
| SLOPE | `{"period":5,"lookback":2}` | slope=-58.6833713128 |
| TRIX | `{"period":3,"movingAveragePeriod":4}` | trix=5.23826471419；movingAverage=24.791943903 |
| EMV | `{"period":3,"divisor":10000,"movingAveragePeriod":4}` | emv=511.752136752；movingAverage=-373.164335664 |
| ROC | `{"period":3,"movingAveragePeriod":4}` | roc=4.85436893204；movingAverage=-0.271670518888 |
| MTM | `{"period":3,"source":"close","movingAveragePeriod":4}` | momentum=5；movingAverage=-0.75 |
