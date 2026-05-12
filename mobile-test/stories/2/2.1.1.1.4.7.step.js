step(
  { id: `2.1.1.1.4.7`, describe: `back to home` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    const element = await browser
      .$(by.id('action-list-item-back-to-home'))
      .click();

    await expect(element).not.toBeDisplayed();
  },
);
