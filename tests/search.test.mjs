import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countByCategory, filterSites, indexSites, isSafeUrl, normalizeText } from '../assets/search.js';

const SITES = indexSites([
  { domain: 'impots.gouv.fr', url: 'https://www.impots.gouv.fr/', title: 'Impôts', description: 'Déclarer ses revenus', category: 'finances', group: 'gouv' },
  { domain: 'ants.gouv.fr', url: 'https://ants.gouv.fr/', title: 'ANTS', description: 'Carte grise et permis', category: 'transports', group: 'gouv' },
  { domain: 'ameli.fr', url: 'https://www.ameli.fr/', title: 'ameli', description: 'Assurance Maladie', category: 'sante', group: 'public' },
  { domain: 'evil.gouv.fr', url: 'javascript:alert(1)', title: 'Evil', description: '', category: 'autres', group: 'gouv' },
]);

test('normalizes accents, case and punctuation', () => {
  assert.equal(normalizeText('  Impôts & Énergie ! '), 'impots energie');
  assert.equal(normalizeText(null), '');
  assert.equal(normalizeText('Cœur Ætna'), 'coeur aetna');
});

test('accepts only http and https urls', () => {
  assert.equal(isSafeUrl('https://x.gouv.fr/'), true);
  assert.equal(isSafeUrl('http://x.gouv.fr/'), true);
  assert.equal(isSafeUrl('javascript:alert(1)'), false);
  assert.equal(isSafeUrl('not a url'), false);
});

test('indexSites drops unsafe urls', () => {
  assert.equal(SITES.some((site) => site.domain === 'evil.gouv.fr'), false);
});

test('indexSites builds a sort key without leading punctuation', () => {
  const [site] = indexSites([{ domain: 'x.gouv.fr', url: 'https://x.gouv.fr/', title: '[ Élection ]', description: '', category: 'autres', group: 'gouv' }]);
  assert.equal(site.sortKey, 'election');
});

test('filters by group and accent-insensitive multi-word query', () => {
  const domains = (options) => filterSites(SITES, options).map((site) => site.domain);
  assert.deepEqual(domains({ group: 'gouv' }), ['impots.gouv.fr', 'ants.gouv.fr']);
  assert.deepEqual(domains({ group: 'gouv', query: 'IMPOTS' }), ['impots.gouv.fr']);
  assert.deepEqual(domains({ group: 'gouv', query: 'carte  grise' }), ['ants.gouv.fr']);
  assert.deepEqual(domains({ group: 'gouv', query: 'carte impots' }), []);
  assert.deepEqual(domains({ group: 'public', query: 'maladie' }), ['ameli.fr']);
  assert.deepEqual(domains({ group: 'gouv', query: 'ants.gouv' }), ['ants.gouv.fr']);
});

test('filters by selected categories', () => {
  const result = filterSites(SITES, { group: 'gouv', categories: ['transports', 'sante'] });
  assert.deepEqual(result.map((site) => site.domain), ['ants.gouv.fr']);
});

test('counts sites by category', () => {
  assert.deepEqual([...countByCategory(SITES)], [['finances', 1], ['transports', 1], ['sante', 1]]);
});
