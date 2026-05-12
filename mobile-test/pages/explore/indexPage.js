import { api } from '@node-e2e/cli/api/index.js';
import Page from '../base.js';
import { Key } from 'webdriverio';

class ExploreIndexPage extends Page {
  get keyElement() {
    return api.by.idStartWith('dapp-');
  }

  get searchBtn() {
    return api.by.id('explore-index-search');
  }

  get searchInput() {
    return api.by.id('nav-header-search');
  }
  get searchResultElement() {
    return api.by.id('dapp-search1');
  }
  async search(val) {
    await api.setValue(this.searchInput, val);
  }
  async shortCutCreateTab() {
    await api.shortCut('t');
  }
  async shortCutCloseTab() {
    await api.shortCut('w');
  }
  async shortCutFreshTab() {
    await api.shortCut('r');
  }

  async shortCutGoBack() {
    await api.shortCut('[');
  }
  async shortCutGoForward() {
    await api.shortCut(']');
  }
  async waitForSearchResult() {
    await api.waitReqByElement(this.searchResultElement);
  }
  async hideKeyboard() {
    await api.hideKeyboard();
  }

  async clickSearchResultByIndex(index) {
    await api.tap(api.by.id(`dapp-search${index}`));
  }

  async clickSearchBtn() {
    await api.tap(this.searchBtn);
  }

  async getSearchInputText() {
    await api.getText(this.searchInput);
  }

  async checkSearchInputTextEqualWithExpect(text) {
    const searchTerm = await this.getSearchInputText();
    expect(searchTerm).toBe(text);
  }

  async checkSearchBtnExisting() {
    await this.searchBtn.isExisting();
  }

  async clickFirstDapp() {
    await api.pause(5000); // wait req load
    await api.tap(api.by.idStartWith('dapp-'));
  }
}

export const exploreIndexPage = new ExploreIndexPage();
