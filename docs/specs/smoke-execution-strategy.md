# 冒烟测试执行策略

> 本文档定义冒烟测试的执行策略，优化测试执行速度同时保证验证准确性。

---

## 1. 执行模式

### 1.1 快速模式（smoke-fast）

**触发词**: `smoke` 或 `smoke-fast`

**适用场景**:
- 日常提测验收
- 快速回归测试
- CI/CD 流水线集成

**执行规则**:
- 只执行 Checklist 中标记为 `[P0]` 的核心场景
- 使用批量操作模式，减少中间状态检查
- 智能快照策略，只在关键验证点获取快照
- 性能采集只在开始和结束时执行

### 1.2 完整模式（smoke-full）

**触发词**: `smoke-full`

**适用场景**:
- 发版前完整测试
- 重大功能变更后的回归
- 需要完整覆盖所有场景

**执行规则**:
- 执行 Checklist 中的所有场景（P0/P1/P2）
- 每次操作前后进行状态检查
- 详细的中间状态验证
- 完整的性能采集

---

## 2. 批量操作模式

### 2.1 操作合并原则

将连续的相关操作合并为一个操作序列，减少中间状态检查：

```
❌ 低效执行（原方式）:
   操作1 → 获取快照 → 验证 → 操作2 → 获取快照 → 验证 → 操作3 → 获取快照 → 验证

✅ 高效执行（优化后）:
   [操作1 + 操作2 + 操作3] → 获取快照 → 验证
```

### 2.2 可合并的操作类型

| 操作序列 | 合并方式 | 示例 |
|---------|---------|------|
| 导航 + 等待 + 验证 | 合并为单次导航操作 | 打开页面并验证加载完成 |
| 点击 + 输入 + 提交 | 合并为表单操作 | 搜索功能测试 |
| 多次点击同类元素 | 批量执行后统一验证 | 连续收藏多个代币 |
| 切换标签 + 验证状态 | 合并为状态一致性检查 | 跨分类验证收藏状态 |

### 2.3 不可合并的操作

以下操作必须单独执行并验证：
- 涉及资金操作（转账、兑换等）
- 需要人工干预的操作（钱包授权等）
- 状态不可逆的操作（删除、取消等）

---

## 3. 智能快照策略

### 3.1 快照获取时机

| 时机 | 是否获取快照 | 说明 |
|------|-------------|------|
| 页面首次加载后 | ✅ 是 | 验证页面结构 |
| 关键操作完成后 | ✅ 是 | 如收藏成功、搜索完成 |
| 页面跳转后 | ✅ 是 | 验证目标页面 |
| 测试场景结束时 | ✅ 是 | 最终状态验证 |
| 中间输入过程 | ❌ 否 | 使用轻量级检查 |
| 连续操作中间 | ❌ 否 | 批量完成后再检查 |
| 等待过程中 | ❌ 否 | 使用 wait_for 代替 |

### 3.2 轻量级状态检查

使用 `evaluate_script` 进行轻量级状态检查，替代完整快照：

```javascript
// 检查元素是否存在
() => !!document.querySelector('[data-testid="favorite-button"]')

// 检查元素状态
() => document.querySelector('.favorite-btn')?.classList.contains('active')

// 检查列表数量
() => document.querySelectorAll('.token-item').length
```

### 3.3 快照使用原则

```
优先级：evaluate_script > wait_for > take_snapshot

1. 简单状态检查 → evaluate_script（~100ms）
2. 等待元素出现 → wait_for（自动等待）
3. 复杂验证/调试 → take_snapshot（~1-2s）
```

---

## 4. 性能采集优化

### 4.1 采集时机

| 模式 | 采集时机 | 说明 |
|------|---------|------|
| 快速模式 | 开始1次 + 结束1次 | 总计2次采集 |
| 完整模式 | 每个场景结束时 | 按需采集 |

### 4.2 采集脚本注入

```
✅ 正确做法：
   1. 测试开始时注入性能采集脚本
   2. 执行所有测试操作
   3. 测试结束时收集性能数据

❌ 错误做法：
   - 每次页面刷新后重复注入
   - 每个操作后都采集一次
   - 多次注入相同脚本
```

