// Merges the downloaded lists with Throwlist's own observations into the published files,
// and writes the change report to report.md. Reads only local files: run `npm run fetch`
// first to download the lists.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { domainMap, loadAllowlist, loadRelays, loadSources } from '../src/config.js';
import { merge } from '../src/merge.js';
import { observationsAsSource, readObservations } from '../src/observations.js';
import { readPaidHosts } from '../src/paidhosts.js';
import { parseFakefilter, parseJsonArray, parseLines, parseSourceMap } from '../src/parse.js';
import { repoPath } from '../src/paths.js';
import { loadPsl } from '../src/psl.js';
import { readRelease, writeList, writeRelease } from '../src/publish.js';
import { buildReport } from '../src/report.js';

/** A source that shrinks by more than this share since the last release is treated as an outage. */
const MAX_DROP = 0.3;

const today = process.env.THROWLIST_DATE ?? new Date().toISOString().slice(0, 10);
const sources = loadSources();
const manifestPath = repoPath('cache', 'manifest.json');
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { sources: {} };
const last = readRelease();

/** @type {Map<string, import('../src/parse.js').SourceData>} */
const current = new Map();
/** @type {Map<string, string>} */
const failures = new Map();

/**
 * @param {import('../src/config.js').Source} source
 * @param {string} text
 */
function parse(source, text) {
  switch (source.format) {
    case 'lines': return parseLines(text);
    case 'json-array': return parseJsonArray(text);
    case 'fakefilter': return parseFakefilter(text);
    case 'source-map': return parseSourceMap(text, { select: source.select, skip: source.skip });
    default: throw new Error(`Unknown format ${source.format}`);
  }
}

for (const source of sources) {
  try {
    let data;
    if (source.format === 'observations') {
      data = observationsAsSource(readObservations());
    } else {
      const m = manifest.sources[source.id];
      if (!m) throw new Error('not downloaded; run npm run fetch');
      if (m.error) throw new Error(m.error);
      data = parse(source, readFileSync(repoPath(m.file), 'utf8'));
    }
    const before = last.source_counts[source.id];
    if (before && data.size < before * (1 - MAX_DROP)) throw new Error(`only ${data.size} entries, down from ${before}`);
    current.set(source.id, data);
  } catch (err) {
    failures.set(source.id, err instanceof Error ? err.message : String(err));
  }
}

const result = merge({
  sources,
  current,
  previous: new Map(last.domains.map(e => [e.domain, e])),
  allowlist: domainMap(loadAllowlist()),
  relays: domainMap(loadRelays()),
  psl: loadPsl(),
  today,
  paidHosts: readPaidHosts(),
});

const sourceCounts = { ...last.source_counts };
for (const [id, n] of result.counts) sourceCounts[id] = n;

writeRelease({
  generated: today,
  count: result.listed.size,
  mx_checked: last.mx_checked,
  source_counts: Object.fromEntries(sources.map(s => [s.id, sourceCounts[s.id] ?? 0])),
  domains: [...result.listed.values()],
});
writeList('allowlist.txt', domainMap(loadAllowlist()).keys());
writeList('relays.txt', domainMap(loadRelays()).keys());

const collectNotesPath = repoPath('cache', 'collect.json');
const collectNotes = existsSync(collectNotesPath) ? JSON.parse(readFileSync(collectNotesPath, 'utf8')).notes : [];
const report = buildReport({ today, result, sources, failures, collectNotes });
writeFileSync(repoPath('report.md'), report);
updateChangelog(today, result.listed.size, result.added.length, result.removed.size, last.domains.length === 0);
console.log(report);

/**
 * Adds or replaces today's entry at the top of CHANGELOG.md.
 * @param {string} date
 * @param {number} total
 * @param {number} added
 * @param {number} removed
 * @param {boolean} first
 */
function updateChangelog(date, total, added, removed, first) {
  const path = repoPath('CHANGELOG.md');
  const intro = '# Changelog\n\nEach release is tagged with its date. Counts are domains in domains.txt.';
  const parts = (existsSync(path) ? readFileSync(path, 'utf8') : intro).split(/\n(?=## )/).map(p => p.trim());
  const tag = `v${date.replaceAll('-', '.')}`;
  const n = total.toLocaleString('en-US');
  const line = first ? `${n} domains. First release.` : `${n} domains: ${added.toLocaleString('en-US')} added, ${removed.toLocaleString('en-US')} removed.`;
  const kept = parts.slice(1).filter(p => p.split('\n')[0] !== `## ${tag}`);
  writeFileSync(path, [parts[0], `## ${tag}\n\n${line}`, ...kept].join('\n\n') + '\n');
}
