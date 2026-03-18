import chalk from 'chalk';
import type { AgentRole } from '../types/task.js';

const AGENT_COLORS: Record<AgentRole, typeof chalk.blue> = {
  'test-designer': chalk.cyan,
  'yaml-orchestrator': chalk.magenta,
  'executor': chalk.yellow,
  'qa-manager': chalk.green,
  'bug-fixer': chalk.red,
};

const AGENT_LABELS: Record<AgentRole, string> = {
  'test-designer': 'TestDesigner',
  'yaml-orchestrator': 'YAMLOrchestrator',
  'executor': 'Executor',
  'qa-manager': 'QAManager',
  'bug-fixer': 'BugFixer',
};

function timestamp(): string {
  return chalk.gray(new Date().toISOString().substring(11, 19));
}

export function info(message: string): void {
  console.log(`${timestamp()} ${chalk.blue('INFO')}  ${message}`);
}

export function success(message: string): void {
  console.log(`${timestamp()} ${chalk.green('OK')}    ${message}`);
}

export function warn(message: string): void {
  console.log(`${timestamp()} ${chalk.yellow('WARN')}  ${message}`);
}

export function error(message: string): void {
  console.log(`${timestamp()} ${chalk.red('ERROR')} ${message}`);
}

export function agent(role: AgentRole, message: string): void {
  const colorFn = AGENT_COLORS[role] ?? chalk.white;
  const label = AGENT_LABELS[role] ?? role;
  console.log(`${timestamp()} ${colorFn(`[${label}]`)} ${message}`);
}

export const logger = { info, success, warn, error, agent };
