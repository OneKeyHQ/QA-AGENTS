step(
  {
    id: `2.1.1.1.3.1.1`,
    describe: `dapp 下拉点击
第 [x]`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      step,
      api: { by, tap },
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await tap($(by.id('search-modal-skytopia')));
  },
);
