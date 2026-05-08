# Browser - 桌面端侧边栏 Tab 列表

> 需求文档：`docs/qa/requirements/Browser-桌面端侧边栏Tab列表.md`  
> 规则文档：`docs/qa/rules/browser-rules.md` 第 `8.3` 节  
> 测试端：Desktop  
> 更新日期：2026-04-24

## 测试范围说明

**测试覆盖要求**：
- 侧边栏标签列表基础展示、激活态与切换
- 侧边栏展开态 / 收起态下的入口可见性
- `新标签位置` 偏好设置与默认值
- `top` / `bottom` 模式下的新建 Tab 插入与滚动行为
- URL 变化后的排序保持
- Pinned / unpinned 分区、分区内拖拽、跨分区隔离、Unpin、关闭快捷键与偏好切换的联动
- Settings 弹出层打开期间的侧边栏展开态保护
- `top` / `bottom` 反复切换后的新增一致性
- 偏好持久化
- 无 Pinned / 无 unpinned / 仅剩 1 个 unpinned 时的列表稳定性

---

## 前置条件

1. 使用支持该需求的 Desktop 构建版本（App-6.3.0 或更新版本）
2. 已进入 Browser 页面，侧边栏可在展开态与收起态之间切换
3. 已准备至少 1 个 Pinned Tab 与 2 个 unpinned Tab，便于观察分区、拖拽与重排
4. 可通过 `+` 新建 Tab、打开网站、Pin / Unpin Tab、关闭快捷键、拖拽调整 Tab 顺序

---

## 1. 标签列表基础展示与切换

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前 Browser 侧边栏处于展开态<br>2. 已打开多个标签页 | 1. 观察侧边栏标签列表<br>2. 观察当前激活标签样式 | 1. 侧边栏显示标签列表<br>2. 当前激活 Tab 显示选中态<br>3. 列表中显示多个 Tab 项 |
| P1 | 1. 当前标签列表中存在至少 2 个 Tab<br>2. 当前有 1 个非激活 Tab | 1. 点击另一个非激活 Tab | 1. 点击后的 Tab 变为选中态<br>2. 原激活 Tab 变为未选中态<br>3. 页面内容切换到对应标签页 |
| P1 | 1. 当前存在 Pinned Tab 与 unpinned Tab | 1. 观察标签列表分区顺序 | 1. Pinned Tabs 位于 unpinned 区上方<br>2. unpinned Tabs 位于 Pinned 区下方 |

---

## 2. 设置入口与默认值

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前 Browser 侧边栏处于展开态<br>2. 侧边栏底部区域可见 | 1. 观察侧边栏底部右下角<br>2. 点击 Settings 图标 | 1. 底部右下角显示 Settings 图标<br>2. 点击后弹出 ActionList<br>3. ActionList 显示 `新标签位置` 选项 |
| P1 | 1. 当前 Browser 侧边栏处于收起态 | 1. 观察侧边栏底部区域 | 1. 不显示 Settings 图标 |
| ❗️❗️P0❗️❗️ | 1. 首次进入支持该需求的 Browser 版本<br>2. 用户未手动修改过 `新标签位置` 偏好 | 1. 打开 Settings ActionList<br>2. 进入 `新标签位置` 选项 | 1. `底部` 为默认选中项<br>2. `顶部` 与 `底部` 选项均可见 |

---

## 3. 顶部模式的新建与保持逻辑

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前存在多个 unpinned Tab<br>2. `新标签位置` 已切换为 `顶部` | 1. 点击 `+` 新建 Tab<br>2. 观察 unpinned 区与侧边栏滚动位置 | 1. 新 Tab 插入到 unpinned 区顶部<br>2. 侧边栏自动滚动到顶部 |
| P1 | 1. `新标签位置` 已切换为 `顶部`<br>2. 当前最顶部 unpinned Tab 为上一步新建的 Tab | 1. 再次点击 `+` 新建 Tab<br>2. 对比两次新增 Tab 的前后顺序 | 1. 第二次新建的 Tab 位于最顶部<br>2. 第一次新建的 Tab 下移一位 |
| ❗️❗️P0❗️❗️ | 1. `新标签位置` 已切换为 `顶部`<br>2. 当前最顶部存在刚创建的新 Tab | 1. 在该 Tab 中访问一个新网站或触发 URL 变化<br>2. 返回观察侧边栏排序 | 1. 该 Tab 仍保持在 unpinned 区顶部<br>2. URL 变化后该 Tab 不跳到 unpinned 区底部 |

