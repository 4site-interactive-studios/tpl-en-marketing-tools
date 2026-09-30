#!/usr/bin/env node
/**
 * Probe generator: head CSS in a TEMPLATE replacement (2026-09-30).
 *
 * QUESTION. The head-resident rules (data-en-tools-template-css: RTE margin
 * containment, the viewport and light/dark forks, .overlay white) are frozen
 * into every email built from the template — EN does not push template edits
 * into existing emails. Would holding them in a template-level REPLACEMENT
 * in the head make them fixable in existing emails? Only if EN reads the
 * replacement's value from the template at render/send, rather than copying
 * it into each email when the email is created. Nothing in either repo has
 * ever measured that.
 *
 * What is already known:
 *   - EN substitutes template replacements inside a head <style>: EN's own
 *     reference template does it with Select values
 *     (email-to-en-marketing-tools src/samples/template-export.json).
 *   - EN wraps a CSS-type value in its own bare <style> at render, so its tag
 *     sits bare in the head, never inside a <style> (guide §2b-bis, measured
 *     2026-08-18 — a second wrapper doubled the delivered sheet).
 *   - EN inlines plain top-level rules from the template head and from the
 *     old block CSS field (2026-08-24), never measured for a template
 *     replacement.
 *   - An EDITED HTML-type value escapes `>`; an edited CSS-type block field
 *     did not (2026-08-13 / 08-18). Never measured for template fields.
 *
 * WHAT IT BUILDS. One importable EN template JSON with two carriers of whole
 * rules in the head, each driving three bars:
 *   C — `probe_head_css`, CSS-type, tag bare in the head.
 *   S — `probe_head_select`, Select-type, tag inside the head's literal
 *       <style> (EN's own pattern, but with whole rules as the option value;
 *       a Select also keeps editors from free-editing CSS per email).
 *   bar 1  plain top-level rule            (the inlining question)
 *   bar 2  rule inside a unique @media     (the delivered-head question)
 *   bar 3  child combinator in that @media (the `>` escape question)
 *   K      control: a literal head rule, no replacement (Moss).
 * Every bar's fill names the value that painted it:
 *   Fern #39B54A = v1 (as imported)
 *   Sky  #5DD8D8 = v2 (the TEMPLATE was edited after the email was made)
 *   Sun  #F7931E = v3 (the value was edited INSIDE the email)
 *   no fill (Snow ground) = the rule never applied
 * Colours are brand palette only (CLAUDE.md, instrument colours); bar text is
 * Earth #362229. The two @media conditions (9997px, 9996px) appear nowhere
 * else, so no same-condition fold can move them.
 *
 * Outputs, next to this file:
 *   <name>.template.json — import into EN as a template
 *   <name>.values.txt    — the v2 and v3 text to paste at steps 3 and 5
 *
 * PROCEDURE (EN + one or two EoA sends):
 *   1. Import the template JSON into EN. If EN rejects the CSS-type or the
 *      whole-rule Select, record that and create the two replacements by hand
 *      in the template editor with the names, types and v1 values below.
 *   2. Create email E1 from it (no blocks needed; the bars are template body).
 *      Preview: all six bars + K should be Fern/Moss. Any unfilled bar at
 *      this step is a substitution failure: record which, keep going.
 *   3. Edit the TEMPLATE (not E1): set probe_head_css to the C v2 text, and
 *      the Select's "Current" option value (and its default, if EN shows it
 *      separately) to the S v2 text. Save.
 *   4. Create email E2 from the template: it must show Sky (proves step 3
 *      saved). Then open E1 WITHOUT touching its replacements and send it to
 *      EoA  → test 1.
 *   5. Inside E1, if EN exposes the template replacements per email, set
 *      probe_head_css to the C v3 text and save. Send E1 to EoA → test 2.
 *      If EN offers no per-email edit, record that and skip the send.
 *
 * VERDICT RULES (test 1 renders + delivered HTML at
 * /app/acidtest/display/email_html/<TEST_ID>):
 *   P  PROPAGATION. E1 bars Sky → EN reads the template's value live: the
 *      idea works. Fern → the value was copied at email creation: a head
 *      replacement is as frozen as literal head CSS, and the idea is dead.
 *      C and S may differ; record each.
 *   I  INLINING. bar 1's element carries background-color inline in the
 *      delivered HTML → plain rules from the field are inlined and stay out
 *      of the Gmail budget, like literal head rules. Rule left in the head →
 *      they cost budget bytes; not inlined and absent → broken.
 *   M  bar 2's @media block is present in the delivered head.
 *   E  bar 3 filled and `>` raw in the delivered head (test 1: untouched;
 *      test 2: after a per-email edit). `&gt;` → the escape bug reaches
 *      template fields too.
 *   O  test 2: bar C Sun → per-email overrides work (and would shadow a later
 *      template fix for that email — record it).
 *
 * ══════════════════ VERDICTS — NONE MEASURED YET ══════════════════
 * ═══════════════════════════════════════════════════════════════════
 *
 * Usage (from the repo root):
 *   node src/probes/probe_head-replacement-propagation-2026-09-30.gen.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const NAME = 'probe_head-replacement-propagation-2026-09-30';
const HERE = dirname(fileURLToPath(import.meta.url));

/** Assembled from parts: the literal must never appear in a source file. */
const CONTAINER = '{{' + 'container~main' + '}}';

