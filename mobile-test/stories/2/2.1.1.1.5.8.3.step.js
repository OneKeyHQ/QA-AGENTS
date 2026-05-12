step(
  {
    id: `2.1.1.1.5.8.3`,
    describe: `pin

`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      step,
      api: { by, tap, longPress },
      exe,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await tap($(by.id('action-list-item-pin')));

    const pinElements = await $$(by.idsStartWith('tab-list-stack-pinned-'));

    await expect(pinElements).toBeElementsArrayOfSize(1);
  },
);
