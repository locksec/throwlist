import { readFileSync, writeFileSync } from 'node:fs';
import { compareDomains } from './domain.js';
import { repoPath } from './paths.js';

/**
 * One sighting of a domain on a watched service.
 * `how` is `api` or `page` for the automatic readers, or `visit` for a one-off visit a
 * maintainer recorded.
 * @typedef {{ domain: string, service: string, first_seen: string, last_seen: string, how: string, evidence: string }} Observation
 */

const COLUMNS = ['domain', 'service', 'first_seen', 'last_seen', 'how', 'evidence'];
const FILE = 'observations.tsv';

/**
 * @param {string} text
 * @returns {Observation[]}
 */
export function parseObservations(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#') || line.startsWith('domain\t')) continue;
    const cells = line.split('\t');
    if (cells.length !== COLUMNS.length) throw new Error(`observations.tsv: expected ${COLUMNS.length} columns: ${line}`);
    const [domain, service, first_seen, last_seen, how, evidence] = cells;
    rows.push({ domain, service, first_seen, last_seen, how, evidence });
  }
  return rows;
}

/**
 * @param {Observation[]} rows
 * @returns {string}
 */
export function formatObservations(rows) {
  const sorted = [...rows].sort((a, b) => compareDomains(a.domain, b.domain) || compareDomains(a.service, b.service));
  return [COLUMNS.join('\t'), ...sorted.map(r => COLUMNS.map(c => r[/** @type {keyof Observation} */ (c)]).join('\t'))].join('\n') + '\n';
}

export const readObservations = () => parseObservations(readFileSync(repoPath(FILE), 'utf8'));

/** @param {Observation[]} rows */
export const writeObservations = rows => writeFileSync(repoPath(FILE), formatObservations(rows));

/**
 * Records sightings: a new domain and service pair gets a row; a known pair has its last
 * seen date moved forward. Rows are never deleted here, since throwaway domains keep
 * working after a service stops showing them.
 * @param {Observation[]} rows
 * @param {{ domain: string, service: string, date: string, how: string, evidence: string }[]} sightings
 * @returns {{ rows: Observation[], added: Observation[] }}
 */
export function recordSightings(rows, sightings) {
  const byKey = new Map(rows.map(r => [`${r.domain}\t${r.service}`, { ...r }]));
  const added = [];
  for (const s of sightings) {
    const key = `${s.domain}\t${s.service}`;
    const row = byKey.get(key);
    if (row) {
      if (s.date > row.last_seen) row.last_seen = s.date;
      if (s.date < row.first_seen) row.first_seen = s.date;
    } else {
      const fresh = { domain: s.domain, service: s.service, first_seen: s.date, last_seen: s.date, how: s.how, evidence: s.evidence };
      byKey.set(key, fresh);
      added.push(fresh);
    }
  }
  return { rows: [...byKey.values()], added };
}

/**
 * Observations as source data for the merge: domain -> first and last sighting and the
 * services it was seen on.
 * @param {Observation[]} rows
 * @returns {import('./parse.js').SourceData}
 */
export function observationsAsSource(rows) {
  /** @type {import('./parse.js').SourceData} */
  const out = new Map();
  for (const r of rows) {
    const seen = out.get(r.domain);
    if (!seen) {
      out.set(r.domain, { first: r.first_seen, last: r.last_seen, services: [r.service] });
      continue;
    }
    if (!seen.first || r.first_seen < seen.first) seen.first = r.first_seen;
    if (!seen.last || r.last_seen > seen.last) seen.last = r.last_seen;
    seen.services = [...new Set([...(seen.services ?? []), r.service])].sort();
  }
  return out;
}
