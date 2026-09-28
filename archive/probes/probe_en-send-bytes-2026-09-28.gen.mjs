#!/usr/bin/env node
/**
 * Probe generator: EN send bytes (2026-09-28).
 *
 * QUESTION. Between the HTML we hand EN and the HTML that lands in the inbox,
 * what does EN already remove? If EN strips HTML comments or re-flows white
 * space at send, the compaction of 2026-09-27 (importer compactEmailHtml,
 * TPL emit-variants) optimises bytes EN would have removed anyway.
 *
 * What is already measured (guide §2): CSS comments are STRIPPED at send;
 * plain CSS rules matching nothing are PRUNED; @media blocks are kept
 * verbatim; one prose comment in block markup SURVIVED (2026-08-09, one
 * send). What never was: white space — indentation, trailing blanks, blank
 * lines — and whether EN re-indents or re-wraps what it serialises.
 *
 * WHAT IT BUILDS. One paste-ready document:
 *   - the donation autoresponder's head exactly as shipped BEFORE compaction
 *     (commit 418882a): its prose comments, CSS comments, and the four
 *     styles.css rules removed 2026-09-27 — one plain top-level
 *     (.footer-cta a), three inside @media — re-verify the pruning claims;
 *   - canary rows C1–C7 (comments) and W1–W7 (white space), each a unique
 *     token the reader finds in the delivered source;
 *   - R1/R2: the SAME real block, Signature Card (photo), as shipped before
 *     compaction (R1) and after (R2), so the send measures the delivered
 *     saving on real markup, not a synthetic one.
 * Between the two `PROBE BLOCK PASTE` comments is the body-only part for
 * Send B (EN's block pipeline, via a Code/RAW HTML block); it is also written
 * on its own as probe_en-send-bytes-2026-09-28.block-paste.html, byte-for-byte
 * the same text, so nobody has to cut it out by hand.
 *
 * Read the result with probe_en-send-bytes-2026-09-28.read.mjs. Colours are
 * brand palette only (CLAUDE.md, instrument colours): Snow ground, Earth
 * text, Moss label bands.
 *
 * Usage (after `npm run build`, from the repo root):
 *   node archive/probes/probe_en-send-bytes-2026-09-28.gen.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const OUT = join(HERE, 'probe_en-send-bytes-2026-09-28.html');
/** Send B's paste: the body section alone, for an EN Code/RAW HTML block */
const OUT_BLOCK = join(HERE, 'probe_en-send-bytes-2026-09-28.block-paste.html');
/** Last commit whose dist/ carried the UNcompacted _live output */
const BEFORE_SHA = '418882a';
const PAGE = 'dist/donation-thank-you_live.html';
const BLOCK = 'Signature Card (photo)';

