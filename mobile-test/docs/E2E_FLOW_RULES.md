# E2E 测试流程规则

本文档约定与「添加观察地址」相关的页面跳转顺序与数据源，便于编写与 review 用例。AI 规则见 `.cursor/rules/e2e-add-watch-address-flow.mdc`。

---

## 1. 导入观察地址流程（从 Onboarding 入口）

从 **Onboarding** 到完成**单次**观察地址导入的步骤顺序：

| 步骤 | 页面 / 操作 |
|------|--------------|
| 1 | `onboardingPage.waitEntryPage()` → `clickMoreOptionsBtn()` |
| 2 | `addWalletPage.waitEntryPage()` → `clickAddExistingWalletCard()` |
| 3 | `addExistingWalletPage.waitEntryPage()` → `clickWatchAddressCard()` |
| 4 | `importAddressPage.waitEntryPage()` → 选链、填地址与名称 → `clickConfirmButton()` |
| 5 | 确认后应用回到 **Homepage** |

选链：`importAddressPage.clickChooseChainBtn()` → `networkSelectPage.waitEntryPage()` → `networkSelectPage.selectNetworkBySearch(item.chain, item.chainId)`。

---

## 2. 从 Home 再进入 Onboarding（添加钱包入口）

当已在 **Homepage**，需要再次进入「添加钱包 / Onboarding」时，固定按以下顺序：

| 步骤 | 操作 |
|------|------|
| 1 | `homePage.clickAccountSelectorBtn()` — 打开账户/钱包选择器 |
| 2 | `walletSelectorPage.waitEntryPage()` — 等待钱包选择器 |
| 3 | `walletSelectorPage.clickAddWallet()` — 点击「添加钱包」 |
| 4 | `onboardingPage.waitEntryPage()` — 进入 Onboarding |

之后可再接「1. 导入观察地址流程」再走一遍。

---

## 3. 数据源与随机数据

- **数据源**：`dataset/watchaddress.js`，使用 `preloadData`。
- **字段**：`name`、`address`、`chain`、`chainId`（及可选 `group`）。
- **随机取数**：使用 `pickRandom(preloadData, n)` 取 n 条，避免多轮/多用例共用同一数据导致状态耦合。
- **「再走一次 + 额外 N 个随机地址」**：共执行 (1 + N) 次导入；每次从 Home 开始 → 按「2」进入 Onboarding → 按「1」完成一次导入；数据用 `pickRandom(preloadData, 1 + N)` 取 (1 + N) 条。

---

## 4. 相关页面与引用

- 页面：`homePage`、`walletSelectorPage`、`onboardingPage`、`addWalletPage`、`addExistingWalletPage`、`importAddressPage`、`networkSelectPage`。
- 参考用例：`test/addWatchAddress.e2e.js`。
