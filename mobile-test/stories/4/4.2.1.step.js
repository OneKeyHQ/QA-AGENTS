step(
  { id: `4.2.1`, describe: `Import Recovery Phrase` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 380, 442],
    });

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 539, 2126],
    });
  },
);
