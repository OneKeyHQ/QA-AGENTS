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

export interface DeepSearchConfig {
  enabled?: boolean;
  search_text?: string;
  search_role?: string;
  search_scope?: string;
}

export type CompiledLocatorSource = 'ui-semantic-map' | 'ui-map' | 'app-monorepo-testid-index';

export interface CompiledLocator {
  source: CompiledLocatorSource;
  primary: string;
  quick_fallbacks?: string[];
  deep_search?: DeepSearchConfig | null;
  semantic_key?: string | null;
  ui_element?: string | null;
  raw_testid?: string | null;
  source_testid?: string | null;
  page?: string | null;
  feature?: string[];
  platform?: Platform[] | string[];
  files?: string[];
  feature_hints?: string[];
  occurrences?: number;
  tier_stats?: Record<string, number> | null;
}

export type StepResolutionStrategy = 'semantic' | 'legacy-ui-map' | 'app-testid-index' | 'unresolved';

export interface StepResolution {
  strategy: StepResolutionStrategy;
  semantic_element?: string | null;
  ui_element?: string | null;
  raw_testid?: string | null;
}

export interface TestStep {
  order: number;
  action: string;
  ui_element?: string;
  semantic_element?: string | null;
  raw_testid?: string | null;
  description?: string;
  target?: string;
  param?: string;
  value?: string;
  text?: string;
  raw_text?: string;
  timeout?: number;
  assertion?: string;
  assertions?: string[];
  resolution?: StepResolution;
  compiled_locator?: CompiledLocator | null;
}

export interface TestStrategy {
  label: string;
  sender: string;
  recipient: string;
  amount?: string;
  memo?: string | null;
}

export interface TestCase {
  id: string;
  scenarioId: string;
  title: string;
  platform: Platform;
  priority: Priority;
  preconditions: string[];
  data?: Record<string, unknown>;
  strategies?: TestStrategy[];
  on_all_failed?: 'skip' | 'fail' | 'report';
  steps: TestStep[];
  expected: string[];
  tags: string[];
}

export interface TestCaseFile {
  version: string;
  lastUpdated: string;
  feature?: string;
  wallet?: string;
  accounts?: Record<string, unknown>;
  verifyDepth?: string;
  _migrated_note?: string;
  cases: TestCase[];
}
