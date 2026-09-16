import { CATEGORY_IDS } from '../../assets/categories.js';
import { categorize } from './categorize.mjs';
import { isGouvDomain, normalizeDomain, parentDomain } from './domains.mjs';

export const MIN_KEPT_RATIO = 0.8;

function comparableTitle(title) {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

function hostOf(url) {
  return normalizeDomain(new URL(url).hostname);
}

function hasSameTitleAsAncestor(domain, titlesByDomain) {
  const title = comparableTitle(titlesByDomain.get(domain));
  for (let parent = parentDomain(domain); parent; parent = parentDomain(parent)) {
    if (titlesByDomain.has(parent)) return comparableTitle(titlesByDomain.get(parent)) === title;
  }
  return false;
}

function pathLength(url) {
  return new URL(url).pathname.length;
}

// Un site par hote final : domaine sans redirection, sinon chemin le plus court.
function dedupeByFinalHost(entries) {
  const byHost = new Map();
  for (const entry of entries) {
    const host = hostOf(entry.url);
    const current = byHost.get(host);
    const isBetter = !current
      || (entry.domain === host && current.domain !== host)
      || (current.domain !== host && pathLength(entry.url) < pathLength(current.url));
    if (isBetter) byHost.set(host, entry);
  }
  return [...byHost].map(([host, entry]) => ({ ...entry, domain: host }));
}

const CATEGORY_BY_SOURCE_TYPE = {
  'Préfécture': 'territoires',
  'Préfecture': 'territoires',
  'Ministère': 'institutions',
  'Ambassade': 'defense',
};

const LOWERCASE_WORDS = new Set(['de', 'du', 'des', 'et', 'la', 'le', 'les', 'sur', 'en']);

// Les domaines accentues doublonnent leur version ASCII.
function isAsciiDomain(domain) {
  return /^[a-z0-9.-]+$/.test(domain) && !domain.split('.').some((label) => label.startsWith('xn--'));
}

function capitalizeLabel(label) {
  return label
    .split('-')
    .map((part, index) => (index > 0 && LOWERCASE_WORDS.has(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('-');
}

// Domaine de base actif selon la source mais qui bloque nos requetes.
function toUnverifiedSite(check, overrides) {
  const { domain, hosts = [], type = '' } = check;
  const host = hosts.includes(`www.${domain}`) ? `www.${domain}` : domain;
  const category = CATEGORY_BY_SOURCE_TYPE[type];
  return {
    domain,
    url: `https://${host}/`,
    title: category === 'territoires' ? `Préfecture : ${capitalizeLabel(domain.split('.')[0])}` : domain,
    description: '',
    category: CATEGORY_IDS.includes(overrides.categories?.[domain])
      ? overrides.categories[domain]
      : category ?? categorize({ domain }),
    group: 'gouv',
    verified: false,
  };
}

export function buildGouvSites(checks, overrides = {}) {
  const verified = buildVerifiedGouvSites(checks, overrides);
  const excluded = new Set(overrides.exclude ?? []);
  const known = new Set([
    ...verified.map((site) => site.domain),
    ...checks.filter((check) => check.result).map((check) => check.domain),
  ]);
  const unverified = checks
    .filter((check) => !check.result && check.blocked && parentDomain(check.domain) === null && isAsciiDomain(check.domain))
    .filter((check) => !known.has(check.domain) && !excluded.has(check.domain))
    .map((check) => toUnverifiedSite(check, overrides));
  return [...verified, ...unverified];
}

function buildVerifiedGouvSites(checks, overrides) {
  const excluded = new Set(overrides.exclude ?? []);
  const live = checks.filter(
    (check) => check.result && !excluded.has(check.domain) && isGouvDomain(hostOf(check.result.url)),
  );
  const titlesByDomain = new Map(live.map((check) => [check.domain, check.result.title]));

  const entries = live
    .filter((check) => !hasSameTitleAsAncestor(check.domain, titlesByDomain))
    .map((check) => ({ domain: check.domain, ...check.result }));

  return dedupeByFinalHost(entries)
    .filter((entry) => !excluded.has(entry.domain))
    .map((entry) => ({
      domain: entry.domain,
      url: entry.url,
      title: entry.title,
      description: entry.description,
      category: categorize(entry, overrides.categories),
      group: 'gouv',
      verified: true,
    }));
}

export function validateAllowlist(allowlist) {
  if (!Array.isArray(allowlist)) throw new Error('public-sites.json doit contenir un tableau.');
  const seen = new Set();
  allowlist.forEach((entry, index) => {
    const where = `public-sites.json[${index}]`;
    if (entry === null || typeof entry !== 'object') throw new Error(`${where} : objet attendu`);
    if (typeof entry.name !== 'string' || entry.name.trim() === '') throw new Error(`${where} : name manquant`);
    if (!CATEGORY_IDS.includes(entry.category)) throw new Error(`${where} : categorie inconnue "${entry.category}"`);
    let url;
    try {
      url = new URL(entry.url);
    } catch {
      throw new Error(`${where} : url invalide`);
    }
    if (url.protocol !== 'https:') throw new Error(`${where} : url en https attendue`);
    const domain = normalizeDomain(url.hostname);
    if (isGouvDomain(domain)) throw new Error(`${where} : domaine .gouv.fr interdit ici`);
    if (seen.has(domain)) throw new Error(`${where} : doublon ${domain}`);
    seen.add(domain);
  });
  return allowlist;
}

// Les entrees restent meme si la verification echoue.
export function buildPublicSites(allowlist, results) {
  return allowlist.map((entry, index) => {
    const result = results[index];
    return {
      domain: normalizeDomain(new URL(entry.url).hostname),
      url: entry.url,
      title: entry.name,
      description: entry.description || result?.description || '',
      category: entry.category,
      group: 'public',
      verified: Boolean(result),
    };
  });
}

export function sortSites(sites) {
  return [...sites].sort((a, b) => a.group.localeCompare(b.group) || a.domain.localeCompare(b.domain));
}

export function countVerified(sites) {
  return sites.filter((site) => site.verified).length;
}

export function assertNoRegression(previousCount, nextCount, minRatio = MIN_KEPT_RATIO) {
  if (nextCount === 0) {
    throw new Error('Aucun site retenu, donnees non mises a jour.');
  }
  if (previousCount > 0 && nextCount < previousCount * minRatio) {
    throw new Error(
      `Chute du nombre de sites (${previousCount} -> ${nextCount}), donnees non mises a jour.`,
    );
  }
}
