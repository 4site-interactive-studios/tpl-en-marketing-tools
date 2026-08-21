/**
 * Copy every source page into dist/, flat.
 *
 * Replaces `cp ./src/*.mjml ./dist/`, which only ever saw the top level and
 * would have silently stopped shipping the autoresponders and any probe the
 * moment src/ grew subfolders (2026-08-21). The importer reads these raw
 * copies, so a missing one is not a build error — it is a page that quietly
 * cannot be imported.
 */
import { copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourcePages } from './lib/source-pages.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = sourcePages(ROOT);
for (const pg of pages) {
  copyFileSync(join(ROOT, 'src', pg.rel), join(ROOT, 'dist', pg.file));
}
console.log(`copy-sources: ${pages.length} page(s) -> dist/ (${pages.map((p) => p.file).join(', ')})`);
