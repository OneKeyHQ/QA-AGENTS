import { detectPlatform, PLATFORMS } from '../utils/detectPlatform.js';

export default class PlatformChain {
  #platformStack = [];
  #excludeStack = [];
  #isExcludeMode = false;

  constructor() {}

  current() {
    return detectPlatform();
  }
  get enum() {
    return PLATFORMS;
  }
  #addPlatform(platform) {
    if (this.#isExcludeMode) {
      this.#excludeStack.push(platform);
    } else {
      this.#platformStack.push(platform);
    }
    return this;
  }

  ios() {
    return this.#addPlatform(PLATFORMS.ios);
  }

  android() {
    return this.#addPlatform(PLATFORMS.android);
  }

  web() {
    return this.#addPlatform(PLATFORMS.web);
  }

  electron() {
    return this.#addPlatform(PLATFORMS.electron);
  }

  ext() {
    return this.#addPlatform(PLATFORMS.ext);
  }

  not() {
    this.#isExcludeMode = true;
    return this;
  }

  async run(fn) {
    const currentPlatform = detectPlatform();
    const shouldRun = this.#isExcludeMode
      ? this.#excludeStack.indexOf(currentPlatform) === -1
      : this.#platformStack.indexOf(currentPlatform) >= 0;

    if (shouldRun) {
      await fn();
    }

    // 重置状态
    this.#platformStack = [];
    this.#excludeStack = [];
    this.#isExcludeMode = false;
  }

  bind(fn) {
    const currentPlatform = detectPlatform();
    const shouldRun = this.#isExcludeMode
      ? this.#excludeStack.indexOf(currentPlatform) === -1
      : this.#platformStack.indexOf(currentPlatform) >= 0;

    if (shouldRun) {
      return fn;
    }

    // 重置状态
    this.#platformStack = [];
    this.#excludeStack = [];
    this.#isExcludeMode = false;
  }
}
