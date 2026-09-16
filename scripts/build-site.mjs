// Copie les fichiers publics dans _site pour GitHub Pages.
import { cp, mkdir, rm } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const output = new URL('_site/', root);
const PUBLIC_FILES = ['index.html', 'assets', 'data/sites.json'];

await rm(output, { recursive: true, force: true });
await mkdir(new URL('data/', output), { recursive: true });
for (const file of PUBLIC_FILES) {
  await cp(new URL(file, root), new URL(file, output), { recursive: true });
}
console.log('Site copie dans _site/');
