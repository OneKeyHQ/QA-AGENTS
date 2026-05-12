import { USBDriver } from './touch/usbdriver';

export class AppCtrl {
  
  #actionLog = [];
  #usbDriver;

  constructor() {

    this.#actionLog = [];
    this.#usbDriver = new USBDriver();
  }

  async initDevice() {
      await this.#usbDriver.init()
  }

  async touchPerform(actions){
    for (const action of actions) {
      await this.#usbDriver.write(action.options.x,action.options.y)
     }
  }
  async releaseDevice() {
    await this.#usbDriver.release()
  }

}