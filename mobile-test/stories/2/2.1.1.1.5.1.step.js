step(
  {
    id: `2.1.1.1.5.1`,
    describe: `点击关闭
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
        await $(by.id('header-button-close')).click();
        await expect($(by.id('header-button-close'))).not.toBeDisplayed();
      });
  },
);
