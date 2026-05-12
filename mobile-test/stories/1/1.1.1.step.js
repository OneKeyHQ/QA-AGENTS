step(
  { id: '1.1.1', describe: '助记词' },
  [],
  [],
  async (data, { platform, step, getStore, setStore, reporter, parameter }) => {
    await browser.$("[data-testid='secondary_show_recovery_phrase']").click();
    platform
      .ios()
      .web()
      .run(async () => {
        await browser.$("[data-testid='mnemonic_card_copy']").click();
      });
    await browser
      .$("[data-testid='phrase_sheet_i_have_saved_the_phrase']")
      .click();
  },
);
