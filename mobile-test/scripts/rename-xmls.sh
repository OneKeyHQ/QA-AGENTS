#!/bin/bash
# Rename xmls files to English camelCase
set -e
ROOT="/Users/onekey/Documents/UI自动化/node-e2e"
cd "$ROOT"

# addressBook
mv "xmls/addressBook/addressBook_noaddress_Chinese.xml" "xmls/addressBook/addressBookNoaddressChinese.xml"
mv "xmls/addressBook/AddressBook_Select_Networks_english.xml" "xmls/addressBook/addressBookSelectNetworksEnglish.xml"
mv "xmls/addressBook/AddressBook_noaddress_english.xml" "xmls/addressBook/addressBookNoaddressEnglish.xml"
mv "xmls/addressBook/AddressBook_AddAddress_english.xml" "xmls/addressBook/addressBookAddAddressEnglish.xml"
mv "xmls/addressBook/addressBook_haveAddress_Chinese.xml" "xmls/addressBook/addressBookHaveAddressChinese.xml"
mv "xmls/addressBook/AddressBook_AddAddress_Chinese.xml" "xmls/addressBook/addressBookAddAddressChinese.xml"
mv "xmls/addressBook/addressbook_alarm_popup_english.xml" "xmls/addressBook/addressbookAlarmPopupEnglish.xml"

# general
mv "xmls/general/NetworkselectPage_chinese_6.1.0.xml" "xmls/general/networkSelectPageChinese610.xml"
mv "xmls/general/SingleNetwork_token_select_english.xml" "xmls/general/singleNetworkTokenSelectEnglish.xml"
mv "xmls/general/Evm_networks_select_english.xml" "xmls/general/evmNetworksSelectEnglish.xml"
mv "xmls/general/NetworkselectPage_english.xml" "xmls/general/networkSelectPageEnglish.xml"

# homePage
mv "xmls/homePage/homepage_nowallet_english.xml" "xmls/homePage/homepageNowalletEnglish.xml"
mv "xmls/homePage/Homepage_nomoney_mnemonic.xml" "xmls/homePage/homepageNomoneyMnemonic.xml"
mv "xmls/homePage/Homepage_nomoney_SecondPage_english.xml" "xmls/homePage/homepageNomoneySecondPageEnglish.xml"
mv "xmls/homePage/homePage_NoWallet_Chinese.xml" "xmls/homePage/homePageNoWalletChinese.xml"
mv "xmls/homePage/Homepage_CopyAddress_Page_Chinese_6.1.0.xml" "xmls/homePage/homepageCopyAddressPageChinese610.xml"
mv "xmls/homePage/HomePage_nomoney_fourthPage_english.xml" "xmls/homePage/homePageNomoneyFourthPageEnglish.xml"
mv "xmls/homePage/HomePage_nomoney_ThirdPage_english.xml" "xmls/homePage/homePageNomoneyThirdPageEnglish.xml"

# onboarding
mv "xmls/onboarding/onboarding_UseGoogle_Chinese.xml" "xmls/onboarding/onboardingUseGoogleChinese.xml"
mv "xmls/onboarding/导入观察地址.xml" "xmls/onboarding/importWatchAddress.xml"
mv "xmls/onboarding/导入助记词或私钥页面.xml" "xmls/onboarding/importMnemonicOrPrivateKeyPage.xml"
mv "xmls/onboarding/添加钱包.xml" "xmls/onboarding/addWallet.xml"
mv "xmls/onboarding/onboarding_Select_HW_Chinese.xml" "xmls/onboarding/onboardingSelectHwChinese.xml"
mv "xmls/onboarding/导入公钥.xml" "xmls/onboarding/importPublicKey.xml"
mv "xmls/onboarding/onboarding_UseApple_Chinese.xml" "xmls/onboarding/onboardingUseAppleChinese.xml"
mv "xmls/onboarding/Homepage有资产第二屏.xml" "xmls/onboarding/homepageWithAssetsSecondScreen.xml"
mv "xmls/onboarding/Homepage有资产第三屏.xml" "xmls/onboarding/homepageWithAssetsThirdScreen.xml"
mv "xmls/onboarding/onboarding_Language_Chinese.xml" "xmls/onboarding/onboardingLanguageChinese.xml"
mv "xmls/onboarding/Homepage有资产.xml" "xmls/onboarding/homepageWithAssets.xml"
mv "xmls/onboarding/onboarding_english.xml" "xmls/onboarding/onboardingEnglish.xml"
mv "xmls/onboarding/导入助记词或私钥_私钥.xml" "xmls/onboarding/importMnemonicOrPrivateKeyPrivateKey.xml"

