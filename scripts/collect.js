// Reads the domains each watched service offers, where its robots.txt and terms allow an
// automatic visit, and records them in observations.tsv. One request per service per run,
// plus its robots.txt. Services whose terms forbid automated visits are never read here.
// Set THROWLIST_ONLY to a comma-separated list of service ids to read only those.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { loadServices } from '../src/config.js';
import { looksLikeBotCheck, PoliteClient } from '../src/http.js';
import { readObservations, recordSightings, writeObservations } from '../src/observations.js';
import { repoPath } from '../src/paths.js';
import { readApi, readPage } from '../src/readers.js';

const today = process.env.THROWLIST_DATE ?? new Date().toISOString().slice(0, 10);
const client = new PoliteClient();
const notes = [];
const sightings = [];
const checked = new Set();

const only = process.env.THROWLIST_ONLY ? new Set(process.env.THROWLIST_ONLY.split(',')) : null;

for (const service of loadServices()) {
  if (service.read !== 'api' && service.read !== 'page') continue;
  if (only && !only.has(service.id)) continue;
  if (service.automated === 'forbidden' || service.status === 'dead') continue;
  if (!service.endpoint) {
    notes.push(`${service.id}: no endpoint in services.yml`);
    continue;
  }
  const res = await client.get(service.endpoint);
  if (!res.ok) {
    notes.push(`${service.id}: not read, ${res.reason}`);
    continue;
  }
  let domains = [];
  try {
    domains = service.read === 'api' ? readApi(res.text, service.json ?? '') : readPage(res.text, service.pattern ?? '', service.within);
  } catch (err) {
    notes.push(`${service.id}: answer not understood (${err instanceof Error ? err.message : err})`);
    continue;
  }
  if (domains.length === 0) {
    notes.push(looksLikeBotCheck(res.text) ? `${service.id}: not read, a bot check answered` : `${service.id}: read, but no domains found; the page may have changed`);
    continue;
  }
  checked.add(service.id);
  notes.push(`${service.id}: ${domains.length} domains`);
  for (const domain of domains) sightings.push({ domain, service: service.id, date: today, how: service.read, evidence: service.endpoint });
}

const { rows, added } = recordSightings(readObservations(), sightings);
writeObservations(rows);
notes.push(`${added.length} new domain sightings across ${new Set(added.map(a => a.service)).size} services`);

// Record when each service was last read, keeping the file's comments and layout.
const doc = parseDocument(readFileSync(repoPath('services.yml'), 'utf8'));
for (const item of /** @type {any} */ (doc.contents).items) {
  if (checked.has(item.get('id'))) item.set('checked', today);
}
writeFileSync(repoPath('services.yml'), doc.toString({ lineWidth: 0 }));

mkdirSync(repoPath('cache'), { recursive: true });
writeFileSync(repoPath('cache', 'collect.json'), JSON.stringify({ date: today, notes }, null, 2));
for (const n of notes) console.log(n);
