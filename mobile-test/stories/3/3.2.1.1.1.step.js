step(
  { id: `3.2.1.1.1`, describe: `关闭` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.tap($(api.by.id('nav-header-close')));
  },
);
