step(
  { id: `5`, describe: `Encrypted Storage 弹窗` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(100);
    await api.tap(api.by.id('encrypted-storage-confirm'));

    await api.tap($(api.by.id('me-address-book')));
  },
);
