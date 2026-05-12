step(
  {
    id: `2.1.1.1.1`,
    describe: `webview 滚动初始 
check `,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { switchContext, appMod },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await switchContext(await appMod.getWebview());
  },
);
