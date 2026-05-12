step(
  { id: '2', describe: '发现页' },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, pause },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await platform
      .ios()
      .android()
      .run(async () => {
        await pause(5000);
      });

    await $(by.id('discovery')).click();
  },
);
