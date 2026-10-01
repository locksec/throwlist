// Checks the published files against the rules in docs/PRD.md. Runs without the network,
// on every pull request. Exits with an error listing each problem.
import { readFileSync } from 'node:fs';
import { domainMap, loadAllowlist, loadRelays, loadServices, loadSources } from '../src/config.js';
import { compareDomains, findSelfOrParent, normalize, selfAndParents } from '../src/domain.js';
import { readObservations } from '../src/observations.js';
import { heldForPaidHost, readPaidHosts } from '../src/paidhosts.js';
import { repoPath } from '../src/paths.js';
import { loadPsl } from '../src/psl.js';
import { readList, readRelease } from '../src/publish.js';

const problems = [];
/** @param {string} message */
const fail = message => problems.push(message);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const psl = loadPsl();
const sources = loadSources();
const sourceIds = new Set(sources.map(s => s.id));
const services = loadServices();
const serviceIds = new Set(services.map(s => s.id));
const allowlist = domainMap(loadAllowlist());
const relays = domainMap(loadRelays());
const release = readRelease();
const list = readList('domains.txt');

// sources.yml and services.yml
for (const s of sources) {
  for (const key of ['id', 'name', 'home', 'format', 'license', 'trust', 'family']) if (!(/** @type {any} */ (s)[key])) fail(`sources.yml: ${s.id ?? '?'} has no ${key}`);
  if (!['direct', 'second'].includes(s.trust)) fail(`sources.yml: ${s.id} trust must be direct or second`);
}
if (sourceIds.size !== sources.length) fail('sources.yml: ids must be unique');
for (const s of services) {
  if (normalize(s.id) !== s.id) fail(`services.yml: id must be the service's host: ${s.id}`);
  if (!['api', 'page', 'manual'].includes(s.read)) fail(`services.yml: ${s.id} read must be api, page or manual`);
  if ((s.read === 'api' || s.read === 'page') && !s.endpoint) fail(`services.yml: ${s.id} needs an endpoint`);
  if (s.read === 'api' && !s.json) fail(`services.yml: ${s.id} needs a json path`);
  if (s.read === 'page' && !s.pattern) fail(`services.yml: ${s.id} needs a pattern`);
  if (s.read !== 'manual' && s.automated === 'forbidden') fail(`services.yml: ${s.id} forbids automated visits, so read must be manual`);
  if (!DATE.test(String(s.checked))) fail(`services.yml: ${s.id} checked must be a date`);
}
if (serviceIds.size !== services.length) fail('services.yml: ids must be unique');

// The allowlist and relays never overlap the list, and are valid registrable domains.
for (const [file, map] of [['allowlist.yml', allowlist], ['relays.yml', relays]]) {
  for (const d of /** @type {Map<string, string>} */ (map).keys()) if (psl.isSuffix(d)) fail(`${file}: ${d} is a public suffix`);
}
for (const [file, map] of [['allowlist.txt', allowlist], ['relays.txt', relays]]) {
  const published = readList(/** @type {string} */ (file));
  const expected = [.../** @type {Map<string, string>} */ (map).keys()].sort(compareDomains);
  if (published.join('\n') !== expected.join('\n')) fail(`${file} is out of date; run npm run build`);
}

// domains.txt
const listed = new Set(list);
if (listed.size !== list.length) fail('domains.txt has duplicates');
for (let i = 1; i < list.length; i++) if (compareDomains(list[i - 1], list[i]) >= 0) { fail(`domains.txt is not sorted at ${list[i]}`); break; }
for (const d of list) {
  if (normalize(d) !== d) fail(`domains.txt: not a normalized domain: ${d}`);
  else if (!psl.knownTld(d) || psl.isSuffix(d)) fail(`domains.txt: public suffix or unknown top-level domain: ${d}`);
  const allowed = findSelfOrParent(d, allowlist);
  if (allowed) fail(`domains.txt: ${d} is allowlisted (${allowlist.get(allowed)})`);
  const relay = findSelfOrParent(d, relays);
  if (relay) fail(`domains.txt: ${d} is a relay service (${relays.get(relay)})`);
  if (selfAndParents(d).slice(1).some(p => listed.has(p))) fail(`domains.txt: ${d} is covered by a listed parent`);
}

// domains.json matches domains.txt, and every entry has evidence.
if (release.domains.map(e => e.domain).join('\n') !== list.join('\n')) fail('domains.json and domains.txt list different domains; run npm run build');
if (release.count !== release.domains.length) fail('domains.json count is wrong');
for (const e of release.domains) {
  if (e.sources.length === 0) fail(`domains.json: ${e.domain} has no source`);
  for (const id of e.sources) if (!sourceIds.has(id)) fail(`domains.json: ${e.domain} names unknown source ${id}`);
  for (const id of e.services) if (!serviceIds.has(id)) fail(`domains.json: ${e.domain} names unknown service ${id}`);
  if (!DATE.test(e.first_seen)) fail(`domains.json: ${e.domain} first_seen is not a date`);
  if (e.last_seen !== null && !DATE.test(e.last_seen)) fail(`domains.json: ${e.domain} last_seen is not a date`);
  if (![true, false, null].includes(/** @type {any} */ (e.mx))) fail(`domains.json: ${e.domain} mx must be true, false or null`);
}

// A domain whose mail goes to a paid organization host needs a sighting on a throwaway service.
const paidHosts = readPaidHosts();
const byId = new Map(sources.map(s => [s.id, s]));
for (const e of release.domains) {
  const named = e.sources.map(id => byId.get(id)).filter(s => s !== undefined);
  if (heldForPaidHost(e.domain, named, paidHosts)) fail(`domains.json: ${e.domain} uses ${paidHosts.get(e.domain)?.host} and no watching source saw it`);
}

// observations.tsv: known services, real dates, and no email addresses anywhere.
for (const o of readObservations()) {
  if (normalize(o.domain) !== o.domain) fail(`observations.tsv: not a normalized domain: ${o.domain}`);
  if (!serviceIds.has(o.service)) fail(`observations.tsv: unknown service ${o.service}`);
  if (!DATE.test(o.first_seen) || !DATE.test(o.last_seen) || o.first_seen > o.last_seen) fail(`observations.tsv: bad dates for ${o.domain} on ${o.service}`);
  if (!['api', 'page', 'visit'].includes(o.how)) fail(`observations.tsv: how must be api, page or visit: ${o.domain}`);
  if (!/^https?:\/\//.test(o.evidence)) fail(`observations.tsv: evidence must be a URL: ${o.domain}`);
}
const ADDRESS = /[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}/i;
for (const file of ['observations.tsv', 'services.yml', 'domains.json', 'domains.txt']) {
  const hit = readFileSync(repoPath(file), 'utf8').match(ADDRESS);
  if (hit) fail(`${file} contains something that looks like an email address: ${hit[0]}`);
}

if (problems.length) {
  console.error(`${problems.length} problem${problems.length === 1 ? '' : 's'}:`);
  for (const p of problems.slice(0, 200)) console.error(`- ${p}`);
  process.exit(1);
}
console.log(`OK: ${list.length.toLocaleString('en-US')} domains, ${allowlist.size} allowlisted, ${relays.size} relay domains, ${services.length} services.`);
