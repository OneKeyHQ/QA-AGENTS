import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function xmlEscape(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function writeJunit(filePath, results) {
  const tests = results.length;
  const failures = results.filter((item) => item.status === 'failed').length;
  const skipped = results.filter((item) => item.status === 'skipped').length;
  const cases = results.map((item) => {
    const attrs = `classname="${xmlEscape(item.classname || 'swap.api')}" name="${xmlEscape(item.name)}" time="${(item.ms / 1000).toFixed(3)}"`;
    if (item.status === 'skipped') {
      return `    <testcase ${attrs}><skipped message="${xmlEscape(item.reason)}"/></testcase>`;
    }
    if (item.status === 'failed') {
      return `    <testcase ${attrs}><failure message="${xmlEscape(item.reason)}">${xmlEscape(item.detail || item.reason)}</failure></testcase>`;
    }
    return `    <testcase ${attrs}/>`;
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="swap-api" tests="${tests}" failures="${failures}" skipped="${skipped}">`,
    ...cases,
    '</testsuite>',
    '',
  ].join('\n');

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, xml);
}
