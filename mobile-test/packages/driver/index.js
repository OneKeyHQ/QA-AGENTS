import OneKeyTouchDriver from './lib/driver';
import { startServer } from './lib/server';

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 5898;

async function main() {
  const getArgValue = (argName) => {
    const argIndex = process.argv.indexOf(argName);
    return argIndex > 0 ? process.argv[argIndex + 1] : null;
  };
  const port = parseInt(getArgValue('--port'), 10) || DEFAULT_PORT;
  const host = getArgValue('--host') || DEFAULT_HOST;
  return await startServer(port, host);
}

export default OneKeyTouchDriver;
export { OneKeyTouchDriver, startServer, main };
