step(
  {
    id: `2.1.1.1.1.1.1`,
    describe: `向上滚动 
check toolbar
check 位置 `,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { execute, by, switchContext, appMod, pause },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await execute((current) => {
      if (current === 'electron') {
        const webView = document.querySelector('webview');
        if (webView) {
          webView.executeJavaScript('window.scrollBy(0, -500);'); // 向下滚动500像素
        }
      } else {
        window.scrollBy(0, -500);
      }
    }, platform.current());

    // 等待滚动
    await pause(3000);
    await switchContext(await appMod.getApp());
    await expect($(by.id('browser-bar-add'))).toBeDisplayed();
  },
);
