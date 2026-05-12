step(
  { id: `5`, describe: `打开地址簿页面` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(3000);
    await api.back();
    await api.tap(api.by.id('me'));
    await api.tap(api.by.id('me-address-book'));
  },
);
