import _ from 'lodash-es';

export default class WorkerService {
  constructor(serviceOptions, capabilities, config) {
    this.options = serviceOptions;
  }

  beforeTest(test, context) {
    browser.store = {
      context: {},
      steps: {},
    };
  }

  afterTest(test, context) {
    browser.store = {
      context: {},
      steps: {},
    };
  }
}
export const launcher = class LauncherService {
  async onPrepare(config, capabilities) {
    return Promise.resolve();
  }

  onComplete(exitCode, config, capabilities) {}
};

export const getStore = (stepId, key, defaultValue) => {
  const value = _.get(browser.store.steps[stepId], key, defaultValue);
  return value;
};

export const setStore = (stepId, key, value) => {
  if (!browser.store.steps[stepId]) {
    browser.store.steps[stepId] = {};
  }
  browser.store.steps[stepId][key] = value;
};
