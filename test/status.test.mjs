// Offline tests: no network, no secrets. They check the request guards that protect credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import {handleStatus} from '../api/status.mjs';
import {createCached} from '../lib/live-status.mjs';

const req = (url, init = {}) => new Request('https://example.test' + url, init);

test('write methods are refused', async () => {
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const r = await handleStatus(req('/api/status', {method}));
    assert.equal(r.status, 405);
    assert.equal(r.headers.get('cache-control'), 'no-store');
  }
});
test('query strings are refused (no cache-busting)', async () => {
  assert.equal((await handleStatus(req('/api/status?x=1'))).status, 400);
});
test('unusual Accept headers are refused (no cache-busting)', async () => {
  assert.equal((await handleStatus(req('/api/status', {headers: {accept: 'text/random-' + Math.random()}}))).status, 406);
});
test('cross-site requests are refused', async () => {
  assert.equal((await handleStatus(req('/api/status', {headers: {'sec-fetch-site': 'cross-site'}}))).status, 403);
});
test('cache: one load per TTL, concurrent calls share it', async () => {
  let calls = 0;
  const get = createCached(async () => { calls++; return {n: calls}; }, 1000);
  const [a, b] = await Promise.all([get(), get()]);
  assert.deepEqual([a, b, await get(), calls], [{n: 1}, {n: 1}, {n: 1}, 1]);
});
