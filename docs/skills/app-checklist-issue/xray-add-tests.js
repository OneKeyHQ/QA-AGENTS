/* Xray Test Execution helper (deprecated for Cloud)
 * 使用 JQL 搜索 Test 列表，并批量挂到指定的 Test Execution。
 *
 * 环境变量（在 ~/.zshrc 中配置）：
 * - JIRA_EMAIL        Jira 登录邮箱
 * - JIRA_API_TOKEN    Jira API Token
 * - JIRA_BASE_URL     Jira 站点地址，例如 https://onekeyhq.atlassian.net
 *
 * 用法示例：
 *   node docs/skills/app-checklist-issue/xray-add-tests.js OK-51517 "issue in (123,456,789)"
 */

const axios = require('axios');

const JIRA_BASE_URL =
  process.env.JIRA_BASE_URL || 'https://onekeyhq.atlassian.net';
const JIRA_EMAIL = process.env.JIRA_EMAIL;
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN;

if (!JIRA_EMAIL || !JIRA_API_TOKEN) {
  // eslint-disable-next-line no-console
  console.error(
    'Missing JIRA_EMAIL or JIRA_API_TOKEN. Please set them in your shell environment.',
  );
  process.exit(1);
}

const authHeader = {
  Authorization:
    'Basic ' +
    Buffer.from(`${JIRA_EMAIL}:${JIRA_API_TOKEN}`).toString('base64'),
};

async function searchTestsByJql(jql) {
  // NOTE: /rest/api/3/search 已被废弃，使用新的 GET /rest/api/3/search/jql 接口
  const params = new URLSearchParams({
    jql,
    maxResults: '1000',
    fields: 'key',
  });
  const url = `${JIRA_BASE_URL}/rest/api/3/search/jql?${params.toString()}`;
  const res = await axios.get(url, {
    headers: { ...authHeader, Accept: 'application/json' },
  });
  return res.data.issues.map((issue) => issue.key);
}

async function addTestsToExecution(testExecutionKey, testKeys) {
  if (testKeys.length === 0) {
    return;
  }
  const url = `${JIRA_BASE_URL}/rest/raven/1.0/api/testexec/${testExecutionKey}/test`;
  const body = { add: testKeys };

  await axios.post(url, body, {
    headers: { ...authHeader, 'Content-Type': 'application/json' },
  });
}

async function main() {
  const [testExecutionKey, jql] = process.argv.slice(2);

  if (!testExecutionKey || !jql) {
    // eslint-disable-next-line no-console
    console.error(
      'Usage: node docs/skills/app-checklist-issue/xray-add-tests.js <TestExecutionKey> "<JQL expression>"',
    );
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`Searching tests with JQL:\n${jql}\n`);
  const testKeys = await searchTestsByJql(jql);

  // eslint-disable-next-line no-console
  console.log(`Found ${testKeys.length} tests:`, testKeys);

  if (testKeys.length === 0) {
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`Adding tests to Test Execution ${testExecutionKey} ...`);
  await addTestsToExecution(testExecutionKey, testKeys);
  // eslint-disable-next-line no-console
  console.log('Done.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.response?.data || err.message);
  process.exit(1);
});