---

## 4. 底部模式与列表稳定性

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 1. 当前 `新标签位置` 已从 `顶部` 切回 `底部`<br>2. 当前存在多个 unpinned Tab | 1. 点击 `+` 新建 Tab<br>2. 观察 unpinned 区与侧边栏滚动位置 | 1. 新 Tab 追加到 unpinned 区底部<br>2. 侧边栏自动滚动到底部 |
| P1 | 1. 当前 `新标签位置` 为 `底部`<br>2. 最新创建的 Tab 位于 unpinned 区底部 | 1. 在该 Tab 中访问一个新网站或触发 URL 变化<br>2. 返回观察侧边栏排序 | 1. 该 Tab 保持当前底部模式下的既有排序行为 |
| P1 | 1. 当前存在已排序的 unpinned Tab 列表<br>2. 用户刚从 `顶部` 切换到 `底部` 或从 `底部` 切换到 `顶部` | 1. 切换 `新标签位置` 偏好<br>2. 不新建 Tab，直接观察现有列表 | 1. 偏好切换后不主动重排已有 unpinned Tab |

---

## 5. 标签列表操作边界

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前同时存在至少 2 个 Pinned Tab 与 2 个 unpinned Tab<br>2. 侧边栏列表处于展开态 | 1. 在 unpinned 区拖拽其中 1 个 Tab 调整顺序<br>2. 观察分区与排序变化 | 1. unpinned 区内 Tab 顺序按拖拽结果更新<br>2. Pinned 区顺序保持不变<br>3. 被拖拽的 unpinned Tab 不进入 Pinned 区 |
| P1 | 1. 当前同时存在至少 2 个 Pinned Tab 与 2 个 unpinned Tab<br>2. 侧边栏列表处于展开态 | 1. 在 Pinned 区拖拽其中 1 个 Tab 调整顺序<br>2. 观察分区与排序变化 | 1. Pinned 区内 Tab 顺序按拖拽结果更新<br>2. unpinned 区顺序保持不变<br>3. 被拖拽的 Pinned Tab 不进入 unpinned 区 |
| P1 | 1. 当前同时存在 Pinned Tab 与 unpinned Tab<br>2. 已记录两侧分区边界 | 1. 尝试将 unpinned Tab 拖动到 Pinned 区<br>2. 尝试将 Pinned Tab 拖动到 unpinned 区 | 1. 两次操作后 Pinned 与 unpinned 分区保持隔离<br>2. 标签不进入另一分类区域 |
| P1 | 1. 当前 unpinned 区已通过拖拽形成自定义顺序 | 1. 切换 `新标签位置` 偏好<br>2. 观察已拖拽完成的现有 Tab 顺序 | 1. 已拖拽形成的顺序保持不变 |
| P1 | 1. 当前侧边栏列表处于展开态<br>2. 当前存在至少 1 个非激活的 unpinned Tab | 1. 观察该 unpinned Tab 的操作按钮<br>2. 关闭该 unpinned Tab | 1. 该 unpinned Tab 显示关闭按钮<br>2. 关闭后该 Tab 从列表中移除 |
| P1 | 1. 当前侧边栏列表处于展开态<br>2. 当前打开的 Tab 为 unpinned Tab<br>3. 该 Tab 上方存在另一个 unpinned Tab | 1. 关闭当前打开的 unpinned Tab<br>2. 观察窗口切换结果 | 1. 被关闭的 Tab 从列表中移除<br>2. 窗口自动切换到列表中上方一个 Tab |
| P1 | 1. 当前侧边栏列表处于展开态<br>2. 当前存在 1 个已 Pin 的 Tab<br>3. `新标签位置` 当前为 `顶部` 或 `底部` | 1. 观察该 Pinned Tab 的操作按钮<br>2. 对该 Tab 执行 Unpin<br>3. 观察该 Tab 在 unpinned 区中的位置 | 1. 该 Pinned Tab 显示 Unpin 按钮<br>2. 执行 Unpin 后，该 Tab 进入 unpinned 区<br>3. 该 Tab 固定出现在 unpinned 区顶部，与 `新标签位置` 设置无关 |
| P1 | 1. 当前侧边栏列表处于展开态<br>2. 当前存在 1 个已 Pin 的 Tab | 1. 观察该 Pinned Tab 的操作按钮 | 1. 该 Pinned Tab 不显示关闭按钮<br>2. 该 Pinned Tab 显示 Unpin 按钮 |
| P1 | 1. 当前存在 1 个已打开的 Pinned Tab | 1. 通过关闭快捷键关闭该 Pinned Tab<br>2. 观察页面、列表与激活态变化 | 1. 当前窗口切换到 Browser 首页<br>2. 该 Pinned Tab 保留在列表中<br>3. 该 Pinned Tab 变为非激活状态 |
| P1 | 1. 当前不存在 Pinned Tab<br>2. 当前存在多个 unpinned Tab | 1. 观察侧边栏分区展示 | 1. 列表仍可正常展示 unpinned Tab<br>2. 不出现空的 Pinned 分区错位或异常占位 |
| P1 | 1. 当前不存在 unpinned Tab<br>2. 当前存在至少 1 个 Pinned Tab | 1. 观察侧边栏分区展示 | 1. 列表仍可正常展示 Pinned Tab<br>2. 不出现空的 unpinned 分区错位或异常占位 |
| P1 | 1. 当前仅剩 1 个 unpinned Tab<br>2. 该 Tab 为当前打开的 Tab | 1. 关闭该 unpinned Tab<br>2. 观察列表与页面状态 | 1. 关闭操作后列表状态保持稳定<br>2. 不出现分区错位、空白错位或异常激活态 |

