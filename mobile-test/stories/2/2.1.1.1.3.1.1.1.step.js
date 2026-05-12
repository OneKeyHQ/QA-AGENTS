step(
  {
    id: `2.1.1.1.3.1.1.1`,
    describe: `webview 加载完毕
check 初始状态`,
  },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { waitUntil, appMod },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await waitUntil(
      async () => {
        const webview = await appMod.getWebview();
        return !!webview;
      },
      {
        timeout: 10000,
        timeoutMsg: '页面加载超时',
      },
    );
  },
);
