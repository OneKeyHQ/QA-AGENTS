const fixInterceptedClick = async id => {
  await browser.execute(buttonSelector => {
    const button = document.querySelector(buttonSelector);
    if (button) {
      button.click(); // 模拟点击操作
    }
  }, `[data-testid^='${id}']`);
};

export default fixInterceptedClick;
