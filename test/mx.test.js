import assert from 'node:assert/strict';
import { test } from 'node:test';
import { organizationHost } from '../src/mx.js';

test('organizationHost names paid mail hosts', () => {
  assert.equal(organizationHost(['aspmx.l.google.com', 'alt1.aspmx.l.google.com']), 'Google Workspace');
  assert.equal(organizationHost(['example-com.mail.protection.outlook.com']), 'Microsoft 365');
  assert.equal(organizationHost(['mx1.example.pphosted.com']), 'Proofpoint');
});

test('organizationHost ignores the mail servers throwaway services run', () => {
  assert.equal(organizationHost(['mx.generator.email']), null);
  assert.equal(organizationHost(['route1.mx.cloudflare.net']), null);
  assert.equal(organizationHost(['google.com.evil.example']), null);
  assert.equal(organizationHost([]), null);
});
