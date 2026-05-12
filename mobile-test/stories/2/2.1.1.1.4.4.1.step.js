step(
  { id: `2.1.1.1.4.4.1`, describe: `unpin` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await $(by.id('browser-bar-options')).click();
    await $(by.id('action-list-item-un-pin')).click();
    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });

    const elements = await $$(by.idsStartWith('tab-list-stack-pinned-'));
    await expect(elements).toBeElementsArrayOfSize(0);
    await platform
      .not()
      .electron()
      .run(async () => {
        await $(by.id('tab-list-modal-done')).click();
      });
  },
);
