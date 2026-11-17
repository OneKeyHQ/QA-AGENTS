# Perps 原生图表固定样本 v1

用于独立测试配置的数值与几何核对。测试参数不是产品默认参数；样本不是实机结果，也不表示已接入自动化。禁止把虚构市场用于真实交易。

## 仓库内容

- [generate.py](generate.py)：独立计算17类指标；包含20根固定行情的输入规则，以及普通、2根短历史、零成交量3组输入。不导入产品计算器。
- [drawings.json](drawings.json)：8个公共锚点、几何参考值、90项工具的紧凑定义。相同说明与永久对象标记由 `tool_defaults` 共用；默认取前N个锚点，自由路径保留完整A–H，测量尺保留临时对象属性，形态保留标签顺序。
- [fingerprints.json](fingerprints.json)：精简前完整样本的冻结指纹，数值按12位有效数字归一化。生成器先核对指纹，再允许输出；禁止根据产品结果自动更新指纹。

完整指标数组和展开的工具记录按需生成，不提交到仓库。只改排版或存储结构，不减少17类指标、3组行情、90项工具或原用例的验证范围。

## 校验与生成

在仓库根目录执行；只依赖Python标准库：

```bash
# 默认只校验，不写文件
python3 -B docs/qa/test-data/perps/native-chart-v1/generate.py --check
python3 -B docs/qa/test-data/perps/native-chart-v1/test_generate.py

# 需要完整样本时输出到本地临时目录
python3 -B docs/qa/test-data/perps/native-chart-v1/generate.py --output /tmp/perps-native-chart-v1
```

输出的 `indicators.json` 保留 `parameters`、`variants.{mixed,short,zero-volume}.bars/expected`、容差等原结构；`drawings.json` 保留原 `tool_oracles` 完整记录。生成器拒绝覆盖此源目录。修改公式、输入、工具定义或冻结指纹，须重新评审预期；校验失败不得直接重生成指纹放行。

## 使用与断言

1. 固定行情：隔离环境同时替换历史和实时订阅，接入边界为 `TradingViewNative/data/useTradingViewNativeKLine.ts`；市场 `QA-NATIVE-USD`、1m、UTC。每组从首根重新加载并清缓存，先核对首末时间、条数与OHLCV，禁止混入实盘行情。普通TF包未接入受控行情时，该批数值验证标记“环境未就绪”。
2. 指标：按生成数据的参数核对全部曲线；只在预期为 `null` 的位置断言缺失占位，不补零。原始误差≤`1e-8 + 1e-8×|期望值|`；UI按显示精度舍入，允许半个末位显示单位的误差。参数是测试自选值。
3. 绘图：按展开记录的锚点和标签顺序操作；永久对象核对类型、数量、控制点及保存重进，自由路径核对采样轨迹。几何参考见 `examples`；成交量/VWAP使用同一20根行情。时间按UTC和K线起点对齐；实机按当前轴换算坐标，未磁吸锚点允许≤2 CSS像素误差，不调整用户窗口、不跨缩放套固定像素。
4. 故障：独立配置下，在 `chartLocalStorage.ts` 的 `appStorage.setItem` 边界挂起/拒绝Promise，不绕过队列；读取故障在 `getItem` 边界注入。订单失败在交易所提交前拒绝，核对出站提交为0，保留只读接口；每次finally恢复替身与配置并读回。
5. 结果：指纹/生成器测试通过只证明固定数据一致，不代表产品计算、UI或TF通过。现有UI脚本不读取这两份样本；后续接入时分别记录离线数值与实机结果。

## 变更记录

- 2026-11-05：保留已确认固定样本语义，完整派生数据改为按需生成，公共绘图字段去重；99条手动用例及Jira正文未改。
