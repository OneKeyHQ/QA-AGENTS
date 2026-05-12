step(
  { id: '2.1.1.1', describe: 'dapp 加载完毕' },
  [],
  [],
  async (
    data,
    {
      platform,
      step,
      api: { pause, appMod, waitUntil },
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    await pause(5000);
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
