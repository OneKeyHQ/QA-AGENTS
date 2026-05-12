import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const lockFilePath = path.join(__dirname, '..', 'first.lock');

export const isFirstRun = () => {
  const exited = !fs.existsSync(lockFilePath);
  console.log('isFirstRun >>>>>', exited);
  return exited;
};

export const setFirstRunComplete = () => {
  fs.writeFileSync(lockFilePath, 'first run complete');
};
export const cleanFirstRun = () => {
  if (fs.existsSync(lockFilePath)) {
    fs.unlinkSync(lockFilePath);
  }
};
