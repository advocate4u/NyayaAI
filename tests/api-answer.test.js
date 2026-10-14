import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/answer.js';

const savedEnv = {};
let originalFetch;
let sequence = 0;

function makeResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function makeRequest({ method = 'POST', origin, body, ip } = {}) {
  sequence += 1;
  const headers = { 'x-forwarded-for': ip || `test-client-${sequence}` };
  if (origin !== undefined) headers.origin = origin;
  return { method, headers, body, socket: { remoteAddress: '127.0.0.1' } };
}

async function invoke(options) {
  const req = makeRequest(options);
  const res = makeResponse();
  await handler(req, res);
  return { req, res };
}

beforeEach(() => {
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'NYAYAI_ALLOWED_ORIGIN']) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'NYAYAI_ALLOWED_ORIGIN']) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  globalThis.fetch = originalFetch;
});

test('rejects methods other than POST without calling the provider', async () => {
  const { res } = await invoke({ method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.allow, 'POST');
  assert.match(res.body.error, /POST/);
});

test('returns a safe service-unavailable message when no server API key is configured', async () => {
  const { res } = await invoke({ body: { question: 'What is the rule?', evidence: '[1] sample provision' } });
  assert.equal(res.statusCode, 503);
  assert.match(res.body.error, /not configured/);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('rejects malformed JSON request bodies', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  const { res } = await invoke({ body: '{invalid json' });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /valid JSON/);
});

test('validates required question and evidence before calling the provider', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => { throw new Error('Provider must not be called'); };
  const { res } = await invoke({ body: { question: 'A question without evidence', evidence: '' } });
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /evidence/i);
});

test('rejects requests from an unapproved browser origin', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.NYAYAI_ALLOWED_ORIGIN = 'https://nyayaai.example';
  const { res } = await invoke({
    origin: 'https://attacker.example',
    body: { question: 'Question?', evidence: '[1] Evidence' }
  });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /origin/i);
});

test('rejects requests with a missing Origin when an allow-list is configured', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.NYAYAI_ALLOWED_ORIGIN = 'https://nyayaai.example';
  const { res } = await invoke({
    body: { question: 'Question?', evidence: '[1] Evidence' }
  });
  assert.equal(res.statusCode, 403);
  assert.match(res.body.error, /origin/i);
});

test('calls the Responses API with server-side credentials and returns only the answer payload', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_MODEL = 'test-model';
  let providerRequest;
  globalThis.fetch = async (url, options) => {
    providerRequest = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ model: 'test-model', output_text: 'Short answer [1].' })
    };
  };

  const { res } = await invoke({
    body: { question: 'Explain this provision', evidence: '[1] Sample provision text' }
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { answer: 'Short answer [1].', model: 'test-model' });
  assert.equal(providerRequest.url, 'https://api.openai.com/v1/responses');
  assert.equal(providerRequest.options.headers.Authorization, 'Bearer test-key');
  const requestBody = JSON.parse(providerRequest.options.body);
  assert.equal(requestBody.model, 'test-model');
  assert.equal(requestBody.store, false);
  assert.match(requestBody.instructions, /Do not invent/);
  assert.match(requestBody.input, /Sample provision text/);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('does not expose provider error details to the caller', async () => {
  process.env.OPENAI_API_KEY = 'test-key';
  globalThis.fetch = async () => ({
    ok: false,
    status: 500,
    json: async () => ({ error: { message: 'sensitive provider internals' } })
  });
  const { res } = await invoke({
    body: { question: 'Question?', evidence: '[1] Evidence' }
  });
  assert.equal(res.statusCode, 502);
  assert.doesNotMatch(JSON.stringify(res.body), /sensitive provider internals/);
});
