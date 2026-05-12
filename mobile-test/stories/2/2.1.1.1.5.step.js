step(
  {
    id: `2.1.1.1.5`,
    describe: `点击 tab

check count =1  `,
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
    await platform
      .ios()
      .android()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });

    const elements = await $$(by.idsStartWith('tab-modal-list-item-'));

    await expect(elements).toBeElementsArrayOfSize(1);
  },
);
