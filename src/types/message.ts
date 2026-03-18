import type { AgentRole } from './task.js';

export interface AgentMessage {
  id: string;
  from: AgentRole;
  to: AgentRole;
  subject: string;
  body: string;
  data?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}

export interface MailboxFile {
  version: string;
  messages: AgentMessage[];
}
