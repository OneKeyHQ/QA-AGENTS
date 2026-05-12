step(
  { id: `3`, describe: `设置页面` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(3000);
    await api.tap($(api.by.id('me')));
    await api.tap($(api.by.id('me-settings')));
  },
);
