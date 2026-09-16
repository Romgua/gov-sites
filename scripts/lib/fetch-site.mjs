import { extractMetadata, isPlaceholderTitle } from './html.mjs';

const MAX_BODY_BYTES = 256 * 1024;
const HEAD_END = /<\/head\s*>|<body[\s>]/i;
const HOST_DOWN_CODES = new Set([
  'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EHOSTUNREACH', 'ENETUNREACH', 'ETIMEDOUT', 'UND_ERR_CONNECT_TIMEOUT',
]);
const TLS_ERROR_CODE = /^(CERT_|ERR_TLS_|ERR_SSL_|UNABLE_TO_|DEPTH_ZERO_|SELF_SIGNED_)/;
const BLOCKED_ERROR_CODES = new Set(['ECONNRESET', 'UND_ERR_SOCKET']);
const DEFAULT_TIMEOUT_MS = 8000;
const BLOCKED_STATUSES = new Set([401, 403, 429]);
// Sans prefixe Mozilla, certains pare-feux refusent la requete.
export const USER_AGENT = 'Mozilla/5.0 (compatible; gov-sites-annuaire/1.0; +https://github.com/Romgua/gov-sites)';

export function detectCharset(contentType, bytes) {
  const fromHeader = contentType.match(/charset=["']?([\w-]+)/i)?.[1];
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 2048));
  const fromMeta = head.match(/<meta[^>]+charset=["']?([\w-]+)/i)?.[1];
  const charset = (fromHeader || fromMeta || 'utf-8').toLowerCase();
  try {
    new TextDecoder(charset);
    return charset;
  } catch {
    return 'utf-8';
  }
}

async function readHead(response, maxBytes) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const latin1 = new TextDecoder('latin1');
  const chunks = [];
  let received = 0;
  let tail = '';
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.byteLength;
      const text = tail + latin1.decode(value);
      if (HEAD_END.test(text)) break;
      tail = text.slice(-16);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).subarray(0, maxBytes);
}

function errorCode(error) {
  return error?.cause?.code ?? error?.code ?? '';
}

export function isHostDown(error) {
  const code = errorCode(error);
  return error?.name === 'TimeoutError' || error?.name === 'AbortError' || HOST_DOWN_CODES.has(code) || TLS_ERROR_CODE.test(code);
}

// Connexion coupee : pare-feu devant un site actif.
export function isBlockedError(error) {
  return BLOCKED_ERROR_CODES.has(errorCode(error));
}

export async function probeSite(url, { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': USER_AGENT, accept: 'text/html' },
    });
  } catch (error) {
    return { site: null, hostDown: isHostDown(error), blocked: isBlockedError(error) };
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.includes('text/html')) {
    await response.body?.cancel().catch(() => {});
    return { site: null, hostDown: false, blocked: BLOCKED_STATUSES.has(response.status) };
  }

  let html;
  try {
    const bytes = await readHead(response, MAX_BODY_BYTES);
    html = new TextDecoder(detectCharset(contentType, bytes)).decode(bytes);
  } catch (error) {
    return { site: null, hostDown: isHostDown(error), blocked: isBlockedError(error) };
  }

  const { title, description } = extractMetadata(html);
  if (isPlaceholderTitle(title)) return { site: null, hostDown: false, blocked: false };
  return { site: { url: cleanUrl(response.url || url), title, description }, hostDown: false, blocked: false };
}

export function cleanUrl(url) {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.hash = '';
  return parsed.href;
}

export async function fetchSite(url, options) {
  return (await probeSite(url, options)).site;
}

// Un hote injoignable n'est pas reessaye. blocked est annule par un echec franc (404, 5xx).
export async function fetchFirstReachable(urls, options) {
  const downHosts = new Set();
  let blocked = false;
  let failedClearly = false;
  for (const url of urls) {
    const { hostname } = new URL(url);
    if (downHosts.has(hostname)) continue;
    const probe = await probeSite(url, options);
    if (probe.site) return { site: probe.site, blocked: false };
    if (probe.hostDown) downHosts.add(hostname);
    blocked ||= probe.blocked;
    failedClearly ||= !probe.hostDown && !probe.blocked;
  }
  return { site: null, blocked: blocked && !failedClearly };
}

export async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
