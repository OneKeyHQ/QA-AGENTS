# Hardware - Protobuf接口回归

> 规则文档：docs/qa/rules/hardware-rules.md（§19）
> 需求文档：docs/qa/requirements/Hardware-通用专项用例补齐.md
> 测试端：Desktop / Web（固件模式及测试工具）
> Jira 对应：OK-25676；仅同步description，保留未授权修改的字段。

## 前置条件

1. 适用设备：原接口工具支持的HW型号；先登记型号能力及不支持方法清单。
2. 准备专用可重置设备，打开 https://hd-example.onekeytest.com/security-check，使用受测端提供的连接入口连接设备。
3. 按原用例只执行firmware normal/all，不执行bootloader/all；支持关联PIN的型号关闭Passphrase后执行。
4. Classic排除evmSignTypedData中的Sign Gnosis Safe Tx-3、Tx(ChainId: 10进制)-4、Tx(Danger)-5；其他排除项须有型号/固件依据，不能将失败项直接改为不适用。

## 1. 用例内容

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | firmware接口集合 | 连接并解锁设备，选择normal/all执行型号支持的方法，按请求在设备确认，导出结果 | 每个支持方法均有对应通过记录，执行数量与选定清单一致；不支持项单独列出依据 |
| P1 | 失败项单独复测 | 保留首次失败日志，单独重新执行失败方法并对比请求与返回 | 记录首轮结果、复测结果及失败原因；重复失败保留为缺陷，不因其他方法通过而覆盖 |
| P1 | 清除设备要求PIN | 在专用测试设备执行deviceWipe，设备点击继续后先取消PIN，再重发并输入主PIN确认 | 未验证主PIN时不清除设备；明确确认后设备才恢复未初始化状态，旧钱包不可直接使用 |
