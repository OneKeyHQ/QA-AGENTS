step(
  { id: `3.2.2`, describe: `当前语言` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(1000);
    const currentLangText = await api.getText(
      'setting-preference-language-current-primary',
    );
    console.log('>>>>>>>>>', currentLangText);
    setStore(`3.2.2`, 'currentLangText', currentLangText);
  },
);
