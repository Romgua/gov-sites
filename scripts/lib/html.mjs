const MAX_TITLE_LENGTH = 150;
const MAX_DESCRIPTION_LENGTH = 300;

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è',
  ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', icirc: 'î', ucirc: 'û',
  ugrave: 'ù', euml: 'ë', iuml: 'ï', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç',
};

const PLACEHOLDER_TITLES = [
  /^index of\b/i,
  /welcome to nginx/i,
  /apache.*(default|test) page/i,
  /^iis windows server/i,
  /^(40[0-9]|50[0-9])\b/,
  /\b(not found|forbidden|bad gateway|service unavailable)\b/i,
  /^page (introuvable|non trouv[ée]e)/i,
  /^(site )?en (maintenance|construction)/i,
  /^(default|test) page/i,
  /^(untitled|sans titre|document|home|accueil)$/i,
  /^(login|connexion|sign in|authentification)$/i,
  /^just a moment/i,
  /^attention required/i,
  /^(react|vite|vue|angular) app$/i,
  /^webpage default/i,
  /application indisponible/i,
  /^redirect(ing)?\b/i,
  /limesurvey/i,
  /listes? de diffusion/i,
  /^(tileserver|keycloak|grafana|gitlab|roundcube|sympa|redmine|pentaho)\b/i,
  /(^|[\s|:-])(login|log in|sign in|se connecter|connexion)$/i,
  /^redirection\b/i,
  /\bproxy\b/i,
];

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity] ?? match;
  });
}

export function cleanText(text, maxLength) {
  const cleaned = decodeEntities(text.replace(/<[^>]*>/g, ' '))
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trimEnd()}…` : cleaned;
}

function metaContent(html, name) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const nameMatch = tag.match(/\b(?:name|property)\s*=\s*["']([^"']+)["']/i);
    if (nameMatch?.[1].toLowerCase() !== name) continue;
    const contentMatch = tag.match(/\bcontent\s*=\s*"([^"]*)"/i) ?? tag.match(/\bcontent\s*=\s*'([^']*)'/i);
    if (contentMatch) return contentMatch[1];
  }
  return '';
}

export function extractMetadata(html) {
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const rawTitle = titleMatch?.[1] || metaContent(html, 'og:title');
  const rawDescription = metaContent(html, 'description') || metaContent(html, 'og:description');
  return {
    title: cleanText(rawTitle ?? '', MAX_TITLE_LENGTH),
    description: cleanText(rawDescription, MAX_DESCRIPTION_LENGTH),
  };
}

export function isPlaceholderTitle(title) {
  return title === '' || PLACEHOLDER_TITLES.some((pattern) => pattern.test(title));
}
