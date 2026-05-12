step(
  {
    id: `2.1.1.1.4.4`,
    describe: `点击pin
关闭options
打开 tabs
check pin count
`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      step,
      api: { by, tap, pause },
      exe,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await exe(['2.1.1.1.4.1']);

    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });

    await $(by.id('browser-bar-add')).click();

    await tap($(by.id('search-modal-skytopia')));

    await $(by.id('browser-bar-options')).click();
    await $(by.id('action-list-item-pin')).click();

    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });
    const elements = await $$(by.idsStartWith('tab-list-stack-pinned-'));
    await expect(elements).toBeElementsArrayOfSize(1);
    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('tab-list-modal-done')).click();
      });
  },
);
