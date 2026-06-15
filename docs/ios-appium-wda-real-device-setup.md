# iOS 真机 Appium + WebDriverAgent 配置教程

本文记录当前 Mac 上已经验证通过的 Appium + WebDriverAgent 配置流程，用于操作通过 TestFlight 安装的 iOS App，例如 OneKey。

目标：

- 在真实 iPhone 上安装并启动 WebDriverAgentRunner。
- 通过 Appium XCUITest 启动 TestFlight App。
- 获取截图和 UI XML。

## 核心结论

TestFlight 安装业务 App 不需要业务 App 的开发者权限。

Appium 操作 iOS 真机需要签名并安装 WebDriverAgentRunner。WDA 是一个独立测试 Runner，可以用当前 Xcode 登录账号的 Personal Team 签名，不一定要用业务 App 的 Team。

本机已验证成功的配置：

```text
Device Name: chloe
Device UDID: 00008140-001A48E41E04801C
iOS Version: 26.5
Business App Bundle ID: so.onekey.wallet
Personal Team ID: J5F69L45WG
Signing Certificate: Apple Development: chaw999@hotmail.com
WDA Bundle ID: com.chaw999.WebDriverAgentRunner.j5f69l45wg
WDA Runner Bundle ID: com.chaw999.WebDriverAgentRunner.j5f69l45wg.xctrunner
DerivedData: /tmp/onekey-appium-smoke/DerivedData-personal-single
```

注意：证书名称括号里的 `QB5C3YM58X` 不是 Team ID。Team ID 要从证书 subject 的 `OU=` 获取，或从 Xcode Signing 页面 Team 行括号中获取。

## 1. 基础环境检查

```bash
xcodebuild -version
xcode-select -p
xcrun xctrace list devices
appium --version
appium driver list --installed --verbose
```

确认 OneKey 已安装：

```bash
xcrun devicectl device info apps --device 00008140-001A48E41E04801C | rg 'OneKey|so.onekey.wallet'
```

WDA project 位置：

```text
/Users/chole/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj
```

如果需要用 Xcode 打开：

```bash
open -a Xcode /Users/chole/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj
```

## 2. 获取正确 Team ID

不要使用证书名称括号里的短 ID 作为 Team ID。用下面命令读取证书 subject，`OU=` 才是 Team ID。

```bash
security find-certificate -a -p -c "Apple Development" | \
awk 'BEGIN{n=0} /BEGIN CERTIFICATE/{n++; f="/tmp/apple-dev-cert-" n ".pem"} {print > f} END{print n}'

for f in /tmp/apple-dev-cert-*.pem; do
  echo "CERT $f"
  openssl x509 -in "$f" -noout -subject -issuer 2>/dev/null | sed 's/^/  /'
  echo
done
```

本机成功使用的个人 Team：

```text
subject=UID=LP2NZH55DK, CN=Apple Development: chaw999@hotmail.com (QB5C3YM58X), OU=J5F69L45WG, O=周 周, C=US
```

所以 Team ID 是：

```text
J5F69L45WG
```

## 3. 准备 smoke 目录和脚本

```bash
mkdir -p /tmp/onekey-appium-smoke
cd /tmp/onekey-appium-smoke
npm init -y
npm install webdriverio
```

当前 smoke 脚本位置：

```text
/tmp/onekey-appium-smoke/smoke.mjs
```

脚本支持这些环境变量：

```text
APPIUM_PORT
XCODE_ORG_ID
UPDATED_WDA_BUNDLE_ID
DERIVED_DATA_PATH
PREBUILD_WDA
USE_PREBUILT_WDA
WDA_PROJECT
ASC_KEY_PATH
ASC_KEY_ID
ASC_ISSUER_ID
```

`PREBUILD_WDA=1` 会在 Appium session 前先执行 `xcodebuild build-for-testing`。

`USE_PREBUILT_WDA=1` 会让 Appium 走 `test-without-building`，复用已有 WDA 构建产物。

## 4. 预构建 WDA

推荐先用单线程预构建 WDA。当前机器曾遇到并发 codesign 导致的 `errSecInternalComponent`，使用 `-jobs 1` 后构建成功。

