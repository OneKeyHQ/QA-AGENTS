export interface BDDScenario {
  feature: string;
  featureDescription: string;
  scenario: string;
  tags: string[];
  given: string[];
  when: string[];
  then: string[];
}

export type Platform = 'web' | 'android' | 'ios' | 'desktop' | 'chrome-extension';
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

export interface TestStep {
  order: number;
  action: 'navigate' | 'tap' | 'input' | 'assert' | 'wait' | 'scroll' | 'query';
  target: string;
  value?: string;
  timeout?: number;
  assertion?: string;
}

export interface TestCase {
  id: string;
  scenarioId: string;
  title: string;
  platform: Platform;
  priority: Priority;
  preconditions: string[];
  steps: TestStep[];
  expected: string[];
  tags: string[];
}

export interface TestCaseFile {
  version: string;
  lastUpdated: string;
  cases: TestCase[];
}
