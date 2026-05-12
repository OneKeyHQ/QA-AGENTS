const command = 'web';
const desc = 'Run web tests';

const builder = {
  port: {
    describe: 'Specify port',
    type: 'number',
  },
};

const handler = function (argv) {
  // 在这里处理 "node-e2e web" 命令的逻辑
  console.log(`Running web tests on port ${argv.port || 3000}`);
};

export { command, desc, builder, handler };
