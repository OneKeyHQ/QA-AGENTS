step(
  { id: `2.1.1.1.4.5`, describe: `share ` },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await $(by.id('action-list-item-share')).click();
    let element;
    await platform.ios().run(async () => {
      element = await $(by.id('copy'));
    });
    await platform.android().run(async () => {
      element = await $(by.id('android:id/chooser_copy_button'));
    });
    await expect(element).toBeDisplayed();
  },
);
