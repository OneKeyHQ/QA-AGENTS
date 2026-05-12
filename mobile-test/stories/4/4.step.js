step(
  { id: `4`, describe: `钱包相关` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(5000);
  },
);
