step(
  {
    id: `2.1.1.1.4.2`,
    describe: `reload
关闭 option 
滚动页面 
记录位置
点击 option
点击 reload
 check 位置
`,
  },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, exe, setStore, reporter, parameter },
  ) => {
    await exe(['2.1.1.1.4.1']);

    await api.switchContext(await api.appMod.getWebview());

    await api.execute((current) => {
      if (current === 'electron') {
        const webView = document.querySelector('webview');
        if (webView) {
          webView.executeJavaScript('window.pageReloaded = true;');
        }
      } else {
        window.pageReloaded = true;
      }
    }, platform.current());

    await api.switchContext(await api.appMod.getApp());

    await $(api.by.id('browser-bar-options')).click();
    await $(api.by.id('action-list-item-reload')).click();
    await api.switchContext(await api.appMod.getWebview());

    const wasReloaded = await api.execute((current) => {
      if (current === 'electron') {
        const webView = document.querySelector('webview');
        if (webView) {
          return webView.executeJavaScript('window.pageReloaded;');
        }
      } else {
        return window.pageReloaded;
      }
    }, platform.current());

    // 断言页面已重新加载
    expect(wasReloaded).not.toBeTruthy();
  },
);
