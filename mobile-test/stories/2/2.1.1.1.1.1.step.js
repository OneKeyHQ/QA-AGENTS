step(
  {
    id: `2.1.1.1.1.1`,
    describe: `向下滚动 
check toolbar
check 位置`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { switchContext, pause, execute, by, appMod },
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
          webView.executeJavaScript('window.scrollBy(0, 500);'); // 向下滚动500像素
        }
      } else {
        window.scrollBy(0, 500);
      }
    }, platform.current());

    // 等待一段时间以确保滚动完成
    await pause(1000);
    await switchContext(await appMod.getApp());

    await platform
      .not()
      .electron()
      .run(async () => {
        await expect($(by.id('browser-bar-add'))).not.toBeDisplayed();
      });
    await switchContext(await appMod.getWebview());
  },
);
