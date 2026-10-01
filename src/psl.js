import { readFileSync } from 'node:fs';
import { domainToASCII } from 'node:url';
import { repoPath } from './paths.js';

/**
 * @typedef {object} Psl
 * @property {(domain: string) => string} suffix The public suffix of a domain.
 * @property {(domain: string) => boolean} isSuffix True when the domain is itself a public suffix.
 * @property {(domain: string) => string | null} registrable The registrable domain, or null for a suffix.
 * @property {(domain: string) => boolean} knownTld True when the top-level domain exists.
 */

/**
 * Parses the Public Suffix List (both the ICANN and private sections).
 * @param {string} text
 * @returns {Psl}
 */
export function parsePsl(text) {
  const rules = new Set();
  const wildcards = new Set();
  const exceptions = new Set();
  const tlds = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim().split(/\s/)[0];
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('!')) {
      exceptions.add(domainToASCII(line.slice(1)));
    } else if (line.startsWith('*.')) {
      const parent = domainToASCII(line.slice(2));
      wildcards.add(parent);
      tlds.add(parent.split('.').pop());
    } else {
      const rule = domainToASCII(line);
      rules.add(rule);
      tlds.add(rule.split('.').pop());
    }
  }

  /** @param {string} domain */
  function suffix(domain) {
    const labels = domain.split('.');
    for (let i = 0; i < labels.length; i++) {
      const candidate = labels.slice(i).join('.');
      if (exceptions.has(candidate)) return labels.slice(i + 1).join('.');
      if (rules.has(candidate)) return candidate;
      if (i + 1 < labels.length && wildcards.has(labels.slice(i + 1).join('.'))) return candidate;
    }
    return labels[labels.length - 1];
  }

  return {
    suffix,
    isSuffix: domain => suffix(domain) === domain,
    registrable(domain) {
      const s = suffix(domain);
      if (s === domain) return null;
      const labels = domain.split('.');
      return labels.slice(labels.length - s.split('.').length - 1).join('.');
    },
    knownTld: domain => tlds.has(domain.split('.').pop() ?? ''),
  };
}

/**
 * Loads the copy of the list kept in the repository, plus Throwlist's own shared suffixes
 * in data/shared_suffixes.txt.
 */
export function loadPsl() {
  return parsePsl(
    readFileSync(repoPath('data', 'public_suffix_list.dat'), 'utf8') + '\n' + readFileSync(repoPath('data', 'shared_suffixes.txt'), 'utf8'),
  );
}
