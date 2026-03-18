import { resolve } from 'node:path';
import { readJSON, writeJSON } from '../utils/file-utils.js';
import type { AgentRole } from '../types/task.js';
import type { KnowledgeEntry, KnowledgeFile } from '../types/knowledge.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');

export interface SearchOptions {
  category?: KnowledgeEntry['category'];
  platform?: string;
  keyword?: string;
}

export class KnowledgeBase {
  private data: KnowledgeFile;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolve(PROJECT_ROOT, 'shared', 'knowledge.json');
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): KnowledgeFile {
    try {
      return readJSON<KnowledgeFile>(this.filePath);
    } catch {
      return { version: '1.0.0', lastUpdated: '', entries: [] };
    }
  }

  private reload(): void {
    this.data = this.loadFromDisk();
  }

  private save(): void {
    this.data.lastUpdated = new Date().toISOString();
    writeJSON(this.filePath, this.data);
  }

  private nextId(): string {
    const maxNum = this.data.entries.reduce((max, entry) => {
      const match = entry.id.match(/^K-(\d+)$/);
      return match ? Math.max(max, parseInt(match[1], 10)) : max;
    }, 0);
    return `K-${String(maxNum + 1).padStart(3, '0')}`;
  }

  addEntry(entry: Omit<KnowledgeEntry, 'id'>): KnowledgeEntry {
    this.reload();
    const newEntry: KnowledgeEntry = {
      id: this.nextId(),
      ...entry,
    };
    this.data.entries.push(newEntry);
    this.save();
    return newEntry;
  }

  search(options: SearchOptions): KnowledgeEntry[] {
    this.reload();
    return this.data.entries.filter((entry) => {
      if (options.category && entry.category !== options.category) return false;
      if (options.platform && entry.platform !== options.platform && entry.platform !== 'all') {
        return false;
      }
      if (options.keyword) {
        const kw = options.keyword.toLowerCase();
        const inPattern = entry.pattern.toLowerCase().includes(kw);
        const inDescription = entry.description.toLowerCase().includes(kw);
        if (!inPattern && !inDescription) return false;
      }
      return true;
    });
  }

  getEntry(id: string): KnowledgeEntry | undefined {
    this.reload();
    return this.data.entries.find((e) => e.id === id);
  }

  updateConfidence(id: string, delta: number): KnowledgeEntry | undefined {
    this.reload();
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return undefined;
    entry.confidence = Math.max(0, Math.min(1, entry.confidence + delta));
    this.save();
    return entry;
  }

  incrementUsage(id: string): KnowledgeEntry | undefined {
    this.reload();
    const entry = this.data.entries.find((e) => e.id === id);
    if (!entry) return undefined;
    entry.usageCount += 1;
    entry.lastUsed = new Date().toISOString();
    this.save();
    return entry;
  }

  getTopPatterns(category: KnowledgeEntry['category'], limit: number = 10): KnowledgeEntry[] {
    this.reload();
    return this.data.entries
      .filter((e) => e.category === category)
      .sort((a, b) => b.confidence * b.usageCount - a.confidence * a.usageCount)
      .slice(0, limit);
  }
}