### 4.3 性能数据收集脚本

```javascript
// 统一的性能数据收集函数
() => {
  const metrics = {};
  
  // Core Web Vitals
  const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
  metrics.LCP = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1].startTime : null;
  
  const fidEntries = performance.getEntriesByType('first-input');
  metrics.FID = fidEntries.length > 0 ? fidEntries[0].processingStart - fidEntries[0].startTime : null;
  
  const clsEntries = performance.getEntriesByType('layout-shift');
  metrics.CLS = clsEntries.reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0);
  
  // 加载性能
  const navTiming = performance.getEntriesByType('navigation')[0];
  if (navTiming) {
    metrics.TTFB = navTiming.responseStart;
    metrics.FCP = performance.getEntriesByType('paint')
      .find(e => e.name === 'first-contentful-paint')?.startTime;
    metrics.LoadComplete = navTiming.loadEventEnd;
  }
  
  // 资源统计
  const resources = performance.getEntriesByType('resource');
  metrics.resourceCount = resources.length;
  
  // 内存使用
  if (performance.memory) {
    metrics.usedJSHeapSize = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
  }
  
  return metrics;
}
```

---

## 5. Checklist 优先级定义

### 5.1 优先级标记

| 标记 | 含义 | 快速模式 | 完整模式 | 占比 |
|------|------|---------|---------|------|
| `[P0]` | 核心路径 | ✅ 执行 | ✅ 执行 | ~20% |
| `[P1]` | 重要场景 | ❌ 跳过 | ✅ 执行 | ~40% |
| `[P2]` | 边缘场景 | ❌ 跳过 | ✅ 执行 | ~40% |

### 5.2 优先级判定标准

**P0 核心路径**:
- 功能的主要使用路径
- 用户最常用的操作
- 无法绕过的关键步骤

**P1 重要场景**:
- 重要的边界条件
- 常见的异常处理
- 跨功能交互验证

**P2 边缘场景**:
- 极端边界条件
- 罕见的异常情况
- 性能和兼容性测试

### 5.3 示例

```markdown
### 场景1：收藏功能测试
- [P0] (a) 点击收藏按钮，验证收藏成功（按钮状态变化）
- [P0] (b) 进入自选列表，验证代币已添加
- [P1] (c) 切换其他分类，验证收藏状态保持一致
- [P2] (d) 快速连续点击收藏按钮3次，验证防抖机制
- [P2] (e) 断网后点击收藏，验证错误提示
```

---

## 6. 执行流程对比

### 6.1 快速模式流程

```
1. 导航到目标页面
2. 注入性能采集脚本（1次）
3. 筛选 P0 场景
4. 批量执行操作序列
5. 关键节点获取快照验证
6. 收集性能数据（1次）
7. 生成报告
```

### 6.2 完整模式流程

```
1. 导航到目标页面
2. 注入性能采集脚本
3. 遍历所有场景（P0/P1/P2）
4. 每个操作前检查状态
5. 执行操作
6. 每个操作后验证结果
7. 每个场景结束采集性能
8. 生成详细报告
```

---

## 7. 预期效果

| 指标 | 快速模式 | 完整模式 | 说明 |
|------|---------|---------|------|
| 场景覆盖 | ~20% | 100% | 核心 vs 全部 |
| 执行时间 | ~10分钟 | ~30分钟 | 典型 Checklist |
| 快照次数 | 减少70% | 标准 | 智能快照策略 |
| 性能采集 | 2次 | 多次 | 开始+结束 vs 按需 |

---

## 8. 最佳实践

### 8.1 日常验收

```bash
# 使用快速模式进行日常验收
smoke https://app.onekey.so/market
```

### 8.2 发版前测试

```bash
# 使用完整模式进行发版前测试
smoke-full https://app.onekey.so/market
```

### 8.3 指定 Checklist

```bash
# 基于 Checklist 执行快速模式
@docs/testcases/checklist/xxx-Checklist.md smoke https://app.onekey.so/market

# 基于 Checklist 执行完整模式
@docs/testcases/checklist/xxx-Checklist.md smoke-full https://app.onekey.so/market
```

---

**最后更新**: 2026-01-08
