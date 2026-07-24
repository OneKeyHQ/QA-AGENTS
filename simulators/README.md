# Pro 2 固件 UI 模拟器 — 使用教程

在 macOS 上直接用 **firmware-pro2 真实 UI 源码**（dev 分支，LVGL 9）渲染 Pro 2 设备页面（604×1024，SDL 窗口，鼠标=触摸）。固件代码**不入库**——构建时通过 `FIRMWARE_DIR` 只读引用本地 firmware-pro2 clone，本教程覆盖「拉最新 dev → 构建 → 跑模拟器测试」的完整流程。

- **Pro 2 固件仓库**：https://github.com/OneKeyHQ/firmware-pro2 （模拟器跟踪其 `dev` 分支；bootstrap 脚本默认从这里 clone）

> 深度技术文档（dev 分支适配细节、页面注册表、stub 策略、工程结构）见 [`pro2-sim/README.md`](pro2-sim/README.md)。

## 1. 环境依赖（一次性）

```bash
brew install sdl2 cmake ninja
```

- **Python 3**：固件资源管线（`resource_pkg.py`）与页面表生成脚本用

## 2. 快速开始：一条命令拉 dev 最新 + 构建 + 冒烟

在 QA-AGENTS 仓库根目录执行：

```bash
./simulators/pro2-sim-bootstrap.sh
```

脚本自动完成：

1. **clone / 更新 firmware-pro2 到 origin/dev 最新**（默认落在 `QA-AGENTS/.deps/firmware-pro2`，已 gitignore）
2. 初始化 lvgl submodule
3. `cmake + ninja` 构建模拟器（configure 时自动解析固件源码重建全量页面注册表）
4. 跑 **30 帧无头冒烟**验证能正常渲染
5. 固件 commit 记录到 `simulators/pro2-sim/build/firmware-commit.txt`（测试报告引用该 hash 即可复现）

### 复用本地已有的固件 clone（推荐日常用）

如果本机已经维护着一份 firmware-pro2（例如 `~/workspace/codex-workspace/Pro2/firmware-pro2`），用 `FIRMWARE_DIR` 指过去，脚本**按原样使用、不会动它的分支/工作区**——想测哪个 commit 由你自己 `git pull` 决定：

```bash
# 先自己把固件更到想测的版本
git -C ~/workspace/codex-workspace/Pro2/firmware-pro2 pull origin dev

# 再构建
FIRMWARE_DIR=~/workspace/codex-workspace/Pro2/firmware-pro2 ./simulators/pro2-sim-bootstrap.sh
```

其他环境变量：`FIRMWARE_BRANCH`（默认 `dev`）、`FIRMWARE_REMOTE`（默认 OneKeyHQ/firmware-pro2）。

### 首次使用 / 固件资源有变时：先生成固件资源

模拟器的字体、图片、i18n 文案来自**固件资源管线的产物**（`<固件目录>/utils/resource/output/`，CMake configure 时软链装配成 `pro2-sim/resroot/resource/`）。产物不存在时 cmake 会直接报错提示。在固件仓库下运行：

```bash
cd <FIRMWARE_DIR>   # 例如 ~/workspace/codex-workspace/Pro2/firmware-pro2
python3 utils/resource/resource_pkg.py font --only json
python3 utils/resource/resource_pkg.py font --only roobert --no-download
python3 utils/resource/resource_pkg.py font --only symbol
python3 utils/resource/resource_pkg.py font --only noto   # 非拉丁语言字体（zh/ja/ko/ru/uk），做多语言检查必须
python3 utils/resource/resource_pkg.py image
```

拉新固件代码后如资源（图片/文案/字体）有变更，重跑上面命令再重新 cmake 即可。

## 3. 运行模拟器

> ⚠️ **必须先 `cd simulators/pro2-sim` 再运行。** 固件资产路径 `A:/resource/...` 映射到 `./resroot/resource/`（相对当前目录，CMake configure 时从固件资源管线软链装配）。在错误目录运行不会 crash，但资源全部加载失败、页面降级渲染（默认字体 + 空白图 + 空文案）。

