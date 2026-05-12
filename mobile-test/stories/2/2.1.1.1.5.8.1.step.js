step(
  { id: `2.1.1.1.5.8.1`, describe: `关闭 option` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    const elem = await $(by.id('popover-btn-close'));
    await elem.click();

    await expect(elem).not.toBeDisplayed();
  },
);
