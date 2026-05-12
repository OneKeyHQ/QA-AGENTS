step(
  { id: `2.1.1.1.4.6`, describe: `open in brower` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await $(by.id('action-list-item-open-in-browser')).click();
    let element;
    await platform.ios().run(async () => {
      element = await $(by.id('TabBarItemTitle'));
    });

    await platform.android().run(async () => {
      element = await $(by.id('com.android.chrome:id/toolbar'));
    });

    await expect(element).toBeDisplayed();
  },
);
