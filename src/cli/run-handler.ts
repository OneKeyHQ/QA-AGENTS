// src/cli/run-handler.ts
// CLI wrapper around test-executor + test-registry.
// Provides synchronous "run → wait → JSON output" for orchestration.

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getTestRegistry } from '../dashboard/test-registry.js';
import { startRun, onEvent, getState, type RunEvent } from '../dashboard/test-executor.js';

interface CaseResult {
  id: string;
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs?: number;
  error?: string | null;
}

interface RunOutput {
  ok: boolean;
  exitCode: number;
  summary: {
    passed: number;
    failed: number;
    skipped: number;
    total: number;
    durationMs: number;
  };
  cases: CaseResult[];
  timestamp: string;
}

/**
 * Resolve case IDs from a filter string.
 * Filters: platform (e.g. "desktop"), category (e.g. "perps"),
 * file glob (e.g. "desktop/perps/*"), or comma-separated IDs.
 */
export async function resolveIds(filter: string): Promise<string[]> {
  const registry = await getTestRegistry();

  // If filter looks like comma-separated IDs (e.g. "SEARCH-001,SEARCH-002")
  if (/^[A-Z]/.test(filter) && filter.includes('-')) {
    const ids = filter.split(',').map(s => s.trim());
    // Validate they exist in registry
    const allIds = new Set(registry.flatMap(g => g.cases.map(c => c.id)));
    const valid = ids.filter(id => allIds.has(id));
    if (valid.length === 0) {
      throw new Error(`No matching case IDs found for: ${filter}`);
    }
    return valid;
  }

  // Filter by platform, category, or file path prefix
  const lower = filter.toLowerCase();
  const matched = registry.filter(g =>
    g.platform === lower ||
    g.category.toLowerCase() === lower ||
    g.file.toLowerCase().startsWith(lower) ||
    g.group.toLowerCase() === lower
  );

  if (matched.length === 0) {
    throw new Error(`No test groups matching filter: "${filter}". Available: ${registry.map(g => g.file).join(', ')}`);
  }

  return matched.flatMap(g => g.cases.map(c => c.id));
}

/**
 * Run specific case IDs and return structured JSON output.
 */
export async function runCases(caseIds: string[], json: boolean): Promise<RunOutput> {
  const state = getState();
  if (state.running) {
    throw new Error('A test run is already in progress. Use "status --json" to check.');
  }

  const registry = await getTestRegistry();
  const startTime = Date.now();

  // Collect events
  const caseResults = new Map<string, CaseResult>();
  const caseNames = new Map<string, string>();

  // Pre-populate names from registry
  for (const group of registry) {
    for (const c of group.cases) {
      caseNames.set(c.id, c.name);
    }
  }

  for (const id of caseIds) {
    caseResults.set(id, {
      id,
      name: caseNames.get(id) ?? id,
      status: 'skipped',
      error: null,
    });
  }

  return new Promise<RunOutput>((resolve) => {
    // Suppress console.log in json mode to keep stdout clean
    const origLog = console.log;
    const origError = console.error;
    if (json) {
      console.log = () => {};
      console.error = () => {};
    }

    const unsubscribe = onEvent((event: RunEvent) => {
      if (event.id && caseResults.has(event.id)) {
        const entry = caseResults.get(event.id)!;
        if (event.event === 'start') {
          entry.status = 'skipped'; // will be overwritten
        } else if (event.event === 'pass') {
          entry.status = 'passed';
          entry.durationMs = event.duration;
        } else if (event.event === 'fail') {
          entry.status = 'failed';
          entry.durationMs = event.duration;
          entry.error = event.error ?? null;
        } else if (event.event === 'skip') {
          entry.status = 'skipped';
          entry.durationMs = event.duration;
        }
      }

      if (event.event === 'done' || event.event === 'stopped') {
        unsubscribe();
        // Restore console
        if (json) {
          console.log = origLog;
          console.error = origError;
        }

        const cases = caseIds.map(id => caseResults.get(id)!);
        const passed = cases.filter(c => c.status === 'passed').length;
        const failed = cases.filter(c => c.status === 'failed').length;
        const skipped = cases.filter(c => c.status === 'skipped').length;
        const totalDuration = Date.now() - startTime;

        const output: RunOutput = {
          ok: failed === 0,
          exitCode: failed > 0 ? 1 : 0,
          summary: { passed, failed, skipped, total: cases.length, durationMs: totalDuration },
          cases,
          timestamp: new Date().toISOString(),
        };

        resolve(output);
      }
    });

    startRun(caseIds, registry).catch((err) => {
      unsubscribe();
      if (json) {
        console.log = origLog;
        console.error = origError;
      }
      resolve({
        ok: false,
        exitCode: 1,
        summary: { passed: 0, failed: caseIds.length, skipped: 0, total: caseIds.length, durationMs: Date.now() - startTime },
        cases: caseIds.map(id => ({
          id,
          name: caseNames.get(id) ?? id,
          status: 'failed' as const,
          error: err.message,
        })),
        timestamp: new Date().toISOString(),
      });
    });
  });
}
