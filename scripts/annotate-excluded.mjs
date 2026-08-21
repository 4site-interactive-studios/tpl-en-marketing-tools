#!/usr/bin/env node
/**
 * Prebuild annotation pass — runs BEFORE mjml compilation.
 *
 * Reads src/*.mjml (+ partials), writes annotated copies to .build/, which is
 * what the mjml CLI actually compiles. Source files are never modified.
 *
 * 1. Tags flagged `data-fully-exclude` get a `fully-excluded` css-class and
 *    `data-import-exclude` wrapper divs get `class="import-excluded"`, so the
 *    flags survive compilation (the post-build restore pass turns them back
 *    into data-* attributes).
 * 2. Computes STRUCTURE GROUPS: every top-level block is normalized (style
 *    values, image/background URLs, button/text alignment, and mj-text
 *    contents masked — the properties exposed as EN Replacements) and blocks
 *    with identical structure are grouped. A { blockName: anchorName }
 *    manifest is injected into each page's <head> as a JSON <script> tag,
 *    which the debug overlay uses for "Group by structure".
 * 3. Validates the data-fully-exclude flags against those groups on every
 *    build: within a group, the first block (anchor) must be unflagged and
 *    every follow-on block must be flagged. Mismatches print as warnings.
 */
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { sourcePages, PARTIAL_DIRS } from './lib/source-pages.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'src');
const OUT = join(root, '.build');

/* ---------- structural normalization (mirror of the exclusion rules) ---------- */

// style-only: presence AND value irrelevant -> attribute removed
const REMOVE = [
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'background-color', 'container-background-color',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-width', 'border-radius',
  'direction', 'color',
];
// content refs: value irrelevant, presence structural -> value masked
const MASK = ['src', 'alt', 'href', 'background-url', 'background-size', 'background-position', 'background-repeat'];

