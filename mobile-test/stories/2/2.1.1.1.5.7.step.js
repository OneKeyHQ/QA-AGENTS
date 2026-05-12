step(
  {
    id: `2.1.1.1.5.7`,
    describe: `close all 
多 tab时
check tab count = 0`,
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
    //删除
    await $(by.id('tab-list-modal-close-all')).click();

    const elements = await $$(by.idsStartWith('tab-modal-header-close-'));
    await expect(elements).toBeElementsArrayOfSize(0);
  },
);