const before = execSync(`git show ${BEFORE_SHA}:${PAGE}`, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
const after = readFileSync(join(ROOT, PAGE), 'utf8');
if (after.length > before.length * 0.8) {
  throw new Error(`${PAGE} does not look compacted — run npm run build first`);
}

const region = (html, name) => {
  const open = `<!-- START: ${name} -->`;
  const close = `<!-- END: ${name} -->`;
  const s = html.indexOf(open);
  const e = html.indexOf(close);
  if (s === -1 || e === -1) throw new Error(`no ${name} region`);
  return html.slice(s, e + close.length);
};
// The markers are renamed so the probe's two copies never share a block name
const rename = (html, tag) => html.split(`: ${BLOCK} -->`).join(`: ${tag} ${BLOCK} -->`);
const r1 = rename(region(before, BLOCK), 'PROBE-R1');
const r2 = rename(region(after, BLOCK), 'PROBE-R2');
const bytes = (s) => Buffer.byteLength(s, 'utf8');

/** One compact label band — MJML's own section shape, so it renders everywhere */
const band = (text, ground = '#CEE4C5') =>
  `<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;" width="600"><tr><td><![endif]-->` +
  `<div style="margin:0px auto;max-width:600px;background:${ground};background-color:${ground};"><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:${ground};background-color:${ground};width:100%;"><tbody><tr>` +
  `<td style="padding:12px 32px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;">${text}</td>` +
  `</tr></tbody></table></div><!--[if mso | IE]></td></tr></table><![endif]-->\n`;

/*
 * The canaries. Authored pretty-printed ON PURPOSE — this is the shape EN
 * received before 2026-09-27. Every token is unique; the reader keys on them.
 * The white-space canaries W1–W4 are built from explicit repeat() calls, not
 * typed: an editor that trims trailing blanks or converts tabs would
 * otherwise quietly change the instrument.
 */
const canaries = `<!--[if mso | IE]><table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="width:600px;" width="600"><tr><td><![endif]-->
    <div style="margin:0px auto;max-width:600px;background:#F5FAF1;background-color:#F5FAF1;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background:#F5FAF1;background-color:#F5FAF1;width:100%;">
        <tbody>
          <!-- PROBE-C1 own-line prose comment: does EN deliver an HTML comment that sits on its own line in the body? -->
          <tr>
            <td style="padding:8px 32px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;">
              C2 inline comment between two words: alpha<!-- PROBE-C2 inline comment -->beta
            </td>
          </tr>
          <!--
            PROBE-C3 multi-line prose comment, shaped like the MJML's own notes:
            dated rulings, measurements, why a value is load-bearing. Before
            2026-09-27 roughly 37.5 KB of these rode inside the TPL catalog's
            blocks. If this whole comment is missing from the delivered source,
            EN strips body comments and the compaction's comment half is redundant.
          -->
          <!-- START: PROBE-C4 marker -->
          <tr>
            <td style="padding:8px 32px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;">
              C4 sits between a START/END comment pair (the block markers the importer keeps).
            </td>
          </tr>
          <!-- END: PROBE-C4 marker -->
          <tr>
            <td style="padding:8px 32px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;">
              C5 hidden conditional: <!--[if mso | IE]><span>PROBE-C5 Outlook-only text</span><![endif]-->
              C6 revealed conditional: <!--[if !mso]><!--><span>PROBE-C6 non-Outlook text</span><!--<![endif]-->
              C7 comment inside an attribute value: <span title="PROBE-C7 <!-- not a comment -->">hover</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;">
${' '.repeat(17)}PROBE-W1 is indented by exactly 17 spaces in the paste
${'\t'.repeat(3)}PROBE-W2 is indented by exactly 3 tabs in the paste
              PROBE-W3 ends with exactly 3 trailing spaces in the paste${' '.repeat(3)}
              PROBE-W4-A is followed by exactly 4 blank lines in the paste${'\n'.repeat(4)}
              PROBE-W4-B
              <span>PROBE-W5-A</span><span>PROBE-W5-B</span> are two tags on one line with nothing between them
              PROBE-W7 keeps runs of spaces inside text: one  two   three
            </td>
          </tr>
          <tr><td style="padding:8px 32px;font-family:Tahoma,sans-serif;font-size:14px;line-height:18px;color:#362229;text-align:left;">PROBE-W6 one line longer than 998 bytes: ${'lorem ipsum dolor sit amet '.repeat(44).trim()} PROBE-W6-END</td></tr>
        </tbody>
      </table>
    </div>
    <!--[if mso | IE]></td></tr></table><![endif]-->
`;

const body = [
  '<!-- PROBE BLOCK PASTE: for Send B copy from the NEXT line down to the matching END comment -->',
  band('<b>EN SEND-BYTES PROBE (2026-09-28)</b>: what does EN remove between the paste and the inbox? Read the delivered SOURCE with the reader script, not the render.'),
  canaries,
  band(`PROBE-R1-BEGIN: ${BLOCK}, as shipped BEFORE compaction (${bytes(r1).toLocaleString('en-US')} bytes pasted)`),
  r1,
  '\n',
  band('PROBE-R1-END'),
  band(`PROBE-R2-BEGIN: the same block AFTER compaction (${bytes(r2).toLocaleString('en-US')} bytes pasted)`),
  r2,
  '\n',
  band('PROBE-R2-END'),
  '<!-- PROBE BLOCK PASTE: END -->',
].join('\n');

// The document: the pre-compaction head verbatim (plus one head canary), the
// probe body in place of the autoresponder's body content.
const headEnd = before.indexOf('</head>');
const bodyOpen = before.indexOf('>', before.indexOf('<body')) + 1;
const bodyClose = before.lastIndexOf('</body>');
const wrapperOpen = before.slice(bodyOpen, before.indexOf('<!-- START: Main Content -->'));
const wrapperClose = before.slice(before.indexOf('<!-- END: Main Content -->') + '<!-- END: Main Content -->'.length, bodyClose);
const head = before
  .slice(0, headEnd)
  .replace('<head>', '<head>\n  <!-- PROBE-H1 head prose comment: does EN deliver comments in the head? -->')
  .replace(/<title>[\s\S]*?<\/title>/, '<title>PROBE: EN send bytes (2026-09-28)</title>');
const doc =
  head +
  before.slice(headEnd, bodyOpen) +
  wrapperOpen +
  body +
  wrapperClose +
  before.slice(bodyClose);

writeFileSync(OUT, doc);
const blockPaste = body.slice(body.indexOf('\n') + 1, body.lastIndexOf('<!-- PROBE BLOCK PASTE: END -->'));
if (!doc.includes(blockPaste)) throw new Error('block paste is not a verbatim slice of the document');
writeFileSync(OUT_BLOCK, blockPaste);
console.log(
  `probe: ${OUT.slice(ROOT.length + 1)} — ${bytes(doc).toLocaleString('en-US')} bytes; ` +
    `R1 ${bytes(r1).toLocaleString('en-US')} vs R2 ${bytes(r2).toLocaleString('en-US')} pasted (${BLOCK}); ` +
    `head from ${BEFORE_SHA}:${PAGE}; block paste ${bytes(blockPaste).toLocaleString('en-US')} bytes`,
);
