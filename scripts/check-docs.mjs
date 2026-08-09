#!/usr/bin/env node
/**
 * Documentation drift checker — runs with the build, prints WARN lines in the
 * same style as annotate-excluded.mjs.
 *
 * Docs go stale silently: a block rename leaves every doc that cited it
 * lying, a hand-written count rots on the next commit, and a rule restated
 * in five places drifts in four of them. Each assertion below encodes a
 * defect this repo actually shipped, so a regression prints a warning
 * instead of surviving until someone audits by hand.
 *
 * Assertions are deliberately cheap and textual. This is a lint, not a
 * parser — it must never be the reason a build fails to produce output.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);

let warnings = 0;
const warn = (msg) => {
  console.warn(`  WARN docs: ${msg}`);
  warnings += 1;
};

/** Local docs only — the two mirrors are canonical elsewhere and not ours to police. */
const LOCAL_DOCS = ['PLAYBOOK.md', 'CLAUDE.md', 'README.MD'].filter((f) => read(f));
const MIRRORS = ['MJML-AUTHORING-GUIDE.md', 'CONVENTIONS.md'];

const demo = read('src/demo.mjml') || '';
const example = read('src/example.mjml') || '';
const blockNames = (src) => new Set([...src.matchAll(/<!-- START: (.+?) -->/g)].map((m) => m[1]));
const demoBlocks = blockNames(demo);

// ---------------------------------------------------------------------------
// 1. Every block name a doc cites must exist in the catalog.
//    Caused by: a mass block rename left the naming grammar in PLAYBOOK §4
//    citing "Logo Header", "Heading Banner", "Dual CTA Buttons" — all gone.
//    Names appear in docs inside START/END comments or double quotes.
// ---------------------------------------------------------------------------

/** Names a doc may cite that are intentionally NOT blocks. */
const NOT_BLOCKS = new Set([
  'Signature card', // PLAYBOOK §4's case-sensitivity counter-example
  'Logo Header x CTA', // documented as a retired combinator
  'Logo Header x State',
]);
/** Families the checker recognises as block-shaped when quoted in prose. */
const BLOCK_PREFIX =
  /^(Logo Hero|Logo Header|Heading|CTA |Story |Image|Photo |Quiz |Steps |Signature |Footer|Divider|Video |Podcast|Caption|Spacer|Two-Line|Stat Row|Event |Feedback|Icon |Text |WYSIWYG|Progress|Countdown|Highlighted|Quote|Deadline|Subscription|Join |Linked )/;

