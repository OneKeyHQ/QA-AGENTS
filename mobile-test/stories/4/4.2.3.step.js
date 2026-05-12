step(
  { id: `4.2.3`, describe: `Import Address` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter }
  ) => {
    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 340, 1339]
    });
  }
);
