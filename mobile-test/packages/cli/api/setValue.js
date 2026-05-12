import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';
import by from './by.js';
import { api } from './index.js';
import tap from './tap.js';

const setValue = async (element, value, platform = detectPlatform()) => {
  await api.tap(element);

  await api.platformChain
    .not()
    .ios()
    .android()
    .run(async () => {
      const selectAll =
        process.platform === 'darwin' ? ['Meta', 'a'] : ['Control', 'a'];
      await browser.keys(selectAll);
      await browser.keys('Delete');
    });
  await api.platformChain
    .ios()
    .android()
    .run(async () => {
      await element.clearValue();
    });
  await element.addValue(value);
};

export default setValue;
