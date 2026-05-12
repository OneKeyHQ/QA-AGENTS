import { WAITE_FOR_ELEMENT_TIMEOUT, TAP_WAIT } from '../const/index.js';

import { api } from './index.js';

const tap = async elem => {
  const resolvedElem = await elem;

  if (!resolvedElem) {
    throw new TypeError('api.tap: element is null or undefined');
  }

  try {
    await api.platformChain
      .not()
      .ios()
      .android()
      .run(
        async () =>
          await resolvedElem.waitForClickable({
            timeout: WAITE_FOR_ELEMENT_TIMEOUT,
          }),
      );
    await browser.pause(TAP_WAIT);
  } catch (error) {}

  if (typeof resolvedElem.click !== 'function') {
    throw new TypeError('api.tap: resolved element does not support click()');
  }

  await resolvedElem.click();
};

export default tap;
