import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

const pushFile = async (fileBase64, path, platform = detectPlatform()) => {
  await browser.pushFile(path, fileBase64);
};

export default pushFile;
