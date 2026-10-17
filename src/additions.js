import { compareDomains } from './domain.js';
import { organizationHost } from './mx.js';
import { heldForPaidHost } from './paidhosts.js';

/**
 * Applies a mail-server check to the domains a build is about to add. Until now a new
 * domain shipped with `mx: null` and the paid-host rule (a domain whose mail goes to
 * Google Workspace, Microsoft 365 or the like stays listed only while a watching source
 * has seen it) could not apply to it before the monthly check, so such a domain could sit
 * on the list for up to a month. Checking the additions at build time closes that gap:
 * the rule applies before the domain is published, and every new entry carries an answer.
 *
 * @typedef {import('./merge.js').MergeResult} MergeResult
 * @typedef {import('./mx.js').MxResult} MxResult
 * @typedef {import('./paidhosts.js').PaidHosts} PaidHosts
 * @typedef {import('./config.js').Source} Source
 */

/**
 * Mutates `result` and `paidHosts` in place and returns the domains held back.
 * @param {MergeResult} result
 * @param {Map<string, MxResult>} mx Results for `result.added`; a domain with no entry or a null answer is left as it was.
 * @param {PaidHosts} paidHosts
 * @param {Map<string, Source>} byId
 * @param {string} today
 * @returns {string[]}
 */
export function applyMxToAdditions(result, mx, paidHosts, byId, today) {
  const held = [];
  for (const domain of result.added) {
    const r = mx.get(domain);
    const entry = result.listed.get(domain);
    if (!r || r.mx === null || !entry) continue;
    entry.mx = r.mx;
    const host = organizationHost(r.hosts);
    if (host) paidHosts.set(domain, { host, checked: today });
    else paidHosts.delete(domain);
    const named = entry.sources.map(id => byId.get(id)).filter(s => s !== undefined);
    if (heldForPaidHost(domain, named, paidHosts)) {
      result.listed.delete(domain);
      held.push(domain);
    }
  }
  if (held.length) {
    const heldSet = new Set(held);
    result.added = result.added.filter(d => !heldSet.has(d));
    result.paidHost = [...result.paidHost, ...held].sort(compareDomains);
  }
  return held.sort(compareDomains);
}
