step(
  { id: `4.1.1.1`, describe: `I've Saved the Phrase` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 325, 500],
    });

    const ocrText1 = await browser.ocr('eng+chi_sim', {
      left: 192,
      top: 450,
      height: 100,
      width: 266,
    });
    setStore('ocr', ocrText1.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText1.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 824, 499],
    });

    const ocrText3 = await browser.ocr('eng+chi_sim', {
      left: 698,
      top: 454,
      height: 90,
      width: 252,
    });
    setStore('ocr', ocrText3.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText3.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 329, 653],
    });

    const ocrText5 = await browser.ocr('eng+chi_sim', {
      left: 192,
      top: 610,
      height: 86,
      width: 274,
    });
    setStore('ocr', ocrText5.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText5.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 836, 650],
    });

    const ocrText7 = await browser.ocr('eng+chi_sim', {
      left: 690,
      top: 604,
      height: 92,
      width: 292,
    });
    setStore('ocr', ocrText7.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText7.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 326, 802],
    });

    const ocrText9 = await browser.ocr('eng+chi_sim', {
      left: 190,
      top: 750,
      height: 104,
      width: 272,
    });
    setStore('ocr', ocrText9.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText9.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 823, 793],
    });

    const ocrText11 = await browser.ocr('eng+chi_sim', {
      left: 688,
      top: 740,
      height: 106,
      width: 270,
    });
    setStore('ocr', ocrText11.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText11.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 325, 946],
    });

    const ocrText13 = await browser.ocr('eng+chi_sim', {
      left: 180,
      top: 888,
      height: 116,
      width: 290,
    });
    setStore('ocr', ocrText13.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText13.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 830, 950],
    });

    const ocrText15 = await browser.ocr('+chi_sim', {
      left: 696,
      top: 900,
      height: 88,
      width: 240,
    });
    setStore('ocr', ocrText15.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText15.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 336, 1092],
    });

    const ocrText17 = await browser.ocr('eng+chi_sim', {
      left: 184,
      top: 1044,
      height: 96,
      width: 304,
    });
    setStore('ocr', ocrText17.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText17.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 826, 1085],
    });

    const ocrText19 = await browser.ocr('eng+chi_sim', {
      left: 682,
      top: 1032,
      height: 106,
      width: 288,
    });
    setStore('ocr', ocrText19.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText19.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 335, 1238],
    });

    const ocrText21 = await browser.ocr('eng+chi_sim', {
      left: 182,
      top: 1186,
      height: 104,
      width: 306,
    });
    setStore('ocr', ocrText21.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText21.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 820, 1233],
    });

    const ocrText23 = await browser.ocr('eng+chi_sim', {
      left: 686,
      top: 1184,
      height: 98,
      width: 268,
    });
    setStore('ocr', ocrText23.trim());
    setStore('4.1.1.1', 'ocr', [
      ...getStore('4.1.1.1', 'ocr', []),
      ocrText23.trim(),
    ]);

    await api.pause(1000);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 543, 2239],
    });
  },
);
