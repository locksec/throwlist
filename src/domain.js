import { domainToASCII } from 'node:url';

const LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;

/**
 * Turns a raw entry from any source into a lowercase ASCII domain, or null when it is not
 * a valid domain. Strips a leading `*.`, `.` or `@` and a trailing dot.
 * @param {string} raw
 * @returns {string | null}
 */
export function normalize(raw) {
  let s = String(raw).trim().toLowerCase();
  s = s.replace(/^(\*\.|\.|@)/, '').replace(/\.$/, '');
  if (!s || /[\s/:@]/.test(s)) return null;
  const ascii = domainToASCII(s);
  if (!ascii || ascii.length > 253) return null;
  const labels = ascii.split('.');
  if (labels.length < 2 || !labels.every(l => LABEL.test(l))) return null;
  if (/^\d+$/.test(labels[labels.length - 1])) return null;
  return ascii;
}

/**
 * The domain and each of its parents, longest first: `a.b.c.com`, `b.c.com`, `c.com`, `com`.
 * @param {string} domain
 * @returns {string[]}
 */
export function selfAndParents(domain) {
  const labels = domain.split('.');
  return labels.map((_, i) => labels.slice(i).join('.'));
}

/**
 * Finds the domain or its nearest parent in a set or map.
 * @template T
 * @param {string} domain
 * @param {Set<string> | Map<string, T>} set
 * @returns {string | null}
 */
export function findSelfOrParent(domain, set) {
  for (const d of selfAndParents(domain)) if (set.has(d)) return d;
  return null;
}

/**
 * Compares domains for sorting: plain code-point order, so the files sort the same way on
 * every machine.
 * @param {string} a
 * @param {string} b
 */
export function compareDomains(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}