const EARTH = '#362229';
const SNOW = '#F5FAF1';
const MOSS = '#CEE4C5';
const V = { v1: '#39B54A', v2: '#5DD8D8', v3: '#F7931E' };
const NAMES = { v1: 'Fern', v2: 'Sky', v3: 'Sun' };

/** The rules one carrier holds, painted in one version's colour. */
const rules = (p, width, color, { oneLine = false } = {}) => {
  const lines = [
    `.${p}1 { background-color: ${color}; }`,
    `@media only screen and (max-width: ${width}px) {`,
    `  .${p}2 { background-color: ${color} !important; }`,
    `  .${p}3 > div { background-color: ${color} !important; }`,
    `}`,
  ];
  return oneLine ? lines.map((l) => l.trim()).join(' ') : lines.join('\n');
};
const cCss = (v) => rules('rp-c', 9997, V[v]);
const sCss = (v) => rules('rp-s', 9996, V[v], { oneLine: true });

const bar = (cls, label, { child = false } = {}) => {
  const inner = `padding:12px 16px;color:${EARTH};font-family:Arial,sans-serif;font-size:14px;line-height:20px;font-weight:bold;`;
  return child
    ? `<tr><td style="padding:0 0 8px;"><div class="${cls}"><div style="${inner}">${label}</div></div></td></tr>`
    : `<tr><td style="padding:0 0 8px;"><div class="${cls}" style="${inner}">${label}</div></td></tr>`;
};

const content = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title></title>
  <style type="text/css">
    body { margin: 0; padding: 0; }
    .rp-k { background-color: ${MOSS}; }
    {replacement~probe_head_select}
  </style>
  {replacement~probe_head_css}
</head>
<body style="margin:0;padding:0;background-color:${SNOW};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${SNOW};">
    <tr><td align="center" style="padding:24px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:568px;">
        <tr><td style="padding:0 0 16px;color:${EARTH};font-family:Arial,sans-serif;font-size:14px;line-height:20px;">
          <strong>Head replacement probe (${NAME})</strong><br>
          Fern = v1 as imported &middot; Sky = v2, template edited after this email was made &middot;
          Sun = v3, edited inside this email &middot; no fill = rule never applied
        </td></tr>
        ${bar('rp-k', 'K &middot; control &middot; literal head rule (Moss)')}
        ${bar('rp-c1', 'C1 &middot; CSS-type field &middot; plain rule')}
        ${bar('rp-c2', 'C2 &middot; CSS-type field &middot; @media rule')}
        ${bar('rp-c3', 'C3 &middot; CSS-type field &middot; child combinator', { child: true })}
        ${bar('rp-s1', 'S1 &middot; Select field &middot; plain rule')}
        ${bar('rp-s2', 'S2 &middot; Select field &middot; @media rule')}
        ${bar('rp-s3', 'S3 &middot; Select field &middot; child combinator', { child: true })}
      </table>
    </td></tr>
  </table>
  ${CONTAINER}
</body>
</html>
`;

const replacements = {
  probe_head_css: {
    type: 'CSS',
    values: { default: { value: cCss('v1') } },
    order: 0,
    label: 'Probe Head CSS (C)',
    name: 'probe_head_css',
    section: 'Template',
  },
  probe_head_select: {
    type: 'Select',
    values: { default: { value: sCss('v1') } },
    order: 1,
    label: 'Probe Head CSS (S)',
    name: 'probe_head_select',
    section: 'Template',
    options: [
      { value: sCss('v1'), label: 'Current (default)' },
      { value: '.rp-off { }', label: 'Off' },
    ],
  },
};

const now = Date.now();
const template = {
  id: 90301,
  clientId: 20002,
  createdOn: now,
  ownedBy: 24,
  folderId: 96,
  name: 'PROBE - Head replacement propagation (2026-09-30)',
  type: 'BROADCAST',
  content,
  data: JSON.stringify({ design: [{ name: 'main', blocks: [] }], replacements }),
};

if (content.split(CONTAINER).length !== 2) throw new Error('container tag must appear exactly once');

const values = `${NAME} — paste-in values

STEP 3 — edit the TEMPLATE (turns E1's bars ${NAMES.v2} if EN reads the template live)

probe_head_css (CSS-type) → replace the whole value with:
${cCss('v2')}

probe_head_select → the "Current" option's value (and the default, if shown separately):
${sCss('v2')}

STEP 5 — edit INSIDE email E1, only if EN offers it (turns C bars ${NAMES.v3})

probe_head_css → replace the whole value with:
${cCss('v3')}
`;

writeFileSync(join(HERE, `${NAME}.template.json`), JSON.stringify(template, null, 2) + '\n');
writeFileSync(join(HERE, `${NAME}.values.txt`), values);
console.log(`wrote ${NAME}.template.json and ${NAME}.values.txt`);
