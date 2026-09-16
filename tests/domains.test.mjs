import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  candidateUrls, hasReachableStatus, isGouvDomain, isTechnicalDomain, normalizeDomain, parentDomain,
  selectGouvCandidates, subdomainLabels,
} from '../scripts/lib/domains.mjs';

test('normalizes case, trailing dot and www prefix', () => {
  assert.equal(normalizeDomain(' WWW.Impots.gouv.fr. '), 'impots.gouv.fr');
});

test('recognizes gouv.fr domains only', () => {
  assert.equal(isGouvDomain('impots.gouv.fr'), true);
  assert.equal(isGouvDomain('gouv.fr'), false);
  assert.equal(isGouvDomain('ameli.fr'), false);
  assert.equal(isGouvDomain('fakegouv.fr'), false);
});

test('extracts labels left of the base gouv.fr domain', () => {
  assert.deepEqual(subdomainLabels('api.gouv.fr'), []);
  assert.deepEqual(subdomainLabels('staging.entreprise.api.gouv.fr'), ['staging', 'entreprise']);
});

test('flags technical subdomains but not base domains', () => {
  for (const domain of [
    'staging.entreprise.api.gouv.fr', 'mail.numerique.gouv.fr', 'metabase.conseiller-numerique.gouv.fr',
    'sandbox5.particulier.api.gouv.fr', 'feat-searchable-select.stack.incubateur.anct.gouv.fr',
    'app-preprod.exemple.gouv.fr', 'enqueteur.jura.equipement-agriculture.gouv.fr', 'pre-dpi.sante.gouv.fr',
    'listes.sup-numerique.gouv.fr',
  ]) {
    assert.equal(isTechnicalDomain(domain), true, domain);
  }
  for (const domain of ['api.gouv.fr', 'particulier.api.gouv.fr', 'corse.drjscs.gouv.fr', 'beta.gouv.fr']) {
    assert.equal(isTechnicalDomain(domain), false, domain);
  }
});

test('returns parent domain or null for a base domain', () => {
  assert.equal(parentDomain('corse.drjscs.gouv.fr'), 'drjscs.gouv.fr');
  assert.equal(parentDomain('drjscs.gouv.fr'), null);
});

test('accepts 200 and redirect statuses from either column', () => {
  assert.equal(hasReachableStatus({ http_status: '301 Moved Permanently https://x', https_status: '' }), true);
  assert.equal(hasReachableStatus({ http_status: 'Connection failed', https_status: '200 OK' }), true);
  assert.equal(hasReachableStatus({ http_status: '404 Not Found', https_status: 'certificate verify failed' }), false);
});

test('selects gouv candidates grouped by normalized domain', () => {
  const ok = { http_status: '200 OK', https_status: '' };
  const candidates = selectGouvCandidates([
    { name: 'www.impots.gouv.fr', ...ok, type: 'Gouvernement' },
    { name: 'impots.gouv.fr', ...ok },
    { name: 'staging.impots.gouv.fr', ...ok },
    { name: 'ameli.fr', ...ok },
    { name: 'dead.gouv.fr', http_status: 'Connection failed', https_status: '' },
  ]);
  assert.deepEqual(candidates, [
    { domain: 'impots.gouv.fr', hosts: ['impots.gouv.fr', 'www.impots.gouv.fr'], type: 'Gouvernement' },
  ]);
});

test('orders candidate urls https first then bare domain first', () => {
  assert.deepEqual(candidateUrls('x.gouv.fr', ['www.x.gouv.fr', 'x.gouv.fr']), [
    'https://x.gouv.fr/', 'https://www.x.gouv.fr/', 'http://x.gouv.fr/', 'http://www.x.gouv.fr/',
  ]);
});
