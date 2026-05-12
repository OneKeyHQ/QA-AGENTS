step(
  {
    id: `2.1.1.1.4.3`,
    describe: `bookmark

关闭 options
打开 tabs 
count bookmark


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
    await $(by.id('action-list-item-bookmark')).click();
    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });

    const elements = await $$(by.idsStartWith('tab-modal-list-item-'));
    await expect(elements).toBeElementsArrayOfSize(2);
    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('tab-list-modal-done')).click();
      });
  },
);
