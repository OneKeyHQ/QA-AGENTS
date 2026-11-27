# 公共执行工具与证据索引

普通 PR 在需要源码测试、可交互预览或执行证据时读取对应段落。公共工具在仓库根目录的 `scripts/pr-preview/`，Codex、Claude 和 Cursor 共用。测试结果和 PR 特定夹具留在被忽略的本地报告目录。

## 1. 固定源码与转换

使用 `source.mjs` 的 `readGitSource({repository,sha,path})` 读取完整提交对象下的原始 blob，返回提交、相对路径、Git blob ID、SHA-256 和 `bytes`。拒绝短 SHA 和越界路径，不受调用方 `GIT_*` 定位影响。它仅做只读采集，临时仓库写操作仍按差分专项隔离。

`createTypeScriptTools({from})` 使用指定本地目录解析到的 TypeScript，记录编译器身份；`extract({source,filePath,selection})` 按 AST 选择原函数、变量、明确类的方法或回调。方法必须提供 `className`，回调必须提供参数位置；合法重载选择唯一实现体，多个实现或只有声明时拒绝执行。保留原始片段、行号和指纹。`transpile({source,filePath})` 做类型转换并保存输入/输出指纹，不改写业务分支。转换成功不等于类型检查通过。

`fingerprintDependency({name,from})` 保存依赖版本、入口文件和 package manifest 指纹。锁文件另按实际字节保存；解析到的安装依赖不一致时明确缺口。测试代码的业务预期、参数 fixture 和危险调用替身按 PR 单独确定，禁止用受测函数生成 expected。

工具不执行抽出的代码，也不提供安全沙箱。`node:vm` 不能隔离恶意代码、网络或主机权限。PR 代码只有在本技能允许的无凭据、无生产网络和无用户配置的外部执行环境中运行；不能确认边界时只采集、静态分析或运行审阅过的必要逻辑。

## 2. 用例×阶段的计划与结果

测试前固定 `plan.json`，包括完整比较 `baseSha/headSha`、目标确认计时标记、测试项内部键及各阶段。每阶段独立提供 `phase/required/level/expected`。`expected` 是独立夹具给出的可比较 JSON 值，工具使用严格深比较，例如 `{invokeCalls:0}`，与结果 `actual` 结构一致；操作步骤和自然语言预期另在四列回归项中写清。内部键仅供证据关联，不替代手动场景名。

结果 `result.json` 的 `rows` 对应每个 `caseKey/phase`，包含 `caseName/status/level`；每个已执行项同时需要 `actual` 与 `evidence:{path,sha256}`，路径相对结果文件目录，缺任一个均阻塞。保留有意义的 `0/false/null`；`-0` 使用 `{"type":"number","value":"-0"}`，大整数金额使用字符串。`pass/fail` 表示该计划层级下的有效断言结果；`pending/blocked/na` 必须说明缺口或不适用依据。层级和状态分开，隔离执行不能冒充真实界面或真实交易通过。计划阶段遗漏、失败未进入 `failures` 摘要、缺文件、字节篡改或比较 SHA 不符均阻塞完整性验收。

资金类根据实际改动选择至少一个可离线运行的关键相邻阶段。计划 `seams` 指定两端 `{caseKey,phase}` 和需比较的字段路径；两端使用同一匿名 `attempt`，实际捕获文件保存 `{attempt,payload}`。从真实执行入口或边界捕获，不能事后复制两份相同预期制造“串联通过”。接缝校验要求两端确已执行、捕获可读且指纹有效，字段存在并符合允许的空值契约；自动核对同次操作的金额、账户、链及所选业务字段。其他上下游或整条真实链路仍按实际执行标记。

```sh
node scripts/pr-preview/evidence.mjs --plan shared/reports/<batch>/plan.json --result shared/reports/<batch>/result.json --out shared/reports/<batch>/runs
```

退出码：`0` 为计划范围通过，`1` 为有效业务断言/接缝失败，`2` 为未完成或协议/证据阻塞。待验结果照常交付并解释缺口；不能为得到退出码 0 删除必跑项或红例。提交前收到 SIGINT/SIGTERM 时，CLI 清理自己的暂存，分别以 `interrupted/130` 或 `interrupted/143` 退出；原子发布已提交时，按已发布结论退出。写入和清理同时失败时保留写入主错误和单列清理诊断。新工具只做索引和归档，不启动业务进程、不代替已有监督器；库调用可提供自己的 `AbortSignal`。

输入读取/解析失败也独立归档已取得的原字节，在 `inputs` 记录路径、指纹、长度、已确认的比较 SHA 与错误。每次运行复制原 plan/result 输入和核验过的证据，在提交前及发布后回读实际落盘字节，核对摘要与清单。校验失败不得返回通过；发布独立目录及字节指纹。失败或复跑均不写回首次交付。发布前后的清理、信号和监督归档要求仅在维护相应实现时按 [reproduction-evidence.md](reproduction-evidence.md) 回归。

