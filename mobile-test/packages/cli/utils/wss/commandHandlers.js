import { build } from './message.js';
import log from '../logger.js';
import { api } from '../../api/index.js';
import { getStore, setStore } from '../../services/store.service.js';
import { loadAllData } from '../../services/composer/core/play.js';

const OCR_KEY = 'ocr';

let data;

// async function initData() {
//   data = await loadAllData();
// }
// initData().catch(log.error);

async function handleScreenshotCommand(ws, commandId) {
  const screenshotData = await browser.takeScreenshot();

  ws.send(
    build(commandId, {
      width: 1080,
      height: 2400,
      screenshot: `data:image/png;base64,${screenshotData}`,
    }),
  );
}

async function handleClickCommand(ws, commandId, payload) {
  await browser.execute('mobile: shell', {
    command: 'input',
    args: ['tap', payload.x, payload.y],
  });

  const clickResult = `Clicked at (${payload.x}, ${payload.y})`;
  ws.send(build(commandId, clickResult));
}

async function handleInputCommand(ws, commandId, payload) {
  let text = '';
  switch (payload.dataSource) {
    case 'Step':
      {
        text = getStore(payload.stepId, payload.keyForLodash);
        await browser.keys(text);
      }
      break;
    case 'User Input':
      {
        text = payload.userInput;
        await browser.keys(text);
      }
      break;
    case 'Data':
      {
        text = api._.get(data, payload.keyForLodash);
        await browser.keys(text);
      }
      break;
    default:
      break;
  }

  const inputResult = `Text ${text} inputted`;
  ws.send(build(commandId, inputResult));
}
async function handleOcrCommand(ws, commandId, payload) {
  try {
    let text = await browser.ocr('eng+chi_sim', payload.rectangle);
    text = text.trim();

    if (!payload.noStore) {
      const ocrList = getStore(payload.stepId, OCR_KEY, []);
      ocrList.push(text);
      setStore(payload.stepId, OCR_KEY, ocrList);
    }
    ws.send(build(commandId, { text }));
  } catch (error) {
    log.error(error.message);
    // 发送错误响应
    ws.send(build(commandId, { error: error.message }));
  }
}
async function handleGetScreenSizeCommand(ws, commandId) {
  const { width, height } = await browser.getWindowSize();
  ws.send(build(commandId, { width, height }));
}

async function handlePlayCommand(ws, commandId, payload) {
  try {
    await browser.terminateApp(process.env.APPIUM_APPPACKAGE);
    await browser.activateApp(process.env.APPIUM_APPPACKAGE);
    await browser.pause(5000);
    await play(payload.pid, {});
  } catch (error) {
    log.error(error.message);
  }
  ws.send(build(commandId, {}));
}

async function handlePauseCommand() {
  try {
    await api.pause(payload.delay);
  } catch (error) {
    log.error(error.message);
  }
  ws.send(build(commandId, {}));
}

const commandHandlers = {
  'screenshot': handleScreenshotCommand,
  'getScreenSize': handleGetScreenSizeCommand,
  'click': handleClickCommand,
  'input': handleInputCommand,
  'ocr': handleOcrCommand,
  'play': handlePlayCommand,
  'pause': handlePauseCommand,
};

export function dispatchCommand(ws, command) {
  const handler = commandHandlers[command.type];
  if (handler) {
    handler(ws, command.id, command.payload);
  } else {
    ws.send(build(command.id, null, 'Unknown command type'));
  }
}
