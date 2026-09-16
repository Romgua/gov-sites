const GOUV_SUFFIX = '.gouv.fr';

const TECHNICAL_LABELS = new Set([
  'staging', 'stage', 'preprod', 'pre-prod', 'preproduction', 'prod', 'production', 'recette',
  'rec', 'dev', 'develop', 'development', 'test', 'tests', 'testing', 'qualif', 'qualification',
  'integration', 'int', 'sandbox', 'demo', 'review', 'preview', 'api', 'apis', 'mail', 'webmail',
  'smtp', 'imap', 'pop', 'mx', 'autodiscover', 'vpn', 'sso', 'auth', 'login', 'cas', 'ldap',
  'metabase', 'grafana', 'kibana', 'portainer', 'proxy', 'minio', 's3', 'cdn', 'static', 'assets',
  'matomo', 'stats', 'analytics', 'sentry', 'git', 'gitlab', 'jenkins', 'ci', 'admin',
  'backoffice', 'bo', 'intranet', 'ftp', 'sftp', 'dns', 'monitoring', 'old', 'backup',
  'storage', 'files', 'upload', 'uploads', 'media', 'img', 'images', 'mta', 'relay', 'lb',
  'redis', 'db', 'pgadmin', 'phpmyadmin', 'keycloak', 'vault', 'rancher', 'k8s', 'argocd',
  'harbor', 'registry', 'nexus', 'sonar', 'sonarqube', 'jira', 'confluence', 'track', 'tracking',
  'enqueteur', 'enquetes', 'limesurvey', 'listes', 'lists', 'sympa', 'tiles', 'openmaptiles',
]);

const TECHNICAL_PATTERNS = [
  /^(feat|feature|fix|pr|mr|branch|hotfix|pre|pp|rec|dev|test|int)-/,
  /-(staging|preprod|dev|test|recette|qualif|demo|review)$/,
  /^(staging|preprod|dev|test|recette|qualif|sandbox|production|prod|ns|mx|smtp|srv|server|vm|node)\d+$/,
  /^[a-f0-9]{8,}$/,
];

const OK_STATUS = /^(200|30[1278])\b/;

export function normalizeDomain(name) {
  return name.trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
}

export function isGouvDomain(domain) {
  return domain.endsWith(GOUV_SUFFIX) && domain.length > GOUV_SUFFIX.length;
}

// "a.b.x.gouv.fr" -> ["a", "b"] : labels a gauche du domaine de base x.gouv.fr.
export function subdomainLabels(domain) {
  const labels = domain.slice(0, -GOUV_SUFFIX.length).split('.');
  return labels.slice(0, -1);
}

export function isTechnicalDomain(domain) {
  return subdomainLabels(domain).some(
    (label) => TECHNICAL_LABELS.has(label) || TECHNICAL_PATTERNS.some((pattern) => pattern.test(label)),
  );
}

// "a.b.gouv.fr" -> "b.gouv.fr", null pour un domaine de base.
export function parentDomain(domain) {
  if (subdomainLabels(domain).length === 0) return null;
  return domain.slice(domain.indexOf('.') + 1);
}

export function hasReachableStatus(record) {
  return OK_STATUS.test(record.http_status) || OK_STATUS.test(record.https_status);
}

export function selectGouvCandidates(records) {
  const candidates = new Map();
  for (const record of records) {
    const domain = normalizeDomain(record.name);
    if (!isGouvDomain(domain) || isTechnicalDomain(domain) || !hasReachableStatus(record)) continue;

    const candidate = candidates.get(domain) ?? { hosts: new Set(), type: '' };
    candidate.hosts.add(record.name.trim().toLowerCase());
    candidate.type ||= record.type ?? '';
    candidates.set(domain, candidate);
  }
  return [...candidates].map(([domain, { hosts, type }]) => ({ domain, hosts: [...hosts].sort(), type }));
}

// https avant http, domaine nu avant www.
export function candidateUrls(domain, hosts = [domain]) {
  const orderedHosts = [...new Set([domain, ...hosts])];
  return [
    ...orderedHosts.map((host) => `https://${host}/`),
    ...orderedHosts.map((host) => `http://${host}/`),
  ];
}
