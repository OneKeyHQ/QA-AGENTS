/**
 * 导入助记词用例：每次执行只导入 1 套助记词。
 * 跑满 5 套需执行 5 次，通过环境变量 PHRASE_SET_INDEX 指定当次使用的套别（0~4 对应 12/15/18/21/24 词，默认 0）。
 * 示例：PHRASE_SET_INDEX=0 yarn test:android --test-case ./test/onboarding/importMnemonic.e2e.js
 */
import { api } from '@node-e2e/cli/api/index.js';

import { pages } from '../../config/setup.js';
import {
  languageSelectPopup,
  setPasswordPopup,
  confirmPasswordPopup,
  copyAddressChoosePathPopup,
} from '../../popup/index.js';
import CopyAddressPage from '../../pages/homepage/copyAddressPage.js';
import { importMnemonicPage } from '../../pages/onboarding/importMnemonicPage.js';
import bip39Dataset from '../../dataset/bip39_mnemonic.js';

const {
  homePage,
  onboardingPage,
  addWalletPage,
  addExistingWalletPage,
} = pages;

const copyAddressPage = new CopyAddressPage();

/** 五套助记词配置：取 phrase 字段，并解析为词数。每次执行用例只导入其中 1 套，由 PHRASE_SET_INDEX 指定（0~4，默认 0） */
const PHRASE_SETS = [
  { name: '12 words', key: 'phrase_12_words', wordCount: 12 },
  { name: '15 words', key: 'phrase_15_words', wordCount: 15 },
  { name: '18 words', key: 'phrase_18_words', wordCount: 18 },
  { name: '21 words', key: 'phrase_21_words', wordCount: 21 },
  { name: '24 words', key: 'phrase_24_words', wordCount: 24 },
].map(({ name, key, wordCount }) => {
  const list = bip39Dataset[key];
  const first = list && list[0];
  const phrase = first ? first.phrase : '';
  const words = phrase ? phrase.trim().split(/\s+/) : [];
  return { name, key, wordCount, phrase, words };
}).filter(({ words }) => words.length > 0);

const PHRASE_SET_INDEX = Math.min(
  Math.max(0, parseInt(process.env.PHRASE_SET_INDEX ?? '0', 10)),
  PHRASE_SETS.length - 1,
);
const CURRENT_PHRASE_SET = PHRASE_SETS[PHRASE_SET_INDEX];

/** 弹层内点击确认/下一步按钮（SetPassword / ConfirmPassword 通用） */
async function tapPopupConfirmButton() {
  const btn = api.by.xpath(
    '//android.widget.Button[@text="确认" or @text="下一步" or contains(@text,"Confirm") or contains(@text,"Next") or @content-desc="确认" or contains(@content-desc,"Confirm")]',
  );
  await api.tap(btn);
}

/**
 * 读取搜索结果副标题文本（带等待与重试，规避列表异步渲染导致的偶发找不到元素）
 */
async function readSearchResultSubtitleTextWithRetry(index, attempts = 5) {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const subtitleEl = copyAddressPage.getNthSearchResultSubtitleElement(index);
      const resolvedEl = await subtitleEl;
      await resolvedEl.waitForExist({ timeout: 2500 });
      const text = await api.getText(resolvedEl, false);
      if (text) return text;
    } catch (error) {
      lastError = error;
    }
    await api.pause(700);
  }
  if (lastError) throw lastError;
  throw new Error(`Failed to read subtitle text at index=${index}`);
}

