step(
  { id: `4.1.1.1.1`, describe: `Confirm` },
  [],
  [],
  async (
    data,
    { platform, api, step, getStore, setStore, reporter, parameter }
  ) => {
    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 338, 343]
    });

    await api.pause(300);
    const stepValue1 = getStore("4.1.1.1", "ocr[0]");
    await browser.keys(stepValue1);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 833, 344]
    });

    await api.pause(300);
    const stepValue4 = getStore("4.1.1.1", "ocr[1]");
    await browser.keys(stepValue4);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 315, 487]
    });

    await api.pause(300);
    const stepValue7 = getStore("4.1.1.1", "ocr[2]");
    await browser.keys(stepValue7);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 834, 497]
    });

    await api.pause(300);
    const stepValue10 = getStore("4.1.1.1", "ocr[3]");
    await browser.keys(stepValue10);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 328, 636]
    });

    await api.pause(300);
    const stepValue13 = getStore("4.1.1.1", "ocr[4]");
    await browser.keys(stepValue13);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 835, 635]
    });

    await api.pause(300);
    const stepValue16 = getStore("4.1.1.1", "ocr[5]");
    await browser.keys(stepValue16);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 326, 785]
    });

    await api.pause(300);
    const stepValue19 = getStore("4.1.1.1", "ocr[6]");
    await browser.keys(stepValue19);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 843, 784]
    });

    await api.pause(300);
    const stepValue22 = getStore("4.1.1.1", "ocr[7]");
    await browser.keys(stepValue22);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 340, 932]
    });

    await api.pause(300);
    const stepValue25 = getStore("4.1.1.1", "ocr[8]");
    await browser.keys(stepValue25);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 835, 935]
    });

    await api.pause(300);
    const stepValue28 = getStore("4.1.1.1", "ocr[9]");
    await browser.keys(stepValue28);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 332, 902]
    });

    await api.pause(300);
    const stepValue31 = getStore("4.1.1.1", "ocr[10]");
    await browser.keys(stepValue31);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 830, 903]
    });

    await api.pause(300);
    const stepValue34 = getStore("4.1.1.1", "ocr[11]");
    await browser.keys(stepValue34);

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 134, 1148]
    });

    await api.pause(300);
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["tap", 547, 1348]
    });
  }
);
