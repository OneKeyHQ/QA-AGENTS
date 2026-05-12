step(
  {
    id: `2.1.1.1.5.2`,
    describe: `点击 done
check 关闭

`,
  },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await platform
      .not()
      .electron()
      .run(async () => {
        const elem = await $(by.id('tab-list-modal-done'));
        await elem.click();
        await expect(elem).not.toBeDisplayed();
      });
  },
);
