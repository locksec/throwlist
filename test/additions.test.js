import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyMxToAdditions } from '../src/additions.js';

/** @type {import('../src/config.js').Source[]} */
const sources = /** @type {any} */ ([
  { id: 'curated', trust: 'direct', family: 'a', observed: false, keep_removed: false },
  { id: 'watcher', trust: 'direct', family: 'b', observed: true, keep_removed: true },
]);
const byId = new Map(sources.map(s => [s.id, s]));

/** @param {string} domain @param {string[]} ids */
const entry = (domain, ids) => ({ domain, sources: ids, services: [], first_seen: '2026-10-12', last_seen: null, mx: null });

/** @returns {import('../src/merge.js').MergeResult} */
function result() {
  const listed = new Map([
    ['farm.xyz', entry('farm.xyz', ['curated'])],
    ['tenant.example', entry('tenant.example', ['curated'])],
    ['seen.example', entry('seen.example', ['watcher'])],
    ['quiet.example', entry('quiet.example', ['curated'])],
  ]);
  return /** @type {any} */ ({
    listed,
    added: ['farm.xyz', 'quiet.example', 'seen.example', 'tenant.example'],
    paidHost: ['earlier.example'],
    removed: new Map(),
    held: [],
    allowlisted: new Map(),
    relayed: new Map(),
    redundant: [],
    rejected: new Map(),
    counts: new Map(),
  });
}

test('a new domain on a paid organization host is held back unless a watching source saw it', () => {
  const r = result();
  const paidHosts = new Map();
  const mx = new Map([
    ['farm.xyz', { mx: true, hosts: ['mail.farm.xyz'] }],
    ['tenant.example', { mx: true, hosts: ['tenant-example.mail.protection.outlook.com'] }],
    ['seen.example', { mx: true, hosts: ['aspmx.l.google.com'] }],
  ]);
  const held = applyMxToAdditions(r, mx, paidHosts, byId, '2026-10-19');

  assert.deepEqual(held, ['tenant.example']);
  assert.deepEqual(r.added, ['farm.xyz', 'quiet.example', 'seen.example']);
  assert.deepEqual(r.paidHost, ['earlier.example', 'tenant.example']);
  assert.equal(r.listed.has('tenant.example'), false);
  assert.equal(r.listed.get('seen.example')?.mx, true, 'a watching source saw it, so it stays');
  assert.equal(r.listed.get('farm.xyz')?.mx, true);
  assert.equal(r.listed.get('quiet.example')?.mx, null, 'no answer leaves the entry as it was');
  assert.deepEqual(
    [...paidHosts].sort(([a], [b]) => a.localeCompare(b)),
    [
      ['seen.example', { host: 'Google Workspace', checked: '2026-10-19' }],
      ['tenant.example', { host: 'Microsoft 365', checked: '2026-10-19' }],
    ],
  );
});

test('a domain with no mail servers is still added, marked mx false', () => {
  const r = result();
  const held = applyMxToAdditions(r, new Map([['farm.xyz', { mx: false, hosts: [] }]]), new Map(), byId, '2026-10-19');
  assert.deepEqual(held, []);
  assert.equal(r.listed.get('farm.xyz')?.mx, false);
  assert.equal(r.added.length, 4);
});
