step(
  { id: '2.1', describe: '点击 modal' },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await $(by.id('fake-search-modal')).click();
  },
);
