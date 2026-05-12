step(
  {
    id: `2.1.1.1.5.5`,
    describe: `点击关闭 单一 tab

当有多个 tab时

check tab = n-1`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      exe,
      api: { by },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await exe(['2.1.1.1.5.3', '2.1.1.1.5.3.1']);

    await platform
      .ios()
      .android()
      .run(async () => {
        const oldElements = await $$(
          by.idsStartWith('tab-modal-header-close-'),
        );

        oldElements[0].click();
      });

    await platform.electron().run(async () => {
      const oldElements = await $$(by.idsStartWith('tab-modal-list-item-'));
      oldElements[0].click();
      await $(by.id('browser-bar-options')).click();
      await $(by.id('action-list-item-close tab')).click();
    });

    const elements = await $$(by.idsStartWith('tab-modal-list-item-'));
    await expect(elements).toBeElementsArrayOfSize(1);
  },
);