```bash
cd simulators/pro2-sim

# ① 交互模式（默认打开 homescreen，鼠标=触摸）
./build/onekey-sim

# 打开指定页面（页面表随 dev 演进自动重建，当前 88 个注册页）
./build/onekey-sim --page onboarding_hello
./build/onekey-sim --page lock_screen

# ② 无头自检：跑 N 帧后退出（CI / 快速验证用）
SDL_VIDEODRIVER=dummy ./build/onekey-sim --page homescreen --frames 120

# ③ 批量截图回归：遍历全部可打开页面，逐页导出 PNG
#    每页独立子进程隔离（单页崩溃不炸整批），退出码 = 失败页数（0 = 全绿）
#    覆盖增强：needs_arg 页面若在 src/sim_demo_args.c 登记了演示参数也会截；
#    首屏以下还有内容的页面额外导出滚到底的 <id>--scrolled.png
SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot out

# ④ 批量交互态截图：逐页点击每个可点控件，点出弹窗/toast/新层时截 <页>--clickNN.png，
#    点完再截 <页>--after-clicks.png（弹窗文案走查用）
SDL_VIDEODRIVER=dummy ./build/onekey-sim --click-test-all out-click
```

**查看全部页面 id**：传一个不存在的 id 即可列出：

```bash
./build/onekey-sim --page nope
# sim: 未知页面 'nope'，可用页面:
#   lock_screen / onboarding_hello / homescreen / ...
```

说明：注册页 = supported + needs_arg 两类（needs_arg 指 on_create 需要运行时参数的页面）。页面表在 cmake configure 时从固件源码自动重建，数量随 dev 演进。needs_arg 页面的**演示参数表**在 `pro2-sim/src/sim_demo_args.c`——按各页真实 arg 语义合成最小值（指纹槽位、蓝牙配对码、设备名等），登记后即可进 `--snapshot`/`--click-test`；拉新 dev 出现新的 needs_arg 页时照现有风格补一行。

### 交互能力边界

- **UI 导航流 ✅**：交互模式挂了 page_manager 导航泵（复刻固件 task_foreground 主循环），页面里点图标跳转、菜单返回按钮、滑动返回手势都是真实固件逻辑。
- **签名/交易确认流程 ✅**：这类页面真机由 MicroPython 引擎喂数据，模拟器用下面的 demo 模式合成真实数据唤起（见下节）。
- **端到端业务流 ❌**：「发起操作 → PIN 验证 → SE 签名 → 完成」这种链路走不通——op_client/auth/SE 都是最小 stub，流程到需要真实后端响应处即停。定位是 **UI 渲染/展示验证器，不是功能模拟器**。

## 4. 签名 / 交易确认页 demo 模式

交易确认、签名类页面在固件里是 needs_arg（真机由 MicroPython 引擎喂交易数据），模拟器提供专门入口用**真实代币/地址数据**合成唤起：

```bash
# 交易确认页（template_txconfirm）：32 个预设 = 19 条链原生币 + ERC20/TRC20 等代币
./build/onekey-sim --demo-tx eth-usdt
./build/onekey-sim --demo-tx btc
# 传错预设名可列出全部；变体：--demo-tx-snap（截图）/ --demo-tx-tab（tab 切换）/ --demo-tx-raw（原始整数金额）

# 签名页目录：77 条，每链每种签名流程一条（BTC SignTx/CoinJoin/SignMessage、
# EVM EIP-1559/712/7702/Safe、Tron、Conflux 等）。行序/标题/滑动门提取自
# dev 分支 MicroPython 引擎真实代码（src/demo_catalog.c 头部注明事实来源 commit）
./build/onekey-sim --demo-catalog eth-approve
./build/onekey-sim --demo-catalog list        # 列出全部 77 条

# 设置里「我的地址」真实展示页（PAGE_ID_ADDRESS_DISPLAY）
./build/onekey-sim --demo-myaddress
```

### 带真实交互的页面演示（SDL 窗口）

不加 `SDL_VIDEODRIVER=dummy` 和 `--demo-tx-snap` 时会弹出 SDL 窗口进入交互模式，**鼠标 = 触摸**，跑的是固件真实页面逻辑。以 ETH 主币转账签名页为例：

```bash
cd simulators/pro2-sim
./build/onekey-sim --lang zh-Hans-CN --demo-catalog eth-transfer
```

