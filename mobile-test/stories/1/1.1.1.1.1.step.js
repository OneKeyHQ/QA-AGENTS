step(
  { id: '1.1.1.1.1', describe: '保存密码' },
  [],
  [],
  async (data, { platform, step, getStore, setStore, reporter, parameter }) => {
    await browser.$("[data-testid='modal_button_primary']").click();
    await platform.ios().run(async () => {
      await browser.$('~允许').click();
    });
  },
);