/** Family keys: a block name with every parenthetical stripped (PLAYBOOK §4). */
const families = new Set([...demoBlocks].map((n) => n.replace(/\s*\(.*$/, '').trim()));
/** Category labels, cited with or without the "Category — " prefix. */
const categories = new Set(
  [...demoBlocks].filter((n) => n.startsWith('Category — ')).map((n) => n.slice('Category — '.length)),
);

for (const f of LOCAL_DOCS) {
  const text = read(f);
  const cited = new Set([
    ...[...text.matchAll(/<!-- (?:START|END): (.+?) -->/g)].map((m) => m[1]),
    ...[...text.matchAll(/"([A-Z][^"\n]{2,60})"/g)].map((m) => m[1]),
  ]);
  for (const name of cited) {
    if (NOT_BLOCKS.has(name) || !BLOCK_PREFIX.test(name)) continue;
    // Valid if it is a whole block, a family baseline, or a category label —
    // docs legitimately cite all three.
    if (demoBlocks.has(name) || families.has(name) || categories.has(name)) continue;
    if (name.startsWith('Category — ') && categories.has(name.slice('Category — '.length))) continue;
    warn(`${f} cites "${name}", which is neither a block, a family, nor a category in src/demo.mjml`);
  }
}

// ---------------------------------------------------------------------------
// 2. demo/example delta must be exactly the documented subset.
//    Caused by: CONVENTIONS' lead-in says "keep them in sync", which reads as
//    "make the lists identical". CLAUDE.md records the real, intentional delta.
// ---------------------------------------------------------------------------
const EXPECTED_ONLY_IN_DEMO = [
  'Story Card (orange-bordered)',
  'Text w/ Background Image',
  'Photo Card (green CTA)',
  'Photo Card (outline CTA)',
  'Progress Meter Block',
  'Countdown Card',
  'Question Block',
  'Footer',
];
if (example) {
  const exampleBlocks = blockNames(example);
  const onlyDemo = [...demoBlocks].filter((n) => !exampleBlocks.has(n));
  const onlyExample = [...exampleBlocks].filter((n) => !demoBlocks.has(n));
  const unexpected = onlyDemo.filter((n) => !EXPECTED_ONLY_IN_DEMO.includes(n));
  const missing = EXPECTED_ONLY_IN_DEMO.filter((n) => !onlyDemo.includes(n));
  for (const n of unexpected) {
    warn(`"${n}" is in demo.mjml but not example.mjml, and is not in the documented subset (CLAUDE.md)`);
  }
  for (const n of missing) {
    warn(`"${n}" is documented as omitted from example.mjml but is present — update CLAUDE.md or the catalog`);
  }
  for (const n of onlyExample) {
    warn(`"${n}" exists only in example.mjml; example is a subset of demo, never a superset`);
  }
}

// ---------------------------------------------------------------------------
// 3. No [data-ogsc] rule at top level in styles.css.
//    Caused by: EN's inliner deletes them outright, silently removing the
//    Outlook.com dark branch from every send (MJML-AUTHORING-GUIDE.md §2a).
// ---------------------------------------------------------------------------
const css = read('src/styles.css') || '';
{
  let depth = 0;
  let topLevel = 0;
  for (const line of css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n')) {
    if (line.includes('[data-ogsc]') && depth === 0) topLevel += 1;
    depth += (line.match(/{/g) || []).length - (line.match(/}/g) || []).length;
  }
  if (topLevel) {
    warn(`styles.css has ${topLevel} [data-ogsc] selector(s) at top level — EN's inliner deletes these; nest them in a conditional media query (guide §2a)`);
  }
}

// ---------------------------------------------------------------------------
// 4. Every declaration inside a dark-mode block needs !important, because the
//    base rule is inlined onto the element and inline beats a stylesheet
//    (guide §2b). Checked for the dark branches only; layout media queries
//    legitimately contain non-important declarations.
// ---------------------------------------------------------------------------
for (const marker of ['@media (prefers-color-scheme: dark)', '@media only screen and (max-width: 9999px)']) {
  const start = css.indexOf(marker);
  if (start < 0) {
    warn(`styles.css is missing the "${marker}" block`);
    continue;
  }
  let depth = 0;
  let end = start;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of body.matchAll(/^\s*([a-z-]+\s*:\s*[^;{]+);\s*$/gm)) {
    const decl = m[1];
    if (/!important/.test(decl) || /^(cursor|content)\s*:/.test(decl)) continue;
    warn(`"${decl.trim()}" inside ${marker} lacks !important — an inlined base rule will beat it (guide §2b)`);
  }
}

// ---------------------------------------------------------------------------
// 5. Source keeps relative asset paths; the absolute root is a build artifact.
//    The test is the asset-root id, NOT "rackcdn" — the footer social icons
//    legitimately live on a different container.
// ---------------------------------------------------------------------------
const ASSET_ROOT_ID = 'bd6ca9cefa6fb6e0adf1';
for (const f of readdirSync(join(ROOT, 'src')).filter((n) => n.endsWith('.mjml'))) {
  if ((read(`src/${f}`) || '').includes(ASSET_ROOT_ID)) {
    warn(`src/${f} contains the absolute EN asset root — source must stay relative (guide §7); the absolute form is emitted into <name>.cdn.html`);
  }
}

// ---------------------------------------------------------------------------
// 6. Cross-references must resolve: a "§N" in a local doc needs a matching
//    "## N." heading in the doc that owns it.
// ---------------------------------------------------------------------------
{
  const playbook = read('PLAYBOOK.md') || '';
  const sections = new Set([...playbook.matchAll(/^## (\d+)\./gm)].map((m) => m[1]));
  const subsections = new Set([...playbook.matchAll(/^### (\d+[a-z])\./gm)].map((m) => m[1]));
  for (const m of playbook.matchAll(/§(\d+[a-z]?)/g)) {
    const ref = m[1];
    if (!sections.has(ref) && !subsections.has(ref) && !sections.has(ref.replace(/[a-z]$/, ''))) {
      warn(`PLAYBOOK.md references §${ref}, which has no matching heading`);
    }
  }
}

// ---------------------------------------------------------------------------
// 7. Mirrors must not be edited locally, and must still say so.
// ---------------------------------------------------------------------------
for (const f of MIRRORS) {
  const text = read(f);
  if (!text) {
    warn(`${f} is missing — it is a mirror of the canonical private repo`);
  } else if (!/MIRROR\s*—\s*DO NOT EDIT HERE/i.test(text.split('\n')[0])) {
    warn(`${f} lost its "MIRROR — DO NOT EDIT HERE" header; corrections belong in the canonical repo`);
  }
}

// ---------------------------------------------------------------------------
// 8. Hand-written counts rot. Flag prose that hard-codes a catalog number.
// ---------------------------------------------------------------------------
for (const f of LOCAL_DOCS) {
  for (const m of (read(f) || '').matchAll(/\b(\d+)\s+(?:`?Category|blocks? in (?:demo|main|example)|structure groups)/g)) {
    const claimed = Number(m[1]);
    const actual =
      /Category/.test(m[0]) ? [...demo.matchAll(/<!-- START: Category — /g)].length : null;
    if (actual !== null && claimed !== actual) {
      warn(`${f} says "${m[0].trim()}" but the catalog has ${actual} — prefer pointing at the build output over hard-coding counts`);
    }
  }
}

// ---------------------------------------------------------------------------
// 9. Symbol existence: paths, data-* attributes, and css-class tokens a doc
//    cites must still resolve. Assertion 1 does this for block NAMES; this is
//    the same guarantee for the vocabulary the docs use to describe code.
//    Caused by: prose survives renames silently. A doc naming a script that
//    moved, or a data-* flag that was renamed, reads as current forever.
// ---------------------------------------------------------------------------
{
  /**
   * The vocabulary corpus is wider than src/: data-tpl-* flags and the
   * `fully-excluded` class are INJECTED by the build (annotate-excluded.mjs)
   * and consumed by debug.js, so they legitimately never appear in a .mjml.
   * Checking against src/ alone would flag every one of them.
   */
  const mjmlSrc = readdirSync(join(ROOT, 'src'))
    .filter((n) => n.endsWith('.mjml'))
    .map((n) => read(`src/${n}`) || '')
    .join('\n');
  const scriptSrc = readdirSync(join(ROOT, 'scripts'))
    .filter((n) => n.endsWith('.mjs'))
    .map((n) => read(`scripts/${n}`) || '')
    .join('\n');
  const vocabulary = mjmlSrc + (read('src/styles.css') || '') + scriptSrc + (read('src/assets/debug.js') || '');

  /** Docs illustrate with stand-ins: `src/anything.mjml`, `css-class="… x"`. */
  const PLACEHOLDER = /anything|…|\.\.\.|<[^>]*>|\*/;

  for (const f of LOCAL_DOCS) {
    const text = read(f);

    // 9a. Repo-relative paths. Trailing-slash tokens are directories.
    for (const m of text.matchAll(/`((?:scripts|src|dist)\/[\w./-]*)`/g)) {
      const rel = m[1].replace(/\/$/, '');
      if (!rel || PLACEHOLDER.test(rel)) continue;
      if (!existsSync(join(ROOT, rel))) warn(`${f} cites \`${m[1]}\`, which does not exist`);
    }

    // 9b. data-* flags. `data-*` itself is the wildcard, not an attribute, and
    // a cited value (data-folder="<id>") is illustrative — check the name only.
    for (const m of text.matchAll(/`(data-[a-z-]+)(?:="[^"]*")?`/g)) {
      const attr = m[1];
      if (attr === 'data-' || attr.endsWith('-')) continue;
      if (!vocabulary.includes(attr)) {
        warn(`${f} cites \`${attr}\`, which appears nowhere in src/ or scripts/`);
      }
    }

    // 9c. css-class tokens must exist somewhere that actually applies them.
    for (const m of text.matchAll(/`css-class="([^"]+)"`/g)) {
      for (const cls of m[1].split(/\s+/).filter(Boolean)) {
        if (PLACEHOLDER.test(cls)) continue;
        if (!vocabulary.includes(cls)) {
          warn(`${f} cites css-class "${cls}", which appears nowhere in src/ or scripts/`);
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 10. Unresolved-state language must not outlive the thing it describes.
//     Caused by: CONVENTIONS carried "until that lands, treat Outlook.com dark
//     mode as not actually deployed" for weeks after the wrap shipped in
//     styles.css. Nobody re-reads a doc to check whether its caveats expired.
// ---------------------------------------------------------------------------
{
  const PENDING =
    /(TO BE FILLED IN|until that lands|not yet measured|untested rescue|pending .{0,30}(?:run|test|confirmation)|TODO: ADD LINK)/gi;
  for (const f of LOCAL_DOCS) {
    for (const m of (read(f) || '').matchAll(PENDING)) {
      warn(`${f} still says "${m[0]}" — confirm it is genuinely still pending, or update it`);
    }
  }
}

console.log(
  warnings
    ? `check-docs: ${warnings} WARNING(S) — see above`
    : `check-docs: ${LOCAL_DOCS.length} local docs + ${MIRRORS.length} mirrors verified, no drift`,
);
