import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findSelfOrParent, normalize, selfAndParents } from '../src/domain.js';

test('normalize lowercases, trims and strips wildcards, dots and at signs', () => {
  assert.equal(normalize('  Mailinator.COM '), 'mailinator.com');
  assert.equal(normalize('*.example.org'), 'example.org');
  assert.equal(normalize('.example.org'), 'example.org');
  assert.equal(normalize('@example.org'), 'example.org');
  assert.equal(normalize('example.org.'), 'example.org');
});

test('normalize converts international names to ASCII', () => {
  assert.equal(normalize('bücher.de'), 'xn--bcher-kva.de');
  assert.equal(normalize('ПОЧТА.рф'), 'xn--80a1acny.xn--p1ai');
});

test('normalize drops anything that is not a domain', () => {
  for (const bad of ['', 'localhost', 'a b.com', 'user@example.com', 'http://example.com', '-bad.com', 'bad-.com', 'under_score.com', '192.168.0.1', 'a..b.com', `${'a'.repeat(64)}.com`]) {
    assert.equal(normalize(bad), null, bad);
  }
});

test('selfAndParents walks up to the top-level domain', () => {
  assert.deepEqual(selfAndParents('a.b.example.com'), ['a.b.example.com', 'b.example.com', 'example.com', 'com']);
});

test('findSelfOrParent finds the nearest listed parent', () => {
  const set = new Set(['mailinator.com']);
  assert.equal(findSelfOrParent('abc.mailinator.com', set), 'mailinator.com');
  assert.equal(findSelfOrParent('mailinator.com', set), 'mailinator.com');
  assert.equal(findSelfOrParent('notmailinator.com', set), null);
});
