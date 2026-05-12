step(
  { id: `2.1.1.1.4.3.1`, describe: `unbookmark` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await $(by.id('browser-bar-options')).click();
    await $(by.id('action-list-item-remove-bookmark')).click();

    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });

    const elements = await $$(by.idsStartWith('tab-modal-list-item-'));
    await expect(elements).toBeElementsArrayOfSize(2);
  },
);
