import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isAllowed, parseRobots } from '../src/robots.js';

test('uses the * group when no group names the bot', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /api/\nAllow: /api/public\n');
  assert.equal(isAllowed(groups, 'throwlistbot', '/'), true);
  assert.equal(isAllowed(groups, 'throwlistbot', '/api/domains'), false);
  assert.equal(isAllowed(groups, 'throwlistbot', '/api/public/domains'), true);
});

test('a group naming the bot replaces the * group', () => {
  const groups = parseRobots('User-agent: *\nDisallow:\n\nUser-agent: ThrowlistBot\nDisallow: /\n');
  assert.equal(isAllowed(groups, 'throwlistbot', '/anything'), false);
});

test('a group for another bot whose name is part of ours does not apply', () => {
  const groups = parseRobots('User-agent: bot\nDisallow: /\n\nUser-agent: *\nAllow: /\n');
  assert.equal(isAllowed(groups, 'throwlistbot', '/x'), true);
});

test('agents listed together share their rules', () => {
  const groups = parseRobots('User-agent: OtherBot\nUser-agent: *\nDisallow: /private\n');
  assert.equal(isAllowed(groups, 'throwlistbot', '/private/x'), false);
});

test('supports * and $ in paths, and allow wins a tie', () => {
  const groups = parseRobots('User-agent: *\nDisallow: /*.php$\nDisallow: /page\nAllow: /page\n');
  assert.equal(isAllowed(groups, 'throwlistbot', '/index.php'), false);
  assert.equal(isAllowed(groups, 'throwlistbot', '/index.php?x=1'), true);
  assert.equal(isAllowed(groups, 'throwlistbot', '/page'), true);
});

test('an empty robots.txt allows everything', () => {
  assert.equal(isAllowed(parseRobots(''), 'throwlistbot', '/x'), true);
});
