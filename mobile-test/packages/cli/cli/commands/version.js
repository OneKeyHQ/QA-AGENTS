const command = 'version';
const desc = 'Show version';
const builder = {};

const handler = function () {
  console.log('Version: 1.0.0'); // 或从 package.json 中读取
};

export { command, desc, builder, handler };
