import path from 'path';
import { readdirSync } from 'fs';
import { getStep } from './step.js';
import middlewares, { clear as clearMiddlewares } from './useMiddleware.js';

import { fileURLToPath, pathToFileURL } from 'url';
import logger from '../../../utils/logger.js';
import { findWorkspaceRoot } from '../../../utils/workspaceRoot.js';

const rootDir = findWorkspaceRoot(process.cwd());

async function loadStepFile(_dir, stepId) {
  try {
    const stepPath = path.join(rootDir + '/stories', _dir, `${stepId}.step.js`);
    // file URL
    const stepModulePath = pathToFileURL(stepPath).href;
    const stepModule = await import(stepModulePath);
    if (stepModule && stepModule.default) {
      stepModule.default();
      logger.info(`Successfully loaded step file for ${stepId}`);
    }
  } catch (err) {
    logger.error(`Failed to load step file for ${stepId}: ${err.message}`);
  }
}
async function runMiddlewaresWithCallback(middlewares, context, step, data) {
  logger.info('Running middlewares with callback');
  const { callback, info } = step;
  const len = middlewares.length;

  async function execMiddleware(i) {
    if (i < len) {
      await middlewares[i](context, async () => {
        await execMiddleware(i + 1);
      });
    } else if (callback) {
      await callback(data, context);
    }
  }

  await execMiddleware(0);
}
// 单步执行
async function exe(steps, parameter) {
  const { data } = this;
  for (const stepId of steps) {
    await loadStepFile(stepId.split('.')[0], stepId);
  }
  await runContext(steps, parameter || {}, this, data);
}

async function runContext(steps, parameter, context, data = {}) {
  for (const stepId of steps) {
    const step = getStep(stepId) || {};
    context.step = step;
    context.parameter = !context.parameter
      ? { ...parameter }
      : { ...context.parameter, ...parameter };
    if (step.callback) {
      await runMiddlewaresWithCallback(middlewares, context, step, data);
      logger.info(`Executed step ${stepId}`);
    }
  }
}

// 链式执行
async function play(id, parameter, cb, initialContext = {}) {
  logger.info(`Starting play function with id ${id}`);

  const steps = findSteps(id);

  for (const stepId of steps) {
    await loadStepFile(steps[0], stepId);
  }

  const context = { ...initialContext };
  context.exe = exe.bind(context); // 只绑定 context，前两个参数设为 null

  logger.info('Loading data dependencies');
  const data = await loadDataDependencies(steps);
  logger.info('Executing steps');
  await runContext(steps, parameter, context, data);

  cb && (await cb(context));
  logger.info('Play function execution completed');
  clearMiddlewares();
}

function findSteps(id) {
  const queue = [];
  const parts = id.split('.');
  let currentId = parts[0];

  if (currentId !== '0') {
    queue.push(`${currentId}`);
  }
  for (const part of parts.slice(1)) {
    currentId = `${currentId}.${part}`;
    queue.push(currentId);
  }
  return queue;
}

async function loadDataDependencies(steps) {
  const data = {};
  const loaded = new Set();
  const dir = path.dirname(fileURLToPath(import.meta.url));
  logger.info('Loading data dependencies for steps');

  for (const stepId of steps) {
    const { dataDependencies } = getStep(stepId);
    for (const dep of dataDependencies) {
      if (!loaded.has(dep)) {
        loaded.add(dep);
        try {
          const modulePath = path.join('data', `${dep}.js`);
          //  file URL
          const moduleURL = pathToFileURL(modulePath).href;
          const module = await import(moduleURL);
          data[dep] = module.default || module;
          logger.info(`Successfully loaded data dependency ${dep}`);
        } catch (err) {
          logger.error(`Failed to load data dependency ${dep}: ${err.message}`);
        }
      }
    }
  }
  return data;
}

export async function loadAllData() {
  const data = {};
  const dataDir = path.join(rootDir, 'data');
  logger.info('Loading data dependencies from directory:', dataDir);

  try {
    const files = readdirSync(dataDir);

    for (const file of files) {
      if (file.endsWith('.js')) {
        const moduleName = file.slice(0, -3); // Remove '.js' extension
        try {
          const modulePath = path.join(dataDir, file);
          const moduleURL = pathToFileURL(modulePath).href;
          const module = await import(moduleURL);
          data[moduleName] = module.default || module;
          logger.info(`Successfully loaded data dependency ${moduleName}`);
        } catch (err) {
          logger.error(
            `Failed to load data dependency ${moduleName}: ${err.message}`,
          );
        }
      }
    }
  } catch (err) {
    logger.error(`Failed to read data directory: ${err.message}`);
  }

  return data;
}
export default play;
