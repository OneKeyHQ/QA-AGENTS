step(
  { id: '1.1.1.1', describe: '保存密码' },
  [],
  [],
  async (data, { platform, step, getStore, setStore, reporter, parameter }) => {
    await platform
      .ios()
      .android()
      .run(async () => {
        await browser.pause(5000);
      });
    await platform.android().run(async () => {
      await browser
        .$("[data-testid='process_auto_typing_action__lets_go3']")
        .click();
    });
    await platform
      .web()
      .ios()
      .electron()
      .ext()
      .run(async () => {
        await browser
          .$("[data-testid='process_auto_typing_action__lets_go2']")
          .click();
      });
  },
);
