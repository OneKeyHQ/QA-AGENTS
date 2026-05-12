step(
  {
    id: `2.1.1.1.2.1.1.1`,
    describe: `点击 后一步
 check url = 2.1.1.1.2.1 url`,
  },
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
    await $(by.id('browser-bar-go-forward')).click();
    await pause(3000);
    await expect(await accessible('browser-bar-go-forward')).toBe(false);
  },
);
