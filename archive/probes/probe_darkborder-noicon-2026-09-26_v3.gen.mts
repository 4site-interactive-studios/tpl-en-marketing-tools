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
const EARTH = { raw: '#362229' };
const EVERGREEN = { raw: '#006837' };

add(caption('DARK-MODE BORDER — #44', 'In DARK mode, D1 and D2 must show a light green (Grass) border, not a near-invisible dark one. Light mode: Earth, as picked. D3 is the control and must look the same as before.'));
add(caption('D1', 'Box Border 4px, colour Earth'));
add(resolve(w, { paragraph_copy_border: '4px', paragraph_copy_border_color: EARTH }));
add(caption('D2', 'Box Border 2px, colour Earth, Text Size Fine Print'));
add(resolve(w, { paragraph_copy_border: '2px', paragraph_copy_border_color: EARTH, paragraph_copy_text_size: 'Fine Print - 14/18' }));
add(caption('D3 CONTROL', 'Box Border 2px, colour Evergreen (unchanged by the dark-mode rule)'));
add(resolve(w, { paragraph_copy_border: '2px', paragraph_copy_border_color: EVERGREEN }));

add(caption('ICON ROW NO ICON — #52', 'Both rows are Fern with Spacing None. N1 (No Icon) must be Fern like N2, not white.'));
add(caption('N1', 'Icon Row, Layout No Icon, Block Background Fern'));
add(resolve(byName(IR), { block_background_color: FERN, image_position: 'No Icon', spacer_gap: 'None - 0px' }));
add(fernText());
add(caption('N2 CONTROL', 'Icon Row, Layout Left, Block Background Fern'));
add(resolve(byName(IR), { block_background_color: FERN, image_position: 'Left', spacer_gap: 'None - 0px' }));
add(fernText());

const seg = segmentEmail(cat.html);
let before = cat.html.slice(0, seg.beforeEnd);
const bodyAt = before.indexOf('<body');
before = before.slice(0, bodyAt) + before.slice(bodyAt).replace(/background-color:#ffffff;/g, 'background-color:#F7931E;');
before = before.replace('<head>', `<head>\n<!--\n  PROBE v3 — resend of the #44/#52 follow-up (v2's comment stripper broke Outlook desktop; see the generator) (${new Date().toISOString().slice(0, 10)}).\n  Generated from the importer's own block output (email-to-en-marketing-tools main ${process.env.IMPORTER_SHA ?? ''}, TPL main ${process.env.TPL_SHA ?? ''}).\n  Instrument colours: Sun ground, Fern blocks, Earth captions (palette only).\n-->`);
const after = cat.html.slice(seg.afterStart);
const doc = before + '\n' + parts.join('\n') + '\n' + after;
const ROOT = 'https://bd6ca9cefa6fb6e0adf1-c2f9aa1adb9f60a775f60074e4c86031.ssl.cf5.rackcdn.com/20002/';
// Strip plain authoring comments only. NEVER touch conditional machinery:
// '<!-->' (the downlevel-revealed opener in '<!--[if !mso]><!-->') and
// '<!--<![endif]-->'. v2's stripper matched '<!-->' as a comment start and ate
// through the next '-->', leaving unclosed '<!--[if !mso]>' openers: Word hid
// everything after the head's, and the Outlook desktop renders came back blank.
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
