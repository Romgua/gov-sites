import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertNoRegression, buildGouvSites, buildPublicSites, countVerified, sortSites, validateAllowlist,
} from '../scripts/lib/dataset.mjs';

const live = (url, title, description = '') => ({ url, title, description });

test('drops unreachable sites and subdomains that repeat the parent title', () => {
  const sites = buildGouvSites([
    { domain: 'drjscs.gouv.fr', result: live('https://drjscs.gouv.fr/', 'DRJSCS') },
    { domain: 'corse.drjscs.gouv.fr', result: live('https://corse.drjscs.gouv.fr/', 'DRJSCS Corse') },
    { domain: 'copy.drjscs.gouv.fr', result: live('https://copy.drjscs.gouv.fr/', ' drjscs ') },
    { domain: 'dead.gouv.fr', result: null },
  ]);
  assert.deepEqual(sites.map((site) => site.domain), ['drjscs.gouv.fr', 'corse.drjscs.gouv.fr']);
  assert.equal(sites[0].group, 'gouv');
  assert.equal(sites[0].verified, true);
});

test('dedupes redirects to the same host and drops redirects leaving gouv.fr', () => {
  const sites = buildGouvSites([
    { domain: 'old.gouv.fr', result: live('https://www.new.gouv.fr/accueil', 'Nouveau') },
    { domain: 'new.gouv.fr', result: live('https://www.new.gouv.fr/', 'Nouveau') },
    { domain: 'other.gouv.fr', result: live('https://www.service-public.fr/', 'SP') },
  ]);
  assert.deepEqual(sites.map((site) => [site.domain, site.url]), [['new.gouv.fr', 'https://www.new.gouv.fr/']]);
});

test('keeps a subdomain whose same-titled parent redirects outside gouv.fr', () => {
  const sites = buildGouvSites([
    { domain: 'x.gouv.fr', result: live('https://www.service-public.fr/', 'Portail') },
    { domain: 'a.x.gouv.fr', result: live('https://a.x.gouv.fr/', 'Portail') },
  ]);
  assert.deepEqual(sites.map((site) => site.domain), ['a.x.gouv.fr']);
});

test('keeps blocked base domains as unverified, using the source type', () => {
  const sites = buildGouvSites(
    [
      { domain: 'nord.gouv.fr', hosts: ['nord.gouv.fr', 'www.nord.gouv.fr'], type: 'Préfécture', result: null, blocked: true },
      { domain: 'alpes-de-haute-provence.gouv.fr', hosts: [], type: 'Préfécture', result: null, blocked: true },
      { domain: 'impots.gouv.fr', hosts: [], type: '', result: null, blocked: true },
      { domain: 'custom.gouv.fr', hosts: [], type: '', result: null, blocked: true },
      { domain: 'app.impots.gouv.fr', hosts: [], type: '', result: null, blocked: true },
      { domain: 'dead.gouv.fr', hosts: [], type: '', result: null, blocked: false },
      { domain: 'old.gouv.fr', result: live('https://new.gouv.fr/', 'New') },
      { domain: 'new.gouv.fr', hosts: [], type: '', result: null, blocked: true },
      { domain: 'éducation.gouv.fr', hosts: [], type: '', result: null, blocked: true },
      { domain: 'xn--ducation-d1a.gouv.fr', hosts: [], type: '', result: null, blocked: true },
      { domain: 'moved.gouv.fr', result: live('https://www.service-public.fr/', 'SP') },
      { domain: 'moved.gouv.fr', hosts: [], type: '', result: null, blocked: true },
    ],
    { categories: { 'custom.gouv.fr': 'culture' } },
  );
  assert.deepEqual(sites.map((site) => [site.domain, site.url, site.title, site.category, site.verified]), [
    ['new.gouv.fr', 'https://new.gouv.fr/', 'New', 'autres', true],
    ['nord.gouv.fr', 'https://www.nord.gouv.fr/', 'Préfecture : Nord', 'territoires', false],
    ['alpes-de-haute-provence.gouv.fr', 'https://alpes-de-haute-provence.gouv.fr/', 'Préfecture : Alpes-de-Haute-Provence', 'territoires', false],
    ['impots.gouv.fr', 'https://impots.gouv.fr/', 'impots.gouv.fr', 'finances', false],
    ['custom.gouv.fr', 'https://custom.gouv.fr/', 'custom.gouv.fr', 'culture', false],
  ]);
});

