import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { compareDomains } from './domain.js';
import { repoPath } from './paths.js';

/**
 * @typedef {import('./merge.js').Entry} Entry
 * @typedef {object} Release
 * @property {string} generated
 * @property {number} count
 * @property {string | null} mx_checked
 * @property {Record<string, number>} source_counts
 * @property {Entry[]} domains
 */

const DOMAINS_JSON = 'domains.json';

/**
 * Reads the last release, or an empty one before the first.
 * @returns {Release}
 */
export function readRelease() {
  const path = repoPath(DOMAINS_JSON);
  if (!existsSync(path)) return { generated: '', count: 0, mx_checked: null, source_counts: {}, domains: [] };
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * domains.json with one domain per line, so a change to one domain is a one-line diff.
 * @param {Release} release
 */
export function formatRelease(release) {
  const head = {
    generated: release.generated,
    count: release.domains.length,
    mx_checked: release.mx_checked,
    source_counts: release.source_counts,
  };
  const lines = Object.entries(head).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  const rows = release.domains.map((e, i) => `    ${JSON.stringify(e)}${i < release.domains.length - 1 ? ',' : ''}`);
  return ['{', ...lines, '  "domains": [', ...rows, '  ]', '}', ''].join('\n');
}

/** @param {Release} release */
export function writeRelease(release) {
  writeFileSync(repoPath(DOMAINS_JSON), formatRelease(release));
  writeList('domains.txt', release.domains.map(e => e.domain));
}

/**
 * Writes a sorted list, one domain per line.
 * @param {string} file
 * @param {Iterable<string>} domains
 */
export function writeList(file, domains) {
  const sorted = [...new Set(domains)].sort(compareDomains);
  writeFileSync(repoPath(file), sorted.join('\n') + '\n');
}

/**
 * Reads a one-per-line list.
 * @param {string} file
 */
export function readList(file) {
  const path = repoPath(file);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8').split('\n').filter(Boolean);
}
