step(
  { id: `2.1.1.1.3`, describe: `点击加号` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await $(by.id('browser-bar-add')).click();
  },
);
