import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const longPress = async (elem, ms = 2000, platform = detectPlatform()) => {
  // 首先，确保元素是可见的，这对于触发动作很重要
  await elem.waitForDisplayed();

  // 获取元素的位置信息
  const { x, y } = await elem.getLocation();

  // 使用 browser.actions() 来模拟长按操作
  await browser.performActions([
    {
      // 开始一个新的动作序列
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'touch' }, // 使用 touch 作为指针类型模拟触摸屏幕
      actions: [
        { type: 'pointerMove', duration: 0, x: x, y: y }, // 移动到元素的位置
        { type: 'pointerDown', button: 0 }, // 模拟手指按下
        { type: 'pause', duration: ms }, // 长按指定的时间
        { type: 'pointerUp', button: 0 }, // 释放按压
      ],
    },
  ]);

  // 最后，清除动作序列
  await browser.releaseActions();
};

export default longPress;
