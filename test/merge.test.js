import assert from 'node:assert/strict';
import { test } from 'node:test';
import { merge } from '../src/merge.js';
import { parsePsl } from '../src/psl.js';

/** @typedef {import('../src/config.js').Source} Source */

const psl = parsePsl('com\nnet\norg\nco.uk\nuk\ncloudns.cc\ncc\n');
const TODAY = '2026-10-08';

/** @type {Source[]} */
const sources = [
  { id: 'curated', name: '', home: '', format: 'lines', license: '', trust: 'direct', family: 'curated', observed: false, keep_removed: false },
  { id: 'watcher', name: '', home: '', format: 'lines', license: '', trust: 'direct', family: 'watcher', observed: true, keep_removed: true },
  { id: 'big-a', name: '', home: '', format: 'lines', license: '', trust: 'second', family: 'a', observed: false, keep_removed: false },
  { id: 'big-a-copy', name: '', home: '', format: 'lines', license: '', trust: 'second', family: 'a', observed: false, keep_removed: false },
  { id: 'big-b', name: '', home: '', format: 'lines', license: '', trust: 'second', family: 'b', observed: false, keep_removed: false },
];

/**
 * @param {Record<string, (string | [string, import('../src/parse.js').Seen])[]>} data
 * @param {Partial<import('../src/merge.js').MergeInput>} [extra]
 */
function run(data, extra = {}) {
  const current = new Map(
    Object.entries(data).map(([id, list]) => [id, new Map(list.map(d => (typeof d === 'string' ? [d, {}] : d)))]),
  );
  return merge({ sources, current, previous: new Map(), allowlist: new Map(), relays: new Map(), psl, today: TODAY, ...extra });
}

test('a direct source lists a domain on its own', () => {
  const r = run({ curated: ['Throw.com'] });
  assert.deepEqual([...r.listed.keys()], ['throw.com']);
  assert.deepEqual(r.listed.get('throw.com')?.sources, ['curated']);
});

test('a second-source domain needs another family to agree', () => {
  const r = run({ 'big-a': ['one.com', 'both.com', 'copied.com'], 'big-a-copy': ['copied.com'], 'big-b': ['both.com'] });
  assert.deepEqual([...r.listed.keys()], ['both.com']);
  assert.deepEqual(r.held, ['copied.com', 'one.com']);
});

test('a domain under an education or government suffix needs a direct source', () => {
  const institutional = parsePsl('com\nsg\nedu.sg\nuk\nac.uk\npl\nedu.pl\n');
  const r = run({ 'big-a': ['nus.edu.sg', 'ox.ac.uk', 'plain.com'], 'big-b': ['nus.edu.sg', 'ox.ac.uk', 'plain.com'], curated: ['temp.edu.pl'] }, { psl: institutional });
  assert.deepEqual([...r.listed.keys()], ['plain.com', 'temp.edu.pl']);
  assert.deepEqual(r.held, ['nus.edu.sg', 'ox.ac.uk']);
});

test('a domain with a paid organization mail host needs a sighting on a throwaway service', () => {
  const paidHosts = new Map([
    ['changed-hands.com', { host: 'Google Workspace', checked: '2026-10-01' }],
    ['seen.com', { host: 'Google Workspace', checked: '2026-10-01' }],
  ]);
  const r = run({ curated: ['changed-hands.com', 'seen.com', 'plain.com'], watcher: ['seen.com'] }, { paidHosts });
  assert.deepEqual([...r.listed.keys()], ['plain.com', 'seen.com']);
  assert.deepEqual(r.paidHost, ['changed-hands.com']);
});

test('a second-source domain is listed when a direct source agrees', () => {
  const r = run({ 'big-a': ['agreed.com'], curated: ['agreed.com'] });
  assert.ok(r.listed.has('agreed.com'));
});

test('the allowlist wins over every source, for the domain and its subdomains', () => {
  const allowlist = new Map([['gmail.com', 'Gmail']]);
  const r = run({ curated: ['gmail.com', 'x.gmail.com'], watcher: ['gmail.com'] }, { allowlist });
  assert.equal(r.listed.size, 0);
  assert.deepEqual([...r.allowlisted.keys()].sort(), ['gmail.com', 'x.gmail.com']);
});