test('keeps the shortest path when no domain matches the final host', () => {
  const sites = buildGouvSites([
    { domain: 'a.gouv.fr', result: live('https://c.gouv.fr/long/path', 'C') },
    { domain: 'b.gouv.fr', result: live('https://c.gouv.fr/x', 'C') },
  ]);
  assert.deepEqual(sites.map((site) => [site.domain, site.url]), [['c.gouv.fr', 'https://c.gouv.fr/x']]);
});

test('applies exclusions and category overrides', () => {
  const sites = buildGouvSites(
    [
      { domain: 'keep.gouv.fr', result: live('https://keep.gouv.fr/', 'Keep') },
      { domain: 'drop.gouv.fr', result: live('https://drop.gouv.fr/', 'Drop') },
    ],
    { exclude: ['drop.gouv.fr'], categories: { 'keep.gouv.fr': 'culture' } },
  );
  assert.deepEqual(sites.map((site) => [site.domain, site.category]), [['keep.gouv.fr', 'culture']]);
});

test('builds public sites from allowlist, keeping unverified entries', () => {
  const allowlist = [
    { name: 'Ameli', url: 'https://www.ameli.fr/', category: 'sante', description: '' },
    { name: 'CAF', url: 'https://www.caf.fr/', category: 'sante', description: 'Allocations' },
  ];
  const sites = buildPublicSites(allowlist, [live('https://www.ameli.fr/assure', 'Titre', 'Desc'), null]);
  assert.deepEqual(sites, [
    { domain: 'ameli.fr', url: 'https://www.ameli.fr/', title: 'Ameli', description: 'Desc', category: 'sante', group: 'public', verified: true },
    { domain: 'caf.fr', url: 'https://www.caf.fr/', title: 'CAF', description: 'Allocations', category: 'sante', group: 'public', verified: false },
  ]);
});

test('validates allowlist entries', () => {
  const valid = { name: 'X', url: 'https://x.fr/', category: 'sante' };
  assert.doesNotThrow(() => validateAllowlist([valid]));
  assert.throws(() => validateAllowlist({}), /tableau/);
  assert.throws(() => validateAllowlist([null]), /objet/);
  assert.throws(() => validateAllowlist([valid, { ...valid, url: 'https://www.x.fr/' }]), /doublon/);
  assert.throws(() => validateAllowlist([{ ...valid, name: '' }]), /name/);
  assert.throws(() => validateAllowlist([{ ...valid, category: 'nope' }]), /categorie/);
  assert.throws(() => validateAllowlist([{ ...valid, url: 'pas une url' }]), /url invalide/);
  assert.throws(() => validateAllowlist([{ ...valid, url: 'http://x.fr/' }]), /https/);
  assert.throws(() => validateAllowlist([{ ...valid, url: 'https://x.gouv.fr/' }]), /gouv/);
  assert.throws(() => validateAllowlist([valid, valid]), /doublon/);
});

test('the committed allowlist is valid', async () => {
  const allowlist = JSON.parse(await readFile(new URL('../data/public-sites.json', import.meta.url), 'utf8'));
  assert.doesNotThrow(() => validateAllowlist(allowlist));
});

test('sorts by group then domain without mutating input', () => {
  const input = [
    { group: 'public', domain: 'a.fr' },
    { group: 'gouv', domain: 'b.gouv.fr' },
    { group: 'gouv', domain: 'a.gouv.fr' },
  ];
  const sorted = sortSites(input);
  assert.deepEqual(sorted.map((site) => site.domain), ['a.gouv.fr', 'b.gouv.fr', 'a.fr']);
  assert.equal(input[0].domain, 'a.fr');
});

test('countVerified counts only verified sites', () => {
  assert.equal(countVerified([{ verified: true }, { verified: false }, { verified: true }]), 2);
});

test('guards against empty or strongly shrinking results', () => {
  assert.throws(() => assertNoRegression(0, 0), /Aucun site/);
  assert.throws(() => assertNoRegression(1000, 799), /Chute/);
  assert.doesNotThrow(() => assertNoRegression(1000, 800));
  assert.doesNotThrow(() => assertNoRegression(0, 5));
});
