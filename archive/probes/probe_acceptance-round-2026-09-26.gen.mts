// Acceptance probe for #41 (Text Size), #44 (Box Border), #46 (spacer None),
// #50 (alt-arrangement wrapper). Every block below is the importer's own
// output (loadCatalog = createProject's pipeline) with the named picks
// substituted, so what EN sends is exactly what an editor's picks produce.
import fs from 'node:fs';
import { loadCatalog } from '/home/user/email-to-en-marketing-tools/scripts/lib/catalog.mts';
import { segmentEmail } from '/home/user/email-to-en-marketing-tools/src/core/segmenter.ts';
import { rewriteAssetPaths } from '/home/user/email-to-en-marketing-tools/src/core/assets.ts';
import type { Block } from '/home/user/email-to-en-marketing-tools/src/core/types.ts';

const mode = process.argv[2]; // 'control-ir' writes the pre-#51 Icon Row; 'probe' assembles
const OUT = process.argv[3];
const cat = await loadCatalog();
const byName = (n: string) => {
  const b = cat.blocks.find((x) => x.name === n);
  if (!b) throw new Error(`no block ${n}`);
  return b;
};
/** picks: field name -> option LABEL, or {hex} / {raw} for free values */
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
const FERN = { raw: '#39b54a' };
const WYS = 'Text — WYSIWYG Text';
const IR = 'Text and Images — Icon Row';

if (mode === 'control-ir') {
  fs.writeFileSync(OUT, resolve(byName(IR), { block_background_color: FERN, image_position: 'Left', spacer_gap: 'None - 0px' }));
  process.exit(0);
}

const controlIr = fs.readFileSync(process.argv[4], 'utf8');
const caption = (id: string, text: string) =>
  `<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;" width="600"><tr><td><![endif]-->` +
  `<div style="margin:0px auto;max-width:600px;"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;"><tbody><tr>` +
  `<td style="padding:28px 32px 8px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;"><b>${id}</b>: ${text}</td>` +
  `</tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]-->\n`;
const fernText = (gap = 'Single - 16px') => resolve(byName(WYS), { block_background_color: FERN, spacer_gap: gap });
const w = byName(WYS);
const oldZeroRow = (() => {
  // The pre-#47 bytes: the gap section kept, at 0px (the Half fragment with both numbers zeroed)
  const half = (w.replacements.find((r) => r.name === 'spacer_gap')?.options ?? []).find((o) => o.label === 'Half - 8px')!.value;
  return { raw: half.replace(/(height:)8px/g, '$10px') };
})();

const parts: string[] = [];
const add = (s: string) => parts.push(s);

add(caption('SPACER — #46 / BugHerd 290, 291', 'Spacing None must leave NO line between the two blocks. Ground is Sun, blocks are Fern: a line of any colour is a failure, except in S3.'));
add(caption('S1', 'Fern text block, Spacing None / Fern text block (291)'));
add(resolve(w, { block_background_color: FERN, spacer_gap: 'None - 0px' }));
add(fernText());
add(caption('S2', 'Photo, Spacing None / Fern text block (290)'));
add(resolve(byName('Images — Image 1x1'), { spacer_gap: 'None - 0px', caption_display: 'Exclude Block' }));
add(fernText());
add(caption('S3 CONTROL', 'Fern / the OLD 0px spacer row / Fern. A thin line SHOULD show here in Outlook desktop; if it does not, this send cannot judge S1/S2.'));
add(resolve(w, { block_background_color: FERN, spacer_gap: oldZeroRow }));
add(fernText());

add(caption('ICON ROW — #50', 'Each Icon Row is Fern with Spacing None over a Fern text block. No strip of any colour may show under the Icon Row, except in I4.'));
for (const [id, layout] of [['I1', 'Left'], ['I2', 'Right'], ['I3', 'No Icon']] as const) {
  add(caption(id, `Icon Row, Layout ${layout}` + (layout === 'No Icon' ? '. Its WHITE background is a known separate bug (#52): judge only the strip under it.' : '')));
  add(resolve(byName(IR), { block_background_color: FERN, image_position: layout, spacer_gap: 'None - 0px' }));
  add(fernText());
}
add(caption('I4 CONTROL', 'Icon Row, Layout Left, as the importer built it BEFORE the fix: an empty Outlook table (white) SHOULD show as a strip under it in Outlook desktop.'));
add(controlIr);
add(fernText());

add(caption('TEXT SIZE — #41 / BugHerd 285, 288', 'Same paragraph at each Text Size. The WHOLE paragraph must shrink, line spacing included, in every client and in dark mode.'));
for (const [id, size] of [['T1', 'Default - 18/24'], ['T2', 'Small - 16/24'], ['T3', 'Fine Print - 14/18']] as const) {
  add(caption(id, `Text Size ${size.replace(' - ', ' (')})`));
  add(resolve(w, { paragraph_copy_text_size: size }));
}

add(caption('BOX BORDER — #44 / BugHerd 295', 'The box sits inside the block gutter on desktop; on a phone it runs to the screen edge with the copy 16px inside. Judge whether mobile should keep a margin.'));
add(caption('B1', 'Box Border None (no box)'));
add(resolve(w, { paragraph_copy_border: 'None' }));
add(caption('B2', 'Box Border 2px, default colour (Evergreen)'));
add(resolve(w, { paragraph_copy_border: '2px' }));
add(caption('B3', 'Box Border 4px, colour Earth'));
add(resolve(w, { paragraph_copy_border: '4px', paragraph_copy_border_color: { raw: '#362229' } }));
add(caption('B4', 'Box Border 2px Fern + Text Size Fine Print, on a Moss block'));
add(resolve(w, { paragraph_copy_border: '2px', paragraph_copy_border_color: FERN, paragraph_copy_text_size: 'Fine Print - 14/18', block_background_color: { raw: '#cee4c5' } }));

const seg = segmentEmail(cat.html);
let before = cat.html.slice(0, seg.beforeEnd);
const bodyAt = before.indexOf('<body');
before = before.slice(0, bodyAt) + before.slice(bodyAt).replace(/background-color:#ffffff;/g, 'background-color:#F7931E;');
before = before.replace('<head>', `<head>\n<!--\n  PROBE — acceptance round for #41 Text Size, #44 Box Border, #46 spacer None, #50 alt-arrangement wrapper (${new Date().toISOString().slice(0, 10)}).\n  Generated from the importer's own block output (email-to-en-marketing-tools main ${process.env.IMPORTER_SHA ?? ''}, TPL main ${process.env.TPL_SHA ?? ''}).\n  Instrument colours: Sun ground, Fern blocks, Earth captions (palette only).\n-->`);
const after = cat.html.slice(seg.afterStart);
const doc = before + '\n' + parts.join('\n') + '\n' + after;
const ROOT = 'https://bd6ca9cefa6fb6e0adf1-c2f9aa1adb9f60a775f60074e4c86031.ssl.cf5.rackcdn.com/20002/';
const live = rewriteAssetPaths(doc, ROOT).html;
fs.writeFileSync(OUT, live);
console.log('wrote', OUT, live.length, 'bytes');
