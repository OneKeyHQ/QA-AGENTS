step(
  {
    id: `2.1.1.1.3.1.1.1.1`,
    describe: `点击 toolbar tab管理 
check tab 数量 = 2`,
  },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await platform
      .ios()
      .android()
      .run(async () => {
        await $(by.id('browser-bar-tabs')).click();
      });
    const elements = await $$(by.idsStartWith('tab-modal-list-item-'));
    await expect(elements).toBeElementsArrayOfSize(2);
  },
);
