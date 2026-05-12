step(
  { id: '2.1.1', describe: 'dapp下拉选择0' },
  [],
  [],
  async (
    data,
    { platform, step, api, getStore, setStore, reporter, parameter },
  ) => {
    await api.tap($(api.by.id('search-modal-carrier')));
  },
);
