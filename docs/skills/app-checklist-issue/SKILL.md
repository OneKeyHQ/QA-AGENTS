# app-checklist-issue — APP 回归 Test Execution 快速生成器

> 固化「APP 回归 Test Execution 创建 + 关联既定 Test 集合」流程，避免每次手动找人/找 JQL。

---

## 🎯 目标与适用场景

- 为 **APP(v5)** 模块创建回归版本的 **Xray Test Execution**，并指导关联固定的一批历史用例。
- 当前覆盖的模块：
  - `Swap & Market`
  - `DeFi & Perps & 返佣 & Browser`
  - `账户模型 & Prime`
  - `Wallet & 通用`

> 说明：由于当前 Atlassian MCP 未暴露 Xray「向 Test Execution 批量添加 Tests」的 API，本 Skill 只做两件事：
> 1. 通过 Jira API 帮你创建 Test Execution（含经办人、命名规范）  
> 2. 输出对应模块的 **固定 JQL**，你在 Xray UI 里用 `Add Tests → Existing Tests → JQL` 粘贴即可一次性挂完。

---

## 🔧 触发指令（你怎么喊）

| 指令 | 说明 |
| --- | --- |
| `app-checklist-issue <version> <module>` | 为**单个模块**创建回归 Test Execution，并输出该模块的 JQL |
| `app-checklist-issue <version> all` | 一次性为 4 个模块都创建 Test Execution，并分别输出 4 条 JQL |

### 参数约定

- **`<version>`**：APP 版本号，如 `6.0.0`、`6.1.0`
- **`<module>`**：以下四个固定取值之一（支持中文/英文模糊匹配），或 `all`：
  - `swap` / `market` / `Swap & Market`
  - `defi` / `perps` / `返佣` / `browser` / `DeFi & Perps & 返佣 & Browser`
  - `wallet` / `通用` / `Wallet & 通用`
  - `account` / `账户模型` / `prime` / `账户模型 & Prime`
  - `all`：一次创建四个模块

---

## 👤 经办人 & Issue 命名规范

创建的 Issue 类型：**`Test Execution`**，项目：**`OK`**（OneKey）。

### Issue Summary & 修复版本

- **Summary 模板**：

  ```text
  回归 APP <version> - <模块名>
  ```

- **Fix Version/s（修复版本）规则**：
  - 创建 Issue 时 **必须同时写入 `Fix Version/s` 字段**
  - 默认值始终等于指令里的 `<version>`，例如：
    - 指令：`app-checklist-issue 6.1.0 Swap & Market`
    - 则 Fix Version/s 设置为：`6.1.0`
  - 实现方式：调用 `createJiraIssue` 时，通过 `additional_fields` 传入：

    ```json
    {
      "fixVersions": [
        { "name": "<version>" }
      ]
    }
    ```

  - 若该版本在项目中尚不存在，Jira 会按项目配置决定是否自动创建；否则保持失败信息回显给用户。

### 经办人映射

| 模块 | Summary 示例（version=6.0.0） | Assignee displayName |
| --- | --- | --- |
| `DeFi & Perps & 返佣 & Browser` | `回归 APP 6.0.0 - DeFi & Perps & 返佣 & Browser` | `ziying` |
| `Swap & Market` | `回归 APP 6.0.0 - Swap & Market` | `andox.zhou` |
| `Wallet & 通用` | `回归 APP 6.0.0 - Wallet & 通用` | `jitao.liang` |
| `账户模型 & Prime` | `回归 APP 6.0.0 - 账户模型 & Prime` | `Dango` |

> 经办人通过 Jira API `lookupJiraAccountId` 解析 displayName → accountId，当前约定保持不变，如需变更请更新本表。

---

## 🔁 创建 Test Execution 的标准流程

当用户输入：

```text
app-checklist-issue 6.0.0 Swap & Market
```

助手必须按以下步骤执行（使用 Atlassian MCP）：

1. **解析参数**
   - 识别版本号：`6.0.0`
   - 归一化模块：映射为 `Swap & Market`
2. **解析经办人**
   - 调用 `lookupJiraAccountId(cloudId, "andox.zhou")`，拿到 `accountId`
3. **创建 Test Execution**
   - 调用 `createJiraIssue`：
     - `projectKey`: `OK`
     - `issueTypeName`: `"Test Execution"`
     - `summary`: `回归 APP 6.0.0 - Swap & Market`
     - `additional_fields`：

       ```json
       {
         "fixVersions": [
           { "name": "6.0.0" }
         ]
       }
       ```
     - `assignee_account_id`: 上一步查到的 `accountId`
     - `description`: 简要说明，例如：  
       `自动创建的回归 Test Execution，用于 APP 6.0.0 Swap & Market 模块回归。`
