step(
  { id: `4.2`, describe: `Import Wallet` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter }
  ) => {
    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 569, 1911]
    });
  }
);
