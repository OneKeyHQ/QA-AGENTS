import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

import {
  WEBVIEW_LOAD_TIMEOUT,
  WAITE_FN_COMPLETE_TIMEOUT,
} from '../../const/index.js';

class ExploreBrowserPage extends Page {
  get toolBarGoBackBtn() {
    return api.by.id('browser-bar-go-back');
  }
  get toolBarGoForwardBtn() {
    return api.by.id('browser-bar-go-forward');
  }
  get toolBarAddBtn() {
    return api.by.id('browser-bar-add');
  }
  get toolBarTabsBtn() {
    return api.by.id('browser-bar-tabs');
  }
  get toolBarOptionsBtn() {
    return api.by.id('browser-bar-options');
  }

  get tabContainer() {
    return api.by.id('tab-container');
  }

  get searchInput() {
    return api.by.id('explore-index-search-input');
  }

  get closeAllTabBtn() {
    return api.by.id('tab-list-modal-close-all');
  }

  async getSearchInputText() {
    await api.getText(this.searchInput, true);
  }
  get browserGoBack() {
    return api.by.id('browser-bar-go-back');
  }
  get browserGoForward() {
    return api.by.id('browser-bar-go-forward');
  }

  get browserBookmark() {
    return api.by.id('action-header-item-bookmark');
  }
  get browserPin() {
    return api.by.id('action-header-item-pin');
  }
  get browserReload() {
    return api.by.id('action-header-item-reload');
  }
  get browserRemoveBookmark() {
    return api.by.id('action-header-item-remove-bookmark');
  }

  get browserRemovePin() {
    return api.by.id('action-header-item-un-pin');
  }

  get pinTabDivider() {
    return api.by.id('pin-tab-divider');
  }

  async checkBrowserBookmarkedWithExpect(isBookmarked) {
    const isExisting = await this.browserRemoveBookmark.isExisting();
    expect(isExisting).toBe(isBookmarked);
  }
  async checkBrowserPinedWithExpect(isPined) {
    const isExisting = await this.browserRemovePin.isExisting();
    expect(isExisting).toBe(isPined);

    const isDividerExisting = await this.pinTabDivider.isExisting();
    expect(isDividerExisting).toBe(isPined);
  }
  async clickBrowserRemoveBookmark() {
    await api.tap(this.browserRemoveBookmark);
  }
  async clickBrowserRemovePin() {
    await api.tap(this.browserRemovePin);
  }
  async clickBrowserBookmark() {
    await api.tap(this.browserBookmark);
  }

  async clickBrowserPin() {
    await api.tap(this.browserPin);
  }
  async clickBrowserReload() {
    await api.tap(this.browserReload);
  }

  async clickBrowserGoBack() {
    await api.tap(this.browserGoBack);
    await api.platformChain.electron().run(async () => await api.pause(3000));
  }
  async clickBrowserGoForward() {
    await api.tap(this.browserGoForward);
    await api.platformChain.electron().run(async () => await api.pause(3000));
  }

  async clickSearchInput() {
    await api.tap(this.searchInput);
  }

  async clickCloseAllTabBtn() {
    await api.tap(this.closeAllTabBtn);
    await api.pause(WAITE_FN_COMPLETE_TIMEOUT);
  }

  async clickCloseAllTabElectronBtn() {
    await api.tap(api.by.id('tab-list-modal-close-all'));
    await api.pause(WAITE_FN_COMPLETE_TIMEOUT);
  }

  async longClickPinnedTab() {
    await api.longPress(api.by.idStartWith('tab-list-stack-pinned-'));
  }

  async longClickActiveTab() {
    await api.platformChain
      .ios()
      .android()
      .run(async () => {
        await api.longPress(api.by.idStartWith('tab-modal-active-item-'));
      });

    await api.platformChain
      .not()
      .ios()
      .android()
      .run(async () => {
        await api.tap(api.by.idStartWith('tab-modal-active-item-'));
        await this.clickToolBarOptionsBtn();
      });
  }

  async longClickTab() {
    await api.platformChain
      .ios()
      .android()
      .run(async () => {
        await api.longPress(api.by.idStartWith('tab-modal-list-item-'));
      });
    await api.platformChain
      .not()
      .ios()
      .android()
      .run(async () => {
        await api.tap(api.by.idStartWith('tab-modal-list-item-'));
        await this.clickToolBarOptionsBtn();
      });
  }
  async clickFirstTab() {
    await api.tap(api.by.idStartWith('tab-modal-list-item-'));
  }
  async longClickInactiveTab() {
    await api.longPress(api.by.idStartWith('tab-modal-no-active-item'));
  }
  async clickInactiveTab() {
    await api.tap(api.by.idStartWith('tab-modal-no-active-item'));
  }

  async clickToolBarAddBtn() {
    await api.tap(this.toolBarAddBtn);
  }

  async isToolBarExist() {
    const isExisting = await this.toolBarAddBtn.isExisting();
    return isExisting;
  }

  async clickToolBarTabsBtn() {
    await api.platformChain
      .android()
      .ios()
      .run(async () => {
        await api.tap(this.toolBarTabsBtn);
      });
  }
  async clickToolBarOptionsBtn() {
    await api.tap(this.toolBarOptionsBtn);
  }

  async switchContextToWebView() {
    await api.switchContext(await api.appMod.getWebview());
  }
  async switchContextToAppView() {
    await api.switchContext(await api.appMod.getApp());
  }

  async inWebviewScrollDown() {
    await webviewYScroll(-350);
  }

