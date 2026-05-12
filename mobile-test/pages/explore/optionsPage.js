import { api } from '@node-e2e/cli/api/index.js';
import Popover from '../modal/popover.js';

import {
  WEBVIEW_LOAD_TIMEOUT,
  WEBPAGE_LOAD_COMPLETE_TIMEOUT,
} from '../../const/index.js';

class ExploreOptionPage extends Popover {
  get reloadBtn() {
    return api.by.id('action-list-item-reload');
  }
  get bookmarkBtn() {
    return api.by.id('action-list-item-bookmark');
  }

  get pinBtn() {
    return api.by.id('action-list-item-pin');
  }

  get shareBtn() {
    return api.by.id('action-list-item-share');
  }

  get openBtn() {
    return api.by.id('action-list-item-open-in-browser');
  }
  get backToHomeBtn() {
    return api.by.id('action-list-item-back-to-home');
  }

  get removeBookmarkBtn() {
    return api.by.id('action-list-item-remove-bookmark');
  }

  get removePinBtn() {
    return api.by.id('action-list-item-un-pin');
  }
  get closeTabBtn() {
    return api.by.id('action-list-item-close-close-tab');
  }
  get closePinTabBtn() {
    return api.by.id('action-list-item-close-close-pin-tab');
  }
  async clickClosePinTabBtn() {
    await api.tap(this.closePinTabBtn);
  }

  async clickCloseTabBtn() {
    await api.tap(this.closeTabBtn);
  }

  async clickReloadBtn() {
    await api.tap(this.reloadBtn);
  }
  async clickBookmarkBtn() {
    await api.tap(this.bookmarkBtn);
  }
  async clickPinBtn() {
    await api.tap(this.pinBtn);
  }

  async clickShareBtn() {
    await api.tap(this.shareBtn);
  }

  async clickOpenBtn() {
    await api.tap(this.openBtn);
  }
  async clickBackToHomeBtn() {
    await api.tap(this.backToHomeBtn);
  }

  async clickRemoveBookmarkBtn() {
    await api.tap(this.removeBookmarkBtn);
  }
  async clickRemovePinBtn() {
    await api.tap(this.removePinBtn);
  }
  async checkCloseTabWithExpect(expectCount) {
    const arr = await api.by.idsStartWith('tab-modal-list-item-');
    expect(arr.length).toBe(expectCount);
  }

  async checkBookmarkedWithExpect(status = true) {
    const isExisting = await this.removeBookmarkBtn.isExisting();
    expect(isExisting).toBe(status);
  }

  async checkPinedWithExpect(status = true) {
    const isExisting = await this.removePinBtn.isExisting();
    expect(isExisting).toBe(status);
    // const arr = await api.by.idsStartWith('tab-list-stack-pinned-');
    // expect(arr.length).toBe(status ? 1 : 0);
  }

  async closeShareMenu() {
    await api.platformChain.ios().run(async () => {
      await api.tap(api.by.xpath(`//XCUIElementTypeButton[@name="Close"]`));
    });
    await api.platformChain.android().run(async () => {
      await api.back();
    });
  }

  async checkShareOpenWithExpect() {
    let element;
    await api.platformChain.ios().run(async () => {
      element = await api.by.id('copy');
    });
    await api.platformChain.android().run(async () => {
      element = await api.by.id('android:id/chooser_copy_button');
    });
    await expect(element).toBeDisplayed();
  }

  async checkOpenBrowserWithExpect() {
    // let element;
    // await api.platformChain.ios().run(async () => {
    //   element = await api.by.id('copy');
    // });
    // await api.platformChain.android().run(async () => {
    //   element = await api.by.id('com.android.browser:id/nav_bar');
    // });
    // await expect(element).toBeDisplayed();
  }
}

export const exploreOptionPage = new ExploreOptionPage();
