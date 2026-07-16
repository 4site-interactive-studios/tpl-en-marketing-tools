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

function normalize(body) {
  let s = body.replace(/\s*data-(style-[a-z-]+|fully-exclude)/g, '');
  // align is an exposed Replacement on buttons, text, and images
  s = s.replace(/<mj-(button|text|image)\b[^>]*>/g, (tag) => tag.replace(/\salign="[^"]*"/g, ''));
  s = s.replace(/(<mj-text\b[^>]*>)[\s\S]*?(<\/mj-text>)/g, '$1#$2');
  // button labels are editable content in EN, same as mj-text bodies
  s = s.replace(/(<mj-button\b[^>]*>)[\s\S]*?(<\/mj-button>)/g, '$1#$2');
  // button width is a Replacement ("auto" = shrink-to-fit; every button authors one)
  s = s.replace(/<mj-button\b[^>]*>/g, (t) => t.replace(/(\swidth=")[^"]*(")/g, '$1#$2'));
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

function structureManifest(text, file) {
  const groups = new Map(); // normalized key -> [block, ...]
  for (const b of topBlocks(text)) {
    if (b.body.includes('data-import-exclude')) continue;
    const key = normalize(b.body);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(b);
  }
  const manifest = {};
  let flagIssues = 0;
  for (const members of groups.values()) {
    const anchor = members[0];
    for (const [i, b] of members.entries()) {
      manifest[b.name] = anchor.name;
      const flagged = b.body.includes('data-fully-exclude');
      if (i === 0 && flagged) {
        console.warn(`  WARN ${file}: "${b.name}" is the group anchor but is flagged data-fully-exclude`);
        flagIssues++;
      }
      if (i > 0 && !flagged) {
        console.warn(`  WARN ${file}: "${b.name}" duplicates "${anchor.name}" but is NOT flagged data-fully-exclude`);
        flagIssues++;
      }
    }
  }
  return { manifest, groups: groups.size, flagIssues };
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

for (const rel of ['', 'partials']) {
  for (const f of readdirSync(join(SRC, rel))) {
    if (!f.endsWith('.mjml')) continue;
    const source = readFileSync(join(SRC, rel, f), 'utf8');
    let { text, fully, imports } = annotate(source);
    let groupNote = '';

    if (text.includes('</mj-head>')) {
      const { manifest, groups, flagIssues } = structureManifest(source, join(rel, f));
      const tag =
        '<mj-raw><script type="application/json" data-tpl-structure-groups>' +
        JSON.stringify(manifest) +
        '</script></mj-raw>\n  </mj-head>';
      text = text.replace('</mj-head>', tag);
      groupNote = `, ${groups} structure groups` + (flagIssues ? `, ${flagIssues} FLAG ISSUES` : '');
    }

    writeFileSync(join(OUT, rel, f), text);
    console.log(`annotate: ${join(rel, f)} — ${fully} fully-excluded, ${imports} import-excluded${groupNote}`);
  }
}
cpSync(join(SRC, 'styles.css'), join(OUT, 'styles.css'));
