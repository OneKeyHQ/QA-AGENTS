step(
  { id: `2.1.1.1.5.3`, describe: `点击 +` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    const elem = await $(by.id('browser-bar-add'));
    await elem.click();
    await expect(elem).not.toBeDisplayed();
  },
);
