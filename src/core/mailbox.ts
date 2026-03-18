import { resolve } from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import { readJSON, writeJSON } from '../utils/file-utils.js';
import type { AgentRole } from '../types/task.js';
import type { AgentMessage, MailboxFile } from '../types/message.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..', '..');

export class Mailbox {
  private data: MailboxFile;
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? resolve(PROJECT_ROOT, 'shared', 'mailbox.json');
    this.data = this.loadFromDisk();
  }

  private loadFromDisk(): MailboxFile {
    try {
      return readJSON<MailboxFile>(this.filePath);
    } catch {
      return { version: '1.0.0', messages: [] };
    }
  }

  private reload(): void {
    this.data = this.loadFromDisk();
  }

  private save(): void {
    writeJSON(this.filePath, this.data);
  }

  send(
    from: AgentRole,
    to: AgentRole,
    subject: string,
    body: string,
    data?: Record<string, unknown>,
  ): AgentMessage {
    this.reload();
    const message: AgentMessage = {
      id: uuidv4(),
      from,
      to,
      subject,
      body,
      data,
      timestamp: new Date().toISOString(),
      read: false,
    };
    this.data.messages.push(message);
    this.save();
    return message;
  }

  getUnread(recipient: AgentRole): AgentMessage[] {
    this.reload();
    return this.data.messages.filter(
      (m) => m.to === recipient && !m.read,
    );
  }

  markRead(messageId: string): boolean {
    this.reload();
    const message = this.data.messages.find((m) => m.id === messageId);
    if (!message) return false;
    message.read = true;
    this.save();
    return true;
  }

  getAll(recipient: AgentRole): AgentMessage[] {
    this.reload();
    return this.data.messages.filter((m) => m.to === recipient);
  }
}
