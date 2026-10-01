// Checks whether each listed domain still has mail servers (MX records) and records the
// answer in domains.json. A domain with none is marked, never removed. When DNS gives no
// answer, the previous result is kept.
//
// It also records which domains send their mail to a host real organizations pay for
// (Google Workspace, Microsoft 365 and the like) in data/paid_mail_hosts.tsv. Such a
// domain stays listed only while a watching source has seen it on a throwaway service;
// the rest are held back here and in every later build. The summary goes to mx-report.md.
//
// Set THROWLIST_DNS to a comma-separated list of resolvers to use other servers.
import { writeFileSync } from 'node:fs';
import { loadSources } from '../src/config.js';
import { checkMx, DEFAULT_SERVERS, organizationHost } from '../src/mx.js';
import { heldForPaidHost, readPaidHosts, writePaidHosts } from '../src/paidhosts.js';
import { repoPath } from '../src/paths.js';
import { readRelease, writeRelease } from '../src/publish.js';

const today = process.env.THROWLIST_DATE ?? new Date().toISOString().slice(0, 10);
const servers = process.env.THROWLIST_DNS ? process.env.THROWLIST_DNS.split(',') : DEFAULT_SERVERS;
const byId = new Map(loadSources().map(s => [s.id, s]));
const release = readRelease();
const paidHosts = readPaidHosts();
const domains = [...new Set([...release.domains.map(e => e.domain), ...paidHosts.keys()])];

console.log(`Checking MX records for ${domains.length.toLocaleString('en-US')} domains via ${servers.join(', ')}`);
const started = Date.now();
const results = await checkMx(domains, { servers, onProgress: n => console.log(`  ${n.toLocaleString('en-US')} done`) });

for (const [domain, r] of results) {
  if (r.mx === null) continue;
  const host = organizationHost(r.hosts);
  if (host) paidHosts.set(domain, { host, checked: today });
  else paidHosts.delete(domain);
}

const tally = { yes: 0, no: 0, unanswered: 0 };
const held = [];
const kept = [];
release.domains = release.domains.filter(entry => {
  const r = results.get(entry.domain);
  if (!r || r.mx === null) tally.unanswered++;
  else {
    entry.mx = r.mx;
    tally[r.mx ? 'yes' : 'no']++;
  }
  const named = entry.sources.map(id => byId.get(id)).filter(s => s !== undefined);
  if (heldForPaidHost(entry.domain, named, paidHosts)) {
    held.push(entry);
    return false;
  }
  if (paidHosts.has(entry.domain)) kept.push(entry);
  return true;
});
release.mx_checked = today;
writeRelease(release);
writePaidHosts(paidHosts);

/** @param {import('../src/merge.js').Entry} e */
const line = e => `- \`${e.domain}\`: ${paidHosts.get(e.domain)?.host}. Sources: ${e.sources.join(', ')}.`;
const summary = `With mail servers: ${tally.yes.toLocaleString('en-US')}. Without: ${tally.no.toLocaleString('en-US')}. No answer (previous result kept): ${tally.unanswered.toLocaleString('en-US')}.`;
const report = [
  `# MX check, ${today}`,
  '',
  summary,
  '',
  `## Held back (${held.length})`,
  '',
  'Their mail now goes to Google Workspace, Microsoft 365 or a similar paid host, and no watching source has seen a throwaway service hand them out. They most likely changed hands.',
  '',
  ...held.map(line),
  '',
  `## Still listed with a paid mail host (${kept.length})`,
  '',
  'A watching source saw a throwaway service hand these out, so they stay. Some throwaway services do use paid hosts.',
  '',
  ...kept.map(line),
  '',
].join('\n');
writeFileSync(repoPath('mx-report.md'), report);
console.log(`${summary} Took ${Math.round((Date.now() - started) / 1000)}s.`);
console.log(`Held back ${held.length} domains with a paid mail host and no sighting; ${kept.length} with a sighting stay listed. See mx-report.md.`);
