#!/usr/bin/env node
/**
 * Post-build restoration pass — runs AFTER mjml compilation.
 *
 * The prebuild pass (annotate-excluded.mjs) smuggles the exclusion flags
 * through the compiler as css-classes, because MJML rejects data-* attributes
 * on its tags. This pass converts them back in dist/*.html:
 *
 *   class="… fully-excluded"          →  data-fully-exclude="true"
 *   class="… fully-excluded-outlook"  →  data-fully-exclude="true"
 *   class="… import-excluded"         →  (token removed; the wrapper div
 *                                         already carries data-import-exclude)
 *
 * Net effect: the compiled HTML ends up with the same data-* attributes the
 * source MJML declares, on the corresponding output elements, with no marker
 * classes left behind.
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const MARKERS = ['fully-excluded', 'fully-excluded-outlook', 'import-excluded'];

for (const f of readdirSync(DIST)) {
  if (!f.endsWith('.html')) continue;
  let fully = 0;
  let imports = 0;

  const html = readFileSync(join(DIST, f), 'utf8').replace(/ class="([^"]*)"/g, (whole, cls) => {
    const tokens = cls.split(/\s+/).filter(Boolean);
    if (!tokens.some((t) => MARKERS.includes(t))) return whole;

    const kept = tokens.filter((t) => !MARKERS.includes(t));
    const wasFully = tokens.includes('fully-excluded') || tokens.includes('fully-excluded-outlook');
    if (wasFully) fully += 1;
    if (tokens.includes('import-excluded')) imports += 1;

    let out = kept.length ? ` class="${kept.join(' ')}"` : '';
    if (wasFully) out += ' data-fully-exclude="true"';
    return out;
  });

  writeFileSync(join(DIST, f), html);
  console.log(`restore: ${f} — ${fully} data-fully-exclude set, ${imports} import-excluded classes removed`);
}
