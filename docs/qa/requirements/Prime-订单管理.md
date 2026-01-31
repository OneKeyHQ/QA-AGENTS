# Prime - 订单管理需求文档

> 版本：1.0  
> 更新日期：2026-01-31  
> App 版本：待定  
> 测试端：iOS / Android / Web

---

## 1. 需求背景

在 OneKey 官网（shop.onekey.so）下单购买硬件钱包的用户，如果下单使用的邮箱与 OneKey ID 邮箱相同，登录 OneKey ID 后可以在 App 上查看对应订单的记录及状态，点击「Details」可跳转至官网查看物流信息。

---

## 2. 功能入口

| 入口路径 | 说明 |
|---------|------|
| OneKey ID 弹窗 → My orders | 点击 OneKey ID 头像/名称打开弹窗，选择「My orders」进入订单列表 |

---

## 3. 功能描述

### 3.1 邮箱匹配规则

| 规则项 | 规则描述 |
|-------|---------|
| 匹配条件 | 官网下单邮箱 = OneKey ID 邮箱（精确匹配） |
| 匹配成功 | 显示该邮箱关联的所有订单 |
| 匹配失败 | 显示空状态，引导用户去官网查找订单 |

### 3.2 状态场景

#### 3.2.1 无订单状态

| 元素 | 内容 |
|-----|------|
| 标题 | My orders |
| 空状态图标 | 订单占位图 + ? 图标 |
| 主文案 | No orders yet |
| 副文案 | Orders are linked to your OneKey ID email. If you placed an order with a different email, you can search it on our website. |
| 按钮 1 | Find my order → 跳转 orders.onekey.so |
| 按钮 2 | Buy OneKey → 跳转 shop.onekey.so |

#### 3.2.2 有订单状态

| 元素 | 内容 |
|-----|------|
| 标题 | My orders |
| 副标题 | Orders are linked to your OneKey ID email. For full details and after-sales, please open on website. |
| 订单卡片 | 显示订单号、商品数量、日期、状态、金额 |
| 操作按钮 | Details → 跳转官网订单详情页 |

### 3.3 订单卡片信息

| 字段 | 说明 | 示例 |
|-----|------|------|
| 订单号 | 以 # 开头 | #1K414975BX |
| 商品数量 | X Items | 1 Items |
| 下单日期 | YYYY-MM-DD | 2025-12-27 |
| 订单状态 | 状态标签（颜色区分） | Cancelled（红色）|
| 金额 | 订单金额 | $289 |

### 3.4 订单状态类型

| 状态 | 显示样式 | 说明 |
|-----|---------|------|
| Pending | 待定 | 待处理 |
| Processing | 待定 | 处理中 |
| Shipped | 待定 | 已发货 |
| Delivered | 待定 | 已送达 |
| Cancelled | 红色标签 | 已取消 |
| Refunded | 待定 | 已退款 |

---

## 4. 交互规则

### 4.1 跳转规则

| 操作 | 目标 URL | 说明 |
|-----|---------|------|
| 点击 Find my order | orders.onekey.so | 外部浏览器打开 |
| 点击 Buy OneKey | shop.onekey.so | 外部浏览器打开 |
| 点击 Details | 官网订单详情页 | 外部浏览器打开，可查看物流信息 |

### 4.2 加载规则

| 规则项 | 规则描述 |
|-------|---------|
| 加载方式 | 一次性加载（用户订单量较少） |
| 分页 | 暂不支持，后续根据实际需求评估 |

---

## 5. 多语言 Key

| Key | 翻译（EN） |
|-----|-----------|
| prime:my_order | My orders |
| prime:no_order_yet | No orders yet |
| prime:no_order_yet_desc | Orders are linked to your OneKey ID email. If you placed an order with a different email, you can search it on our website. |
| prime:button_find_my_order | Find my order |
| prime:button_buy_onekey | Buy OneKey |
| prime:order_link_title | Orders are linked to your OneKey ID email |
| prime:order_link_desc | For full details and after-sales, please open on website. |

---

## 6. 已知风险

| 风险项 | 说明 |
|-------|------|
| 邮箱大小写 | 需确认邮箱匹配是否区分大小写 |
| 订单同步延迟 | 官网下单后 App 显示是否有延迟 |
| 跨端一致性 | iOS / Android / Web 订单展示是否一致 |

---

## 7. 关联资源

| 资源类型 | 链接 |
|---------|------|
| 设计稿 | Figma - Order management |
| API 文档 | 待补充 |

---

## 8. 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|---------|
| 2026-01-31 | 1.0 | 初始版本，新增订单管理功能需求 |