test('relay services are kept off the list', () => {
  const relays = new Map([['duck.com', 'DuckDuckGo Email Protection']]);
  const r = run({ curated: ['duck.com', 'sub.duck.com', 'throw.com'] }, { relays });
  assert.deepEqual([...r.listed.keys()], ['throw.com']);
  assert.deepEqual([...r.relayed.keys()].sort(), ['duck.com', 'sub.duck.com']);
});

test('public suffixes and unknown top-level domains are rejected', () => {
  const r = run({ curated: ['co.uk', 'cloudns.cc', 'abc.cloudns.cc', 'thing.notatld', 'not a domain'] });
  assert.deepEqual([...r.listed.keys()], ['abc.cloudns.cc']);
  assert.equal(r.rejected.get('co.uk'), 'a public suffix');
  assert.equal(r.rejected.get('cloudns.cc'), 'a public suffix');
  assert.equal(r.rejected.get('thing.notatld'), 'unknown top-level domain');
  assert.equal(r.rejected.get('not a domain'), 'not a valid domain');
});

test('a subdomain of a listed domain is dropped as redundant', () => {
  const r = run({ curated: ['anonbox.net', 'x1.anonbox.net'], watcher: ['x2.anonbox.net'] });
  assert.deepEqual([...r.listed.keys()], ['anonbox.net']);
  assert.deepEqual(r.redundant, ['x1.anonbox.net', 'x2.anonbox.net']);
});

test('a domain a watching source dropped stays listed', () => {
  const previous = new Map([['old.com', { domain: 'old.com', sources: ['watcher'], services: [], first_seen: '2026-01-01', last_seen: '2026-02-01', mx: true }]]);
  const r = run({ watcher: [] }, { previous });
  assert.deepEqual(r.listed.get('old.com'), { domain: 'old.com', sources: ['watcher'], services: [], first_seen: '2026-01-01', last_seen: '2026-02-01', mx: true });
});

test('a domain a curated source removed leaves the list', () => {
  const previous = new Map([['fixed.com', { domain: 'fixed.com', sources: ['curated'], services: [], first_seen: '2026-01-01', last_seen: null, mx: null }]]);
  const r = run({ curated: [] }, { previous });
  assert.equal(r.listed.size, 0);
  assert.equal(r.removed.get('fixed.com'), 'no source names it any more');
});

test('a source that failed to load keeps what it listed last time', () => {
  const previous = new Map([['kept.com', { domain: 'kept.com', sources: ['curated'], services: [], first_seen: '2026-01-01', last_seen: null, mx: null }]]);
  const r = run({}, { previous });
  assert.ok(r.listed.has('kept.com'));
  assert.equal(r.removed.size, 0);
});

test('a domain newly allowlisted is reported as removed with the provider', () => {
  const previous = new Map([['real.com', { domain: 'real.com', sources: ['curated'], services: [], first_seen: '2026-01-01', last_seen: null, mx: null }]]);
  const r = run({ curated: ['real.com'] }, { previous, allowlist: new Map([['real.com', 'Real Mail']]) });
  assert.equal(r.removed.get('real.com'), 'allowlisted (Real Mail)');
});

test('dates: first seen is the earliest any source gives, last seen comes from watching sources only', () => {
  const r = run({ curated: ['a.com', 'b.com'], watcher: [['a.com', { first: '2025-05-01', last: '2026-10-01' }]] });
  assert.equal(r.listed.get('a.com')?.first_seen, '2025-05-01');
  assert.equal(r.listed.get('a.com')?.last_seen, '2026-10-01');
  assert.equal(r.listed.get('b.com')?.first_seen, TODAY);
  assert.equal(r.listed.get('b.com')?.last_seen, null);
});

test('a date in the future from a source is ignored for first seen', () => {
  const r = run({ watcher: [['a.com', { first: '2030-01-01' }]] });
  assert.equal(r.listed.get('a.com')?.first_seen, TODAY);
});

test('added and removed are reported against the last release', () => {
  const previous = new Map([['gone.com', { domain: 'gone.com', sources: ['curated'], services: [], first_seen: '2026-01-01', last_seen: null, mx: null }]]);
  const r = run({ curated: ['new.com'] }, { previous });
  assert.deepEqual(r.added, ['new.com']);
  assert.deepEqual([...r.removed.keys()], ['gone.com']);
});
