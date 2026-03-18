export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type AgentRole = 'test-designer' | 'yaml-orchestrator' | 'executor' | 'qa-manager' | 'bug-fixer';

export interface Task {
  id: string;
  title: string;
  description: string;
  type: 'design' | 'convert' | 'execute' | 'diagnose' | 'fix' | 'retest';
  status: TaskStatus;
  priority: TaskPriority;
  assignee: AgentRole | null;
  dependencies: string[];
  input: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface TaskBoard {
  version: string;
  lastUpdated: string;
  tasks: Task[];
}
