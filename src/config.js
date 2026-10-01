import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { normalize } from './domain.js';
import { repoPath } from './paths.js';

/**
 * @typedef {object} Source
 * @property {string} id
 * @property {string} name
 * @property {string} home
 * @property {string} [url] Where the data is downloaded from. Absent for local sources.
 * @property {'lines' | 'json-array' | 'fakefilter' | 'source-map' | 'observations'} format
 * @property {string} license
 * @property {'direct' | 'second'} trust `direct` lists a domain on its own; `second` needs a source from another family.
 * @property {string} family Sources that copy from each other share a family.
 * @property {boolean} observed True when the source watches throwaway services, so its dates count as sightings.
 * @property {boolean} keep_removed Keep a domain this source drops (throwaway domains keep working after services stop showing them).
 * @property {'crawls' | 'lists'} [select] For `source-map`: the aggregator's own crawls, or the other lists it compiles.
 * @property {string[]} [skip] For `source-map`: origins to ignore because Throwlist reads them directly.
 */

/**
 * @typedef {object} Service
 * @property {string} id The service's host, such as `tempail.com`.
 * @property {string} name
 * @property {string} url
 * @property {string} [language]
 * @property {'api' | 'page' | 'manual'} read How its domains are read.
 * @property {string} [endpoint] For `api` and `page`: the URL read.
 * @property {string} [json] For `api`: where the domains are in the answer, such as `hydra:member[*].domain`.
 * @property {string} [pattern] For `page`: a regular expression whose first group is a domain.
 * @property {string} [within] For `page`: a regular expression whose first group is the part of the page to search.
 * @property {'allowed' | 'disallowed' | 'none' | 'unreachable'} robots
 * @property {string | null} [terms]
 * @property {'forbidden' | 'not mentioned' | 'unknown'} automated
 * @property {'active' | 'script' | 'blocked' | 'dead'} status
 * @property {string} checked
 * @property {string} [notes]
 */

/** @typedef {{ provider: string, reason: string, source?: string, domains: string[] }} AllowEntry */
/** @typedef {{ service: string, url: string, source?: string, notes?: string, domains: string[] }} RelayEntry */

/** @param {string} file */
const readYaml = file => parse(readFileSync(repoPath(file), 'utf8')) ?? [];

/** @returns {Source[]} */
export const loadSources = () => readYaml('sources.yml');

/** @returns {Service[]} */
export const loadServices = () => readYaml('services.yml');

/** @returns {AllowEntry[]} */
export const loadAllowlist = () => readYaml('allowlist.yml');

/** @returns {RelayEntry[]} */
export const loadRelays = () => readYaml('relays.yml');

/**
 * Flattens allowlist or relay entries into domain -> provider or service name.
 * @param {(AllowEntry | RelayEntry)[]} entries
 * @returns {Map<string, string>}
 */
export function domainMap(entries) {
  const map = new Map();
  for (const entry of entries) {
    const name = 'provider' in entry ? entry.provider : entry.service;
    for (const raw of entry.domains ?? []) {
      const d = normalize(raw);
      if (!d) throw new Error(`Not a valid domain in ${name}: ${raw}`);
      map.set(d, name);
    }
  }
  return map;
}
