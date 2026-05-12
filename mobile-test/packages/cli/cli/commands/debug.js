import { WebSocketServer } from 'ws';
import { remote } from 'webdriverio';

import logger from '../../utils/logger.js';
import { FRAMEWORKS, PLATFORMS } from '../../utils/constants.js';
import { loadEnv } from '../../utils/loadEnv.js';
import { parse } from '../../utils/wss/message.js';
import { dispatchCommand } from '../../utils/wss/commandHandlers.js';

import { loadService } from '../../utils/loadService4debug.js';

const command = 'debug';
const desc = 'Run debug ';

const builder = {
  platform: {
    describe: 'Specify the platform',
    choices: Object.keys(PLATFORMS),
    type: 'string',
    demandOption: true,
  },
  framework: {
    describe: 'Specify the framework',
    choices: Object.keys(FRAMEWORKS),
    type: 'string',
    demandOption: true,
  },
  port: {
    describe: 'Specify port',
    type: 'number',
  },
};

const handler = async function(props) {
  const { platform, framework, port = 3333 } = props;
  process.env['NODE_E2E_PLATFORM'] = platform;
  process.env['NODE_E2E_FRAMEWORK'] = framework;

  loadEnv(platform);

  logger.info(`Running ${platform} debug ws on port ${port}`);

  let wdioConfig;
  try {
    const wdioConfigModule = await import(
      `../../confs/wdio.${platform}.conf.js`
    );

    wdioConfig = wdioConfigModule.config; // 确保引入的是配置对象
  } catch (error) {
    logger.error('load WebDriverIO config failed:', error);
    return;
  }
  console.log('>>>>>>>>>>wdioConfig.port', wdioConfig.port);
  const browser = await remote({
    runner: wdioConfig.runner,
    logLevel: wdioConfig.logLevel,
    port: parseInt(wdioConfig.port),
    capabilities: {
      ...wdioConfig.capabilities[0],
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 60 * 60 * 24,
    },
  });
  global.browser = browser;
  global.$ = browser.$.bind(browser);
  global.$$ = browser.$$.bind(browser);

  loadService();

  await browser.execute('mobile: installApp', {
    appPath: process.env.APPIUM_APP,
  });
  await browser.execute('mobile: activateApp', {
    appId: process.env.APPIUM_APPPACKAGE,
  });

  // create WebSocket server
  const wss = new WebSocketServer({ port });

  logger.info(`WebSocket Server run on ${port}`);

  let openConnections = 0;

  await new Promise((resolve, reject) => {
    wss.on('connection', ws => {
      openConnections++;
      logger.info('WebSocket Client Connected');

      ws.on('message', async message => {
        const command = parse(message);
        if (command) {
          dispatchCommand(ws, command);
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket Client Closed');
        openConnections--;
      });
    });

    wss.on('close', () => {
      logger.info('WebSocket Server Closed');
      resolve();
    });

    wss.on('error', error => {
      logger.error('WebSocket Server Error:', error);
      reject(error);
    });
  });

  if (browser) {
    await browser.deleteSession();
  }
};

export { command, desc, builder, handler };
