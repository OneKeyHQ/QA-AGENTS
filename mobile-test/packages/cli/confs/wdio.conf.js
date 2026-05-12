import path from 'path';
import allure from 'allure-commandline';
import ejs from 'ejs';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { api } from '@node-e2e/cli/api/index.js';
import {
  detectPlatform,
  PLATFORMS,
} from '@node-e2e/cli/utils/detectPlatform.js';

import { Buffer } from 'buffer';
import { exec } from 'child_process';
import {
  isFirstRun,
  setFirstRunComplete,
  cleanFirstRun,
} from '../utils/firstLock.js';

import ITStoreService from '../services/store.service.js';
import ComposerService from '../services/composer.service.js';
import OcrService from '../services/ocr.service.js';
import RRWebHttpServer, {
  generateRRWebPlaybackHTML,
} from '../services/rrWebHttp.service.js';
import { recordingService } from '../services/recording.service.js';
import {
  startRealtimeReportServer,
  stopRealtimeReportServer,
  isRealtimeReportEnabled,
  getResultsDir,
} from '../utils/realtimeReportService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const currentPlatform = detectPlatform();

function killElectronProcess() {
  return new Promise((resolve, reject) => {
    exec('taskkill /F /IM OneKey.exe', (err, stdout, stderr) => {
      if (err) {
        console.error('Failed to kill Electron process: ', err);
        return reject(err);
      }
      console.log('Electron process killed successfully');
      resolve(stdout);
    });
  });
}

