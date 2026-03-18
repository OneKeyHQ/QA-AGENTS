import { v4 as uuidv4 } from 'uuid';
import type { TestResult, StepResult } from '../types/result.js';

export interface RawStepOutput {
  action?: string;
  status?: string;
  duration?: number;
  screenshot?: string;
  error?: string;
}

export interface RawTestOutput {
  status?: string;
  duration?: number;
  steps?: RawStepOutput[];
  screenshots?: string[];
  error?: { message: string; step?: number; screenshot?: string };
}

function normalizeStatus(
  status: string | undefined,
): TestResult['status'] {
  switch (status?.toLowerCase()) {
    case 'passed':
    case 'pass':
    case 'success':
      return 'passed';
    case 'failed':
    case 'fail':
    case 'failure':
      return 'failed';
    case 'error':
      return 'error';
    case 'skipped':
    case 'skip':
      return 'skipped';
    default:
      return 'error';
  }
}

function normalizeStepStatus(
  status: string | undefined,
): StepResult['status'] {
  switch (status?.toLowerCase()) {
    case 'passed':
    case 'pass':
    case 'success':
      return 'passed';
    case 'failed':
    case 'fail':
    case 'failure':
      return 'failed';
    case 'skipped':
    case 'skip':
      return 'skipped';
    default:
      return 'failed';
  }
}

export function parseResult(
  rawOutput: RawTestOutput,
  testCaseId: string,
  yamlFile: string,
  platform: string,
): TestResult {
  const now = new Date().toISOString();
  const duration = rawOutput.duration ?? 0;

  const steps: StepResult[] = (rawOutput.steps ?? []).map((step, index) => ({
    order: index + 1,
    action: step.action ?? 'unknown',
    status: normalizeStepStatus(step.status),
    duration: step.duration ?? 0,
    screenshot: step.screenshot,
    error: step.error,
  }));

  const result: TestResult = {
    id: uuidv4(),
    testCaseId,
    yamlFile,
    platform,
    status: normalizeStatus(rawOutput.status),
    startedAt: new Date(Date.now() - duration).toISOString(),
    completedAt: now,
    duration,
    steps,
    screenshots: rawOutput.screenshots ?? [],
  };

  if (rawOutput.error) {
    result.error = {
      message: rawOutput.error.message,
      step: rawOutput.error.step ?? 0,
      screenshot: rawOutput.error.screenshot,
    };
  }

  return result;
}

export function createPassedResult(
  testCaseId: string,
  yamlFile: string,
  platform: string,
  duration: number,
): TestResult {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    testCaseId,
    yamlFile,
    platform,
    status: 'passed',
    startedAt: new Date(Date.now() - duration).toISOString(),
    completedAt: now,
    duration,
    steps: [],
    screenshots: [],
  };
}

export function createFailedResult(
  testCaseId: string,
  yamlFile: string,
  platform: string,
  error: string,
  step: number,
): TestResult {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    testCaseId,
    yamlFile,
    platform,
    status: 'failed',
    startedAt: now,
    completedAt: now,
    duration: 0,
    steps: [],
    screenshots: [],
    error: {
      message: error,
      step,
    },
  };
}
