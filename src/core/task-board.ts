import { resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { readJSON, writeJSON } from '../utils/file-utils.js';
import type {
  Task,
  TaskBoard as TaskBoardData,
  TaskStatus,
  TaskPriority,
  AgentRole,
} from '../types/task.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');

export interface CreateTaskOptions {
  title: string;
  description: string;
  type: Task['type'];
  priority?: TaskPriority;
  assignee?: AgentRole | null;
  dependencies?: string[];
  input?: Record<string, unknown>;
}

export class TaskBoard {
  private data: TaskBoardData;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolve(PROJECT_ROOT, 'shared', 'tasks.json');
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): TaskBoardData {
    try {
      return readJSON<TaskBoardData>(this.filePath);
    } catch {
      return { version: '1.0.0', lastUpdated: '', tasks: [] };
    }
  }

  reload(): void {
    this.data = this.loadFromDisk();
  }

  save(): void {
    this.data.lastUpdated = new Date().toISOString();
    writeJSON(this.filePath, this.data);
  }

  createTask(opts: CreateTaskOptions): Task {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuidv4(),
      title: opts.title,
      description: opts.description,
      type: opts.type,
      status: 'pending',
      priority: opts.priority ?? 'medium',
      assignee: opts.assignee ?? null,
      dependencies: opts.dependencies ?? [],
      input: opts.input ?? {},
      result: null,
      error: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };
    this.data.tasks.push(task);
    this.save();
    return task;
  }

  getTask(id: string): Task | undefined {
    return this.data.tasks.find((t) => t.id === id);
  }

  getTasksByAssignee(role: AgentRole): Task[] {
    return this.data.tasks.filter((t) => t.assignee === role);
  }

  getTasksByStatus(status: TaskStatus): Task[] {
    return this.data.tasks.filter((t) => t.status === status);
  }

  getReadyTasks(): Task[] {
    return this.data.tasks.filter((task) => {
      if (task.status !== 'pending') return false;
      return task.dependencies.every((depId) => {
        const dep = this.data.tasks.find((t) => t.id === depId);
        return dep?.status === 'completed';
      });
    });
  }

  claimTask(id: string, assignee: AgentRole): Task | undefined {
    const task = this.getTask(id);
    if (!task) return undefined;
    task.status = 'in_progress';
    task.assignee = assignee;
    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }

  completeTask(id: string, result: Record<string, unknown>): Task | undefined {
    const task = this.getTask(id);
    if (!task) return undefined;
    const now = new Date().toISOString();
    task.status = 'completed';
    task.result = result;
    task.updatedAt = now;
    task.completedAt = now;
    this.save();
    return task;
  }

  failTask(id: string, error: string): Task | undefined {
    const task = this.getTask(id);
    if (!task) return undefined;
    task.status = 'failed';
    task.error = error;
    task.updatedAt = new Date().toISOString();
    this.save();
    return task;
  }

  getAllTasks(): Task[] {
    return [...this.data.tasks];
  }

  getVersion(): string {
    return this.data.version;
  }
}