export const config = {
  //
  // ====================
  // Runner Configuration
  // ====================
  // WebdriverIO supports running e2e tests as well as unit and component tests.
  runner: 'local',
  //
  // ==================
  // Specify Test Files
  // ==================
  // Define which test specs should run. The pattern is relative to the directory
  // of the configuration file being run.
  //
  // The specs are defined as an array of spec files (optionally using wildcards
  // that will be expanded). The test for each spec file will be run in a separate
  // worker process. In order to have a group of spec files run in the same worker
  // process simply enclose them in an array within the specs array.
  //
  // If you are calling `wdio` from an NPM script (see https://docs.npmjs.com/cli/run-script),
  // then the current working directory is where your `package.json` resides, so `wdio`
  // will be called from there.
  //
  // specs: [process.env.SPECS],
  // Patterns to exclude.
  exclude: [
    // 'path/to/excluded/files'
  ],
  //
  // ============
  // Capabilities
  // ============
  // Define your capabilities here. WebdriverIO can run multiple capabilities at the same
  // time. Depending on the number of capabilities, WebdriverIO launches several test
  // sessions. Within your capabilities you can overwrite the spec and exclude options in
  // order to group specific specs to a specific capability.
  //
  // First, you can define how many instances should be started at the same time. Let's
  // say you have 3 different capabilities (Chrome, Firefox, and Safari) and you have
  // set maxInstances to 1; wdio will spawn 3 processes. Therefore, if you have 10 spec
  // files and you set maxInstances to 10, all spec files will get tested at the same time
  // and 30 processes will get spawned. The property handles how many capabilities
  // from the same test should run tests.
  //
  maxInstances: 1,
  //
  // If you have trouble getting all important capabilities together, check out the
  // Sauce Labs platform configurator - a great tool to configure your capabilities:
  // https://saucelabs.com/platform/platform-configurator
  //
  // capabilities: [
  //   {
  //     browserName: 'chrome',
  //     'goog:chromeOptions': {
  //       // given your wdio.conf.js is in the root directory and your compiled
  //       // web extension files are located in the `./dist` folder
  //       args: [
  //         `--lang=${process.env.LANG}`,
  //         `--new-window="${process.env.BASEURL}"`,
  //         // '--window-size=375,812',
  //       ],
  //     },
  //   },
  // ],

  //
  // ===================
  // Test Configurations
  // ===================
  // Define all options that are relevant for the WebdriverIO instance here
  //
  // Level of logging verbosity: trace | debug | info | warn | error | silent
  // 默认 warn 减少刷屏；需要排查时设 LOG_LEVEL=debug
  logLevel: process.env.LOG_LEVEL || 'warn',
  logLevels: {
    webdriver: process.env.LOG_LEVEL || 'error',
    webdriverio: process.env.LOG_LEVEL || 'error',
    '@wdio/local-runner': process.env.LOG_LEVEL || 'warn',
    '@wdio/appium-service': process.env.LOG_LEVEL || 'warn',
    '@wdio/mocha-framework': process.env.LOG_LEVEL || 'warn',
  },
  //
  // If you only want to run your tests until a specific amount of tests have failed use
  // bail (default is 0 - don't bail, run all tests).
  bail: 0,
  //
  // Set a base URL in order to shorten url command calls. If your `url` parameter starts
  // with `/`, the base url gets prepended, not including the path portion of your baseUrl.
  // If your `url` parameter starts without a scheme or `/` (like `some/path`), the base url
  // gets prepended directly.
  baseUrl: '',
  //
  // Default timeout for all waitFor* commands.
  waitforTimeout: 10000,
  //
  // Default timeout in milliseconds for request
  // if browser driver or grid doesn't send response
  connectionRetryTimeout: 1000 * 60 * 10,
  //
  // Default request retries count
  connectionRetryCount: 1,
  //
  // Test runner services
  // Services take over a specific job you don't want to take care of. They enhance
  // your test setup with almost no effort. Unlike plugins, they don't add new
  // commands. Instead, they hook themselves up into the test process.
  services: [
    'shared-store',
    // [ITStoreService],
    // [ComposerService],
    [OcrService],
    // [
    //   'native-app-compare',
    //   {
    //     baselineFolder: path.join(process.cwd(), 'test', 'baseline'),
    //     formatImageName: '{tag}-{logName}-{width}x{height}',
    //     screenshotPath: path.join(process.cwd(), 'tmp'),
    //     savePerInstance: true,
    //     autoSaveBaseline: true,
    //     blockOutStatusBar: true,
    //     blockOutToolBar: true,
    //     blockOutIphoneHomeBar: true,
    //     blockOutNavigationBar: true,
    //     // NOTE: When you are testing a hybrid app please use this setting
    //     // Options for the tabbing image
    //     tabbableOptions: {
    //       circle: {
    //         size: 18,
    //         fontSize: 18,
    //         // ...
    //       },
    //       line: {
    //         color: '#ff221a', // hex-code or for example words like `red|black|green`
    //         width: 3,
    //       },
    //     },
    //     // ... more options
    //   },
    // ],
  ].concat(
    currentPlatform != PLATFORMS.ios && currentPlatform != PLATFORMS.android
      ? [[RRWebHttpServer]]
      : [],
  ),
  //
  // Framework you want to run your specs with.
  // The following are supported: Mocha, Jasmine, and Cucumber
  // see also: https://webdriver.io/docs/frameworks
  //
  // Make sure you have the wdio adapter package for the specific framework installed
  // before running any tests.
  framework: 'mocha',

  //
  // The number of times to retry the entire specfile when it fails as a whole
  // specFileRetries: 1,
  //
  // Delay in seconds between the spec file retry attempts
  // specFileRetriesDelay: 0,
  //
  // Whether or not retried spec files should be retried immediately or deferred to the end of the queue
  // specFileRetriesDeferred: false,
  //
  // Test reporter for stdout.
  // The only one supported by default is 'dot'
  // see also: https://webdriver.io/docs/dot-reporter
  reporters: [
    [
      'allure',
      {
        outputDir: process.env.ALLURE_RESULTS_DIR || 'allure-results',
        addConsoleLogs: false,
        reportedEnvironmentVars: process.env,
        disableWebdriverStepsReporting: true,
        disableWebdriverScreenshotsReporting: true,
      },
    ],
  ],

  // Options to be passed to Mocha.
  // See the full list at http://mochajs.org/
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000 * 60,
  },

  //
  // =====
  // Hooks
  // =====
  // WebdriverIO provides several hooks you can use to interfere with the test process in order to enhance
  // it and to build services around it. You can either apply a single function or an array of
  // methods to it. If one of them returns with a promise, WebdriverIO will wait until that promise got
  // resolved to continue.
  /**
   * Gets executed once before all workers get launched.
   * @param {object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   */
  onPrepare: async function (config, capabilities) {
    // 如果启用了实时报告，启动 Allure 服务器
    if (isRealtimeReportEnabled()) {
      try {
        const resultsDir = getResultsDir();
        const port = process.env.ALLURE_REPORT_PORT 
          ? parseInt(process.env.ALLURE_REPORT_PORT, 10) 
          : null;
        const openBrowser = process.env.ALLURE_AUTO_OPEN !== 'false';
        
        await startRealtimeReportServer(resultsDir, port, openBrowser);
      } catch (error) {
        console.error('Failed to start realtime report server:', error);
        // 不阻止测试执行，只是警告
      }
    }
  },
  /**
   * Gets executed before a worker process is spawned and can be used to initialise specific service
   * for that worker as well as modify runtime environments in an async fashion.
   * @param  {string} cid      capability id (e.g 0-0)
   * @param  {object} caps     object containing capabilities for session that will be spawn in the worker
   * @param  {object} specs    specs to be run in the worker process
   * @param  {object} args     object that will be merged with the main configuration once worker is initialized
   * @param  {object} execArgv list of string arguments passed to the worker process
   */
  // onWorkerStart: function (cid, caps, specs, args, execArgv) {
  // },
  /**
   * Gets executed just after a worker process has exited.
   * @param  {string} cid      capability id (e.g 0-0)
   * @param  {number} exitCode 0 - success, 1 - fail
   * @param  {object} specs    specs to be run in the worker process
   * @param  {number} retries  number of retries used
   */
  // onWorkerEnd: function (cid, exitCode, specs, retries) {
  // },
  /**
   * Gets executed just before initialising the webdriver session and test framework. It allows you
   * to manipulate configurations depending on the capability or spec.
   * @param {object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that are to be run
   * @param {string} cid worker id (e.g. 0-0)
   */
  // beforeSession: function (config, capabilities, specs, cid) {
  // },
  /**
   * Gets executed before test execution begins. At this point you can access to all global
   * variables like `browser`. It is the perfect place to define custom commands.
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs        List of spec file paths that are to be run
   * @param {object}         browser      instance of created browser/device session
   */
  before: async function(capabilities, specs, browser) {
    // await browser.overwriteCommand(
    //   '$',
    //   async function(origFunction, oldSelector) {
    //     if (
    //       process.env.NODE_E2E_PLATFORM != PLATFORMS.android &&
    //       process.env.NODE_E2E_PLATFORM != PLATFORMS.ios
    //     ) {
    //       return await origFunction(oldSelector);
    //     }
    //     const regex = /\[data-testid='(.*?)'\]/;
    //     const match = oldSelector.match(regex);
    //     if (!match) {
    //       return await origFunction(oldSelector);
    //     }
    //     const selector = match[1];
    //     if (process.env.NODE_E2E_PLATFORM == PLATFORMS.android) {
    //       return await origFunction(
    //         `android=new UiSelector().resourceId("${selector}")`,
    //       );
    //     }
    //     return await origFunction(`~${selector}`);
    //   },
    //   false,
    // );
  },
  /**
   * Runs before a WebdriverIO command gets executed.
   * @param {string} commandName hook command name
   * @param {Array} args arguments that command would receive
   */
  beforeCommand: async function (commandName, args) {
    // 录制服务：在命令执行前记录
    if (recordingService.isRecording) {
      // 注意：这里不记录，因为元素信息需要在命令执行后获取
    }
  },
  /**
   * Hook that gets executed before the suite starts
   * @param {object} suite suite details
   */
  // beforeSuite: function (suite) {
  // },
  /**
   * Function to be executed before a test (in Mocha/Jasmine) starts.
   */
  beforeTest: async function(test, context) {
    await api.platformChain
      .ios()
      .android()
      .run(async () => {
        await browser.startRecordingScreen({ videoType: 'libx264' });
      });
  },
  /**
   * Hook that gets executed _before_ a hook within the suite starts (e.g. runs before calling
   * beforeEach in Mocha)
   */
  // beforeHook: function (test, context, hookName) {
  // },
  /**
   * Hook that gets executed _after_ a hook within the suite starts (e.g. runs after calling
   * afterEach in Mocha)
   */
  // afterHook: function (test, context, { error, result, duration, passed, retries }, hookName) {
  // },
  /**
   * Function to be executed after a test (in Mocha/Jasmine only)
   * @param {object}  test             test object
   * @param {object}  context          scope object the test was executed with
   * @param {Error}   result.error     error object in case the test fails, otherwise `undefined`
   * @param {*}       result.result    return object of test function
   * @param {number}  result.duration  duration of test
   * @param {boolean} result.passed    true if test has passed, otherwise false
   * @param {object}  result.retries   information about spec related retries, e.g. `{ attempts: 0, limit: 0 }`
   */
  afterTest: async function(
    test,
    context,
    { error, result, duration, passed, retries },
  ) {
    // if (error) {
    //   const screenshot = await browser.takeScreenshot();

    //   allureReporter.addAttachment(
    //     'Failed Screenshot',
    //     Buffer.from(screenshot, 'base64'),
    //     'image/png',
    //   );
    // }
    // if (isFirstRun()) {
    //   setFirstRunComplete();
    // }

    await api.platformChain
      .ios()
      .android()
      .run(async () => {
        const videoBase64 = await browser.stopRecordingScreen();
        const videoBuffer = Buffer.from(videoBase64, 'base64');
        api.reporter.addAttachment(
          `recordedVideo.mp4`,
          videoBuffer,
          `video/mp4`,
        );
      });

    // await api.platformChain.android().run(async () => {
    //   const cpuinfoData = await api.globalStore.get(
    //     `perf:${currentPlatform}:cpuinfo`,
    //   );
    //   const templateStr = fs.readFileSync(
    //     path.join(__dirname, '..', 'utils/ejs', 'chart.ejs'),
    //     'utf-8',
    //   );
    //   const html = ejs.render(templateStr, { data: cpuinfoData });
    //   api.reporter.addAttachment('cpuinfo', html, 'text/html');

    //   const memoryInfo = await api.globalStore.get(
    //     `perf:${currentPlatform}:memoryinfo`,
    //   );
    //   const memoryHtml = ejs.render(templateStr, { data: memoryInfo });
    //   api.reporter.addAttachment('memoryinfo', memoryHtml, 'text/html');

    //   const networkInfo = await api.globalStore.get(
    //     `perf:${currentPlatform}:networkinfo`,
    //   );
    //   const networkHtml = ejs.render(templateStr, { data: networkInfo });
    //   api.reporter.addAttachment('networkinfo', networkHtml, 'text/html');

    //   const batteryInfo = await api.globalStore.get(
    //     `perf:${currentPlatform}:batteryinfo`,
    //   );
    //   const batteryHtml = ejs.render(templateStr, { data: batteryInfo });
    //   api.reporter.addAttachment('batteryinfo', batteryHtml, 'text/html');
    // });
  },

  /**
   * Hook that gets executed after the suite has ended
   * @param {object} suite suite details
   */
  afterSuite: async function(suite) {
    // 关闭 Electron 进程
    if (
      process.platform === 'win32' &&
      detectPlatform() === PLATFORMS.electron
    ) {
      try {
        await killElectronProcess();
      } catch (err) {
        // 处理关闭 Electron 进程的错误
        console.error('Error while killing Electron process: ', err);
      }
    }
  },
  /**
   * Runs after a WebdriverIO command gets executed
   * @param {string} commandName hook command name
   * @param {Array} args arguments that command would receive
   * @param {number} result 0 - command success, 1 - command error
   * @param {object} error error object if any
   */
  afterCommand: async function (commandName, args, result, error) {
    // 录制服务：在命令执行后记录操作
    if (recordingService.isRecording && result === 0) {
      await recordingService.recordAction(commandName, args, result);
    }
  },
  /**
   * Gets executed after all tests are done. You still have access to all global variables from
   * the test.
   * @param {number} result 0 - test pass, 1 - test fail
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that ran
   */
  after: async function(result, capabilities, specs) {},
  /**
   * Gets executed right after terminating the webdriver session.
   * @param {object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {Array.<String>} specs List of spec file paths that ran
   */
  // afterSession: function (config, capabilities, specs) {
  // },
  /**
   * Gets executed after all workers got shut down and the process is about to exit. An error
   * thrown in the onComplete hook will result in the test run failing.
   * @param {object} exitCode 0 - success, 1 - fail
   * @param {object} config wdio configuration object
   * @param {Array.<Object>} capabilities list of capabilities details
   * @param {<Object>} results object containing test results
   */
  // onComplete: function(exitCode, config, capabilities, results) {
  // },
  onComplete: async function() {
    // cleanFirstRun();
    
    // 如果启用了实时报告，不需要再次生成报告（服务器已经在实时更新）
    if (isRealtimeReportEnabled()) {
      console.log('\n✅ 实时报告服务器正在运行，报告会自动更新');
      console.log('💡 提示：报告会在浏览器中自动打开，或者查看控制台输出的 URL');
      // 不停止服务器，让用户可以继续查看报告
      return;
    }
    
    // 传统模式：测试完成后生成报告
    const resultsDir = getResultsDir();
    const reportError = new Error('Could not generate Allure report');
    const generation = allure(['generate', resultsDir, '--clean']);
    return new Promise((resolve, reject) => {
      const generationTimeout = setTimeout(() => reject(reportError), 30000);
      generation.on('exit', function(exitCode) {
        clearTimeout(generationTimeout);
        if (exitCode !== 0) {
          return reject(reportError);
        }
        allure(['open']);
        resolve();
      });
    });
  },

  /**
   * Gets executed when a refresh happens.
   * @param {string} oldSessionId session ID of the old session
   * @param {string} newSessionId session ID of the new session
   */
  // onReload: function(oldSessionId, newSessionId) {
  // }
};
