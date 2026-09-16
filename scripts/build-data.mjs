import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseCsv, toRecords } from './lib/csv.mjs';
import { candidateUrls, selectGouvCandidates } from './lib/domains.mjs';
import {
  assertNoRegression, buildGouvSites, buildPublicSites, countVerified, sortSites, validateAllowlist,
} from './lib/dataset.mjs';
import { fetchFirstReachable, mapWithConcurrency, USER_AGENT } from './lib/fetch-site.mjs';

const SOURCE_URL = 'https://raw.githubusercontent.com/etalab/noms-de-domaine-organismes-secteur-public/master/domains.csv';
const REQUIRED_COLUMNS = ['name', 'http_status', 'https_status'];
const DEFAULT_CONCURRENCY = 32;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const PROGRESS_STEP = 250;

function readConcurrency() {
  const value = Number(process.env.CONCURRENCY ?? DEFAULT_CONCURRENCY);
  if (!Number.isInteger(value) || value < 1) throw new Error(`CONCURRENCY invalide : ${process.env.CONCURRENCY}`);
  return value;
}

const dataDir = new URL('../data/', import.meta.url);
const outputFile = new URL('sites.json', dataDir);

async function readJson(url, fallback) {
  try {
    return JSON.parse(await readFile(url, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

async function downloadSource() {
  const response = await fetch(SOURCE_URL, {
    headers: { 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Telechargement de la source impossible : HTTP ${response.status}`);
  return toRecords(parseCsv(await response.text()), REQUIRED_COLUMNS);
}

async function checkAll(label, items, toUrls, concurrency) {
  let done = 0;
  return mapWithConcurrency(items, concurrency, async (item) => {
    const result = await fetchFirstReachable(toUrls(item));
    done++;
    if (done % PROGRESS_STEP === 0 || done === items.length) console.log(`[${label}] ${done}/${items.length}`);
    return result;
  });
}

async function main() {
  const concurrency = readConcurrency();
  const overrides = await readJson(new URL('overrides.json', dataDir), {});
  const allowlist = validateAllowlist(await readJson(new URL('public-sites.json', dataDir), []));
  const previous = await readJson(outputFile, { sites: [] });

  const records = await downloadSource();
  const candidates = selectGouvCandidates(records);
  console.log(`${records.length} lignes source, ${candidates.length} domaines .gouv.fr candidats`);

  const gouvResults = await checkAll('gouv', candidates, (candidate) => candidateUrls(candidate.domain, candidate.hosts), concurrency);
  const gouvSites = buildGouvSites(
    candidates.map((candidate, index) => ({
      ...candidate,
      result: gouvResults[index].site,
      blocked: gouvResults[index].blocked,
    })),
    overrides,
  );

  const publicResults = await checkAll('public', allowlist, (entry) => [entry.url], concurrency);
  const publicSites = buildPublicSites(allowlist, publicResults.map((probe) => probe.site));

  // Aussi sur les verifies : un blocage de la CI les fait passer en non verifies.
  const previousGouv = previous.sites.filter((site) => site.group === 'gouv');
  assertNoRegression(previousGouv.length, gouvSites.length);
  assertNoRegression(countVerified(previousGouv), countVerified(gouvSites));

  const sites = sortSites([...gouvSites, ...publicSites]);
  const temporaryFile = new URL('sites.json.tmp', dataDir);
  await writeFile(temporaryFile, `${JSON.stringify({ source: SOURCE_URL, sites }, null, 1)}\n`);
  await rename(temporaryFile, outputFile);

  console.log(
    `${gouvSites.length} sites .gouv.fr (${countVerified(gouvSites)} verifies), `
    + `${publicSites.length} services publics (${countVerified(publicSites)} verifies)`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
