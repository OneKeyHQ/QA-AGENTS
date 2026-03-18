@regression @cosmos @transfer @desktop
Feature: OneKey Desktop Cosmos 系列网络转账
  As a OneKey desktop user using wallet "ran"
  I want to transfer tokens from Account 1 to Account 2
  So that I can verify the transfer flow works correctly across Cosmos networks

  Background:
    Given OneKey 桌面端已打开
    And 当前使用名为 "ran" 的钱包
    And 当前选中 Account 1

  @P0 @standard
  Scenario: Akash 网络转账 AKT
    When 用户切换到 Akash 网络
    And 选择 AKT 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.001"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Akash，代币为 AKT，数量为 0.001

  @P0 @standard
  Scenario: Cosmos 网络转账 ATOM
    When 用户切换到 Cosmos 网络
    And 选择 ATOM 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "1"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Cosmos，代币为 ATOM，数量为 1

  @P0 @max-amount
  Scenario: Crypto.org 网络转账 CRO - 最大金额
    When 用户切换到 Crypto.org 网络
    And 选择 CRO 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 点击最大金额按钮
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Crypto.org，代币为 CRO，数量为最大可用余额

  @P0 @small-amount
  Scenario: Fetch.ai 网络转账 FET - 极小金额
    When 用户切换到 Fetch.ai 网络
    And 选择 FET 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.0001"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Fetch.ai，代币为 FET，数量为 0.0001

  @P0 @standard
  Scenario: Juno 网络转账 JUNO
    When 用户切换到 Juno 网络
    And 选择 JUNO 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.0002"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Juno，代币为 JUNO，数量为 0.0002

  @P0 @memo
  Scenario: Osmosis 网络转账 OSMO - 带 memo
    When 用户切换到 Osmosis 网络
    And 选择 OSMO 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.01"
    And 输入 memo "onekey"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Osmosis，代币为 OSMO，数量为 0.01，memo 为 "onekey"

  @P0 @memo @cross-token
  Scenario: Osmosis 网络转账 ATOM - 跨链代币带 memo
    When 用户切换到 Osmosis 网络
    And 选择 ATOM 代币（非原生代币）
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.001"
    And 输入 memo "123456"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Osmosis，代币为 ATOM，数量为 0.001，memo 为 "123456"

  @P0 @standard
  Scenario: Secret Network 转账 SCRT
    When 用户切换到 Secret Network
    And 选择 SCRT 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.0001"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Secret Network，代币为 SCRT，数量为 0.0001

  @P0 @standard
  Scenario: Celestia 网络转账 TIA
    When 用户切换到 Celestia 网络
    And 选择 TIA 代币
    And 点击发送
    And 选择 Account 2 作为收款方
    And 输入转账数量 "0.0002"
    And 点击下一步
    Then 确认页显示正确的转账信息
    And 网络为 Celestia，代币为 TIA，数量为 0.0002