```bash
WDA_PROJECT="/Users/chole/.appium/node_modules/appium-xcuitest-driver/node_modules/appium-webdriveragent/WebDriverAgent.xcodeproj"
UDID="00008140-001A48E41E04801C"
TEAM="J5F69L45WG"
BUNDLE="com.chaw999.WebDriverAgentRunner.j5f69l45wg"
DD="/tmp/onekey-appium-smoke/DerivedData-personal-single"
LOG="/tmp/onekey-appium-smoke/xcodebuild-personal-team-single.log"

rm -rf "$DD"

xcodebuild build-for-testing \
  -jobs 1 \
  -allowProvisioningUpdates \
  -allowProvisioningDeviceRegistration \
  -project "$WDA_PROJECT" \
  -scheme WebDriverAgentRunner \
  -derivedDataPath "$DD" \
  -destination "id=$UDID" \
  IPHONEOS_DEPLOYMENT_TARGET=26.5 \
  DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic \
  "CODE_SIGN_IDENTITY=Apple Development" \
  PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE" \
  GCC_TREAT_WARNINGS_AS_ERRORS=0 \
  COMPILER_INDEX_STORE_ENABLE=NO \
  > "$LOG" 2>&1

echo "rc=$? log=$LOG"
```

成功标志：

```text
** TEST BUILD SUCCEEDED **
```

成功产物：

```text
/tmp/onekey-appium-smoke/DerivedData-personal-single/Build/Products/Debug-iphoneos/WebDriverAgentRunner-Runner.app
```

## 5. 手动安装 WDA Runner 到手机

```bash
xcrun devicectl device install app \
  --device 00008140-001A48E41E04801C \
  /tmp/onekey-appium-smoke/DerivedData-personal-single/Build/Products/Debug-iphoneos/WebDriverAgentRunner-Runner.app
```

成功会看到：

```text
App installed:
bundleID: com.chaw999.WebDriverAgentRunner.j5f69l45wg.xctrunner
```

## 6. 信任开发者证书

如果首次运行时报：

```text
The application could not be launched because the Developer App Certificate is not trusted.
```

需要在 iPhone 上手动信任一次：

```text
设置 -> 通用 -> VPN 与设备管理 -> Apple Development: chaw999@hotmail.com / 周 周 -> 信任
```

iOS 不允许从 Mac 侧脚本静默完成这个信任动作。

可以用下面命令验证 WDA Runner 是否能启动：

```bash
xcrun devicectl device process launch \
  --device 00008140-001A48E41E04801C \
  com.chaw999.WebDriverAgentRunner.j5f69l45wg.xctrunner
```

如果能看到 `Launched application...`，说明安装和信任已通过。

## 7. 启动 Appium

```bash
cd /tmp/onekey-appium-smoke
appium --port 4723 --log-level info --log /tmp/onekey-appium-smoke/appium-4723-personal.log
```

如果 `4723` 被占用：

```bash
lsof -nP -iTCP:4723 -sTCP:LISTEN
```

也可以临时用 `4725`，同时把 smoke 里的 `APPIUM_PORT` 改成 `4725`。

## 8. 跑 smoke 验证

另开一个终端：

```bash
cd /tmp/onekey-appium-smoke

env \
  XCODE_ORG_ID=J5F69L45WG \
  UPDATED_WDA_BUNDLE_ID=com.chaw999.WebDriverAgentRunner.j5f69l45wg \
  DERIVED_DATA_PATH=/tmp/onekey-appium-smoke/DerivedData-personal-single \
  USE_PREBUILT_WDA=1 \
  APPIUM_PORT=4723 \
  node smoke.mjs
```

成功输出应包含：

```json
{
  "ok": true,
  "appState": 4,
  "contexts": [
    "NATIVE_APP"
  ],
  "screenshot": "/tmp/onekey-appium-smoke/onekey-smoke.png",
  "source": "/tmp/onekey-appium-smoke/onekey-source.xml"
}
```

成功产物：

