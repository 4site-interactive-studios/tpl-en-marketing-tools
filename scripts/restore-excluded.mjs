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

  const fluid = applyInlineFluid(html);
  const fluidTds = (html.match(/\binline-fluid\b/g) || []).length;
  writeFileSync(join(DIST, f), fluid.html);
  console.log(
    `restore: ${f} — ${fully} data-fully-exclude set, ${imports} import-excluded classes removed` +
      (fluidTds ? `, ${fluid.rewrites} inline-fluid tds -> 100%` : ''),
  );
}

/**
 * Mirror of the APP's applyInlineFluid (src/core/mjml.ts — keep in step):
 * every td classed inline-fluid (the mj-image wrapper) gets its constraining
 * inner td rewritten from width:Npx to width:100%, so the no-CSS rendering
 * is the correct mobile rendering (probe_fullbleed-grid-images, guide
 * §2b-bis). Fail-open per image; idempotent.
 */
function applyInlineFluid(html) {
  const outer = /<td\b[^>]*class="[^"]*\binline-fluid\b[^"]*"[^>]*>/g;
  let out = '';
  let pos = 0;
  let rewrites = 0;
  let m;
  while ((m = outer.exec(html))) {
    const searchFrom = m.index + m[0].length;
    const inner = /<td\b[^>]*?style="([^"]*?)"[^>]*>/g;
    inner.lastIndex = searchFrom;
    const im = inner.exec(html);
    if (!im || im.index - searchFrom > 2000) continue;
    const style = im[1];
    if (!/(^|;|\s)width:\s*\d+(?:\.\d+)?px/.test(style)) continue;
    const styleStart = im.index + im[0].indexOf(style);
    out += html.slice(pos, styleStart) + style.replace(/width:\s*\d+(?:\.\d+)?px/, 'width:100%');
    pos = styleStart + style.length;
    outer.lastIndex = pos;
    rewrites += 1;
    // Bordered fluid images: box-sizing so 100% includes the border widths
    const imgRe = /<img\b[^>]*style="([^"]*)"[^>]*>/g;
    imgRe.lastIndex = pos;
    const gm = imgRe.exec(html);
    if (
      gm &&
      gm.index - pos < 2000 &&
      /(^|;|\s)border:\s*[1-9]/.test(gm[1]) &&
      !gm[1].includes('box-sizing')
    ) {
      const s = gm[1];
      const sStart = gm.index + gm[0].indexOf(s);
      out += html.slice(pos, sStart) + s + (s.trim().endsWith(';') ? '' : ';') + 'box-sizing:border-box;';
      pos = sStart + s.length;
      outer.lastIndex = pos;
    }
  }
  return { html: out + html.slice(pos), rewrites };
}
