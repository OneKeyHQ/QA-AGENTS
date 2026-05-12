step(
  { id: `5`, describe: `Encrypted Storage 弹窗` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.tap(api.by.id('password'));
    await api.tap(api.keys(data.lock.password));
    await api.tap(api.by.id('confirm-password'));
    await api.tap(api.keys(data.lock.password));
    await api.tap(api.by.id('set-password'));
    
  },
);
