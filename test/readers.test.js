import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadServices } from '../src/config.js';
import { repoPath } from '../src/paths.js';
import { MAX_PER_SERVICE, readApi, readPage, walkJson } from '../src/readers.js';

test('walkJson follows keys and array wildcards', () => {
  const data = { 'hydra:member': [{ domain: 'a.com' }, { domain: 'b.com' }] };
  assert.deepEqual(walkJson(data, 'hydra:member[*].domain'), ['a.com', 'b.com']);
  assert.deepEqual(walkJson(['x.com', 'y.com'], '[*]'), ['x.com', 'y.com']);
  assert.deepEqual(walkJson({}, 'missing[*].domain'), []);
});

test('readPage searches only inside the given section', () => {
  const html = '<select name="lang"><option value="de.example">x</option></select><select name="domain"><option value="Temp.Example">t</option></select>';
  assert.deepEqual(readPage(html, '<option value="([^"]+)"', '<select name="domain">(.*?)</select>'), ['temp.example']);
  assert.deepEqual(readPage(html, '<option value="([^"]+)"', '<select name="nothing">(.*?)</select>'), []);
});

test('readers drop invalid entries and zero-width characters', () => {
  assert.deepEqual(readApi('["ok.com", "not a domain", "zero​width.com", 7]', '[*]'), ['ok.com', 'zerowidth.com']);
});

test('a reader never returns more than its cap', () => {
  const many = JSON.stringify(Array.from({ length: MAX_PER_SERVICE + 50 }, (_, i) => `d${i}.com`));
  assert.equal(readApi(many, '[*]').length, MAX_PER_SERVICE);
});

test('each service reader reads its saved page or API answer', () => {
  const expected = JSON.parse(readFileSync(repoPath('test', 'fixtures', 'services', 'expected.json'), 'utf8'));
  const readers = loadServices().filter(s => s.read === 'api' || s.read === 'page');
  assert.ok(readers.length > 0);
  for (const s of readers) {
    const file = repoPath('test', 'fixtures', 'services', `${s.id}.${s.read === 'api' ? 'json' : 'html'}`);
    const text = readFileSync(file, 'utf8');
    const got = s.read === 'api' ? readApi(text, s.json ?? '') : readPage(text, s.pattern ?? '', s.within);
    assert.deepEqual(got, expected[s.id], s.id);
  }
});
