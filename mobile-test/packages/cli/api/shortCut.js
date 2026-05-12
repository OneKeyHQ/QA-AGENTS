import { Key } from 'webdriverio';

import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const shortCut = async (keyCode, platform = detectPlatform()) => {
  await browser.keys([Key.Ctrl, keyCode]);
};

export default shortCut;
