import http from 'http';
import https from 'https';
import path from 'path';
import fs from 'fs';

import ejs from 'ejs';
import { api } from '@node-e2e/cli/api/index.js';
let RRWeb_EVENTS = [];
const templateString = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RRWeb Playback</title>
    <!-- 引入rrweb播放器的样式文件 -->
    <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/style.css"
  />
  <script src="https://cdn.jsdelivr.net/npm/rrweb-player@latest/dist/index.js"></script>
</head>
<body>
    <div id="rrweb-container" style="display: flex;height: 100vh;width: 100vw;justify-content: center;align-items: center;"></div>
    <!-- 引入rrweb播放器的脚本 -->
    <script>
        // 从模板传入的events变量包含了事件数据
        const events = <%- events %>;
        // 使用rrweb的replay功能回放这些事件
        new rrwebPlayer({
          target: document.querySelector('#rrweb-container'), // customizable root element
          props: {
            events,
          },
        });
    </script>
</body>
</html>
`;

class RRWebHttpService {
  server;

  constructor() {
    this.server = http.createServer((req, res) => {
      // 设置允许跨域的头信息

      // res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000'); // 允许所有来源的跨域请求，你也可以指定特定的来源，例如 'http://localhost:3000'
      res.setHeader('Access-Control-Allow-Origin', '*'); // 允许所有来源的跨域请求，你也可以指定特定的来源，例如 'http://localhost:3000'
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept'); // 允许的请求头
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST', 'OPTIONS'); // 允许的请求方法
      if (req.method === 'POST' && req.url === '/events') {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          const { testCaseName, events } = JSON.parse(body);
          RRWeb_EVENTS.push(events);
          res.writeHead(200);
          res.end('Events stored successfully');
        });
      } else if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
  }

  async beforeSuite(suite) {
    // 下载 rrweb-record.min.js 文件到本地目录
    await api.platformChain.ext().run(async () => {
      const localPath = path.join(
        process.env.LOAD_EXTENSION,
        'rrweb-record.min.js',
      );
      if (!fs.existsSync(localPath)) {
        // 如果 localPath 路径不存在,则下载 rrweb-record.min.js 文件到该路径
        await downloadRRWebRecordFile(
          'https://cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js',
          localPath,
        );
      }
    });

    return new Promise((resolve, reject) => {
      this.server.listen(3399, () => {
        console.log('HTTP server running on port 3399');
        resolve();
      });
      this.server.on('error', err => {
        console.error('HTTP server error:', err);
        reject(err);
      });
    });
  }

  async afterSuite(suite) {
    return new Promise((resolve, reject) => {
      this.server.close(err => {
        if (err) {
          console.error('Error closing HTTP server:', err);
          reject(err);
          return;
        }
        console.log('HTTP server closed');
        resolve();
      });
    });
  }

  async beforeTest(test, context) {
    await browser.execute(
      (testCaseName, platform) => {
        const script = document.createElement('script');
        script.src =
          platform === 'ext'
            ? chrome.runtime.getURL('/rrweb-record.min.js')
            : 'https://cdn.jsdelivr.net/npm/rrweb@latest/dist/record/rrweb-record.min.js';
        script.async = true; // 确保脚本异步加载
        script.crossorigin = 'anonymous';
        script.onload = () => {
          window.rrwebRecord({
            // TODO: 不使用节流会导致不停发送 events，页面崩溃，打开 settingpage 失败。待处理。
            emit(event) {
              _.throttle(
                fetch('http://localhost:3399/events', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ testCaseName, events: event }),
                }), 10 * 1000
              )
            },
          });
        };
        document.head.appendChild(script);
      },
      test.title,
      api.platformChain.current(),
    );
  }
  async afterTest(test, context, { error, result, duration, passed, retries }) {
    const html = await generateRRWebPlaybackHTML(test.title);
    api.reporter.addAttachment('recordedRRWeb', html, 'text/html');
    RRWeb_EVENTS = [];
  }
}
const downloadRRWebRecordFile = (url, localPath) => {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    https
      .get(url, response => {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      })
      .on('error', error => {
        fs.unlink(localPath, () => {
          reject(error);
        });
      });
  });
};

export const generateRRWebPlaybackHTML = async testCaseName => {
  let htmlContent = '';

  try {
    htmlContent = ejs.render(templateString, {
      events: JSON.stringify(RRWeb_EVENTS),
    });
  } catch (error) {
    console.error(error.message);
  }
  return htmlContent;
};

export default RRWebHttpService;
