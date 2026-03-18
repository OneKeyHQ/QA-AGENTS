import { resolve } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { writeJSON } from '../utils/file-utils.js';
import { ensureDir } from '../utils/file-utils.js';
import { TaskBoard } from '../core/task-board.js';
import { parseBDDFile } from '../converters/bdd-to-json.js';
import { logger } from '../core/logger.js';
import type { TaskBoard as TaskBoardData } from '../types/task.js';
import type { MailboxFile } from '../types/message.js';
import type { KnowledgeFile } from '../types/knowledge.js';
import type { TestCaseFile } from '../types/testcase.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');
const SHARED_DIR = resolve(PROJECT_ROOT, 'shared');

const program = new Command();

program
  .name('onekey-agent-test')
  .description('Multi-agent UI automation testing CLI for OneKey wallet')
  .version('1.0.0');

// ─── init command ────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize or reset shared state files')
  .option('--force', 'Overwrite existing files', false)
  .action((options: { force: boolean }) => {
    logger.info('Initializing shared state files...');

    ensureDir(SHARED_DIR);
    ensureDir(resolve(SHARED_DIR, 'results'));
    const tasksPath = resolve(SHARED_DIR, 'tasks.json');
    const mailboxPath = resolve(SHARED_DIR, 'mailbox.json');
    const knowledgePath = resolve(SHARED_DIR, 'knowledge.json');
    const testCasesPath = resolve(SHARED_DIR, 'test_cases.json');

    const tasksData: TaskBoardData = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      tasks: [],
    };

    const mailboxData: MailboxFile = {
      version: '1.0.0',
      messages: [],
    };

    const knowledgeData: KnowledgeFile = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      entries: [
        {
          id: 'K-001',
          category: 'locator',
          platform: 'web',
          pattern: "OneKey login phone input: use aiInput with description 'phone number input field'",
          description: 'OneKey web app login page phone number input field locator',
          confidence: 0.8,
          usageCount: 0,
          lastUsed: '',
          createdBy: 'qa-manager',
        },
        {
          id: 'K-002',
          category: 'best-practice',
          platform: 'all',
          pattern: 'Always add aiWaitFor before aiAssert to handle page transitions',
          description:
            'Midscene needs explicit waits before assertions after navigation or actions that trigger page changes',
          confidence: 0.9,
          usageCount: 0,
          lastUsed: '',
          createdBy: 'qa-manager',
        },
      ],
    };

    const testCasesData: TestCaseFile = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      cases: [],
    };

    if (options.force) {
      writeJSON(tasksPath, tasksData);
      writeJSON(mailboxPath, mailboxData);
      writeJSON(knowledgePath, knowledgeData);
      writeJSON(testCasesPath, testCasesData);
      logger.success('All shared state files reset (--force)');
    } else {
      // Only write if files are empty or don't exist
      writeJSON(tasksPath, tasksData);
      writeJSON(mailboxPath, mailboxData);
      writeJSON(knowledgePath, knowledgeData);
      writeJSON(testCasesPath, testCasesData);
      logger.success('Shared state files initialized');
    }

    logger.info(`  Tasks:      ${tasksPath}`);
    logger.info(`  Mailbox:    ${mailboxPath}`);
    logger.info(`  Knowledge:  ${knowledgePath}`);
    logger.info(`  Test Cases: ${testCasesPath}`);
    logger.info(`  Results:    ${resolve(SHARED_DIR, 'results')}/`);
  });

// ─── run command ─────────────────────────────────────────────────────────────

