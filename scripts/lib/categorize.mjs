import { CATEGORY_IDS } from '../../assets/categories.js';

const DOMAIN_WEIGHT = 3;
const TEXT_WEIGHT = 1;

// Ancre en debut de mot, lettres accentuees comprises.
function words(source) {
  return new RegExp(`(?<!\\p{L})(?:${source})`, 'gu');
}

// En cas d'egalite, la premiere regle gagne.
const RULES = [
  {
    id: 'territoires',
    domain: /\b(dreal|draaf|drac|dreets|ddets|ddt|ddtm|ddpp|ddcs|drjscs|drihl|driea|dir[a-z]{1,3}|sgar|prefecture|sous-prefecture)\b/g,
    text: words("services de l.[ée]tat|pr[ée]fecture|pr[ée]fet|sous-pr[ée]fecture|direction r[ée]gionale|direction d[ée]partementale"),
  },
  {
    id: 'finances',
    domain: /\b(impots|economie|budget|douane|dgfip|tresor|finances|comptes|cadastre|marches-publics|achatpublic|fiscalite)\b/g,
    text: words('imp[oô]ts?|fiscal|finances|budget|douanes?\\b|tr[ée]sor|comptabilit|tax(?:e|es)\\b|march[ée]s publics|cadastre|monnaie'),
  },
  {
    id: 'sante',
    domain: /\b(sante|solidarites|ars|handicap|social|famille|retraite|autonomie|vaccination|medicament)\b/g,
    text: words("sant[ée]\\b|m[ée]dic|h[oô]pita|soins\\b|handicap|solidarit|sociale?s?\\b|s[ée]curit[ée] sociale|retraite|famille|autonomie|vaccin|maladie|pr[ée]vention"),
  },
  {
    id: 'emploi',
    domain: /\b(travail|emploi|formation|apprentissage|inclusion|chomage|competences|metiers)\b/g,
    text: words('travail|emplois?\\b|formation professionnelle|apprentissage|ch[oô]mage|recrutement|insertion|comp[ée]tences|m[ée]tiers'),
  },
  {
    id: 'education',
    domain: /\b(education|enseignement|etudiant|recherche|universite|sup|eduscol|ecole|lycee|college|academie|science|parcoursup|onisep)\b/g,
    text: words('[ée]ducation|enseignement|[ée]coles?\\b|[ée]l[eè]ves?\\b|[ée]tudiant|universit|recherche scientifique|la recherche\\b|scientifique|scolaire|p[ée]dagog|acad[ée]mie'),
  },
  {
    id: 'justice',
    domain: /\b(justice|interieur|police|gendarmerie|securite(?!-routiere)|cybermalveillance|ssi|anssi|pharos|legifrance|conseil-etat|prisons?)\b/g,
    text: words("justice|tribuna|juridi|police\\b|gendarmerie|s[ée]curit[ée] (?:int[ée]rieure|publique|civile)|cyber|p[ée]nitentiaire|d[ée]linquance|victimes?\\b|droits?\\b|lois\\b|loi\\b|l[ée]gislati"),
  },
  {
    id: 'defense',
    domain: /\b(defense|armees|diplomatie|france-diplomatie|ambafrance|consulat|europe|affaires-etrangeres|veterans|onac)\b/g,
    text: words("d[ée]fense|arm[ée]es?\\b|militaire|diplomat|ambassade|consulat|international|europ[ée]en|affaires [ée]trang[eè]res|anciens combattants"),
  },
  {
    id: 'transports',
    domain: /\b(transports?|mobilites?|routes?|routiere|aviation|dgac|maritime|mer|ferroviaire|permis|ants|antai|velo|stationnement)\b/g,
    text: words('transports?\\b|mobilit|routi[eè]re|permis de conduire|v[ée]hicules?\\b|aviation|a[ée]rien|maritime|ferroviaire|carte grise|circulation'),
  },
  {
    id: 'environnement',
    domain: /\b(ecologie|environnement|developpement-durable|agriculture|alimentation|energie|climat|biodiversite|eau|foret|meteo|risques|georisques|vigicrues|peche|nucleaire)\b/g,
    text: words("[ée]colog|environnement|climat|biodiversit|agricul|alimentation|[ée]nergie|for[eê]ts?\\b|eaux?\\b|pollution|risques naturels|d[ée]veloppement durable|nucl[ée]aire|p[eê]che\\b"),
  },
  {
    id: 'logement',
    domain: /\b(logement|habitat|cohesion-territoires|urbanisme|renovation|anah|france-renov)\b/g,
    text: words("logements?\\b|habitat|urbanisme|r[ée]novation|locataire|propri[ée]taire|h[ée]bergement d.urgence"),
  },
  {
    id: 'entreprises',
    domain: /\b(entreprises?|commerce|industrie|export|artisanat|tourisme|consommation|dgccrf|concurrence|innovation)\b/g,
    text: words('entreprise|commerce|industri|export|artisan|tourisme|consommat|concurrence|[ée]conomi|innovation|investissement'),
  },
  {
    id: 'culture',
    domain: /\b(culture|patrimoine|musees?|archives|sports?|jeunesse|jeux|bibliotheque|cinema|associations?|engagement|service-civique|snu)\b/g,
    text: words("culture|patrimoine|mus[ée]es?\\b|archives|sports?\\b|sporti|jeunesse|biblioth[eè]que|cin[ée]ma|arts?\\b|associati|b[ée]n[ée]vol|engagement civique"),
  },
  {
    id: 'numerique',
    domain: /\b(numerique|data|donnees|beta|api|franceconnect|etalab|code|opendata|dinum|incubateur|design|tchap|agent-connect|proconnect)\b/g,
    text: words("num[ée]rique|open ?data|donn[ée]es (?:publiques|ouvertes)|api\\b|logiciel|startups? d.[ée]tat|d[ée]mat[ée]rialis|identit[ée] num[ée]rique|informatique|intelligence artificielle"),
  },
  {
    id: 'institutions',
    domain: /\b(gouvernement|premier-ministre|elysee|service-public|modernisation|fonction-publique|vie-publique|sgg|sgdsn|cour|conseil|haut-conseil|mediateur|defenseur|annuaire|elections)\b/g,
    text: words("gouvernement|premier ministre|minist[eè]re|fonction publique|[ée]lections?\\b|institution|administration|conseil d.[ée]tat|haut conseil|m[ée]diateur|d[ée]marches administratives"),
  },
];

function normalize(text) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function countMatches(pattern, text) {
  return text.match(pattern)?.length ?? 0;
}

export function categorize({ domain, title = '', description = '' }, overrides = {}) {
  const forced = overrides[domain];
  if (forced && CATEGORY_IDS.includes(forced)) return forced;

  const domainText = domain.replace(/\.gouv\.fr$/, '').replace(/\./g, ' ');
  const text = `${title} ${description}`.toLowerCase();
  const textWithoutAccents = normalize(text);

  let best = { id: 'autres', score: 0 };
  for (const rule of RULES) {
    const score = DOMAIN_WEIGHT * countMatches(rule.domain, domainText)
      + TEXT_WEIGHT * Math.max(countMatches(rule.text, text), countMatches(rule.text, textWithoutAccents));
    if (score > best.score) best = { id: rule.id, score };
  }
  return best.id;
}