  async inWebviewScrollUp() {
    await webviewYScroll(350);
  }
  async scrollDown() {
    await api.scrollY(-350);
  }

  async scrollUp() {
    await api.scrollY(350);
  }

  async inWebviewCheckFresh(action) {
    await api.execute(
      (current, electron) => {
        if (current === electron) {
          const webView = document.querySelector('webview');
          if (webView) {
            webView.executeJavaScript('window.pageReloaded = true;');
          }
        } else {
          window.pageReloaded = true;
        }
      },
      api.platformChain.current(),
      api.platformChain.enum.electron,
    );
    await action();
    // check
    const wasReloaded = await api.execute(
      (current, electron) => {
        if (current === electron) {
          const webView = document.querySelector('webview');
          if (webView) {
            return webView.executeJavaScript('window.pageReloaded;');
          }
        } else {
          return window.pageReloaded;
        }
      },
      api.platformChain.current(),
      api.platformChain.enum.electron,
    );
    // 断言页面已重新加载
    expect(wasReloaded).not.toBeTruthy();
  }
  async checkToolBarExistsStatusWithExpect(status = true) {
    const isExists = await this.toolBarAddBtn.isExisting();
    expect(isExists).toBe(status);
  }
  async checkPinTabCountWithExpect(expectCount) {
    const arr = await api.by.idsStartWith('tab-list-stack-pinned-');
    expect(arr.length).toBe(expectCount);
  }
  async checkActiveTabExists() {
    await api.by.idStartWith('tab-modal-active-item-').isExisting();
  }
  async checkTabsCountWithExpect(count) {
    const tabs = await api.by.idsStartWith('tab-modal-list-item-');

    expect(tabs.length).toBe(count);
  }

  async waitForWebviewLoad() {
    try {
      await browser.waitUntil(
        async () => {
          const isLoaded = await browser.execute(() => {
            const webview = document.querySelector('webview');
            // 用于存储加载状态的变量
            return new Promise(resolve => {
              if (webview.isLoading() === false) {
                resolve(true);
              } else {
                // 设置一个超时，避免无限等待
                setTimeout(() => {
                  resolve(false);
                }, 1000); // 根据需要调整超时时间
              }
            });
          });
          return isLoaded;
        },
        {
          timeout: 10000, // 设置超时时间，根据需要调整
          timeoutMsg: 'webview加载超时',
        },
      );
    } catch (error) {}
  }
  async clickInWebViewNav() {
    await api.pause(6000);

    await api.execute(
      async (current, electron) => {
        if (current === electron) {
          const webView = document.querySelector('webview');
          if (webView) {
            await webView.executeJavaScript(
              `const links = document.querySelectorAll('a:not([target]):not([href^="https://"])');
              for (let el of links) {
                let href = new URL(el.getAttribute('href'), window.location.href).pathname;
                if (href !== window.location.pathname) {
                  el.click(); // 如果不等，则点击该<a>标签
                  break; // 点击后退出循环
                }
              }`,
            );
          }
        } else {
          document
            .querySelectorAll('a:not([target]):not([href^="https://"])')
            .forEach(el => {
              // 获取<a>标签的href属性，并转换为绝对URL
              let href = new URL(el.getAttribute('href'), window.location.href)
                .pathname;

              // 检查href属性值是否不等于当前页面的路径
              if (href !== window.location.pathname) {
                el.click(); // 如果不等，则点击该<a>标签
              }
            });
        }
      },
      api.platformChain.current(),
      api.platformChain.enum.electron,
    );
    await api.pause(6000);
  }
  async checkNavDisableStatusWithExpect(goForward, goBack) {
    await api.platformChain.electron().run(async () => {
      const forwardDisabled = await api.attr.value(
        await api.by.id('browser-bar-go-forward'),
        'aria-disabled',
      );
      const backDisabled = await api.attr.value(
        await api.by.id('browser-bar-go-back'),
        'aria-disabled',
      );
      expect(forwardDisabled || false.toString()).toBe(goForward.toString());
      expect(backDisabled || false.toString()).toBe(goBack.toString());
    });
  }

  async waitForWebViewLoad() {
    await api.waitUntil(
      async () => {
        const webview = await api.appMod.getWebview();
        return !!webview;
      },
      {
        timeout: WEBVIEW_LOAD_TIMEOUT,
        timeoutMsg: '页面加载超时',
      },
    );
  }

  async waitTabContainerLoad() {
    await api.waitPageByElement(this.tabContainer);
  }

  async waitForPageLoadComplete() {
    // await api.waitUntil(
    //   async () => {
    //     const readyState = await api.execute(() => {
    //       return document.readyState;
    //     });
    //     console.log('>>>>>>>>>>>>>> readyState', readyState);
    //     return readyState === 'complete';
    //   },
    //   {
    //     timeout: WEBPAGE_LOAD_COMPLETE_TIMEOUT, // 最长等待时间，例如10秒
    //     timeoutMsg: 'Page did not load completely within 10 seconds',
    //   },
    // );
  }
}

const webviewYScroll = async y => {
  await api.platformChain.electron().run(async () => {
    await api.execute(posY => {
      const webView = document.querySelector('webview');
      if (webView) {
        webView.executeJavaScript('window.scrollBy(0, ' + posY + ');');
      }
    }, y);
  });

  await api.platformChain
    .not()
    .electron()
    .run(async () => {
      await api.execute(posY => {
        window.scrollBy(0, posY);
      }, y);
    });
};

export const exploreBrowserPage = new ExploreBrowserPage();
