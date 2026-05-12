step(
  { id: '1', describe: '初始化' },
  [],
  [],
  async (data, { platform, step, getStore, setStore, reporter, parameter }) => {
    await browser.takeScreenshot();
    // await platform
    //   .ios()
    //   .android()
    //   .run(async () => {
    //     await browser.pause(5000);
    //   });

    await platform.ios().run(async () => {
      await browser.$('~无线局域网与蜂窝网络').click();
    });
    await platform.web().run(async () => {
      await browser.url(process.env.BASEURL);
      await browser.cdp('Browser', 'setPermission', {
        permission: { name: 'notifications' },
        setting: 'granted', // 或 'denied'
      });
    });
    await platform.ext().run(async () => {
      await browser.setWindowSize(380, 700);
      await browser.pause(3000);
      const handles = await browser.getWindowHandles();
      await browser.switchToWindow(handles[1]);
    });

    await browser.$("[data-testid='welcome_action__create_wallet']").click();
  },
);
