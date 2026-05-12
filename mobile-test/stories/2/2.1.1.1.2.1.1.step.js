step(
  { id: '2.1.1.1.2.1.1', describe: '点击 前一步' },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, pause, accessible },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await $(by.id('browser-bar-go-back')).click();
    await pause(5000);
    await expect(await accessible('browser-bar-go-forward')).toBe(true);
  },
);
