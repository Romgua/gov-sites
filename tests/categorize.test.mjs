import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize } from '../scripts/lib/categorize.mjs';

test('categorizes from domain keywords', () => {
  assert.equal(categorize({ domain: 'impots.gouv.fr' }), 'finances');
  assert.equal(categorize({ domain: 'travail-emploi.gouv.fr' }), 'emploi');
  assert.equal(categorize({ domain: 'securite-routiere.gouv.fr' }), 'transports');
  assert.equal(categorize({ domain: 'corse.drjscs.gouv.fr' }), 'territoires');
});

test('categorizes from title and description with or without accents', () => {
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Les services de l’État dans le Nord' }), 'territoires');
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Portail de la sante publique' }), 'sante');
  assert.equal(categorize({ domain: 'xyz.gouv.fr', description: 'Enseignement supérieur et recherche' }), 'education');
});

test('domain keywords outweigh a single text keyword', () => {
  assert.equal(categorize({ domain: 'impots.gouv.fr', title: 'Espace santé' }), 'finances');
});

test('does not match keywords inside other words', () => {
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Répondre à vos besoins. Rechercher' }), 'autres');
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Offres d’emplois' }), 'emploi');
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Horaires des transports' }), 'transports');
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Hébergement de sites web' }), 'autres');
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Écoles et élèves' }), 'education');
});

test('falls back to autres without any match', () => {
  assert.equal(categorize({ domain: 'xyz.gouv.fr', title: 'Bienvenue' }), 'autres');
});

test('applies valid overrides and ignores unknown categories', () => {
  assert.equal(categorize({ domain: 'xyz.gouv.fr' }, { 'xyz.gouv.fr': 'culture' }), 'culture');
  assert.equal(categorize({ domain: 'impots.gouv.fr' }, { 'impots.gouv.fr': 'nope' }), 'finances');
});
