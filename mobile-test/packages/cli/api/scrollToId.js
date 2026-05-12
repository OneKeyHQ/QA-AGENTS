import { api } from './index.js';

const scrollToId = async id => {
  await api.platformChain.ios().run(async () => {
    const elem = await api.by.id(id);
    await browser.executeScript('mobile: scrollToElement', [
      { 'elementId': elem.elementId },
    ]);
  });

  await api.platformChain.android().run(async () => {
    await browser.execute('mobile: scroll', {
      strategy: '-android uiautomator',
      selector: `new UiSelector().resourceId("${id}")`,
    });
  });
  await api.platformChain
    .not()
    .android()
    .ios()
    .run(async () => {
      const elem = await api.by.id(id);
      await elem.scrollIntoView();
    });
};

export default scrollToId;
