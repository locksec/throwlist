import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadPsl, parsePsl } from '../src/psl.js';

const psl = parsePsl(`
// ===BEGIN ICANN DOMAINS===
com
uk
co.uk
*.ck
!www.ck
рф
// ===BEGIN PRIVATE DOMAINS===
cloudns.cc
cc
`);

test('finds the longest matching rule', () => {
  assert.equal(psl.suffix('a.b.example.co.uk'), 'co.uk');
  assert.equal(psl.registrable('a.b.example.co.uk'), 'example.co.uk');
  assert.equal(psl.registrable('mail.example.com'), 'example.com');
});

test('handles wildcard and exception rules', () => {
  assert.equal(psl.suffix('shop.foo.ck'), 'foo.ck');
  assert.equal(psl.isSuffix('foo.ck'), true);
  assert.equal(psl.suffix('www.ck'), 'ck');
  assert.equal(psl.registrable('www.ck'), 'www.ck');
});

test('treats private-section suffixes as suffixes', () => {
  assert.equal(psl.isSuffix('cloudns.cc'), true);
  assert.equal(psl.registrable('abc.cloudns.cc'), 'abc.cloudns.cc');
});

test('knows which top-level domains exist', () => {
  assert.equal(psl.knownTld('example.com'), true);
  assert.equal(psl.knownTld('example.xn--p1ai'), true);
  assert.equal(psl.knownTld('example.notatld'), false);
});

test('the repository copy guards real suffixes', () => {
  const real = loadPsl();
  for (const suffix of ['com', 'co.uk', 'com.au', 'github.io', 'edu.pl', 'mooo.com', 'us.to']) assert.equal(real.isSuffix(suffix), true, suffix);
  assert.equal(real.registrable('throwaway.mooo.com'), 'throwaway.mooo.com');
  for (const domain of ['mailinator.com', 'example.co.uk', 'notatka.edu.pl']) assert.equal(real.isSuffix(domain), false, domain);
});
