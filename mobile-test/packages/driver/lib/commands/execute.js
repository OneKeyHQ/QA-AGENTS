import { errors } from '@appium/base-driver';
import log from '../logger';
import { executeCommand } from '../utils';
import { util } from '@appium/support';

const commands = {};

const EXTENSION_COMMANDS_MAPPING = {
  shell: 'shell',
};

commands.execute = async function execute(script, args) {
  if (script.match(/^touch:/)) {
    log.info(`Executing extension command '${script}'`);
    script = script.replace(/^touch:/, '').trim();
    return await this.executeTouchCommand(
      script,
      Array.isArray(args) ? args[0] : args,
    );
  }
  throw new errors.NotImplementedError();
};

commands.executeTouchCommand = async function executeTouchCommand(
  command,
  opts = {},
) {
  if (Object.keys(EXTENSION_COMMANDS_MAPPING).indexOf(command) < 0) {
    throw new errors.UnknownCommandError(
      `Unknown extension command "${command}". ` +
        `Only ${Object.keys(
          EXTENSION_COMMANDS_MAPPING,
        )} commands are supported.`,
    );
  }
  return await this[EXTENSION_COMMANDS_MAPPING[command]](opts);
};

commands.shell = async function shell(opts = {}) {
  const { cmd } = opts;
  if (!util.hasValue(cmd)) {
    throw new errors.UnknownError('parameter cmd is required');
  }
  try {
    const result = await executeCommand(cmd);
    return result;
  } catch (err) {
    throw new errors.UnknownError(err.message);
  }
};

export default commands;
