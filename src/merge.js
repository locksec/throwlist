import { compareDomains, findSelfOrParent, normalize, selfAndParents } from './domain.js';
import { heldForPaidHost } from './paidhosts.js';

/**
 * Education and government suffixes (`edu`, `ac.uk`, `edu.sg`, `gov.br` and so on). Their
 * domains belong to institutions with real, lasting mailboxes, so a domain under one is
 * listed only on a direct source's word.
 */
const INSTITUTIONAL = /^(edu|gov|mil)$|(^|\.)(edu|gov|mil|ac|gob|gouv|govt|sch|k12)\.[a-z.-]+$/;

/**
 * @typedef {import('./config.js').Source} Source
 * @typedef {import('./parse.js').Seen} Seen
 * @typedef {import('./parse.js').SourceData} SourceData
 * @typedef {import('./psl.js').Psl} Psl
 */

/**
 * A listed domain as published in domains.json.
 * @typedef {object} Entry
 * @property {string} domain
 * @property {string[]} sources Ids from sources.yml that list it.
 * @property {string[]} services Services Throwlist itself saw it on.
 * @property {string} first_seen Earliest date any source gives, or the day Throwlist first listed it.
 * @property {string | null} last_seen Latest date it was seen on a throwaway service; null when only lists name it.
 * @property {boolean | null} mx Whether it had mail servers at the last MX check; null before its first check.
 */

/**
 * @typedef {object} MergeInput
 * @property {Source[]} sources
 * @property {Map<string, SourceData>} current Data read this run, by source id. A source missing here failed to load.
 * @property {Map<string, Entry>} previous The last release's entries.
 * @property {Map<string, string>} allowlist Domain -> provider.
 * @property {Map<string, string>} relays Domain -> relay service.
 * @property {Psl} psl
 * @property {string} today ISO date.
 * @property {import('./paidhosts.js').PaidHosts} [paidHosts] Domains whose mail goes to a paid organization host.
 */

/**
 * @typedef {object} MergeResult
 * @property {Map<string, Entry>} listed
 * @property {Map<string, string>} removed Domain -> why it left the list.
 * @property {string[]} added
 * @property {string[]} held Domains only second-source lists name, and either one family names or the domain is under an education or government suffix.
 * @property {Map<string, string>} allowlisted Domain -> provider, for domains a source named.
 * @property {Map<string, string>} relayed Domain -> relay service, for domains a source named.
 * @property {string[]} paidHost Domains held back because their mail goes to a paid organization host and no watching source saw them.
 * @property {string[]} redundant Domains dropped because a parent is listed.
 * @property {Map<string, string>} rejected Raw entry -> reason.
 * @property {Map<string, number>} counts Valid domains read from each source.
 */

/**
 * Combines every source into the published list.
 * @param {MergeInput} input
 * @returns {MergeResult}
 */
