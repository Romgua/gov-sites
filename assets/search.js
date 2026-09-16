export function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.]+/g, ' ')
    .trim();
}

export function isSafeUrl(url) {
  try {
    const { protocol } = new URL(url);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export function indexSites(sites) {
  return sites
    .filter((site) => isSafeUrl(site.url))
    .map((site) => ({
      ...site,
      searchText: normalizeText(`${site.title} ${site.domain} ${site.description}`),
      sortKey: normalizeText(site.title) || site.domain,
    }));
}

// Tous les mots doivent correspondre. Aucune categorie = pas de filtre.
export function filterSites(indexedSites, { group, query = '', categories = [] }) {
  const terms = normalizeText(query).split(' ').filter(Boolean);
  const selected = new Set(categories);
  return indexedSites.filter((site) =>
    site.group === group
    && (selected.size === 0 || selected.has(site.category))
    && terms.every((term) => site.searchText.includes(term)));
}

export function countByCategory(sites) {
  const counts = new Map();
  for (const site of sites) counts.set(site.category, (counts.get(site.category) ?? 0) + 1);
  return counts;
}
