step(
  { id: `3.2.1`, describe: `切换语言` },
  [],
  [],
  async (
    data,
    { platform, exe, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(1000);
    await exe(['3.2.2']);
    await api.tap($(api.by.id('setting-preference-language-title-primary')));
  },
);
