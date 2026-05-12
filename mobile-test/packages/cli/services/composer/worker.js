import play from './core/play.js';
import step from './core/step.js';
import { useMiddleware } from './core/useMiddleware.js';
import { api, reporter } from '../../api/index.js';
import { getStore, setStore } from '../store.service.js';
export default class WorkerService {
  /**
   * `serviceOptions` contains all options specific to the service
   * e.g. if defined as follows:
   *
   * ```
   * services: [['custom', { foo: 'bar' }]]
   * ```
   *
   * the `serviceOptions` parameter will be: `{ foo: 'bar' }`
   */
  constructor(serviceOptions, capabilities, config) {
    this.options = serviceOptions;
  }

  beforeTest() {
    useMiddleware(async ({ step }, next) => {
      const { info } = step;
      console.log(`exe step #${info.id} - before`);
      await next();
      console.log(`exe step #${info.id} - after`);
    });
    useMiddleware(async (context, next) => {
      const { step } = context;
      const { info } = step;
      context.platform = api.platformChain;
      context.api = api;
      context.reporter = reporter;
      context.getStore = getStore;
      context.setStore = setStore;
      context.env = process.env;
      reporter.addStep(`# ${info.id} - ${info.describe}`);
      await next();
    });

    global.step = step;
    global.play = play;
    global.platformChain = api.platformChain;
  }
}
