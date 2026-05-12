import { BaseDriver, errors } from '@appium/base-driver';
import { desiredCapConstraints } from './desired-caps';
import commands from './commands/index';
import { AppCtrl } from './appCtrl';
import log from './logger';

const NO_PROXY = [];
const toPairs = (obj) => {
  return Object.keys(obj).map((key) => [key, obj[key]]);
};
class OneKeyTouchDriver extends BaseDriver {

  #appCtrl;

  constructor(opts = {}) {
    super(opts);
    this.desiredCapConstraints = desiredCapConstraints;
    for (const [cmd, fn] of toPairs(commands)) {
      OneKeyTouchDriver.prototype[cmd] = fn;
    }

    this.#appCtrl = new AppCtrl();
  }

  proxyActive() {
    return false;
  }

  getProxyAvoidList() {
    return NO_PROXY;
  }

  canProxy() {
    return false;
  }

  async createSession(...args) {
    const [sessionId, caps] = await super.createSession(...args);
    await  this.#appCtrl.initDevice();
    return [sessionId, caps];
  }

  async deleteSession() {
    await this.#appCtrl.releaseDevice();
    await super.deleteSession();

  }
  touchPerform = async function touchPerform(actions) {
    log.debug('>>>>>>>>>>>> touchPerform', JSON.stringify(actions, null, 2));
    await this.#appCtrl.touchPerform(actions)
  };
  static newMethodMap = {
    '/session/:sessionId/touch/perform': {
      POST: {
        command: 'touchPerform',
        payloadParams: { required: ['actions'] },
      },
    },
  };
}

export default OneKeyTouchDriver;
