step(
  { id: `4.2.1.1`, describe: `12 words` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter },
  ) => {
    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 331, 404],
    });

    await api.pause(300);
    const dataValue1 = api._.get(data, 'phrases.p12[0]');
    await browser.keys(dataValue1);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 828, 402],
    });

    await api.pause(300);
    const dataValue4 = api._.get(data, 'phrases.p12[1]');
    await browser.keys(dataValue4);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 340, 554],
    });

    await api.pause(300);
    const dataValue7 = api._.get(data, 'phrases.p12[2]');
    await browser.keys(dataValue7);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 839, 555],
    });

    await api.pause(300);
    const dataValue10 = api._.get(data, 'phrases.p12[3]');
    await browser.keys(dataValue10);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 344, 703],
    });

    await api.pause(300);
    const dataValue13 = api._.get(data, 'phrases.p12[4]');
    await browser.keys(dataValue13);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 838, 701],
    });

    await api.pause(300);
    const dataValue16 = api._.get(data, 'phrases.p12[5]');
    await browser.keys(dataValue16);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 324, 848],
    });

    await api.pause(300);
    const dataValue19 = api._.get(data, 'phrases.p12[6]');
    await browser.keys(dataValue19);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 820, 840],
    });

    await api.pause(300);
    const dataValue22 = api._.get(data, 'phrases.p12[7]');
    await browser.keys(dataValue22);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 318, 902],
    });

    await api.pause(300);
    const dataValue25 = api._.get(data, 'phrases.p12[8]');
    await browser.keys(dataValue25);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 806, 897],
    });

    await api.pause(300);
    const dataValue28 = api._.get(data, 'phrases.p12[9]');
    await browser.keys(dataValue28);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 336, 899],
    });

    await api.pause(300);
    const dataValue31 = api._.get(data, 'phrases.p12[10]');
    await browser.keys(dataValue31);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 824, 909],
    });

    await api.pause(300);
    const dataValue34 = api._.get(data, 'phrases.p12[11]');
    await browser.keys(dataValue34);

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 97, 1146],
    });

    await api.pause(300);
    await browser.execute('mobile: shell', {
      command: 'input',
      args: ['tap', 533, 1341],
    });
  },
);
