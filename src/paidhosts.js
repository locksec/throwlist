import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { compareDomains } from './domain.js';
import { repoPath } from './paths.js';

/**
 * Domains whose mail, at the last MX check, went to a host real organizations pay for
 * (Google Workspace, Microsoft 365 and the like). Kept apart from domains.json because it
 * also remembers domains this rule holds back, which domains.json no longer lists.
 * @typedef {Map<string, { host: string, checked: string }>} PaidHosts
 */

const FILE = ['data', 'paid_mail_hosts.tsv'];
const HEADER = 'domain\thost\tchecked';

/** @returns {PaidHosts} */
export function readPaidHosts() {
  const path = repoPath(...FILE);
  /** @type {PaidHosts} */
  const out = new Map();
  if (!existsSync(path)) return out;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (!line || line === HEADER) continue;
    const [domain, host, checked] = line.split('\t');
    out.set(domain, { host, checked });
  }
  return out;
}

/** @param {PaidHosts} hosts */
export function writePaidHosts(hosts) {
  const rows = [...hosts].sort(([a], [b]) => compareDomains(a, b)).map(([d, h]) => `${d}\t${h.host}\t${h.checked}`);
  writeFileSync(repoPath(...FILE), [HEADER, ...rows].join('\n') + '\n');
}

/**
 * Whether a domain is held back because its mail goes to a paid organization host and no
 * watching source has seen it on a throwaway service. Throwaway domains that change hands
 * often end up with a real business or a person's own mail; a recent sighting is the only
 * evidence that still points the other way.
 * @param {string} domain
 * @param {import('./config.js').Source[]} named The sources that name the domain.
 * @param {PaidHosts} paidHosts
 */
export const heldForPaidHost = (domain, named, paidHosts) => paidHosts.has(domain) && !named.some(s => s.observed);
