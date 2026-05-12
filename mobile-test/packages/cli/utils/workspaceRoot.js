import fs from 'fs';
import path from 'path';

export const findWorkspaceRoot = (currentDir) => {
  try {
    if (currentDir === path.dirname(currentDir)) {
      throw new Error('Workspace root directory not found');
    }

    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      const packageJson = JSON.parse(
        fs.readFileSync(path.join(currentDir, 'package.json'), 'utf8'),
      );
      if (packageJson.workspaces) {
        return currentDir;
      }
    }

    return findWorkspaceRoot(path.dirname(currentDir));
  } catch (error) {
    throw error;
  }
};
