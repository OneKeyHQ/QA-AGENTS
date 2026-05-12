import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import { executeByPlatform } from '../../../util/index.js';

const getClipboard = async (platform = detectPlatform()) => {
  return new Promise(async (resolve, reject) => {
    await executeByPlatform(
      async () => {
        const base64Text = await browser.getClipboard();
        const text = Buffer.from(base64Text, 'base64').toString('utf-8');
        resolve(text);
      },
      async () => {
        const text = await browser.executeAsync(async done => {
          try {
            const text = await navigator.clipboard.readText();
            done(text);
          } catch (error) {
            done('');
          }
        });
        resolve(text);
      },
    );
  });
};

export default getClipboard;