---

## 6. 弹出层保护与偏好持久化

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| P1 | 1. 当前侧边栏处于展开态<br>2. Settings ActionList 已打开 | 1. 将鼠标从侧边栏 hover 区移动到 ActionList 弹出层内部<br>2. 持续观察侧边栏展示状态 | 1. 侧边栏保持展开<br>2. ActionList 保持显示 |
| P1 | 1. Settings ActionList 已打开<br>2. 鼠标当前停留在弹出层内部 | 1. 关闭 ActionList<br>2. 将鼠标移出侧边栏与弹出层区域 | 1. ActionList 关闭<br>2. 侧边栏按原逻辑收起 |
| P1 | 1. 当前存在多个 unpinned Tab<br>2. 用户可反复切换 `新标签位置` 偏好 | 1. 依次切换为 `顶部` → `底部` → `顶部`<br>2. 每次切换后点击 `+` 新建 Tab<br>3. 观察插入位置与滚动方向 | 1. 每次新建 Tab 的插入位置都与当前选中的偏好一致<br>2. 侧边栏滚动方向与当前偏好一致<br>3. 反复切换后行为不混乱 |
| P1 | 1. 用户已将 `新标签位置` 设置为 `顶部` 或 `底部` | 1. 退出并重新启动 App<br>2. 重新进入 Browser 并打开 Settings ActionList | 1. `新标签位置` 保持上次选中的偏好 |
| P1 | 1. App 重启后已确认 `新标签位置` 偏好保留 | 1. 再次点击 `+` 新建 Tab<br>2. 观察插入位置与滚动方向 | 1. 新 Tab 的插入位置继续遵循重启前保存的偏好<br>2. 侧边栏滚动方向与偏好一致 |
