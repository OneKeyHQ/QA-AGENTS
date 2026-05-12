import { WAITE_FOR_REQ_TIMEOUT } from '../const/index.js';
import { api } from './index.js';
const waitReqByElement = async elem => {
  try {
    await api.platformChain
      .not()
      .ios()
      .run(
        async () =>
          await elem.waitForDisplayed({ timeout: WAITE_FOR_REQ_TIMEOUT }),
      );
    await api.platformChain
      .ios()
      .run(
        async () => await elem.waitForExist({ timeout: WAITE_FOR_REQ_TIMEOUT }),
      );
  } catch (error) {}
};

export default waitReqByElement;
