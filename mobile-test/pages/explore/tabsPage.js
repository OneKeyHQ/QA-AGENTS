import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';

import {
  WEBVIEW_LOAD_TIMEOUT,
  WEBPAGE_LOAD_COMPLETE_TIMEOUT,
} from '../../const/index.js';

class ExploreTabManagePage extends Page {
  get doneBtn() {
    return api.by.id('tab-list-modal-done');
  }

  async clickDoneBtn() {
    await api.tap(this.doneBtn);
  }
}

export const exploreTabManagePage = new ExploreTabManagePage();
