# Hardware - Passphrase会话切换

> 规则文档：docs/qa/rules/hardware-rules.md（§19）
> 需求文档：docs/qa/requirements/Hardware-通用专项用例补齐.md
> 测试端：Desktop / Web（配合设备及Passphrase工具）
> Jira 对应：OK-24756；仅同步description，保留未授权修改的字段。

## 前置条件

1. 适用设备：原Passphrase测试工具支持的HW型号；不将关联PIN组数当作会话缓存数。
2. 准备固定测试种子、空密语及至少三组不同测试密语，保存各链/路径/密语的独立预期地址。
3. 打开 https://hardware-example.onekeytest.com/expo-example/passphrase-test；按同一设备、固件、网络登记本轮缓存配置，取消结果须对应工具预设取消子项。

## 1. 用例内容

| 优先级 | 场景 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- |
| ❗️❗️P0❗️❗️ | 缓存范围内来回切换 | 分别执行包含、不包含空密语的Switch Wallet组，在本轮缓存范围内往返切换钱包并取地址 | 每次返回目标密语的参考地址；空密语与非空密语不串钱包，不错误复用上一会话 |
| ❗️❗️P0❗️❗️ | 超过缓存范围后重新授权 | 对包含、不包含空密语两组依次访问超过缓存数量的钱包，再切回最早钱包按提示重新输入密语 | 按需要重新获取授权；返回最早钱包的原地址，不返回其他钱包缓存地址 |
| P1 | Count Test预设取消项 | 按原工具Count Test执行BTC、EVM、DOT的Wallet-1、Wallet-2及Wallet-3取消子项，再执行ADA的count=0子项，记录各自输出 | BTC、EVM、DOT的Wallet-1及Wallet-2通过，Wallet-3指定子项返回Cancelled by User；ADA指定子项不输出地址并返回Cancelled by User。取消结果不计为地址匹配，count为工具参数，不推定统一硬件缓存上限 |
| P1 | 跨链与多钱包切换 | 执行Multichain Wallet组，在BTC、EVM、DOT、ADA的支持项间切换不同测试密语 | 每次返回地址与所选链、路径和密语一致；同一密语跨链不复用其他链地址 |
| P1 | 特殊密语与会话隔离 | 执行Special Passphrase组，使用同一测试种子对应的密语样本，再切回空密语钱包 | 特殊密语地址与独立参考一致；切回空密语恢复原标准钱包地址 |
| P1 | 取消输入后重新请求 | 取消一次密语输入，再重新请求并输入目标密语 | 取消不返回其他钱包地址；重试后只返回本次密语钱包地址 |
