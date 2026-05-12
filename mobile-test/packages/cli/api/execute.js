const execute = async (fn, ...args) => {
  await browser.execute(fn, ...args);
};

export default execute;