窗口里可以做的真实交互：

- **概览 / 详情** tab 点击切换；详情页字段列表可上下拖动滚动
- 底部**滑动签署**：按住圆钮向右拖到头 = 确认（真实滑动门逻辑，拖一半松手回弹）
- 从屏幕左缘向右滑 = 返回手势（页面栈 pop）
- `--page homescreen` 打开主屏后可点图标真实导航进设置等子页、逐级返回

关窗口即退出进程。注意：签名/交易类 demo 页滑动确认后页面栈弹空、进程会自然退出，属正常行为。

> 已知小告警：中文下日志会刷 `NotoR0 ... size: 35` 字体创建失败——noto 字体表没有 35 号（等宽金额字体那一档），该档回退默认字体渲染，不影响交互和其余字号。

## 5. 多语言检查

固件资源管线带全部 **17 个语言包**（`resroot/resource/i18n/`：en / zh-Hans / zh-Hant-HK / zh-Hant-TW / ja / ko / de / es / fr / it / pt / ru / tr / uk / vi / id / fil），走的是固件真实 i18n 链路（cJSON 解析 + LVGL translation），CJK 字体正常渲染。

> **前置**：非拉丁语言（zh/ja/ko/ru/uk）额外依赖 noto 字体，需先在固件目录跑过
> `python3 utils/resource/resource_pkg.py font --only noto`（见第 2 节），否则 CJK 显示为空框。

**`--lang <code>` 启动参数**：启动即切到指定语言，对所有模式生效（语言码 = `resroot/resource/i18n/` 的文件名，传错码会列出全部可用）。切换链路对齐真机 `ui_language.c`：noto 字体逐步加载 → 文案切换 → 字体启用，英文 fallback 保留（缺译 tag 回退英文，同真机）：

```bash
# 指定语言打开单页
./build/onekey-sim --lang zh-Hans-CN --page onboarding_verify_device

# 指定语言全量截图 —— 多语言回归一条命令（--lang 经 SIM_LANG 环境变量透传给逐页子进程）
SDL_VIDEODRIVER=dummy ./build/onekey-sim --lang zh-Hans-CN --snapshot out-zh
SDL_VIDEODRIVER=dummy ./build/onekey-sim --lang ja-Jpan-JP --snapshot out-ja

# demo 模式同样生效
./build/onekey-sim --lang zh-Hans-CN --demo-tx eth-usdt
```

- 不加 `--lang` 时默认英文（固件 `UI_LANG_DEFAULT_CODE`），语言设置不持久化
- **交互切换**也可用：打开语言选择页（`--page onboarding_select_language`）点选，切换流程是真实固件逻辑（sim 侧 resource_manager 视为资源包常驻已挂载）

## 6. 固定回归用例

以下用例为固定回归项，直接说触发语即可执行（均默认先拉 dev 最新再跑）：

| 用例 | 触发语示例 | 执行方式 | 通过标准 |
|------|-----------|---------|---------|
| **SIM-TOKEN-001 内置代币对照** | "对比内置代币是否正确" | `FIRMWARE_DIR=<固件目录> python3 simulators/tests/check_builtin_tokens.py [--verbose]` | 输出 PASS（字段不一致 0 条）；缺失条目为覆盖率警告非错误 |
| **SIM-L10N-001 翻译走查（语言参数化）** | "跑一遍中文翻译检查" / "跑一遍日语翻译检查" / "检查韩语翻译" … | `--lang <语言码>` 下三批：`--snapshot`（含 needs_arg 演示参数页 + `--scrolled` 滚动变体）+ `--click-test-all`（弹窗/toast 交互态）+ `--demo-catalog` 批量 → 逐张目检翻译/换行/溢出 → 出报告 | 无新增问题；报告归档 `shared/reports/` |
| **SIM-SMOKE-001 构建冒烟** | "跑一下模拟器冒烟" | `./simulators/pro2-sim-bootstrap.sh` + `--snapshot` 全量截图 | 构建成功、截图 0 失败 |
| **SIM-TX-001 链转账/签名页走查（语言可选）** | "走查各链转账页面" / "各链签名页截图走查" / "+日语" | `./simulators/tests/snapshot-sign-catalog.sh [语言码] [输出目录]` —— 批量导出全部 77 条签名页（固件全部 17 条链，BTC 流程代表 LTC/DOGE/BCH；转账/代币/授权/盲签/消息/712 各流程），逐张目检 | 0 失败；文案/布局无新增问题 |

