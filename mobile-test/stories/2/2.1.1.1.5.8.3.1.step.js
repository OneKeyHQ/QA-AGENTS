step(
  { id: `2.1.1.1.5.8.3.1`, describe: `unpin` },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, tap, longPress },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    const pinElements = await $$(by.idsStartWith('tab-list-stack-pinned-'));

    await longPress(pinElements[0]);

    await tap($(by.id('action-list-item-un-pin')));

    await expect(pinElements).toBeElementsArrayOfSize(0);
  },
);