4. **回显信息**
   - 输出新建 Issue key（如 `OK-51518`）及浏览链接
   - 同时输出该模块对应的 **JQL 语句**，供后续在 Xray UI 里挂用例

---

## 📌 固定 JQL 映射（一次性挂历史用例）

以下 JQL 全部来自 Xray Test Repository 中各模块 folder 的「View Issues in Navigator」，是**固定集合**，用于每次大版本回归复用。

### 1️⃣ Swap & Market

**说明**：来源链接  
`https://onekeyhq.atlassian.net/issues/?jql=issue%20in%20%2834615%2C35858%2C38937%2C...%2C73052%29`

**JQL：**

```text
issue in (34615,35858,38937,34784,34547,35084,34701,34520,34616,34587,34559,66815,66816,67313,72677,38335,34545,34987,22414,34700,34711,45310,34679,34761,34579,69830,34788,34544,34607,34993,35328,34762,34808,35010,36265,34560,35633,37586,35306,35632,66814,38330,35299,34595,38477,34786,34543,35080,37583,34518,35083,34660,34730,34760,36833,34658,35300,34697,14071,35634,38062,42121,34787,14142,34710,38523,34685,35327,35319,35008,34609,35313,34610,34606,67677,63645,63655,63836,34561,34563,34564,34654,45305,35314,36261,34442,35207,45307,34565,45309,34536,34686,73052)
```

**在 Xray 中挂用例步骤（通用于所有模块）：**
1. 打开对应的 Test Execution（如 `OK-51518`）。  
2. 在中部 `Tests` 面板点击 `Add Tests → Existing Tests`。  
3. 右上切换到 **Advanced / JQL 模式**。  
4. 粘贴上面的整条 JQL，执行搜索。  
5. 列表中全选 → `Add`，完成关联。

---

### 2️⃣ DeFi & Perps & 返佣 & Browser

**说明**：来源链接  
`https://onekeyhq.atlassian.net/issues/?jql=issue%20in%20%2822417%2C58809%2C34996%2C...%2C35349%29`

**JQL：**

```text
issue in (22417,58809,34996,22055,35088,34526,34702,57069,37134,34624,35881,35097,35202,35200,34546,38946,35292,36262,34955,37655,38763,46997,34542,34681,35201,59829,59828,37412,37103,35348,55176,34717,15567,35553,36883,36901,34676,34558,35302,35315,35301,35416,14408,35349)
```

---

### 3️⃣ 账户模型 & Prime

**说明**：来源链接  
`https://onekeyhq.atlassian.net/issues/?jql=issue%20in%20(34519%2C34780%2C35291%2C...%2C35646)`

**JQL：**

```text
issue in (34519,34780,35291,35296,35294,35293,34618,38429,34549,37102,35942,34555,37131,38939,38945,38947,38414,38415,38423,15449,34554,34637,39218,39256,39286,36894,38579,34523,38543,36198,51517,34583,34581,35076,37145,35101,34703,38571,35074,22413,36223,35178,15560,35882,35100,55369,58220,63656,38570,67680,35148,34743,34580,35871,34577,34578,38998,36197,38886,34785,35646)
```

---

### 4️⃣ Wallet & 通用

**说明**：来源链接  
`https://onekeyhq.atlassian.net/issues/?jql=issue%20in%20%2834946%2C34598%2C35030%2C...%2C36195%29`

**JQL：**

```text
issue in (34946,34598,35030,35773,34998,34944,40372,38328,36200,34647,38944,34956,45737,39257,34541,14839,36222,34672,39227,39684,50788,36389,38033,15334,34522,58411,58305,55157,38247,38255,34622,38054,34562,14683,54140,34767,34632,72954,58185,58272,58232,57643,34646,34635,22382,34516,34620,34596,35093,35062,36895,47392,34619,35635,34698,53292,36287,39307,36811,36812,36813,36264,36263,44064,44062,44360,44030,44278,44279,44280,44287,44284,44026,44090,44070,44663,45697,45692,46332,38061,50789,34880,34881,34882,58625,52229,52089,52129,34954,31739,34722,45835,35552,36195)
```

---

## 🔄 使用示例

**示例：为 6.0.0 版本创建四个回归 Test Execution**

```text
用户：
app-checklist-issue 6.0.0 Swap & Market
app-checklist-issue 6.0.0 DeFi & Perps & 返佣 & Browser
app-checklist-issue 6.0.0 Wallet & 通用
app-checklist-issue 6.0.0 账户模型 & Prime
```

**助手预期行为：**

1. 依次创建 4 个 Test Execution（Issue 类型 `Test Execution`，项目 `OK`），经办人按上表映射。
2. 对每个模块：
   - 回显新建 Issue key（例如 `OK-51518`）和浏览地址。
   - 输出对应模块的 JQL，并附带「在 Xray UI 中如何使用 JQL 挂用例」的 5 步说明。