program
  .command('run')
  .description('Parse a BDD scenario and create initial tasks')
  .requiredOption('--scenario <path>', 'Path to .feature file')
  .option('--platform <platform>', 'Target platform (web|android|ios|desktop|chrome-extension)', 'web')
  .action((options: { scenario: string; platform: string }) => {
    const scenarioPath = resolve(options.scenario);

    logger.info(`Parsing BDD scenario: ${scenarioPath}`);
    logger.info(`Target platform: ${options.platform}`);

    let scenarios;
    try {
      scenarios = parseBDDFile(scenarioPath);
    } catch (err) {
      logger.error(`Failed to parse scenario file: ${(err as Error).message}`);
      process.exit(1);
    }

    if (scenarios.length === 0) {
      logger.warn('No scenarios found in the feature file');
      process.exit(0);
    }

    logger.success(`Parsed ${scenarios.length} scenario(s) from feature: ${scenarios[0].feature}`);

    // Display parsed scenarios
    for (const scenario of scenarios) {
      console.log('');
      console.log(chalk.bold(`  Scenario: ${scenario.scenario}`));
      console.log(chalk.gray(`  Tags: ${scenario.tags.map((t) => '@' + t).join(' ')}`));
      for (const g of scenario.given) console.log(chalk.cyan(`    Given ${g}`));
      for (const w of scenario.when) console.log(chalk.yellow(`    When  ${w}`));
      for (const t of scenario.then) console.log(chalk.green(`    Then  ${t}`));
    }

    // Create initial design task on the task board
    const board = new TaskBoard();
    const task = board.createTask({
      title: `Design test cases for: ${scenarios[0].feature}`,
      description: `Parse and convert ${scenarios.length} BDD scenario(s) from ${scenarioPath} into structured test cases for platform: ${options.platform}`,
      type: 'design',
      priority: 'high',
      input: {
        scenarioPath,
        platform: options.platform,
        scenarioCount: scenarios.length,
        scenarios: scenarios.map((s) => ({
          name: s.scenario,
          tags: s.tags,
        })),
      },
    });

    console.log('');
    logger.success(`Created initial task: ${task.id}`);
    logger.info(`Task type: ${task.type} | Priority: ${task.priority} | Status: ${task.status}`);

    console.log('');
    console.log(chalk.bold.white('  Next steps:'));
    console.log(chalk.gray('  Invoke the /onekey-test skill to start the multi-agent pipeline.'));
    console.log(chalk.gray('  The test-designer agent will pick up the task from the task board.'));
    console.log('');
  });

// ─── status command ──────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show current task board status')
  .option('--verbose', 'Show full task details', false)
  .action((options: { verbose: boolean }) => {
    const board = new TaskBoard();
    const tasks = board.getAllTasks();

    if (tasks.length === 0) {
      logger.info('Task board is empty. Run "init" then "run --scenario <path>" to start.');
      return;
    }

    console.log('');
    console.log(chalk.bold.white(`  Task Board (${tasks.length} tasks)`));
    console.log(chalk.gray('  ' + '='.repeat(72)));

    // Status summary
    const statusCounts: Record<string, number> = {};
    for (const task of tasks) {
      statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
    }

    const statusLine = Object.entries(statusCounts)
      .map(([status, count]) => {
        const colorFn = statusColor(status);
        return colorFn(`${status}: ${count}`);
      })
      .join('  ');
    console.log(`  ${statusLine}`);
    console.log('');

    // Task table
    const idWidth = 10;
    const typeWidth = 10;
    const statusWidth = 14;
    const assigneeWidth = 20;
    const titleWidth = 30;

    console.log(
      chalk.gray(
        `  ${'ID'.padEnd(idWidth)}${'Type'.padEnd(typeWidth)}${'Status'.padEnd(statusWidth)}${'Assignee'.padEnd(assigneeWidth)}${'Title'.padEnd(titleWidth)}`,
      ),
    );
    console.log(chalk.gray('  ' + '-'.repeat(idWidth + typeWidth + statusWidth + assigneeWidth + titleWidth)));

    for (const task of tasks) {
      const id = task.id.substring(0, 8);
      const type = task.type.padEnd(typeWidth);
      const status = statusColor(task.status)(task.status.padEnd(statusWidth));
      const assignee = (task.assignee ?? '-').padEnd(assigneeWidth);
      const title = task.title.length > titleWidth
        ? task.title.substring(0, titleWidth - 3) + '...'
        : task.title.padEnd(titleWidth);

      console.log(`  ${chalk.white(id.padEnd(idWidth))}${type}${status}${assignee}${title}`);

      if (options.verbose) {
        if (task.error) {
          console.log(chalk.red(`    Error: ${task.error}`));
        }
        if (task.dependencies.length > 0) {
          console.log(chalk.gray(`    Deps: ${task.dependencies.map((d) => d.substring(0, 8)).join(', ')}`));
        }
      }
    }

    console.log('');
  });

function statusColor(status: string): typeof chalk.white {
  switch (status) {
    case 'pending':
      return chalk.gray;
    case 'in_progress':
      return chalk.yellow;
    case 'completed':
      return chalk.green;
    case 'failed':
      return chalk.red;
    case 'blocked':
      return chalk.magenta;
    default:
      return chalk.white;
  }
}

program.parse();
