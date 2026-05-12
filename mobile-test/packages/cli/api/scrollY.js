import { api } from './index.js';

const scrollY = async y => {
  const size = await browser.getWindowSize();
  const width = size.width;
  const height = size.height;

  const startX = parseInt(width / 2);
  const startY = parseInt(height / 2);
  const endY = parseInt(startY + y);

  await browser.performActions([
    {
      type: 'pointer',
      id: 'finger1',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', duration: 0, x: startX, y: startY },
        { type: 'pointerDown', button: 0 },
        { type: 'pause', duration: 100 },
        { type: 'pointerMove', duration: 1000, x: startX, y: endY },
        { type: 'pointerUp', button: 0 },
      ],
    },
  ]);
};

export default scrollY;
