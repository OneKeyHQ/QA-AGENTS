step(
  { id: `3.2.1.1.2`, describe: `选择语言` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.tap(
      $(
        api.by.id(`settinglanguagemodal-${parameter.lang.value}-title-primary`),
      ),
    );
    await api.tap($(api.by.id(`nav-header-close`)));
  },
);
