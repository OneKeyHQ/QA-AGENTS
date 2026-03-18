export interface StepResult {
  order: number;
  action: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  screenshot?: string;
  error?: string;
}

export interface Diagnosis {
  category: 'bug' | 'flaky' | 'environment' | 'test-issue';
  rootCause: string;
  suggestion: string;
  confidence: number;
  relatedKnowledge: string[];
}

export interface TestResult {
  id: string;
  testCaseId: string;
  yamlFile: string;
  platform: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  startedAt: string;
  completedAt: string;
  duration: number;
  steps: StepResult[];
  screenshots: string[];
  error?: { message: string; step: number; screenshot?: string };
  diagnosis?: Diagnosis;
}
