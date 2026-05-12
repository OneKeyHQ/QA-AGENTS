import { api } from '@node-e2e/cli/api/index.js';

import Page from './base.js';

class DevPage extends Page {
  get globalDevBtn() {
    return api.by.id('dev-button');
  }

  async clickGlobalDevBtn() {
    await api.tapOnDevBtn('dev-button');
  }
}

export const devPage = new DevPage();
