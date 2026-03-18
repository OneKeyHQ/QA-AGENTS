import { readFileSync } from 'node:fs';
import type { BDDScenario } from '../types/testcase.js';

type BDDKeyword = 'given' | 'when' | 'then';

export function parseBDDFile(filePath: string): BDDScenario[] {
  const content = readFileSync(filePath, 'utf-8');
  return parseBDDContent(content);
}

export function parseBDDContent(content: string): BDDScenario[] {
  const lines = content.split('\n').map((line) => line.trim());
  const scenarios: BDDScenario[] = [];

  let currentFeature = '';
  let currentFeatureDescription = '';
  let currentTags: string[] = [];
  let featureTags: string[] = [];
  let currentScenario: BDDScenario | null = null;
  let lastKeyword: BDDKeyword | null = null;
  let pendingTags: string[] = [];

  for (const line of lines) {
    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    // Parse tags
    if (line.startsWith('@')) {
      const tags = line
        .split(/\s+/)
        .filter((t) => t.startsWith('@'))
        .map((t) => t.substring(1));
      pendingTags.push(...tags);
      continue;
    }

    // Parse Feature
    if (line.startsWith('Feature:')) {
      currentFeature = line.substring('Feature:'.length).trim();
      featureTags = [...pendingTags];
      pendingTags = [];
      currentFeatureDescription = '';
      continue;
    }

    // Parse feature description lines (indented lines before first Scenario)
    if (
      currentFeature &&
      !currentScenario &&
      !line.startsWith('Scenario:') &&
      !line.startsWith('Scenario Outline:') &&
      !line.startsWith('@')
    ) {
      if (currentFeatureDescription) {
        currentFeatureDescription += '\n' + line;
      } else {
        currentFeatureDescription = line;
      }
      continue;
    }

    // Parse Scenario
    if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
      // Save previous scenario if exists
      if (currentScenario) {
        scenarios.push(currentScenario);
      }

      const scenarioName = line.startsWith('Scenario Outline:')
        ? line.substring('Scenario Outline:'.length).trim()
        : line.substring('Scenario:'.length).trim();

      currentTags = [...featureTags, ...pendingTags];
      pendingTags = [];
      lastKeyword = null;

      currentScenario = {
        feature: currentFeature,
        featureDescription: currentFeatureDescription,
        scenario: scenarioName,
        tags: currentTags,
        given: [],
        when: [],
        then: [],
      };
      continue;
    }

    if (!currentScenario) continue;

    // Parse Given / When / Then / And
    if (line.startsWith('Given ')) {
      lastKeyword = 'given';
      currentScenario.given.push(line.substring('Given '.length).trim());
    } else if (line.startsWith('When ')) {
      lastKeyword = 'when';
      currentScenario.when.push(line.substring('When '.length).trim());
    } else if (line.startsWith('Then ')) {
      lastKeyword = 'then';
      currentScenario.then.push(line.substring('Then '.length).trim());
    } else if (line.startsWith('And ')) {
      const text = line.substring('And '.length).trim();
      if (lastKeyword && currentScenario) {
        currentScenario[lastKeyword].push(text);
      }
    } else if (line.startsWith('But ')) {
      const text = line.substring('But '.length).trim();
      if (lastKeyword && currentScenario) {
        currentScenario[lastKeyword].push(text);
      }
    }
  }

  // Push the last scenario
  if (currentScenario) {
    scenarios.push(currentScenario);
  }

  return scenarios;
}
