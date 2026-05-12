step(
  {
    id: `2.1.1.1.4`,
    describe: `option 初始
check
`,
  },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    const elem = await $(by.id('browser-bar-options'));
    await expect(elem).toBeDisplayed();
    await $(by.id('browser-bar-options')).click();
  },
);