// Ordinary HTML comments are annotation (caveat notes, formulas) and never
// structure — but MSO conditional comments ARE structure (Outlook
// scaffolding), so only non-conditional comments are stripped.
function stripAnnotationComments(body) {
  return body.replace(/<!--(?!\[if|<!\[endif)[\s\S]*?-->/g, '');
}

function normalize(body) {
  // Importer directives are ANNOTATION, not structure: they say which fields
  // the importer generates and how it labels them, never what the block
  // renders. Two blocks that differ only by a directive still look the same,
  // so they must stay in one subsumption group — otherwise flagging one
  // variant orphans its twin's data-fully-exclude. A dated caveat comment
  // above a section is annotation for the same reason — and worse, a comment
  // NAMING a flag would otherwise read as the flag itself downstream.
  let s = stripAnnotationComments(body).replace(
    /\s*data-(style-[a-z-]+|fully-exclude|no-display-toggle|no-link-toggle|no-width-toggle|no-background-color|no-direction-toggle|desktop-only-[a-z-]+|mobile-only-[a-z-]+|inset-toggle|visible-duplicate|arrangement-label(?:="[^"]*")?|link-group(?:="[^"]*")?|width-options(?:="[^"]*")?)/g,
    '',
  );
  // data-alt-arrangement is deliberately ABSENT from that list. Every other
  // flag there is annotation — it changes fields, never what renders. This one
  // is STRUCTURAL: a section carrying it is folded into its neighbour's Select
  // instead of rendering, so a block with it renders one section where a block
  // without it renders two. Stripping it would let a flagged block subsume its
  // unflagged twin. data-arrangement-label IS pure annotation and is stripped.
  // data-folder routes a block to an EN folder — importer annotation too
  s = s.replace(/\s*data-folder="\d+"/g, '');
  // inset-gutter is the responsive companion of a padding value (collapses
  // desktop gutters on mobile) — padding is a Replacement, so this isn't structure
  s = s.replace(/css-class="([^"]*)"/g, (m, cls) =>
    'css-class="' + cls.split(/\s+/).filter((t) => t && t !== 'inset-gutter' && t !== 'fixed-width').join(' ') + '"');
  // css-class="button" on a button restates the mj-attributes default; an
  // emptied-out css-class is no class at all — neither is structure
  s = s.replace(/<mj-button\b[^>]*>/g, (tag) => tag.replace(/\s*css-class="button"/g, ''));
  s = s.replace(/\s*css-class=""/g, '');
  // align is an exposed Replacement on buttons, text, and images
  s = s.replace(/<mj-(button|text|image)\b[^>]*>/g, (tag) => tag.replace(/\salign="[^"]*"/g, ''));
  // vertical-align is an exposed Replacement on columns (absent = "top")
  s = s.replace(/<mj-column\b[^>]*>/g, (tag) => tag.replace(/\svertical-align="[^"]*"/g, ''));
  s = s.replace(/(<mj-text\b[^>]*>)[\s\S]*?(<\/mj-text>)/g, '$1#$2');
  // button labels are editable content in EN, same as mj-text bodies
  s = s.replace(/(<mj-button\b[^>]*>)[\s\S]*?(<\/mj-button>)/g, '$1#$2');
  // button width is a Replacement ("auto" = shrink-to-fit; every button authors one)
  s = s.replace(/<mj-button\b[^>]*>/g, (t) => t.replace(/(\swidth=")[^"]*(")/g, '$1#$2'));
  // image/spacer width+height values are Replacements (every image authors an
  // explicit px width; "fill container" = the padding-chain ceiling)
  s = s.replace(/<mj-(image|spacer)\b[^>]*>/g, (t) => t.replace(/(\s(?:width|height)=")[^"]*(")/g, '$1#$2'));
  for (const a of REMOVE) s = s.replace(new RegExp('\\s' + a + '="[^"]*"', 'g'), '');
  for (const a of MASK) s = s.replace(new RegExp('(\\s' + a + '=")[^"]*(")', 'g'), '$1#$2');
  // attribute ORDER is not structure — normalize it away
  s = s.replace(/<(mj-[a-z-]+)\b([^>]*?)(\/?)>/g, (m, tag, attrs, close) => {
    const toks = attrs.match(/[a-z-]+(="[^"]*")?/g) || [];
    return '<' + tag + (toks.length ? ' ' + toks.sort().join(' ') : '') + (close ? ' /' : '') + '>';
  });
  s = s.split(/\s+/).join(' ');
  // whitespace hugging tag boundaries (incl. around text content) is not structure either
  return s.replace(/>\s+/g, '>').replace(/\s+</g, '<');
}

const MARKER = /<!--\s*(START|END):\s*(.+?)\s*-->/g;

function topBlocks(text) {
  const stack = [], out = [];
  let m;
  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(text))) {
    if (m[1] === 'START') {
      stack.push({ name: m[2], start: MARKER.lastIndex });
    } else {
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].name === m[2]) {
          const open = stack.splice(i, 1)[0];
          if (stack.length <= 1 && open.name !== 'Main Content') {
            out.push({ name: open.name, body: text.slice(open.start, m.index) });
          }
          break;
        }
      }
    }
  }
  return out;
}

/* ---------- image width guardrails ---------- */

function hpad(tag) {
  let total = 0;
  const m = tag.match(/\spadding="([^"]*)"/);
  if (m) {
    const v = m[1].split(/\s+/).map((x) => parseFloat(x) || 0);
    if (v.length === 1) total += 2 * v[0];
    else if (v.length <= 3) total += 2 * v[1];
    else total += v[1] + v[3];
  }
  for (const side of ['left', 'right']) {
    const p = tag.match(new RegExp('\\spadding-' + side + '="([^"]*)"'));
    if (p) total += parseFloat(p[1]) || 0;
  }
  return total;
}

function checkImageWidths(text, file) {
  let issues = 0;
  for (const sm of text.matchAll(/(<mj-section\b[^>]*>)([\s\S]*?)<\/mj-section>/g)) {
    const inner = 600 - hpad(sm[1]);
    const cols = [...sm[2].matchAll(/(<mj-column\b[^>]*>)([\s\S]*?)<\/mj-column>/g)];
    for (const cm of cols) {
      const w = cm[1].match(/\swidth="([^"]*)"/);
      const colw = w
        ? (w[1].includes('%') ? (inner * parseFloat(w[1])) / 100 : parseFloat(w[1]))
        : inner / Math.max(1, cols.length);
      const content = colw - hpad(cm[1]);
      for (const im of cm[2].matchAll(/<mj-image\b[^>]*?\/?>/g)) {
        const ceiling = Math.floor(content - hpad(im[0]));
        const iw = im[0].match(/\swidth="([^"]*)"/);
        const src = (im[0].match(/src="([^"]*)"/) || [])[1] || '?';
        if (!iw) {
          console.warn(`  WARN ${file}: image ${src} has no explicit width (ceiling ${ceiling}px)`);
          issues++;
        } else if (iw[1].includes('%')) {
          console.warn(`  WARN ${file}: image ${src} uses a percent width "${iw[1]}" (MJML misparses percents — use px)`);
          issues++;
        } else if (parseFloat(iw[1]) > ceiling) {
          console.warn(`  WARN ${file}: image ${src} width ${iw[1]} exceeds its container ceiling ${ceiling}px`);
          issues++;
        }
      }
    }
  }
  return issues;
}

/* ---------- markup-integrity guard ----------
   Catches the corruption classes a careless bulk source edit can introduce
   (and that MJML compiles right past): an attribute glued to `padding="`
   because a repair ate the leading space, and `cellpadding`/`cellspacing`
   split into two words by an injected space. Both shipped once via the
   pacing snap; this makes the build fail loud instead of silent. */
function checkMarkupIntegrity(text, file) {
  let issues = 0;
  const warn = (msg) => { console.warn(`  WARN ${file}: ${msg}`); issues++; };
  // a word-char/quote directly before padding=" means the leading space was
  // eaten (valid MJML always has whitespace there; inner-/mso- use a hyphen).
  // cellpadding="" is the one legit word ending in `padding` — exclude it.
  const glued = text.match(/(?<=[A-Za-z0-9"])(?<!cell)padding="/g);
  if (glued) warn(`${glued.length} attribute(s) glued to padding (missing space) — a bulk edit likely ate a space`);
  for (const bad of ['cell padding=', 'cell spacing=']) {
    const n = (text.match(new RegExp(bad, 'g')) || []).length;
    if (n) warn(`${n}x "${bad}" — cellpadding/cellspacing was split by an injected space`);
  }
  return issues;
}

/* ---------- display-toggle subsumption ----------
   A block whose column members can be individually excluded via the importer's
   auto Display toggles "contains" every block reachable by removing one such
   member. A group anchor MAY carry data-fully-exclude when another group's
   anchor subsumes it — its looks are reachable from the superset block, so it
   is redundant as an importable starting point. The build verifies the claim
   (single-element removals, dark twins fold into their light image, elements
   with data-no-display-toggle or MSO-conditional texts are not removable). */
function removableVariants(body) {
  const out = [];
  const colRe = /<mj-column\b[^>]*?>([\s\S]*?)<\/mj-column>/g;
  let cm;
  while ((cm = colRe.exec(body))) {
    const col = cm[1];
    const colStart = cm.index + cm[0].indexOf(col);
    const els = [];
    const er = /<mj-(image|text|button|divider)\b[^>]*?(?:\/>|>[\s\S]*?<\/mj-\1>)/g;
    let em;
    while ((em = er.exec(col))) {
      const tag = em[0];
      if (/data-style-dark-mode/.test(tag) && els.length && els[els.length - 1].kind === 'image') {
        els[els.length - 1].end = em.index + tag.length; // fold dark twin into light image
        continue;
      }
      els.push({ kind: em[1], start: em.index, end: em.index + tag.length });
    }
    if (els.length < 2) continue; // sole member never gets a toggle
    for (const e of els) {
      const seg = col.slice(e.start, e.end);
      if (/data-no-display-toggle/.test(seg)) continue;
      if (e.kind === 'text' && /\[if mso\]/.test(seg)) continue; // complex texts skipped by importer
      let s0 = e.start, e0 = e.end;
      const after = col.slice(e0).match(/^\s*<mj-raw><!--<!\[endif\]--><\/mj-raw>/);
      if (after) e0 += after[0].length;
      const before = col.slice(0, s0).match(/<mj-raw><!--\[if !mso\]><!--><\/mj-raw>\s*$/);
      if (before) s0 -= before[0].length;
      out.push(body.slice(0, colStart + s0) + body.slice(colStart + e0));
    }
  }
  return out;
}

function structureManifest(text, file) {
  const groups = new Map(); // normalized key -> [block, ...]
  for (const b of topBlocks(text)) {
    if (b.body.includes('data-import-exclude')) continue;
    const key = normalize(b.body);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  // subsumption edges: groupKey -> key of a group whose anchor subsumes it
  // depth-2 closure: editors may exclude ANY combination of toggles, so a
  // subset reachable by removing two members (e.g. caption + button) is just
  // as derivable as a one-removal subset. Depth 2 covers every real case in
  // this catalog at trivial cost.
  const variantKeys = new Map(); // groupKey -> Set of normalized 1- and 2-removal variants
  for (const [key, members] of groups) {
    const lvl1 = removableVariants(members[0].body);
    const keys = new Set(lvl1.map(normalize));
    for (const v of lvl1) for (const v2 of removableVariants(v)) keys.add(normalize(v2));
    variantKeys.set(key, keys);
  }
  const parentOf = new Map();
  for (const [key, members] of groups) {
    if (!members[0].body.includes('data-fully-exclude')) continue; // only flagged anchors need a parent
    for (const [candKey] of groups) {
      if (candKey !== key && variantKeys.get(candKey).has(key)) { parentOf.set(key, candKey); break; }
    }
  }
  const resolveAnchor = (key) => {
    let k = key, hops = 0;
    while (parentOf.has(k) && hops++ < 10) k = parentOf.get(k);
    return groups.get(k)[0].name;
  };

  const manifest = {};
  let flagIssues = 0;
  let subsumed = 0;
  for (const [key, members] of groups) {
    const anchorName = resolveAnchor(key);
    if (parentOf.has(key)) subsumed++;
    for (const [i, b] of members.entries()) {
      manifest[b.name] = anchorName;
      // Flag detection on the comment-stripped body: a caveat comment that
      // NAMES a flag must never read as the flag being present.
      const tagBody = stripAnnotationComments(b.body);
      const flagged = tagBody.includes('data-fully-exclude');
      // data-visible-duplicate: this member's duplication is a deliberate
      // product decision and the block must remain importable — exempt from
      // the duplicate WARN. The flag is stripped in normalize() (annotation,
      // not structure), so it can never change the block's group key.
      const visibleDup = tagBody.includes('data-visible-duplicate');
      // Only a group with OTHER members can be stranded by an excluded
      // anchor — that is the whole point of the rule. A solo group has
      // nobody to strand, and a solo data-fully-exclude block is the
      // sanctioned state for a structural variant the catalog keeps as a
      // demo but deliberately does not export (CLAUDE.md, "Deliberately
      // KEPT"). Firing there asked authors to un-flag a block the
      // convention says to leave flagged (2026-08-21).
      if (i === 0 && flagged && members.length > 1 && !parentOf.has(key)) {
        console.warn(`  WARN ${file}: "${b.name}" is the group anchor but is flagged data-fully-exclude (and no other block subsumes it)`);
        flagIssues++;
      }
      if (i === 0 && visibleDup) {
        console.warn(`  WARN ${file}: "${b.name}" is its group's anchor — data-visible-duplicate is meaningless there, remove it`);
        flagIssues++;
      }
      if (visibleDup && flagged) {
        console.warn(`  WARN ${file}: "${b.name}" carries BOTH data-visible-duplicate and data-fully-exclude — contradictory, pick one`);
        flagIssues++;
      }
      if (i > 0 && !flagged && !visibleDup) {
        console.warn(`  WARN ${file}: "${b.name}" duplicates "${members[0].name}" but is NOT flagged data-fully-exclude`);
        flagIssues++;
      }
    }
  }
  return { manifest, groups: groups.size, subsumed, flagIssues };
}

/* ---------- class transforms (flags must survive compilation) ---------- */

function addCssClass(tag, cls) {
  const m = tag.match(/css-class="([^"]*)"/);
  if (m) {
    if (m[1].split(/\s+/).includes(cls)) return tag;
    return tag.replace(m[0], `css-class="${m[1]} ${cls}"`);
  }
  return tag.replace(/<(mj-[a-z-]+)\b/, `<$1 css-class="${cls}"`);
}

function annotate(text) {
  let fully = 0;
  let imports = 0;

  text = text.replace(/<mj-[a-z-]+\b[^>]*?data-fully-exclude[^>]*?>/g, (tag) => {
    fully += 1;
    return addCssClass(tag, 'fully-excluded');
  });

  text = text.replace(/<div\b([^>]*\bdata-import-exclude\b[^>]*)>/g, (whole, attrs) => {
    imports += 1;
    return /class="/.test(attrs)
      ? whole.replace(/class="([^"]*)"/, 'class="$1 import-excluded"')
      : `<div class="import-excluded"${attrs}>`;
  });

  return { text, fully, imports };
}

/* ---------- build .build/ ---------- */

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'partials'), { recursive: true });

// Pages come from the shared enumerator; partials keep their own subtree in
// .build/. Pages are written FLAT into .build/ whatever subfolder they came
// from, because `mjml ./.build/*.mjml` compiles that one level and dist/ is
// keyed on the bare filename everywhere downstream.
const walk = [
  ...sourcePages(root).map((pg) => ({ rel: pg.dir, f: pg.file, out: '' })),
  ...PARTIAL_DIRS.flatMap((d) =>
    readdirSync(join(SRC, d))
      .filter((n) => n.endsWith('.mjml'))
      .map((f) => ({ rel: d, f, out: d })),
  ),
];
for (const { rel, f, out: outDir } of walk) {
  {
    const source = readFileSync(join(SRC, rel, f), 'utf8');
    let { text, fully, imports } = annotate(source);
    let groupNote = '';

    checkMarkupIntegrity(source, join(rel, f));
    if (text.includes('</mj-head>')) {
      checkImageWidths(source, join(rel, f));
      const { manifest, groups, subsumed, flagIssues } = structureManifest(source, join(rel, f));
      // raw source + every mj-include's contents ride along in the compiled
      // page (dev artifact) so the debugger's MJML export works even opened
      // as a bare file:// page AND can inline the includes to make the
      // export fully self-contained; <\/ escaping keeps any "</" inside the
      // payload from closing the tag
      const includes = {};
      for (const im of source.matchAll(/<mj-include\s+path="([^"]+)"[^>]*\/>/g)) {
        try {
          includes[im[1]] = readFileSync(join(SRC, rel, im[1]), 'utf8');
        } catch (e) {
          console.warn(`  WARN ${join(rel, f)}: cannot read include ${im[1]}`);
        }
      }
      const tag =
        '<mj-raw><script type="application/json" data-tpl-structure-groups>' +
        JSON.stringify(manifest) +
        '</script><script type="application/json" data-tpl-raw-source>' +
        JSON.stringify({ source: source, includes: includes }).replace(/<\//g, '<\\/') +
        '</script></mj-raw>\n  </mj-head>';
      text = text.replace('</mj-head>', tag);
      groupNote = `, ${groups} structure groups` + (subsumed ? ` (${subsumed} subsumed -> ${groups - subsumed} importable)` : '') + (flagIssues ? `, ${flagIssues} FLAG ISSUES` : '');
    }

    // Flattening moves the file one level up, so an include authored
    // relative to a subfolder ('../partials/x') has to become './partials/x'
    // to still resolve from .build/.
    if (rel && !outDir) text = text.replace(/(<mj-include\s+path=")\.\.\//g, '$1./');
    writeFileSync(join(OUT, outDir, f), text);
    console.log(`annotate: ${join(rel, f)} — ${fully} fully-excluded, ${imports} import-excluded${groupNote}`);

    // Print the live category → EN folder routing. Documenting this by hand
    // rots on every category change (it did); deriving it means the build
    // itself is the reference and PLAYBOOK can simply point here.
    const categories = [
      ...source.matchAll(
        /<!-- START: Category — (.+?) -->[\s\S]{0,400}?data-folder="(\d+)"(?:[^>]*data-category-short="([^"]*)")?/g,
      ),
    ];
    if (categories.length) {
      const rows = categories
        .map(([, label, folder, short]) => `${folder} ${label}${short ? ` [${short}]` : ''}`)
        .join(' · ');
      console.log(`  categories (${categories.length}): ${rows}`);
    }
  }
}
cpSync(join(SRC, 'styles.css'), join(OUT, 'styles.css'));
