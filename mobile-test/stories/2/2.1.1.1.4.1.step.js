step(
  {
    id: `2.1.1.1.4.1`,
    describe: `点击 x
check 关闭 option`,
  },
  [],
  [],
  async (
    data,
    { platform, api: { by }, step, getStore, setStore, reporter, parameter },
  ) => {
    await platform
      .android()
      .ios()
      .run(async () => {
        await $(by.id('popover-btn-close')).click();

        const elem = await $(by.id('popover-btn-close'));
        await expect(elem).not.toBeDisplayed();
      });
    await platform.electron().run(async () => {
      // 定位到一个足够大的元素，例如 body
      const largeElement = await $('body');

      // 获取该元素的尺寸和位置
      const { width, height } = await largeElement.getSize();
      const { x, y } = await largeElement.getLocation();

      // 计算中心点坐标
      const centerX = x + parseInt(width / 2);
      const centerY = y + parseInt(height / 2);

      // 点击中心点
      await browser.performActions([
        {
          type: 'pointer',
          id: 'pointer1',
          parameters: { pointerType: 'mouse' },
          actions: [
            { type: 'pointerMove', duration: 0, x: centerX, y: centerY },
            { type: 'pointerDown', button: 0 },
            { type: 'pointerUp', button: 0 },
          ],
        },
      ]);

      const elem = await $(by.id('action-list-item-close tab'));
      await expect(elem).not.toBeDisplayed();
    });
  },
);
