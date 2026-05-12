step(
  {
    id: `2.1.1.1.5.4`,
    describe: `点击  关闭 单一tab
当 只有一个 tab 时
check tab count =0

`,
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
    await expect(elements).toBeElementsArrayOfSize(0);
  },
);
