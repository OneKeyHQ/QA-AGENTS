step(
  { id: `2.1.1.1.5.8.5`, describe: `close tab` },
  [],
  [],
  async (
    data,
    {
      platform,
      api: { by, tap },
      step,
      getStore,
      setStore,
      reporter,
      parameter,
    },
  ) => {
    const elem = await $(by.id('action-list-item-close tab'));
    tap(elem);
    await expect(elem).not.toBeDisplayed();
  },
);
