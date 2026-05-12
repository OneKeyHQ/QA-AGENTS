step(
  {
    id: `2.1.1.1.3.1`,
    describe: `dapp 下拉选择
check list
`,
  },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    const elem = await $(by.id('search-modal-skytopia'));
    await expect(elem).toBeDisplayed();
  },
);
