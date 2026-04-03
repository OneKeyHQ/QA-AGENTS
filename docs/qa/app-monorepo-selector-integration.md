# app-monorepo selector integration

## 目标

把 `app-monorepo` 中已经存在的 `testID / data-testid` 提炼成 QA-AGENTS 可复用的公共定位参考层，优先服务：

- 测试用例生成
- 录制后补齐公共元素
- 后续 runner 灰度接入

> 当前阶段为 **additive only**：新增参考层，不替换 `shared/ui-map.json`，不改变现有用例执行路径。

---

## 当前产物

### 1. 原始索引
- 文件：`shared/generated/app-monorepo-testid-index.json`
- 来源：扫描 `app-monorepo` 的 `apps/`、`packages/` 下代码文件
- 内容：
  - `testID / data-testid`
  - 对应 selector
  - 来源文件
  - feature hints
  - 出现次数

### 2. 语义层映射
- 文件：`shared/ui-semantic-map.json`
- 用途：给测试生成、脚本编写、知识维护提供统一语义名
- 特点：
  - 优先引用 app-monorepo 中稳定 testID
  - 允许 QA-AGENTS 在其上补派生 selector（如 form 内 input、localized button）
  - 不影响现有 `shared/ui-map.json`

---

## 同步命令

```bash
node scripts/sync-app-monorepo-selectors.mjs
```

可选环境变量：

```bash
APP_MONOREPO_PATH=/path/to/app-monorepo node scripts/sync-app-monorepo-selectors.mjs
```

默认按以下顺序寻找 app-monorepo：

1. `APP_MONOREPO_PATH`
2. `/Users/onekey/Documents/Github/app-monorepo`
3. `/Users/onekey/.openclaw/workspace/app-monorepo`

找到仓库后，默认按以下优先级读取源码：

1. `APP_MONOREPO_REF`
2. `origin/x`
3. 本地 `x`
4. 当前 working tree（仅当前三者都不可用时兜底）

> 也就是说，**默认同步来源是 app-monorepo 的 `x` 分支**，不要求人工先 checkout 到 `x`。
---

## 测试生成时的使用规则

### 规则 1：优先参考语义层，不要直接散写 selector
优先使用：

- `wallet.account.selector.trigger`
- `wallet.network.selector.trigger`
- `global.modal.container`
- `global.footer.confirm`
- `wallet.send.form`

不要在新脚本里直接重复硬写：

```js
page.locator('[data-testid="AccountSelectorTriggerBase"]')
```

而应先在脚本注释或辅助层中声明其对应的语义元素。

### 规则 2：弹窗操作必须先切 modal scope
如果命中 `global.modal.container`，弹窗内搜索/输入/断言都要优先收敛到 modal 内部。

### 规则 3：app-monorepo 定位优先，QA-AGENTS 经验兜底
顺序建议：

1. `shared/ui-semantic-map.json`
2. `shared/ui-map.json`
3. `shared/knowledge.json` 中的 quirks / fallback 经验
4. 运行时探索（CDP / 文本 / OCR）

### 规则 4：不要因为新层存在就批量修改历史用例
老用例保持原状；新生成用例优先参考语义层。

---

## 推荐维护方式

### 新增公共元素时
1. 先跑同步脚本，确认 app-monorepo 是否已有 testID
2. 若已有：补到 `shared/ui-semantic-map.json`
3. 若没有：可先在 QA-AGENTS 侧加派生 selector，并在 `notes` 标明来源
4. 只有在执行验证稳定后，再考虑同步进 `shared/ui-map.json`

### 字段建议

```json
{
  "wallet.account.selector.trigger": {
    "primary": "[data-testid=\"AccountSelectorTriggerBase\"]",
    "source_testid": "AccountSelectorTriggerBase",
    "source": "app-monorepo",
    "page": "wallet-home",
    "platform": ["desktop", "web"],
    "feature": ["wallet-home", "account-selector"]
  }
}
```

---

## 后续演进建议

### Phase 1（已做）
- 建立 app-monorepo testID 索引
- 建立 QA-AGENTS 语义 locator map
- 先用于测试生成和知识维护

### Phase 2（已补）
- recorder / generator 增加 semantic lookup
- 录制分析结果默认输出 `semantic_element`
- 新 testid 会同时对照 `ui-semantic-map` / `ui-map`，并给出推荐 semantic key

### Phase 3
- runner 灰度支持 semantic → ui-map fallback lookup
- 仅在高频模块（首页/账户/网络/send/modal）先试
