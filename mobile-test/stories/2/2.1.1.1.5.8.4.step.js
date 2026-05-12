step(
  {
    id: `2.1.1.1.5.8.4`,
    describe: `share
`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, tap },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await tap($(by.id('action-list-item-share')));
    let element;
    await platform.ios().run(async () => {
      element = await $(by.id('copy'));
    });
    await platform.android().run(async () => {
      element = await $(by.id('android:id/chooser_copy_button'));
    });
    await expect(element).toBeDisplayed();
  },
);
