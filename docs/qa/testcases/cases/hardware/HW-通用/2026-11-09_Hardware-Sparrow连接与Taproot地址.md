# Hardware - Sparrow连接与Taproot地址

> 规则文档：docs/qa/rules/hardware-rules.md（§19）
> 需求文档：docs/qa/requirements/Hardware-通用专项用例补齐.md
> 测试端：Desktop（Sparrow，USB）
> Jira 对应：OK-18199；仅同步description，保留未授权修改的字段。

## 前置条件

1. 适用设备：已验证支持 Sparrow 的 HW 型号，USB连接；不以蓝牙支持推定第三方钱包兼容性。
2. 从 https://sparrowwallet.com/ 安装受测 Sparrow，准备已初始化测试设备，记录同一测试钱包的主指纹、Taproot账户公钥和完整地址参考值。
3. 固定BTC网络及Taproot账户路径；账户0使用 m/86'/0'/0'，按同一地址索引对比。

## 1. 用例内容

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 识别设备并导入钱包 | 新建钱包，脚本类型选择Taproot，连接硬件设备并输入PIN完成导入 | 识别目标设备，钱包指纹、账户路径和账户公钥与参考值一致 |
| ❗️❗️P0❗️❗️ | Taproot收款地址 | 在Sparrow选择已导入账户的收款地址，在设备核对相同索引地址 | Sparrow、设备及独立参考的完整地址逐字符一致 |
| P1 | 重新连接后账户一致 | 保存钱包，断开并重新连接同一设备，再打开原钱包核对地址 | 仍为同一钱包指纹、路径和地址，未换成其他设备或账户 |
