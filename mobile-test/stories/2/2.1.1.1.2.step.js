step(
  {
    id: `2.1.1.1.2`,
    describe: `webview nav 
向前，向后 
初始化 check`,
  },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await expect(await api.accessible('browser-bar-go-back')).toBe(false);
    await expect(await api.accessible('browser-bar-go-forward')).toBe(false);
  },
);
