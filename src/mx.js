import { Resolver } from 'node:dns/promises';

/** Public resolvers by default, so a local filtering resolver cannot hide a domain's mail servers. */
export const DEFAULT_SERVERS = ['1.1.1.1', '8.8.8.8', '9.9.9.9'];

/**
 * Mail hosts that real organizations pay for. A listed domain whose mail goes to one of
 * these is worth a second look: throwaway services run their own mail servers.
 * @type {[RegExp, string][]}
 */
export const ORGANIZATION_HOSTS = [
  [/(^|\.)(google|googlemail)\.com$/, 'Google Workspace'],
  [/\.mail\.protection\.outlook\.com$/, 'Microsoft 365'],
  [/(^|\.)mimecast\.com$/, 'Mimecast'],
  [/(^|\.)pphosted\.com$/, 'Proofpoint'],
  [/(^|\.)barracudanetworks\.com$/, 'Barracuda'],
  [/(^|\.)messagingengine\.com$/, 'Fastmail'],
  [/(^|\.)protonmail\.ch$/, 'Proton'],
  [/(^|\.)mail\.icloud\.com$/, 'iCloud'],
  [/(^|\.)zoho\.(com|eu|in|jp|com\.au|com\.cn)$/, 'Zoho'],
];

/**
 * @typedef {{ mx: boolean | null, hosts: string[] }} MxResult
 * `mx` is true with at least one MX record (other than a "null MX", RFC 7505), false when
 * the domain or its MX records do not exist, and null when DNS did not answer.
 */

/**
 * @param {Resolver} resolver
 * @param {string} domain
 * @returns {Promise<MxResult>}
 */
export async function lookupMx(resolver, domain) {
  try {
    const hosts = (await resolver.resolveMx(domain)).map(r => r.exchange.toLowerCase()).filter(h => h && h !== '.');
    return { mx: hosts.length > 0, hosts };
  } catch (err) {
    const code = /** @type {{ code?: string }} */ (err).code;
    return { mx: code === 'ENODATA' || code === 'ENOTFOUND' ? false : null, hosts: [] };
  }
}

/**
 * The paid mail host a domain uses, if any.
 * @param {string[]} hosts
 * @returns {string | null}
 */
export function organizationHost(hosts) {
  for (const h of hosts) for (const [re, name] of ORGANIZATION_HOSTS) if (re.test(h)) return name;
  return null;
}

/**
 * Checks many domains with a fixed number in flight.
 * @param {string[]} domains
 * @param {{ servers?: string[], concurrency?: number, onProgress?: (done: number) => void }} [options]
 * @returns {Promise<Map<string, MxResult>>}
 */
export async function checkMx(domains, { servers = DEFAULT_SERVERS, concurrency = 48, onProgress } = {}) {
  const resolver = new Resolver({ timeout: 4000, tries: 2 });
  resolver.setServers(servers);
  /** @type {Map<string, MxResult>} */
  const results = new Map();
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < domains.length) {
      const domain = domains[next++];
      results.set(domain, await lookupMx(resolver, domain));
      if (++done % 1000 === 0) onProgress?.(done);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
