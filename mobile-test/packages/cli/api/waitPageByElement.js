import { WAITE_FOR_PAGE_TIMEOUT } from '../const/index.js';
import { api } from './index.js';
const waitPageByElement = async (elem, timeout = WAITE_FOR_PAGE_TIMEOUT) => {
  try {
    await api.platformChain
      .not()
      .ios()
      .run(
        async () =>
          await elem.waitForDisplayed({ timeout }),
      );
    await api.platformChain
      .ios()
      .run(
        async () =>
          await elem.waitForExist({ timeout }),
      );
  } catch (error) {}
};

export default waitPageByElement;
