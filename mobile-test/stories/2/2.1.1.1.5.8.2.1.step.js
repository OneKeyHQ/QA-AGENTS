step(
  {
    id: `2.1.1.1.5.8.2.1`,
    describe: `unbookmark
check 状态`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      exe,
      api: { by, tap },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await exe(['2.1.1.1.5.8']);
    await tap($(by.id('action-list-item-remove-bookmark')));
  },
);
