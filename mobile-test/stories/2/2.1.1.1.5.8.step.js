step(
  {
    id: `2.1.1.1.5.8`,
    describe: `长按 tab 
打开option`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, longPress },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    const elements = await $$(by.idsStartWith('tab-modal-list-item-'));

    await longPress(elements[0]);
    const elem = await $(by.id('popover-btn-close'));
    await expect(elem).toBeDisplayed();
  },
);
