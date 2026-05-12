step(
  { id: `4.1.1`, describe: `Show Recovery Phrase` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter }
  ) => {
    await api.pause(1000);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 555, 2234]
    });
  }
);