## 3. 真实耗时与首份结果

从确认可解析目标时立即记录 `--mark target-confirmed`；规则读取和工具发现也属于总耗时。材料取得后记录 `--mark material`。首个有固定输入、独立预期、命令及实际输出的可复跑结果准备好后记录 `--mark first-evidence`。标记保留同主机单调时钟与墙钟时间，不回填排除等待的起点。

```sh
node scripts/pr-preview/evidence.mjs --mark target-confirmed
node scripts/pr-preview/evidence.mjs --mark material
node scripts/pr-preview/evidence.mjs --mark first-evidence
```

将目标标记写入计划 `targetConfirmed`，材料和首份证据标记放在结果 `milestones.material/firstEvidence`。首份证据标记另外关联 `caseKey/phase/sha256`，必须对应真实已执行文件。冻结归档的 `timing.prepared` 是证据准备时点，尚未计摘要、清单、回读与发布；它不能称为完整交付时间。CLI/API 最终返回独立 `publicationReceipt`，包含归档目录、manifest 指纹、实际 `delivery` 及有效计时下的完整耗时；在写入、原子发布与最终回读后才生成，不回写首次归档。分别报告材料准备、首份可复跑证据和正式交付的耗时；跨主机或倒退时不伪造有效计时。

3–5 分钟是首轮安排目标。到点只有片段、无有效断言、无可运行输入或关键证据未齐时，提供进度和待验项，继续完成当前首轮；不能把生成空 HTML、截图或进度消息计为完成。批量读取、可用依赖与构建缓存、公共外壳和适配工具用于降低准备成本，不削去已识别的业务验收项。

## 4. 预览外壳

`preview.mjs` 只生成产品画面以外的工具栏、来源与缺口说明。输入本地清单及预先审阅的独立 HTML 产物，每个场景固定平台、实际宽度、版本和可用语言。产品画面放在 sandbox iframe，外壳 CSS 不进入产品区域；工具不提供钱包 UI 或自创业务行为。默认 `execution:{mode:"static"}`，产品脚本不运行。需要实际交互时显式选 `external-isolation`，并提供唯一规范化 `entryUrl`（HTTP 回环 `127.0.0.1` 或 `[::1]`、显式端口、独立运行路径；无 query/hash/凭据）及 `boundaryEvidence:{path,sha256}`；该 UTF-8 JSON 日志包含同一入口、非空 mechanism/credentialBoundary 和非空 observations 数组。工具核对材料并绑定实际入口，外部禁网仍由上游真实环境保证。file:// 或入口不匹配只能静态展示，不能把元数据声明当作已建立安全沙箱。

```sh
node scripts/pr-preview/preview.mjs shared/reports/<batch>/preview-manifest.json shared/reports/<batch>/preview.html
```

清单含可选 `execution`、`comparison:{base,head}`、`scenes`；每场景有 `id/label/platform/widths/initialWidth/initialLocale/initialVersion` 和 `versions.<base|head>.<locale>`。每个版本变体提供 `artifact:{path,sha256}` 与 `source:{kind,repo,sha,materials,mocks,unverified}`。`kind` 为 `original-page/original-component/reconstruction`，源码 SHA 必须与所选版本一致。材料分别记 `role/path/sha256`；重建至少提供布局、样式和真实字典依据，原始页面/组件提供源码依据，其他实际依赖也须记录。

本地路径限定在清单目录内，所有材料和产物核对指纹，输出不覆盖已有文件。独立 HTML 须满足工具支持的资源和网络限制；外部或缺失资源不能静默当作真实展示。它不代替应用构建系统，也不赋予运行未经审阅 PR 代码的授权。

首次打开/刷新恢复清单声明的初始场景，复位恢复当前变体。同场景 B/H 至少需要一个共同语言以保证所有变体可达；没有共同语言时提供独立场景，不静默切语言或声称同语言差分。跨版本保留业务输入和步骤需要业务适配器实际支持并测试；仅重新打开起始页面的外壳不能声称完成了同输入差分或分叉回放。详细 UI 对照与最终链接验收见 [preview-ui.md](preview-ui.md)。

## 5. 维护验证

```sh
node --test scripts/pr-preview/*.test.mjs
node scripts/pr-preview/check-skill.mjs
```

行为测试至少覆盖受污染 Git 环境、源码歧义/转换错误、漏必跑/漏红例/篡改证据、错层级、错交易接缝、计时和独立复跑，以及预览首开刷新、同宽度切版、样式隔离和不可信文本。另用真实 PR 的固定原始源码验证一处阶段交接。同步与格式检查只证明包装一致，不能代替这些行为测试。
