step(
  {
    id: `4.1`,
    describe: `click Create Wallet
`
  },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter }
  ) => {
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 410, 1688]
    });
  }
);
