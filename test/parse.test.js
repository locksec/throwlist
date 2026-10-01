import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatObservations, observationsAsSource, parseObservations, recordSightings } from '../src/observations.js';
import { parseFakefilter, parseLines, parseSourceMap } from '../src/parse.js';

test('parseLines skips comments and blank lines', () => {
  assert.deepEqual([...parseLines('# header\na.com\n\nb.com  # note\n// other\n').keys()], ['a.com', 'b.com']);
});

test('parseFakefilter turns Unix times into dates', () => {
  const data = parseFakefilter(JSON.stringify({ domains: { 'x.com': { provider: 'p', firstseen: 1759276800, lastseen: 1790812800 } } }));
  assert.deepEqual(data.get('x.com'), { first: '2025-10-01', last: '2026-10-01' });
});

test('parseSourceMap separates crawls from compiled lists and skips copies', () => {
  const text = [
    'GeneratorEmail:crawled.com',
    'https://yopmail.com/domain?d=all:yop.com',
    'https://throwaway.cloud/list.txt:listed.com',
    'https://raw.githubusercontent.com/FGRibreau/mailchecker/master/list.txt:copied.com',
  ].join('\n');
  const skip = ['FGRibreau/mailchecker'];
  assert.deepEqual([...parseSourceMap(text, { select: 'crawls', skip }).keys()], ['crawled.com', 'yop.com']);
  assert.deepEqual([...parseSourceMap(text, { select: 'lists', skip }).keys()], ['listed.com']);
});

test('observations round-trip through the TSV format', () => {
  const rows = [{ domain: 'b.com', service: 's.com', first_seen: '2026-10-01', last_seen: '2026-10-01', how: 'visit', evidence: 'https://s.com/' }];
  assert.deepEqual(parseObservations(formatObservations(rows)), rows);
});

test('recordSightings adds new pairs and moves last seen forward', () => {
  const rows = [{ domain: 'a.com', service: 's.com', first_seen: '2026-09-01', last_seen: '2026-09-01', how: 'page', evidence: 'https://s.com/' }];
  const { rows: out, added } = recordSightings(rows, [
    { domain: 'a.com', service: 's.com', date: '2026-10-01', how: 'page', evidence: 'https://s.com/' },
    { domain: 'b.com', service: 's.com', date: '2026-10-01', how: 'page', evidence: 'https://s.com/' },
  ]);
  assert.equal(out.find(r => r.domain === 'a.com')?.last_seen, '2026-10-01');
  assert.equal(out.find(r => r.domain === 'a.com')?.first_seen, '2026-09-01');
  assert.deepEqual(added.map(a => a.domain), ['b.com']);
});

test('observations become source data with every service a domain was seen on', () => {
  const data = observationsAsSource([
    { domain: 'a.com', service: 'one.com', first_seen: '2026-09-01', last_seen: '2026-09-15', how: 'visit', evidence: 'https://one.com/' },
    { domain: 'a.com', service: 'two.com', first_seen: '2026-08-01', last_seen: '2026-10-01', how: 'page', evidence: 'https://two.com/' },
  ]);
  assert.deepEqual(data.get('a.com'), { first: '2026-08-01', last: '2026-10-01', services: ['one.com', 'two.com'] });
});
