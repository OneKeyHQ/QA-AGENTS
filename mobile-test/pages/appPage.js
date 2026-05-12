import { api } from '@node-e2e/cli/api/index.js';

import Page from './base.js';

class App extends Page {
  async toastShouldDisplayed() {
    const isDisplayed = await api.isToastDisplayed();
    expect(isDisplayed).toBe(true);
  }
}

export const app = new App();
