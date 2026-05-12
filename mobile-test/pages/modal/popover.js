import Page from '../base.js';
import { api } from '@node-e2e/cli/api/index.js';
export default class Popover extends Page {
  get close() {
    return api.by.id('popover-btn-close');
  }

  async clickClose() {
    await api.tap(this.close);
  }
}
