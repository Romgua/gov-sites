import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, decodeEntities, extractMetadata, isPlaceholderTitle } from '../scripts/lib/html.mjs';

test('decodes named, decimal and hex entities', () => {
  assert.equal(decodeEntities('Imp&ocirc;ts &amp; taxes &#233;t&#xE9; &unknown;'), 'Impôts & taxes été &unknown;');
});

test('ignores invalid numeric entities', () => {
  assert.equal(decodeEntities('&#0; &#x110000;'), '&#0; &#x110000;');
});

test('strips tags, collapses whitespace and truncates', () => {
  assert.equal(cleanText('  <b>Hello</b>\n\n world ', 50), 'Hello world');
  assert.equal(cleanText('abcdefghij', 5), 'abcd…');
});

test('extracts title and description, with og fallbacks', () => {
  const html = `<html><head><TITLE lang="fr">
    Accueil | impots.gouv.fr</TITLE>
    <meta content="Le site des impôts" name="description"></head></html>`;
  assert.deepEqual(extractMetadata(html), { title: 'Accueil | impots.gouv.fr', description: 'Le site des impôts' });

  const ogOnly = `<meta property="og:title" content='Titre OG'><meta property="og:description" content="Desc OG">`;
  assert.deepEqual(extractMetadata(ogOnly), { title: 'Titre OG', description: 'Desc OG' });
});

test('keeps script-like title text as plain text', () => {
  const { title } = extractMetadata('<title>&lt;script&gt;alert(1)&lt;/script&gt;</title>');
  assert.equal(title, '<script>alert(1)</script>');
});

test('detects placeholder and error titles', () => {
  for (const title of ['', 'Index of /', 'Welcome to nginx!', '404 Not Found', 'Site en maintenance', 'Accueil', 'Just a moment...', 'React App', 'LimeSurvey -- accueil', 'DNUM - Application indisponible', 'Webpage default', 'SUMiT login', '- Login', 'Redirection vers l’accueil', 'ISL Conference Proxy', 'Redmine qgis']) {
    assert.equal(isPlaceholderTitle(title), true, title);
  }
  assert.equal(isPlaceholderTitle('Accueil | Service-Public.fr'), false);
  assert.equal(isPlaceholderTitle('Connexion aux services en ligne des douanes'), false);
});
