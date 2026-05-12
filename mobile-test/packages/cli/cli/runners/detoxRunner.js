import { spawn } from 'child_process';
import logger from '../../logger.js';

export const runMobileTests = async function (config) {
  const child = spawn(
    'detox',
    ['test', '-c', 'android.emu.debug', '-C', config, '--record-logs', 'all'],
    {
      stdio: 'inherit', // 使子进程继承父进程的 stdio
    },
  );

  child.on('close', (code) => {
    logger.error(`child process exited with code ${code}`);
  });
};