# popups
mv "xmls/popups/复制地址搜索LTC.xml" "xmls/popups/copyAddressSearchLtc.xml"
mv "xmls/popups/选择地址类型popup.xml" "xmls/popups/selectAddressTypePopup.xml"
mv "xmls/popups/inputPasscode_popup_Chinese.xml" "xmls/popups/inputPasscodePopupChinese.xml"
mv "xmls/popups/Redeem_logined_popup_English.xml" "xmls/popups/redeemLoginedPopupEnglish.xml"
mv "xmls/popups/没有创建地址的选择地址类型popup.xml" "xmls/popups/selectAddressTypeNoAddressPopup.xml"
mv "xmls/popups/导入xpub后BTC派生路径选择popup.xml" "xmls/popups/importXpubBtcDerivePathSelectPopup.xml"
mv "xmls/popups/Confirm_password_popup_english.xml" "xmls/popups/confirmPasswordPopupEnglish.xml"
mv "xmls/popups/addressbook_alarm_popup_Chinese.xml" "xmls/popups/addressbookAlarmPopupChinese.xml"
mv "xmls/popups/Confirm_password_popup_chinese.xml" "xmls/popups/confirmPasswordPopupChinese.xml"
mv "xmls/popups/复制地址搜索BTC.xml" "xmls/popups/copyAddressSearchBtc.xml"
mv "xmls/popups/SignupLogin_popup_English.xml" "xmls/popups/signupLoginPopupEnglish.xml"
mv "xmls/popups/SetPassowrd._popup_Englishxml" "xmls/popups/setPasswordPopupEnglish.xml"

# settings
mv "xmls/settings/Intercom_English.xml" "xmls/settings/intercomEnglish.xml"
mv "xmls/settings/Backup_english.xml" "xmls/settings/backupEnglish.xml"
mv "xmls/settings/menu_Chinese.xml" "xmls/settings/menuChinese.xml"
mv "xmls/settings/NetworkSettings_English.xml" "xmls/settings/networkSettingsEnglish.xml"
mv "xmls/settings/Menu_english.xml" "xmls/settings/menuEnglish.xml"
mv "xmls/settings/BulkCopyAddress_nologin_English.xml" "xmls/settings/bulkCopyAddressNologinEnglish.xml"
mv "xmls/settings/PreferencesSettings_English.xml" "xmls/settings/preferencesSettingsEnglish.xml"
mv "xmls/settings/Prime_not_login_English.xml" "xmls/settings/primeNotLoginEnglish.xml"
mv "xmls/settings/Security_Settings_English.xml" "xmls/settings/securitySettingsEnglish.xml"
mv "xmls/settings/Referral_English.xml" "xmls/settings/referralEnglish.xml"
mv "xmls/settings/Settings_English.xml" "xmls/settings/settingsEnglish.xml"
mv "xmls/settings/Scan_English.xml" "xmls/settings/scanEnglish.xml"
mv "xmls/settings/防护管理_Chinese.xml" "xmls/settings/protectionManagementChinese.xml"

# swap
mv "xmls/swap/Swap_nomoney_english.xml" "xmls/swap/swapNomoneyEnglish.xml"
mv "xmls/swap/Swap_nomoney_pro_english.xml" "xmls/swap/swapNomoneyProEnglish.xml"

# wallets
mv "xmls/wallets/addAddress.page.js" "xmls/wallets/addAddressPage.js"
mv "xmls/wallets/添加钱包_english.xml" "xmls/wallets/addWalletEnglish.xml"
mv "xmls/wallets/import_PrvKey_SelectNetwork_Chinese.xml" "xmls/wallets/importPrvKeySelectNetworkChinese.xml"
mv "xmls/wallets/添加钱包.xml" "xmls/wallets/addWallet.xml"
mv "xmls/wallets/wallet_Selector_Chinese.xml" "xmls/wallets/walletSelectorChinese.xml"
mv "xmls/wallets/导入观察地址.xml" "xmls/wallets/importWatchAddress.xml"
mv "xmls/wallets/importMneOrPrvKey_PrvKey_Chinese.xml" "xmls/wallets/importMneOrPrvKeyPrvKeyChinese.xml"
mv "xmls/wallets/homepage_NotBackupWallet_FirstPage_Chinese.xml" "xmls/wallets/homepageNotBackupWalletFirstPageChinese.xml"
mv "xmls/wallets/creating_Wallet_Chinese.xml" "xmls/wallets/creatingWalletChinese.xml"
mv "xmls/wallets/homepage_NotBackupWallet_SecondPage_Chinese.xml" "xmls/wallets/homepageNotBackupWalletSecondPageChinese.xml"
mv "xmls/wallets/添加现有钱包.xml" "xmls/wallets/addExistingWallet.xml"
mv "xmls/wallets/importMneOrPrvKey_Mne_Chinese.xml" "xmls/wallets/importMneOrPrvKeyMneChinese.xml"
mv "xmls/wallets/导入观察地址_english.xml" "xmls/wallets/importWatchAddressEnglish.xml"
mv "xmls/wallets/添加现有钱包_english.xml" "xmls/wallets/addExistingWalletEnglish.xml"
mv "xmls/wallets/importMneOrPrvKey_Chinese.xml" "xmls/wallets/importMneOrPrvKeyChinese.xml"

echo "Done."
