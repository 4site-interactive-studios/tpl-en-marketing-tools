// Probe: button Width cap + mobile fit (2026-09-27). W cases: each capped
// block at its WORST settings (widest side padding / insets) with the widest
// Width the importer now offers: the button must stay inside its box on
// desktop. P cases: wide Widths at default settings: on a phone the pill must
// shrink to its label (td.button table width:auto) with no sideways scroll;
// P4 carries the fixed-width class and must still fill the phone width.
// Every block is the importer's own output with the named picks substituted.
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

const parts: string[] = [];
const add = (s: string) => parts.push(s);
const B = (n: string) => byName(n);
const WIDEST = (b: Block, f: string) => {
  const r = b.replacements.find((x) => x.name === f)!;
  return (r.options ?? []).filter((o) => /px/.test(o.value)).at(-1)!.label;
};
const Q = 'Quadruple - 64px';
add(caption('BUTTON WIDTHS', 'DESKTOP: in W1 to W6 the button must sit fully inside its block, not past the edge. PHONE: no sideways scrolling anywhere; in P1, P2, P3 and P5 the button shrinks to fit its text; P4 stays full width.'));
const w = (id: string, name: string, picks: Record<string, Pick>, note: string) => {
  const b = B(name);
  add(caption(id, note));
  add(resolve(b, picks));
};
let b = B('Buttons — CTA Button');
w('W1', 'Buttons — CTA Button', { block_width: 'Quadruple', button_width: WIDEST(b, 'button_width') }, 'CTA Button, Block Padding Left/Right Quadruple, Width ' + WIDEST(b, 'button_width'));
b = B('Text — Stat Row');
w('W2', 'Text — Stat Row', { block_width: 'Quadruple', column_padding_left: Q, column_padding_right: Q, button_width: WIDEST(b, 'button_width') }, 'Stat Row, Block Padding Quadruple, Column Padding 64 both sides, Width ' + WIDEST(b, 'button_width'));
b = B('Text and Images — Photo Banner (overlay panel, w/ CTA)');
w('W3', b.name, { button_inset_left: Q, button_inset_right: Q, button_width: WIDEST(b, 'button_width') }, 'Photo Banner (overlay panel), button Insets 64 both sides, Width ' + WIDEST(b, 'button_width'));
b = B('Headers/Heroes — CTA Hero');
w('W4', b.name, { block_width: 'Quadruple', button_width: WIDEST(b, 'button_width') }, 'CTA Hero, Block Padding Quadruple, Width ' + WIDEST(b, 'button_width'));
b = B('Engagement — Steps Block');
w('W5', b.name, { row_2_padding_left: Q, row_2_padding_right: Q, row_2_button_width: WIDEST(b, 'row_2_button_width') }, 'Steps Block, Row 2 padding 64 both sides, Width ' + WIDEST(b, 'row_2_button_width'));
b = B('Footer — Footer (w/ image, brown)');
w('W6', b.name, { row_2_padding_left: Q, row_2_padding_right: Q, row_2_button_width: WIDEST(b, 'row_2_button_width') }, 'Footer (brown), Row 2 padding 64 both sides, Width ' + WIDEST(b, 'row_2_button_width'));
b = B('Buttons — CTA Button');
w('P1', b.name, { button_width: WIDEST(b, 'button_width') }, 'CTA Button, default settings, Width ' + WIDEST(b, 'button_width'));
b = B('Engagement — Countdown Block');
w('P2', b.name, { button_width: WIDEST(b, 'button_width') }, 'Countdown Block, Width ' + WIDEST(b, 'button_width'));
b = B('Text and Images — Story Card 1x1');
w('P3', b.name, { button_width: WIDEST(b, 'button_width') }, 'Story Card 1x1, Width ' + WIDEST(b, 'button_width'));
b = B('Text and Images — Photo Banner (w/ CTA)');
w('P4 CONTROL', b.name, { button_width: WIDEST(b, 'button_width') }, 'Photo Banner (w/ CTA), fixed-width class, Width ' + WIDEST(b, 'button_width') + ' (stays full width on a phone)');
b = B('Images — Video Block');
w('P5', b.name, { row_1_button_width: WIDEST(b, 'row_1_button_width') }, 'Video Block, Width ' + WIDEST(b, 'row_1_button_width'));

const seg = segmentEmail(cat.html);
let before = cat.html.slice(0, seg.beforeEnd);
before = before.replace('<head>', `<head>\n<!--\n  PROBE button-width-cap (${new Date().toISOString().slice(0, 10)}): do capped button Widths fit at worst-case settings on desktop, and do wide buttons fit on phones?\n  Generated from the importer's own block output (email-to-en-marketing-tools ${process.env.IMPORTER_SHA ?? ''}, TPL ${process.env.TPL_SHA ?? ''}).\n-->`);
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
