import assert from 'node:assert/strict';
import { test } from 'node:test';
import { looksLikeBotCheck } from '../src/http.js';

test('looksLikeBotCheck spots challenge pages', () => {
  assert.equal(looksLikeBotCheck('<html><head><title>Just a moment...</title>'), true);
  assert.equal(looksLikeBotCheck('<script src="/cdn-cgi/challenge-platform/h/b/orchestrate"></script>'), true);
});

test('looksLikeBotCheck ignores a normal page that mentions a CAPTCHA', () => {
  assert.equal(looksLikeBotCheck('<title>Temp Mail</title><p>Protected by reCAPTCHA.</p><select><option value="a.com">'), false);
});
