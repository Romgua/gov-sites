import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanUrl, detectCharset, fetchFirstReachable, fetchSite, isBlockedError, isHostDown, mapWithConcurrency,
} from '../scripts/lib/fetch-site.mjs';

function fakeResponse(body, { status = 200, contentType = 'text/html; charset=utf-8', url = '' } = {}) {
  const response = new Response(body, { status, headers: { 'content-type': contentType } });
  Object.defineProperty(response, 'url', { value: url });
  return response;
}

test('returns metadata and final url for a valid html page', async () => {
  const fetchImpl = async () => fakeResponse('<title>Mon site</title><meta name="description" content="Desc">', { url: 'https://www.x.gouv.fr/' });
  assert.deepEqual(await fetchSite('https://x.gouv.fr/', { fetchImpl }), {
    url: 'https://www.x.gouv.fr/', title: 'Mon site', description: 'Desc',
  });
});

test('rejects errors, non html, placeholders and network failures', async () => {
  const cases = [
    async () => fakeResponse('<title>Mon site</title>', { status: 503 }),
    async () => fakeResponse('{}', { contentType: 'application/json' }),
    async () => fakeResponse('<title>Welcome to nginx!</title>'),
    async () => { throw new TypeError('fetch failed'); },
  ];
  for (const fetchImpl of cases) {
    assert.equal(await fetchSite('https://x.gouv.fr/', { fetchImpl }), null);
  }
});

test('decodes latin1 pages declared in meta charset', async () => {
  const bytes = Buffer.from('<meta charset="iso-8859-1"><title>Imp\xf4ts</title>', 'latin1');
  const fetchImpl = async () => fakeResponse(bytes, { contentType: 'text/html' });
  assert.equal((await fetchSite('https://x.gouv.fr/', { fetchImpl })).title, 'Impôts');
});

test('detectCharset falls back to utf-8 for unknown charsets', () => {
  assert.equal(detectCharset('text/html; charset=nope', new Uint8Array()), 'utf-8');
  assert.equal(detectCharset('text/html; charset=UTF-8', new Uint8Array()), 'utf-8');
});

test('fetchFirstReachable tries urls in order', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return url.startsWith('https') ? fakeResponse('', { status: 500 }) : fakeResponse('<title>OK</title>', { url });
  };
  const result = await fetchFirstReachable(['https://x.gouv.fr/', 'http://x.gouv.fr/'], { fetchImpl });
  assert.equal(result.site.title, 'OK');
  assert.deepEqual(calls, ['https://x.gouv.fr/', 'http://x.gouv.fr/']);
});

test('fetchFirstReachable skips other urls of a host that timed out or does not resolve', async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes('www.')) return fakeResponse('<title>WWW</title>', { url });
    throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } });
  };
  const urls = ['https://x.gouv.fr/', 'https://www.x.gouv.fr/', 'http://x.gouv.fr/'];
  assert.equal((await fetchFirstReachable(urls, { fetchImpl })).site.title, 'WWW');
  assert.deepEqual(calls, ['https://x.gouv.fr/', 'https://www.x.gouv.fr/']);
});

test('fetchFirstReachable reports blocked sites (socket reset or 403)', async () => {
  const reset = async () => { throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_SOCKET' } }); };
  assert.deepEqual(await fetchFirstReachable(['https://x.gouv.fr/'], { fetchImpl: reset }), { site: null, blocked: true });

  const forbidden = async () => fakeResponse('<title>Forbidden</title>', { status: 403 });
  assert.deepEqual(await fetchFirstReachable(['https://x.gouv.fr/'], { fetchImpl: forbidden }), { site: null, blocked: true });

  const dns = async () => { throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }); };
  const notFound = async () => fakeResponse('', { status: 404 });
  assert.deepEqual(await fetchFirstReachable(['https://x.gouv.fr/'], { fetchImpl: dns }), { site: null, blocked: false });
  assert.deepEqual(await fetchFirstReachable(['https://x.gouv.fr/'], { fetchImpl: notFound }), { site: null, blocked: false });
});

test('fetchFirstReachable is not blocked when another url fails clearly', async () => {
  const fetchImpl = async (url) => {
    if (url.startsWith('https://www.')) throw new TypeError('fetch failed', { cause: { code: 'UND_ERR_SOCKET' } });
    if (url.startsWith('https')) throw new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED' } });
    return fakeResponse('', { status: 404 });
  };
  const urls = ['https://x.gouv.fr/', 'https://www.x.gouv.fr/', 'http://x.gouv.fr/', 'http://www.x.gouv.fr/'];
  assert.deepEqual(await fetchFirstReachable(urls, { fetchImpl }), { site: null, blocked: false });
});

const failure = (code) => new TypeError('fetch failed', { cause: { code } });

test('classifies network errors as host down, blocked or neither', () => {
  assert.equal(isHostDown(new DOMException('timeout', 'TimeoutError')), true);
  for (const code of ['EAI_AGAIN', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT', 'CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE']) {
    assert.equal(isHostDown(failure(code)), true, code);
    assert.equal(isBlockedError(failure(code)), false, code);
  }
  for (const code of ['ECONNRESET', 'UND_ERR_SOCKET']) {
    assert.equal(isHostDown(failure(code)), false, code);
    assert.equal(isBlockedError(failure(code)), true, code);
  }
  assert.equal(isHostDown(new TypeError('fetch failed')), false);
  assert.equal(isBlockedError(new TypeError('fetch failed')), false);
});

test('times out slow servers', async () => {
  // AbortSignal.timeout ne garde pas le process actif.
  const fetchImpl = (url, { signal }) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(() => {}, 1000);
    signal.addEventListener('abort', () => {
      clearTimeout(keepAlive);
      reject(signal.reason);
    });
  });
  assert.equal(await fetchSite('https://x.gouv.fr/', { fetchImpl, timeoutMs: 20 }), null);
});

test('stops reading after the head and finds a title after large inline styles', async () => {
  let pulls = 0;
  const encoder = new TextEncoder();
  const parts = ['<head><style>' + 'a{}'.repeat(40000) + '</style><title>Loin</title></head>', '<body>', 'x'.repeat(1000)];
  const body = new ReadableStream({
    pull(controller) {
      if (pulls < parts.length) controller.enqueue(encoder.encode(parts[pulls++]));
      else controller.close();
    },
  });
  const fetchImpl = async () => fakeResponse(body);
  assert.equal((await fetchSite('https://x.gouv.fr/', { fetchImpl })).title, 'Loin');
  assert.ok(pulls < parts.length);
});

test('cleanUrl removes query string and fragment', () => {
  assert.equal(cleanUrl('https://x.gouv.fr/login?returnUrl=%2F&jsessionid=1#top'), 'https://x.gouv.fr/login');
});

test('mapWithConcurrency preserves order and respects the limit', async () => {
  let running = 0;
  let maxRunning = 0;
  const results = await mapWithConcurrency([30, 10, 20, 0], 2, async (delay) => {
    running++;
    maxRunning = Math.max(maxRunning, running);
    await new Promise((resolve) => setTimeout(resolve, delay));
    running--;
    return delay * 2;
  });
  assert.deepEqual(results, [60, 20, 40, 0]);
  assert.equal(maxRunning, 2);
  assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
});
