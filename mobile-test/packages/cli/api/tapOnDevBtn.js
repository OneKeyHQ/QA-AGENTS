import executeByPlatform from '../utils/executeByPlatform.js';

import { api } from './index.js';
const tapOnDevBtn = async id => {
  await executeByPlatform(
    async () => {
      await api.tap(api.by.id(id));
    },
    async () => {
      await api.pause(1000);
      await api.fixInterceptedClick(id);
    },
  );
};

export default tapOnDevBtn;
