step(
  { id: '1.1', describe: '输入密码' },
  ['account'],
  [],
  async (data, { platform, step, getStore, setStore, reporter, parameter }) => {
    await browser.$("[data-testid='setup_password']").click();
    await browser
      .$("[data-testid='setup_password']")
      .setValue(data.account.password);
    await browser.$("[data-testid='setup_confirm_password']").click();
    await browser
      .$("[data-testid='setup_confirm_password']")
      .setValue(data.account.password);
    platform
      .ios()
      .android()
      .run(async () => {
        // app 需要点两次
        await browser.$("[data-testid='setup_continue']").click();
      });
    await browser.$("[data-testid='setup_continue']").click();
  },
);
