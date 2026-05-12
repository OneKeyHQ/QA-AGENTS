step(
  {
    id: `2.1.1.1.2.1`,
    describe: `点击 内页 a 标签 
记录页面URL`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, attr, appMod, accessible, execute, pause, switchContext },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await switchContext(await appMod.getWebview());

    await platform.android().run(async () => {
      const link = await $('a[href^="https://"]');
      await link.scrollIntoView();
      // await browser.pause(2000);
      await link.click();
    });
    await platform
      .ios()
      .electron()
      .run(async () => {
        await execute((current) => {
          if (current === 'electron') {
            const webView = document.querySelector('webview');
            if (webView) {
              webView.executeJavaScript(
                'window.location.href = "https://www.google.com/";',
              );
            }
          } else {
            window.location.href = 'https://www.google.com/';
          }
        }, platform.current());
      });
    await platform
      .ios()
      .android()
      .run(async () => {
        await execute(() => {
          window.scrollBy(0, -100);
        });
      });

    await pause(3000);
    await switchContext(await appMod.getApp());

    await expect(await accessible('browser-bar-go-back')).toBe(true);
  },
);