- SIM-TOKEN-001 的参照榜单在 `simulators/testdata/builtin-tokens/`（唯一维护来源，含各文件结构说明），被测对象是固件 `frozen/**/tokens.py` / `spl_tokens.py` 内置表。
- SIM-TX-001 的页面清单来自 `pro2-sim/src/demo_catalog.c`（行序/标题/滑动门提取自固件 MP 引擎代码，文件头注明事实来源 commit）。固件签名引擎大改后需按头注释的方法重新提取对齐。
- SIM-L10N-001 支持全部 17 种语言，触发时说明语言即可。语言 → 语言码对照：

  | 语言 | 码 | 语言 | 码 |
  |------|----|------|----|
  | 简体中文 | zh-Hans-CN | 繁中（香港/台湾） | zh-Hant-HK / zh-Hant-TW |
  | 日语 | ja-Jpan-JP | 韩语 | ko-Kore-KR |
  | 俄语 | ru-Cyrl-RU | 乌克兰语 | uk-Cyrl-UA |
  | 德语 | de-Latn-DE | 法语 | fr-Latn-FR |
  | 西语 | es-Latn-ES | 意语 | it-Latn-IT |
  | 葡语（巴西） | pt-Latn-BR | 土耳其语 | tr-Latn-TR |
  | 越南语 | vi-Latn-VN | 印尼语 | id-Latn-ID |
  | 菲律宾语 | fil-Latn-PH | 英语（基准） | en-Latn-US |

  注意：zh/ja/ko/ru/uk 依赖 noto 字体（第 2 节 `--only noto` 步骤）；英语是默认语言无需 `--lang`。
- 历史报告见 `shared/reports/`（如 `2026-07-23_pro2固件中文翻译走查.md`），永不删除。

## 7. 日常测试流程（固件 dev 更新后）

```bash
# 1. 重跑 bootstrap（自动拉 dev 最新 + 增量重编译 + 冒烟）
./simulators/pro2-sim-bootstrap.sh

# 2. 全量逐页截图验证（回归检查 UI 是否渲染正常）
cd simulators/pro2-sim
SDL_VIDEODRIVER=dummy ./build/onekey-sim --snapshot out

# 3. 看输出末尾「N/M 失败」；有失败页时逐页 --page 复现排查
```

测试报告里引用 `build/firmware-commit.txt` 中的固件 hash，即可标明本次验证对应的固件版本。

## 8. 拉新 dev 后编不过 / 渲染异常怎么办

| 症状 | 原因 | 处理 |
|------|------|------|
| 链接报 `undefined symbols` | dev 新增页面引用了模拟器未桩的固件后端符号（auth_manager / op_client / slip39 等） | 在 `pro2-sim/src/sim_stubs_pages.c` 按现有风格补最小桩（async 返回 false、getter 给保守默认、void 空操作），函数签名从固件头文件 grep |
| 编译报找不到头文件 | 固件新增了头文件目录 | 按报错在 `pro2-sim/CMakeLists.txt` 补对应 `target_include_directories` |
| cmake 报「固件资源未生成」 | 固件 clone 里没跑过资源管线 | 按第 2 节「先生成固件资源」在固件目录跑 `resource_pkg.py` 各步骤 |
| 页面出现空白图片 / 空文案 / 缺字 | 拉新固件后资源有变更但没重新生成 | 在固件目录重跑 `resource_pkg.py`（font json / roobert / symbol / image）后重新 cmake |
| 全部字体/图片加载失败 | 没在 `pro2-sim` 目录下运行 | `cd simulators/pro2-sim` 后再跑 |

## 已知差异 vs 真机

- 状态栏电量为随机 mock（每次运行 20–99%）
- LVGL 软件渲染代替 DMA2D 硬件加速（视觉结果一致，性能路径不同）
- 依赖后端/SE 的业务动作为最小 stub（见「交互能力边界」）
