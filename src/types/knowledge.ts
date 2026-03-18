import type { AgentRole } from './task.js';

export interface KnowledgeEntry {
  id: string;
  category: 'locator' | 'flaky' | 'bug-pattern' | 'best-practice' | 'platform-quirk';
  platform: string;
  pattern: string;
  description: string;
  confidence: number;
  usageCount: number;
  lastUsed: string;
  createdBy: AgentRole;
}

export interface KnowledgeFile {
  version: string;
  lastUpdated: string;
  entries: KnowledgeEntry[];
}
