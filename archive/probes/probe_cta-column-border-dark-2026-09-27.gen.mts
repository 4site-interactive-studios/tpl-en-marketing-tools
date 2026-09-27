// Probe: does the proposed dark-mode remap reach the CTA Text Block's
// COLUMN-level Box Border? The shipped rule matches td.wysiwyg only, and the
// column cell has no class. Every block is the importer's own output
// (loadCatalog = createProject's pipeline) with the named picks substituted.
// The CANDIDATE rule is injected into this probe's head only; styles.css is
// untouched until the verdict.
import fs from 'node:fs';
import { loadCatalog } from '/home/user/email-to-en-marketing-tools/scripts/lib/catalog.mts';
import { segmentEmail } from '/home/user/email-to-en-marketing-tools/src/core/segmenter.ts';
import { rewriteAssetPaths } from '/home/user/email-to-en-marketing-tools/src/core/assets.ts';
import type { Block } from '/home/user/email-to-en-marketing-tools/src/core/types.ts';

const OUT = process.argv[2];
const cat = await loadCatalog();
const byName = (n: string) => {
  const b = cat.blocks.find((x) => x.name === n);
  if (!b) throw new Error(`no block ${n}`);
  return b;
};
type Pick = string | { raw: string };
const resolve = (b: Block, picks: Record<string, Pick>) => {
  const val = (name: string): string => {
    const r = b.replacements.find((x) => x.name === name);
    const p = picks[name];
    if (p === undefined) return r?.defaultValue ?? '';
    if (typeof p !== 'string') return p.raw;
    const o = (r?.options ?? []).find((x) => x.label === p);
    if (!o) throw new Error(`${b.name}: no option "${p}" on ${name} (${(r?.options ?? []).map((x) => x.label).join(' | ')})`);
    return o.value;
  };
  for (const n of Object.keys(picks)) if (!b.replacements.some((x) => x.name === n)) throw new Error(`${b.name}: no field ${n}`);
  let s = b.html;
  for (let i = 0; i < 8 && s.includes('{replacement~'); i++) s = s.replace(/\{replacement~(\w+)\}/g, (_, n) => val(n));
  if (s.includes('{replacement~')) throw new Error(`${b.name}: unresolved tag`);
  return s;
};
const caption = (id: string, text: string) =>
  `<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;" width="600"><tr><td><![endif]-->` +
  `<div style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr>` +
  `<td style="padding:28px 32px 8px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;"><b>${id}</b>: ${text}</td>` +
  `</tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]-->\n`;

const EARTH = { raw: '#362229' };
const EARTH_RGB = { raw: 'rgb(54,34,41)' }; // same colour, invisible to a [style*="#362229"] selector
const EVERGREEN = { raw: '#006837' };
const CTA = byName('Text — CTA Text Block');
const WYS = byName('Text — WYSIWYG Text');

const parts: string[] = [];
const add = (s: string) => parts.push(s);
add(caption('CTA BORDER IN DARK MODE', 'Open in DARK mode. C1, C2 and C5 must show a light green (Grass) border. C3 shows what an unfixed Earth border does in this client. C4 must stay dark green. In LIGHT mode every border is exactly the colour named.'));
add(caption('C1', 'CTA Text Block, Box Border 2px, Earth (the candidate rule should turn it Grass in dark mode)'));
add(resolve(CTA, { block_border: '2px', block_border_color: EARTH }));
add(caption('C2', 'CTA Text Block, Box Border 4px, Earth, Block Padding Left/Right Double, Box Padding Triple'));
add(resolve(CTA, { block_border: '4px', block_border_color: EARTH, block_width: 'Double', block_border_padding: 'Triple - 48px' }));
add(caption('C3 CONTROL', 'CTA Text Block, Box Border 2px, Earth written as rgb() so no rule matches (the unfixed look)'));
add(resolve(CTA, { block_border: '2px', block_border_color: EARTH_RGB }));
add(caption('C4 CONTROL', 'CTA Text Block, Box Border 2px, Evergreen (no rule should touch it)'));
add(resolve(CTA, { block_border: '2px', block_border_color: EVERGREEN }));
add(caption('C5 REFERENCE', 'WYSIWYG Text, Box Border 2px, Earth (the rule already shipped)'));
add(resolve(WYS, { paragraph_copy_border: '2px', paragraph_copy_border_color: EARTH }));

const CANDIDATE = `<style type="text/css">
  /* PROBE CANDIDATE: column-cell Box Border in Earth -> Grass (not yet in styles.css) */
  @media only screen and (max-width: 9999px) {
    [data-ogsc] td[style*="border:"][style*="#362229"] { border-color: #8CC63F !important; }
  }
  @media (prefers-color-scheme: dark) {
    td[style*="border:"][style*="#362229"] { border-color: #8CC63F !important; }
  }
</style>`;

const seg = segmentEmail(cat.html);
let before = cat.html.slice(0, seg.beforeEnd);
before = before.replace('</head>', `${CANDIDATE}\n</head>`);
before = before.replace('<head>', `<head>\n<!--\n  PROBE cta-column-border-dark (${new Date().toISOString().slice(0, 10)}): does a dark-mode remap reach the CTA Text Block's column-cell Box Border?\n  Generated from the importer's own block output (email-to-en-marketing-tools ${process.env.IMPORTER_SHA ?? ''}, TPL ${process.env.TPL_SHA ?? ''}).\n-->`);
const after = cat.html.slice(seg.afterStart);
const doc = before + '\n' + parts.join('\n') + '\n' + after;
const ROOT = 'https://bd6ca9cefa6fb6e0adf1-c2f9aa1adb9f60a775f60074e4c86031.ssl.cf5.rackcdn.com/20002/';
const stripped = doc.replace(/<!--(?!>)(?!<!\[endif)(?!\[if)(?!\s*PROBE)(?!\s*en-tools-)[\s\S]*?-->/g, '');
const openers = (stripped.match(/<!--\[if !mso\]>/g) ?? []).length;
const revealed = (stripped.match(/<!--\[if !mso\]><!-->/g) ?? []).length;
const closers = (stripped.match(/<!--<!\[endif\]-->/g) ?? []).length;
const beforeOpeners = (doc.match(/<!--\[if !mso\]>/g) ?? []).length;
if (openers !== revealed || revealed !== closers || openers !== beforeOpeners) {
  throw new Error(`conditional pairs broken by stripping: [if !mso] ${beforeOpeners}->${openers}, <!--> ${revealed}, <!--<![endif]--> ${closers}`);
}
const live = rewriteAssetPaths(stripped, ROOT).html;
fs.writeFileSync(OUT, live);
console.log('wrote', OUT, live.length, 'bytes');
