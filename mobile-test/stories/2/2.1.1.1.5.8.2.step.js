step(
  {
    id: `2.1.1.1.5.8.2`,
    describe: `bookmark
bookmarked
check 状态`,
  },
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
    const elem = await $(by.id('action-list-item-bookmark'));
    await tap(elem);
    await expect(elem).not.toBeDisplayed();
  },
);
