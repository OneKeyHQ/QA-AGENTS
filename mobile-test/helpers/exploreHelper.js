import { api } from '@node-e2e/cli';

import { lockPassword } from '../dataset/index.js';

import {
  exploreIndexPage,
  exploreBrowserPage,
  exploreOptionPage,
} from '../pages/index.js';
import util from '../util/index.js';
export const ExploreDynamicEntryType = {
  TOOLBAR: 'TOOLBAR',
  INDEX_SEARCH: 'INDEX_SEARCH',
  AUTO: 'AUTO',
};

class ExploreHelperClass {
  static async createTab(searchTerm, entry = ExploreDynamicEntryType.AUTO) {
    if (entry === ExploreDynamicEntryType.AUTO) {
      const isExist = await exploreBrowserPage.isToolBarExist();
      if (isExist) {
        await exploreBrowserPage.clickToolBarAddBtn();
      } else {
        await exploreIndexPage.clickSearchBtn();
      }
    } else if (entry === ExploreDynamicEntryType.TOOLBAR) {
      await exploreBrowserPage.clickToolBarAddBtn();
    } else {
      await exploreIndexPage.clickSearchBtn();
    }

    await exploreIndexPage.search(searchTerm);
    await exploreIndexPage.waitForSearchResult();
    // 首页搜索打开新标签页
    await exploreIndexPage.hideKeyboard();
    await exploreIndexPage.clickSearchResultByIndex(1);
    await exploreBrowserPage.waitForWebViewLoad();
    await exploreBrowserPage.checkToolBarExistsStatusWithExpect();
  }

  static async longPressTabCheckFnWithExpect(isActive, finalTabCount) {
    const tabClickHandle = isActive
      ? exploreBrowserPage.longClickActiveTab
      : exploreBrowserPage.longClickInactiveTab;

    await tabClickHandle();
    await exploreOptionPage.clickBookmarkBtn();
    await tabClickHandle();
    await exploreOptionPage.checkBookmarkedWithExpect();
    await exploreOptionPage.clickRemoveBookmarkBtn();
    await tabClickHandle();
    await exploreOptionPage.checkBookmarkedWithExpect(false);
    await exploreOptionPage.clickClose();
    await tabClickHandle();
    await exploreOptionPage.clickPinBtn();
    await exploreBrowserPage.longClickPinnedTab();
    await exploreOptionPage.clickRemovePinBtn();
    await tabClickHandle();
    await exploreOptionPage.clickShareBtn();
    await exploreOptionPage.checkShareOpenWithExpect();
    await exploreOptionPage.closeShareMenu();
    await tabClickHandle();
    await exploreOptionPage.clickCloseTabBtn();
    await exploreBrowserPage.checkTabsCountWithExpect(finalTabCount);
  }

  static async longPressPinCheckFnWithExpect(isActive, finalTabCount) {
    const tabClickHandle = isActive
      ? exploreBrowserPage.longClickActiveTab
      : exploreBrowserPage.longClickInactiveTab;

    await tabClickHandle();
    await exploreOptionPage.clickBookmarkBtn();
    await tabClickHandle();
    await exploreOptionPage.checkBookmarkedWithExpect();
    await exploreOptionPage.clickRemoveBookmarkBtn();
    await tabClickHandle();
    await exploreOptionPage.checkBookmarkedWithExpect(false);
    await exploreOptionPage.close();
    await tabClickHandle();
    await exploreOptionPage.clickPinBtn();

    // await tabClickHandle();
    // await exploreOptionPage.checkPinedWithExpect();
    // await exploreOptionPage.clickRemovePinBtn();
    // await tabClickHandle();
    // await exploreOptionPage.checkPinedWithExpect(false);
    await tabClickHandle();
    await exploreOptionPage.clickShareBtn();
    await exploreOptionPage.checkShareOpenWithExpect();
    await exploreOptionPage.closeShareMenu();
    await tabClickHandle();
    await exploreOptionPage.clickCloseTabBtn();
    await exploreBrowserPage.checkPinTabCountWithExpect(finalTabCount);
  }
}

export const ExploreHelper = ExploreHelperClass;
