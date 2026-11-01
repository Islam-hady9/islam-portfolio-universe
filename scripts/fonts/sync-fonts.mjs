// Copies the OFL-licensed variable fonts used by the site from @fontsource-variable packages
// into src/assets/fonts together with their licence files, so builds are deterministic and
// offline. Run after upgrading the font packages: `npm run fonts:sync`.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'src/assets/fonts');
mkdirSync(outDir, { recursive: true });

const fonts = [
  { pkg: 'sora', files: ['sora-latin-wght-normal.woff2', 'sora-latin-ext-wght-normal.woff2'] },
  { pkg: 'manrope', files: ['manrope-latin-wght-normal.woff2'] },
  { pkg: 'jetbrains-mono', files: ['jetbrains-mono-latin-wght-normal.woff2'] },
];

for (const { pkg, files } of fonts) {
  const base = join(root, 'node_modules/@fontsource-variable', pkg);
  if (!existsSync(base)) throw new Error(`Missing font package @fontsource-variable/${pkg}. Run npm install.`);
  for (const file of files) copyFileSync(join(base, 'files', file), join(outDir, file));
  copyFileSync(join(base, 'LICENSE'), join(outDir, `${pkg}.LICENSE.txt`));
  console.log(`synced ${pkg}`);
}
