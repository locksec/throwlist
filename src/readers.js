import { normalize } from './domain.js';

/** A reader never returns more than this many domains, so a broken pattern cannot flood the list. */
export const MAX_PER_SERVICE = 500;

/**
 * Walks a JSON answer along a path such as `hydra:member[*].domain`. `[*]` means every
 * element of an array; a bare `[*]` path means the answer is an array of domains.
 * @param {unknown} data
 * @param {string} path
 * @returns {unknown[]}
 */
export function walkJson(data, path) {
  let nodes = [data];
  for (const part of path.split('.').filter(Boolean)) {
    const each = part.endsWith('[*]');
    const key = each ? part.slice(0, -3) : part;
    nodes = nodes.flatMap(node => {
      const value = key ? (node && typeof node === 'object' ? /** @type {Record<string, unknown>} */ (node)[key] : undefined) : node;
      if (each) return Array.isArray(value) ? value : [];
      return value === undefined ? [] : [value];
    });
  }
  return nodes;
}

/**
 * Domains from a service's API answer.
 * @param {string} text
 * @param {string} path
 */
export function readApi(text, path) {
  return clean(walkJson(JSON.parse(text), path).filter(v => typeof v === 'string'));
}

/**
 * Domains from a service's page, using a pattern whose first group is a domain. When
 * `within` is given, only the part of the page captured by its first group is searched,
 * such as the inside of the domain picker.
 * @param {string} html
 * @param {string} pattern
 * @param {string} [within]
 */
export function readPage(html, pattern, within) {
  let text = html;
  if (within) {
    const section = new RegExp(within, 'is').exec(html);
    if (!section) return [];
    text = section[1];
  }
  const re = new RegExp(pattern, 'gi');
  return clean([...text.matchAll(re)].map(m => m[1]).filter(Boolean));
}

/**
 * @param {string[]} raw
 * @returns {string[]}
 */
function clean(raw) {
  const out = new Set();
  for (const r of raw) {
    const d = normalize(r.replace(/[​-‍﻿]/g, ''));
    if (d) out.add(d);
    if (out.size >= MAX_PER_SERVICE) break;
  }
  return [...out].sort();
}
