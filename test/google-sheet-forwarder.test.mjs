import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSubmissionHandler, parseSubmission } from '../netlify/functions/lib/google-sheet-forwarder.mjs';

const validSubmission = {
  id: '0123456789abcdef01234567',
  form_name: 'probetraining',
  created_at: '2026-09-29T10:00:00.000Z',
  data: {
    'form-name': 'probetraining',
    event_id: 'event-123',
    name: 'Test Person',
    email: 'test@example.com',
  },
};

test('parseSubmission accepts direct and wrapped Netlify payloads', () => {
  assert.deepEqual(parseSubmission(JSON.stringify(validSubmission)), validSubmission);
  assert.deepEqual(parseSubmission(JSON.stringify({ payload: validSubmission })), validSubmission);
});

test('parseSubmission accepts all three approved forms', () => {
  for (const formName of ['probetraining', 'firmenanfrage', 'blitzbewerbung']) {
    const submission = { ...validSubmission, form_name: formName, data: { ...validSubmission.data, 'form-name': formName } };
    assert.deepEqual(parseSubmission(JSON.stringify(submission)), submission);
  }
});

test('parseSubmission ignores unrelated forms', () => {
  assert.equal(parseSubmission(JSON.stringify({ ...validSubmission, form_name: 'newsletter' })), null);
});

test('parseSubmission rejects malformed approved-form payloads', () => {
  assert.throws(() => parseSubmission(JSON.stringify({ payload: { form_name: 'probetraining' } })), /Invalid Netlify submission/);
  assert.throws(() => parseSubmission(JSON.stringify({ payload: null, ...validSubmission })), /Invalid Netlify submission/);
  assert.throws(() => parseSubmission(JSON.stringify({ payload: 'invalid', ...validSubmission })), /Invalid Netlify submission/);
  assert.throws(() => parseSubmission(JSON.stringify({ ...validSubmission, id: '' })), /Invalid Netlify submission/);
  for (const id of [123, true, [], {}]) {
    assert.throws(() => parseSubmission(JSON.stringify({ ...validSubmission, id })), /Invalid Netlify submission/);
  }
  assert.throws(() => parseSubmission(JSON.stringify({ ...validSubmission, id: 'not-a-netlify-id' })), /Invalid Netlify submission/);
  assert.throws(() => parseSubmission(JSON.stringify({ ...validSubmission, data: [] })), /Invalid Netlify submission/);
  for (const created_at of [
    'not-a-date',
    '0',
    '2026',
    '09/29/2026',
    '2026-09-29',
    '2026-02-29T10:00:00Z',
    '2026-04-31T10:00:00Z',
    '2026-13-01T10:00:00Z',
    '2026-09-29T24:00:00Z',
    '2026-09-29T10:60:00Z',
  ]) {
    assert.throws(() => parseSubmission(JSON.stringify({ ...validSubmission, created_at })), /Invalid Netlify submission/);
  }
  assert.doesNotThrow(() => parseSubmission(JSON.stringify({ ...validSubmission, created_at: '2028-02-29T10:00:00Z' })));
});

test('handler forwards the exact submission to Apps Script with a timeout signal', async () => {
  const calls = [];
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ ok: true, blatt: 'Anfragen' }), { status: 200 });
    },
  });

  const response = await handler({ body: JSON.stringify({ payload: validSubmission }) });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://script.google.com/macros/s/example/exec');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.ok(calls[0].options.signal instanceof AbortSignal);
  assert.deepEqual(JSON.parse(calls[0].options.body), validSubmission);
});

test('handler follows only the expected Apps Script redirect host', async () => {
  const calls = [];
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (calls.length === 1) {
        return new Response(null, { status: 302, headers: { location: 'https://script.googleusercontent.com/macros/echo?user_content_key=test' } });
      }
      return new Response(JSON.stringify({ ok: true, blatt: 'Anfragen' }), { status: 200 });
    },
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(calls[1].options.method, 'GET');
  assert.equal(calls[1].options.redirect, 'error');
});

test('handler rejects redirects outside the Apps Script content host', async () => {
  let calls = 0;
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => {
      calls += 1;
      return new Response(null, { status: 302, headers: { location: 'https://example.com/collect' } });
    },
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 502);
  assert.equal(calls, 1);
});

test('handler rejects invalid JSON and malformed approved submissions', async () => {
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => { throw new Error('must not be called'); },
  });
  assert.equal((await handler({ body: '{' })).statusCode, 400);
  assert.equal((await handler({ body: JSON.stringify({ form_name: 'probetraining' }) })).statusCode, 400);
});

test('handler reports missing or invalid endpoint configuration', async () => {
  for (const endpoint of ['', 'https://example.com/webhook']) {
    const handler = buildSubmissionHandler({ endpoint, fetchImpl: async () => new Response('{}') });
    assert.equal((await handler({ body: JSON.stringify(validSubmission) })).statusCode, 500);
  }
});

test('handler does not call Apps Script for unrelated forms', async () => {
  let called = false;
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => { called = true; },
  });
  const response = await handler({ body: JSON.stringify({ ...validSubmission, form_name: 'newsletter' }) });
  assert.equal(response.statusCode, 200);
  assert.equal(called, false);
});

test('handler fails closed when Apps Script rejects the submission', async () => {
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'internal details' }), { status: 200 }),
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /internal details|test@example.com/);
});

test('handler fails closed when the upstream request throws', async () => {
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => { throw new Error('network details'); },
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /network details|test@example.com/);
});

test('handler aborts a stalled Apps Script request', async () => {
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    timeoutMs: 10,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }),
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 502);
});

test('handler fails closed when Apps Script returns invalid JSON', async () => {
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => new Response('not-json', { status: 200 }),
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /not-json|test@example.com/);
});

test('handler fails closed on an upstream HTTP error', async () => {
  const handler = buildSubmissionHandler({
    endpoint: 'https://script.google.com/macros/s/example/exec',
    fetchImpl: async () => new Response('upstream secret error', { status: 500 }),
  });
  const response = await handler({ body: JSON.stringify(validSubmission) });
  assert.equal(response.statusCode, 502);
  assert.doesNotMatch(response.body, /upstream secret error|test@example.com/);
});
