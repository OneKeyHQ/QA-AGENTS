import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';
import prettier from 'prettier';

import { NextRequest, NextResponse } from 'next/server';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function POST(req, res) {
  const { nodes } = await req.json();

  const newNodes = nodes.filter(node => node.isNew);

  try {
    newNodes.forEach(async node => {
      if (node.step && node.code) {
        await writeStepFile(node);
      }
      if (node.e2e) {
        writeE2EFile(node);
      }
    });
    return NextResponse.json({ status: 'success' });
  } catch (error) {
    // 处理外层错误
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function writeStepFile(node) {
  const filePath = getFilePath(node.id, '../../stories', 'step.js');
  const content = await getStepFileContent(node);
  writeFile(filePath, content);
}

function writeE2EFile(node) {
  const filePath = getFilePath(node.id, '../../test', 'e2e.js');
  const content = getE2EFileContent(node);
  writeFile(filePath, content);
}

function getFilePath(id, baseDir, extension) {
  const parts = id.split('.');
  const dir =
    parts.length > 1 ? path.join(baseDir, parts[0]) : path.join(baseDir, id);
  return path.join(dir, `${id}.${extension}`);
}

async function getStepFileContent(node) {
  const templatePath = path.join(__dirname, '../../../ejs/step.ejs');
  let str = await ejs.renderFile(templatePath, node, { async: true });
  str = prettier.format(str, { parser: 'babel' });
  return str;
}

function getE2EFileContent(node) {
  return `
describe(\`test ${node.id} - ${node.desc}\`, () => {
  it(\`${node.id} story\`, async () => {
    await play(\`${node.id}\`, {}, (context) => {
      //console.log('最终的上下文:', context);
    });
  });
});
  `;
}

function writeFile(filePath, content) {
  ensureDirectoryExistence(filePath);
  fs.writeFileSync(filePath, content);
}

function ensureDirectoryExistence(filePath) {
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