export function merge({ sources, current, previous, allowlist, relays, psl, today, paidHosts = new Map() }) {
  const byId = new Map(sources.map(s => [s.id, s]));
  /** @type {Map<string, { present: Map<string, Seen>, retained: Set<string> }>} */
  const candidates = new Map();
  /** @type {Map<string, string>} */
  const rejected = new Map();
  /** @type {Map<string, number>} */
  const counts = new Map();

  /** @param {string} d */
  const candidate = d => {
    let c = candidates.get(d);
    if (!c) candidates.set(d, (c = { present: new Map(), retained: new Set() }));
    return c;
  };

  for (const source of sources) {
    const data = current.get(source.id);
    if (!data) continue;
    let valid = 0;
    for (const [raw, seen] of data) {
      const d = normalize(raw);
      if (!d) {
        rejected.set(raw, 'not a valid domain');
        continue;
      }
      if (!psl.knownTld(d)) {
        rejected.set(raw, 'unknown top-level domain');
        continue;
      }
      if (psl.isSuffix(d)) {
        rejected.set(raw, 'a public suffix');
        continue;
      }
      valid++;
      const c = candidate(d);
      const prior = c.present.get(source.id);
      c.present.set(source.id, prior ? combine(prior, seen) : seen);
    }
    counts.set(source.id, valid);
  }

  // A source that failed to load keeps what it listed last time. A source that dropped a
  // domain keeps it only when it is marked keep_removed.
  for (const entry of previous.values()) {
    for (const id of entry.sources) {
      const source = byId.get(id);
      if (!source || (current.has(id) && !source.keep_removed)) continue;
      const c = candidate(entry.domain);
      if (!c.present.has(id)) c.retained.add(id);
    }
  }

  /** @type {Map<string, Entry>} */
  const listed = new Map();
  /** @type {Map<string, string>} */
  const allowlisted = new Map();
  /** @type {Map<string, string>} */
  const relayed = new Map();
  const held = [];
  const paidHost = [];

  for (const [d, c] of candidates) {
    const relay = findSelfOrParent(d, relays);
    if (relay) {
      relayed.set(d, /** @type {string} */ (relays.get(relay)));
      continue;
    }
    const allowed = findSelfOrParent(d, allowlist);
    if (allowed) {
      allowlisted.set(d, /** @type {string} */ (allowlist.get(allowed)));
      continue;
    }
    const ids = [...new Set([...c.present.keys(), ...c.retained])];
    const named = ids.map(id => /** @type {Source} */ (byId.get(id)));
    const direct = named.some(s => s.trust === 'direct');
    const families = new Set(named.filter(s => s.trust === 'second').map(s => s.family));
    if (!direct && (families.size < 2 || INSTITUTIONAL.test(psl.suffix(d)))) {
      held.push(d);
      continue;
    }
    if (heldForPaidHost(d, named, paidHosts)) {
      paidHost.push(d);
      continue;
    }
    listed.set(d, toEntry(d, c, previous.get(d), byId, today));
  }

  // A subdomain adds nothing when its parent is listed: sites match parents anyway.
  const redundant = [];
  for (const d of [...listed.keys()]) {
    if (selfAndParents(d).slice(1).some(p => listed.has(p))) {
      listed.delete(d);
      redundant.push(d);
    }
  }

  const added = [...listed.keys()].filter(d => !previous.has(d)).sort(compareDomains);
  /** @type {Map<string, string>} */
  const removed = new Map();
  const heldSet = new Set(held);
  const paidHostSet = new Set(paidHost);
  const redundantSet = new Set(redundant);
  for (const d of previous.keys()) {
    if (listed.has(d)) continue;
    if (allowlisted.has(d) || findSelfOrParent(d, allowlist)) removed.set(d, `allowlisted (${allowlist.get(/** @type {string} */ (findSelfOrParent(d, allowlist)))})`);
    else if (relayed.has(d) || findSelfOrParent(d, relays)) removed.set(d, `relay service (${relays.get(/** @type {string} */ (findSelfOrParent(d, relays)))})`);
    else if (redundantSet.has(d)) removed.set(d, 'a parent domain is now listed');
    else if (heldSet.has(d)) removed.set(d, 'only one community list still names it');
    else if (paidHostSet.has(d)) removed.set(d, `its mail is now hosted by ${paidHosts.get(d)?.host} and no service was seen handing it out`);
    else if (psl.isSuffix(d)) removed.set(d, 'now a public suffix');
    else removed.set(d, 'no source names it any more');
  }

  return {
    listed: new Map([...listed].sort(([a], [b]) => compareDomains(a, b))),
    removed,
    added,
    held: held.sort(compareDomains),
    paidHost: paidHost.sort(compareDomains),
    allowlisted,
    relayed,
    redundant: redundant.sort(compareDomains),
    rejected,
    counts,
  };
}

/**
 * @param {Seen} a
 * @param {Seen} b
 * @returns {Seen}
 */
function combine(a, b) {
  return {
    first: minDate(a.first, b.first),
    last: maxDate(a.last, b.last),
    services: [...new Set([...(a.services ?? []), ...(b.services ?? [])])].sort(),
  };
}

/**
 * @param {string} domain
 * @param {{ present: Map<string, Seen>, retained: Set<string> }} c
 * @param {Entry | undefined} prev
 * @param {Map<string, Source>} byId
 * @param {string} today
 * @returns {Entry}
 */
function toEntry(domain, c, prev, byId, today) {
  let first = prev?.first_seen ?? today;
  let last = prev?.last_seen ?? null;
  /** @type {Set<string>} */
  const services = new Set();
  for (const [id, seen] of c.present) {
    first = /** @type {string} */ (minDate(first, seen.first && seen.first <= today ? seen.first : undefined));
    if (byId.get(id)?.observed) last = maxDate(last ?? undefined, seen.last ?? today) ?? null;
    for (const s of seen.services ?? []) services.add(s);
  }
  return {
    domain,
    sources: [...new Set([...c.present.keys(), ...c.retained])].sort(),
    services: [...services].sort(),
    first_seen: first,
    last_seen: last,
    mx: prev?.mx ?? null,
  };
}

/**
 * @param {string | undefined} a
 * @param {string | undefined} b
 */
const minDate = (a, b) => (!a ? b : !b ? a : a < b ? a : b);

/**
 * @param {string | undefined} a
 * @param {string | undefined} b
 */
const maxDate = (a, b) => (!a ? b : !b ? a : a > b ? a : b);