describe('Import Mnemonic', () => {
  before(async () => {
    await api.waitUntilAppInit();
  });

  it(`Import mnemonic: ${CURRENT_PHRASE_SET.name} (set ${PHRASE_SET_INDEX + 1}/5) -> set password -> home -> network select`, async () => {
    const { name, wordCount, words } = CURRENT_PHRASE_SET;

    // 1. 前置步骤（与 addWatchAddress.e2e.js 42-52 一致）：首次启动在 onboarding
    await onboardingPage.waitEntryPage();
    await onboardingPage.clickTopRightButton();
    await languageSelectPopup.waitForPopup();
    await languageSelectPopup.selectSimplifiedChinese();
    await onboardingPage.waitEntryPage();
    await onboardingPage.clickMoreOptionsBtn();

    await addWalletPage.waitEntryPage();
    await addWalletPage.clickAddExistingWalletCard();

    // 2. 在 addExistingWallet 页点击「导入助记词或私钥」进入 importMnemonic
    await addExistingWalletPage.waitEntryPage();
    await addExistingWalletPage.clickImportMnemonicOrPrivateKeyCard();

    await importMnemonicPage.waitEntryPage();

    // 3. 若词数 > 12，先选择助记词长度
    if (wordCount > 12) {
      await importMnemonicPage.selectPhraseLengthByWordCount(wordCount);
    }

    // 4. 点击第一个输入框并填入助记词
    await importMnemonicPage.clickPhraseInputFirst();
    await importMnemonicPage.fillMnemonicPhrases(words);
    await importMnemonicPage.clickConfirmButton();

    // 5. 首次启动（无任何数据）时才会出现 SetPassword / ConfirmPassword
    try {
      await setPasswordPopup.waitForPopup();
      await setPasswordPopup.inputPassword('111111');
      await confirmPasswordPopup.waitForPopup();
      await confirmPasswordPopup.inputConfirmPassword('111111');
      await confirmPasswordPopup.setBiometricSwitch(false);

    } catch {
      // 非首次启动则无设置密码弹层，直接等 Home
    }

    // 6. 先等 12 秒再检查首页元素（约 20 秒内跳转到 Home）
    await api.pause(12000);
    await homePage.waitEntryPage(25000);

    // 7. 在 Home 点击复制地址，跳转到复制地址页面
    await homePage.clickCopyAddressBtn();
    await copyAddressPage.waitEntryPage();

    // 8. 基于 bip39 当前套的 *_index_0 键值对，搜索网络并校验地址前 8 / 后 6 位，结果写入报告
    const data = bip39Dataset[CURRENT_PHRASE_SET.key][0];
    const index0Keys = Object.keys(data).filter(
      (k) => k.endsWith('_index_0') && data[k],
    );
    const SEARCH_RESULT_START_INDEX = {
      conflux: 1,
      filecoin: 1,
    };
    const prefixCount = {};
    const entries = [];
    for (const key of index0Keys) {
      const prefix = key.split('_')[0];
      const offset = prefixCount[prefix] ?? 0;
      const startIndex = SEARCH_RESULT_START_INDEX[prefix] ?? 0;
      const resultIndex = startIndex + offset;
      prefixCount[prefix] = offset + 1;
      entries.push({
        key,
        searchTerm: prefix,
        resultIndex,
        expected: data[key],
      });
    }
    const byTerm = {};
    for (const e of entries) {
      (byTerm[e.searchTerm] = byTerm[e.searchTerm] || []).push(e);
    }

    /** BTC 地址类型在「选择地址类型」弹层中的展示名 */
    const BTC_KEY_TO_PATH_TYPE = {
      taproot: 'Taproot',
      nested_segwit: 'Nested SegWit',
      native_segwit: 'Native SegWit',
      legacy: 'Legacy',
    };

    /** LTC 地址类型在「选择地址类型」弹层中的展示名 */
    const LTC_KEY_TO_PATH_TYPE = {
      nested_segwit: 'Nested SegWit',
      native_segwit: 'Native SegWit',
      legacy: 'Legacy',
    };

    for (const [searchTerm, group] of Object.entries(byTerm)) {
      await copyAddressPage.clearSearchInput();
      await copyAddressPage.inputSearchText(searchTerm);

      if (searchTerm === 'btc') {
        await copyAddressPage.clickBtcTaprootTypeLabel();
        await copyAddressChoosePathPopup.waitForPopup();
        for (const { key, expected } of group) {
          const typePart = key.replace(/^btc_/, '').replace(/_address_index_\d+$/, '');
          const pathType = BTC_KEY_TO_PATH_TYPE[typePart];
          if (!pathType) continue;
          const subtitleEl = copyAddressChoosePathPopup.getSubtitleElementByPathType(pathType);
          const actualText = await api.getText(subtitleEl, false);
          const expectedFirst8 = expected.slice(0, 8);
          const expectedLast6 = expected.slice(-6);
          const actualFirst8 = actualText ? actualText.slice(0, 8) : '';
          const actualLast6 = actualText ? actualText.slice(-6) : '';
          const match =
            actualFirst8 === expectedFirst8 && actualLast6 === expectedLast6;
          const checkMsg =
            `[${key}] 前8后6${match ? '一致' : '不一致'}: expected ...${expectedFirst8}...${expectedLast6}, actual ...${actualFirst8}...${actualLast6}`;
          api.reporter.addStep(checkMsg);
          console.log(checkMsg);
        }
        await copyAddressChoosePathPopup.clickCloseBtn();
        continue;
      }

      if (searchTerm === 'ltc') {
        await api.tap(copyAddressPage.getNthSearchResultSubtitleElement(0));
        await api.pause(2000);
        await copyAddressPage.clickLtcNestedSegWitTypeLabel();
        await copyAddressChoosePathPopup.waitForPopup();
        await copyAddressChoosePathPopup.selectPathType('Native SegWit');
        await api.pause(2000);
        await copyAddressChoosePathPopup.selectPathType('Legacy');
        await api.pause(2000);
        for (const { key, expected } of group) {
          const typePart = key.replace(/^ltc_/, '').replace(/_address_index_\d+$/, '');
          const pathType = LTC_KEY_TO_PATH_TYPE[typePart];
          if (!pathType) continue;
          const subtitleEl = copyAddressChoosePathPopup.getSubtitleElementByPathType(pathType);
          const actualText = await api.getText(subtitleEl, false);
          const expectedFirst8 = expected.slice(0, 8);
          const expectedLast6 = expected.slice(-6);
          const actualFirst8 = actualText ? actualText.slice(0, 8) : '';
          const actualLast6 = actualText ? actualText.slice(-6) : '';
          const match =
            actualFirst8 === expectedFirst8 && actualLast6 === expectedLast6;
          const checkMsg =
            `[${key}] 前8后6${match ? '一致' : '不一致'}: expected ...${expectedFirst8}...${expectedLast6}, actual ...${actualFirst8}...${actualLast6}`;
          api.reporter.addStep(checkMsg);
          console.log(checkMsg);
        }
        await copyAddressChoosePathPopup.clickCloseBtn();
        continue;
      }

      for (const { key, resultIndex, expected } of group) {
        let actualText = await readSearchResultSubtitleTextWithRetry(resultIndex);
        if (actualText === '创建地址') {
          await api.tap(copyAddressPage.getNthSearchResultRow(resultIndex));
          const waitMs = key === 'cardano_address_index_0' ? 10000 : 3000;
          await api.pause(waitMs);
          actualText = await readSearchResultSubtitleTextWithRetry(resultIndex);
        }
        const expectedFirst8 = expected.slice(0, 8);
        const expectedLast6 = expected.slice(-6);
        const actualFirst8 = actualText ? actualText.slice(0, 8) : '';
        const actualLast6 = actualText ? actualText.slice(-6) : '';
        const match =
          actualFirst8 === expectedFirst8 && actualLast6 === expectedLast6;
        const checkMsg =
          `[${key}] 前8后6${match ? '一致' : '不一致'}: expected ...${expectedFirst8}...${expectedLast6}, actual ...${actualFirst8}...${actualLast6}`;
        api.reporter.addStep(checkMsg);
        console.log(checkMsg);
      }
    }
  });
});
