step(
  {
    id: `2.1.1.1.5.6`,
    describe: `close all
单一 tab时
 check tab count = 0

`,
  },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    //删除
    await $(by.id('tab-list-modal-close-all')).click();
    const elements = await $$(by.idsStartWith('tab-modal-header-close-'));
    await expect(elements).toBeElementsArrayOfSize(0);
  },
);