```text
/tmp/onekey-appium-smoke/onekey-smoke.png
/tmp/onekey-appium-smoke/onekey-source.xml
```

## 9. 用脚本自动预构建

`smoke.mjs` 已支持自动预构建。需要重新生成 WDA 时可以跑：

```bash
cd /tmp/onekey-appium-smoke

env \
  XCODE_ORG_ID=J5F69L45WG \
  UPDATED_WDA_BUNDLE_ID=com.chaw999.WebDriverAgentRunner.j5f69l45wg \
  DERIVED_DATA_PATH=/tmp/onekey-appium-smoke/DerivedData-personal-single \
  PREBUILD_WDA=1 \
  APPIUM_PORT=4723 \
  node smoke.mjs
```

如果本机没有登录可用 Xcode 账号，但有 App Store Connect API Key，可以额外传：

```bash
export ASC_KEY_PATH=/path/to/AuthKey_XXXX.p8
export ASC_KEY_ID=XXXX
export ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

脚本会把这些参数传给 `xcodebuild`：

```text
-authenticationKeyPath
-authenticationKeyID
-authenticationKeyIssuerID
```

注意：Appium capabilities 本身不暴露这些 `xcodebuild` auth key 参数，所以需要在 Appium session 前通过脚本预构建。

## 10. 常见错误

### No Account for Team

错误：

```text
No Account for Team "BVJ3FU5H2K"
No profiles for 'xxx.xctrunner' were found
```

处理：

- 不要强行用业务 Team。
- 如果只是操作 TestFlight App，可以改用当前 Xcode 登录账号的 Personal Team。
- Team ID 从证书 `OU=` 或 Xcode Signing Team 行获取。

### profile 后缀不匹配

错误：

```text
No profiles for 'com.xxx.WebDriverAgentRunner.xctrunner' were found
```

说明：

WDA 需要签的是 Runner bundle id，默认会在 `updatedWDABundleId` 后追加 `.xctrunner`。

例如：

```text
updatedWDABundleId: com.chaw999.WebDriverAgentRunner.j5f69l45wg
actual runner id:  com.chaw999.WebDriverAgentRunner.j5f69l45wg.xctrunner
```

业务 App 的 profile，例如 `so.onekey.wallet` 或 `so.onekey.wallet.ServiceExtension`，不能直接拿来签 WDA Runner。

### errSecInternalComponent

错误：

```text
Command CodeSign failed with a nonzero exit code
errSecInternalComponent
```

处理：

- 先确认 keychain 允许 codesign 访问私钥。
- 用 `xcodebuild -jobs 1` 单线程重新构建。
- 本机实际就是用 `-jobs 1` 解决的。

### Developer App Certificate is not trusted

错误：

```text
The application could not be launched because the Developer App Certificate is not trusted.
```

处理：

在 iPhone 上手动信任：

```text
设置 -> 通用 -> VPN 与设备管理 -> 对应 Apple Development 证书 -> 信任
```

### Appium driver update 失败

错误：

```text
npm error Cannot read properties of null (reading 'package')
```

本机处理方式：

```bash
backup="/tmp/onekey-appium-smoke/appium-node_modules-backup-$(date +%Y%m%d%H%M%S)"
mv /Users/chole/.appium/node_modules "$backup"

cd /Users/chole/.appium
npm install --save-dev --no-progress --no-audit --omit=peer \
  --install-strategy=shallow --no-package-lock --save-exact \
  appium-xcuitest-driver@10.43.1 appium-uiautomator2-driver@7.2.3

appium driver list --installed
```

## 11. 最终确认清单

成功时应满足：

- `xcodebuild build-for-testing` 成功。
- WDA Runner 已安装到 iPhone。
- iPhone 已信任开发者证书。
- Appium session 创建成功。
- WDA 启动成功。
- OneKey 被启动。
- `appState` 返回 `4`。
- contexts 至少包含 `NATIVE_APP`。
- 生成截图：`/tmp/onekey-appium-smoke/onekey-smoke.png`。
- 生成 UI XML：`/tmp/onekey-appium-smoke/onekey-source.xml`。
