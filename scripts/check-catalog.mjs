#!/usr/bin/env node
/**
 * Catalog defect checker — the sibling of check-docs.mjs, for the BLOCKS
 * rather than the prose.
 *
 * A 2026-08-15 audit of the catalog found that its defects were not random:
 * they clustered into a handful of patterns, and every one of them was
 * arithmetic or a grep. Each assertion below encodes a pattern that actually
 * shipped, so the next instance prints a warning at build time instead of
 * surviving to an inbox.
 *
 * Deliberately separate from check-docs.mjs: different input domain (compiled
 * dist/ + src/*.mjml + styles.css, vs *.md), and `npm run check-docs` is run
 * standalone while editing prose, where a stale dist/ would produce bogus
 * geometry warnings.
 *
 * Same contract as check-docs.mjs: cheap, textual, warnings-only. This is a
 * lint, not a parser — it must never be the reason a build fails to produce
 * output. Every assertion is wrapped so one throwing cannot lose the others.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import { sourcePages, CATALOG, PARTIAL_DIRS } from './lib/source-pages.mjs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);

let warnings = 0;
const warn = (msg) => {
  console.warn(`  WARN catalog: ${msg}`);
  warnings += 1;
};

/** 1-based line of an offset, the check-docs.mjs idiom. */
const lineAt = (text, index) => text.slice(0, index).split('\n').length;

/** Catalog sources. Probes are deliberate experiments, not catalog pages —
 *  they live in src/probes/ and are excluded by directory now, not by prefix. */
const sources = sourcePages(ROOT)
  .filter((p) => p.dir !== 'probes')
  .map((p) => p.rel);

/** The compiled pages the dist-reading checks police: every dist/*_live.html,
 *  resolved to its source through the layout helper and excluded by the same
 *  probes-directory rule as `sources`. Never rebuild the path as
 *  `src/${base}.mjml` — that silently skipped both autoresponders from
 *  2026-08-21, when they moved into src/autoresponders/, until a 2026-09-27
 *  review. A compiled page with no source WARNS instead of being skipped: it
 *  is a stale artifact (the build never cleans dist/) or a page this lookup
 *  has lost, and either way no geometry check ran on it. Memoized so the
 *  warning prints once however many checks ask. */
let livePagesMemo = null;
const livePages = () => {
  if (livePagesMemo) return livePagesMemo;
  const byBase = new Map(sourcePages(ROOT).map((p) => [p.base, p]));
  const dist = existsSync(join(ROOT, 'dist')) ? readdirSync(join(ROOT, 'dist')) : [];
  livePagesMemo = [];
  for (const page of dist.filter((n) => n.endsWith('_live.html')).sort()) {
    const base = page.replace(/_live\.html$/, '');
    const src = byBase.get(base);
    if (!src) {
      warn(
        `dist/${page} has no source page in src/ — a stale artifact (git rm its three dist files) or a page the layout helper cannot find; the column-geometry and padding checks did not run on it`,
      );
      continue;
    }
    if (src.dir === 'probes') continue;
    livePagesMemo.push({ page, rel: `src/${src.rel}`, catalog: src.rel === CATALOG, srcText: read(`src/${src.rel}`) || '' });
  }
  return livePagesMemo;
};

/** Run an assertion without letting a throw take the rest of the pass down. */
const guard = (label, fn) => {
  try {
    fn();
  } catch (err) {
    warn(`${label} could not run (${err.message}) — the other checks still ran`);
  }
};

// ---------------------------------------------------------------------------
// 0. The topBlocks copy below must not drift from its original.
//    annotate-excluded.mjs runs rmSync(.build) at top level, so importing it
//    from a lint would delete and rebuild the compile input. The helper is
//    copied instead — this assertion is what keeps the copy honest.
// ---------------------------------------------------------------------------

/** Copied from scripts/annotate-excluded.mjs (MARKER + topBlocks). */
const MARKER = /<!--\s*(START|END):\s*(.+?)\s*-->/g;

function topBlocks(text) {
  const stack = [];
  const out = [];
  let m;
  MARKER.lastIndex = 0;
  while ((m = MARKER.exec(text))) {
    if (m[1] === 'START') {
      stack.push({ name: m[2], start: MARKER.lastIndex, open: m.index });
    } else {
      for (let i = stack.length - 1; i >= 0; i -= 1) {
        if (stack[i].name === m[2]) {
          const open = stack.splice(i, 1)[0];
          if (stack.length <= 1 && open.name !== 'Main Content') {
            out.push({ name: open.name, body: text.slice(open.start, m.index), start: open.open });
          }
          break;
        }
      }
    }
  }
  return out;
}

guard('topBlocks drift check', () => {
  const origin = read('scripts/annotate-excluded.mjs') || '';
  if (!origin.includes('function topBlocks(text)') || !origin.includes(String(MARKER.source))) {
    warn(
      'scripts/annotate-excluded.mjs no longer contains the topBlocks/MARKER shape this file copied — re-sync the copy at the top of check-catalog.mjs',
    );
  }
});

// ---------------------------------------------------------------------------
// 1. A section OR wrapper must never carry background-color AND background-url.
//    MJML copies the colour onto the Outlook v:fill as color=, and the Word
//    engine paints that INSTEAD of the photo — every such hero renders as a
//    flat slab (measured 2026-08-13, EoA aBPD6k1l). The fallback colour goes
//    on an mj-wrapper BEHIND the image-carrying tag.
//    Caused by: a 25-section sweep fixed every mj-section and missed the one
//    mj-wrapper, because the rule was written section-only (guide §4).
// ---------------------------------------------------------------------------

guard('both-attribute background check', () => {
  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    for (const m of text.matchAll(/<mj-(?:section|wrapper)\b[^>]*>/g)) {
      if (!/\sbackground-color=/.test(m[0]) || !/\sbackground-url=/.test(m[0])) continue;
      warn(
        `src/${f}:${lineAt(text, m.index)} carries background-color AND background-url on one tag — Word paints the colour instead of the photo; move the fallback colour to an mj-wrapper behind it (guide §4)`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 2. RETIRED (2026-08-18): "a light container background inside a .block
//    section needs a dark-mode hook". The premise was measured wrong on the
//    delivered payload (EoA aafUJU…, all five dark-capable renders): EN's
//    inliner rewrites background-color to a bgcolor ATTRIBUTE at send, and
//    every dark client — Apple Mail, Gmail app, Outlook.com, and both Word
//    engines — transforms that ground itself. The predicted white-on-white
//    (Quiz Block answer card, 1.00:1 against the LOCAL build) rendered dark
//    and legible everywhere. The check was flagging a non-defect: the local
//    artifact it reasoned from does not survive to the inbox.
//    Lesson kept here because the check itself was born from one: dark-mode
//    claims must be measured against the DELIVERED html, never dist/.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3. Fixed-width columns must fit the frame they sit in.
//    A block copied into a narrower container keeps its old column widths;
//    inline-blocks wrap on ANY overflow, so a two-column card silently becomes
//    one column in every CSS client, and Word won't shrink its ghost cells.
//
//    Reads the COMPILED output, because the frame is only resolved there.
//    Width comes from the class name (mj-column-px-240), never the inline
//    percentage: inside a plain mj-section every px column emits width:100%,
//    so percentage-summing both misses real overflows and flags clean blocks.
// ---------------------------------------------------------------------------

/**
 * Column + image geometry for one compiled page.
 *
 * Shared by the overflow guard and the padding-growth census, so the two
 * can never disagree about what fits. Mirrors src/core/paddingCap.ts in
 * email-to-en-marketing-tools, which is what the importer uses to decide
 * which padding options an editor may be offered.
 */
function scanGeometry(html) {
  // `direction` matches ltr OR rtl: a reversed row (Story Card image-right)
  // is a normal section whose content td reads `direction:rtl`, and matching
  // only ltr skipped those sections entirely — their columns were never
  // measured. The importer's Column Order toggle can also flip an authored
  // ltr section to rtl, so the blind spot was reachable at edit time too.
  const events = [
    ...html.matchAll(
      /<!--\[if mso \| IE\]>([\s\S]*?)<!\[endif\]-->|<div class="mj-column-(px|per)-([\d-]+) mj-outlook-group-fix[^"]*"|<div [^>]*style="[^"]*max-width:(\d+)px|<td[^>]*style="([^"]*direction:\s*(?:ltr|rtl)[^"]*)"|<td[^>]*style="([^"]*word-break:break-word[^"]*)"|<img[^>]*\swidth="(\d+)"|<td[^>]*style="([^"]*vertical-align:[^"]*padding:[^"]*)"/g,
    ),
  ];

  // `cell` is the width of the innermost open cell. A conditional <table>
  // opens a frame whose width is that cell — the tds INSIDE it are the
  // sibling columns, not the frame. That distinction is the whole check:
  // MJML nests an mj-group's columns one conditional deeper, so a group's
  // children are measured against the cell the GROUP occupies.
  let carrier = 600; // mj-body default; no catalog page overrides it
  let cell = 600;
  // A second, plain-CSS model for the image rule. `cell` cannot serve: a
  // conditional's own td already set it to the COLUMN's px width, so
  // `cell * 50 / 100` halves an already-halved number, and that number is
  // the FROZEN ghost besides. Column sums tolerate both (they only ever
  // compare against a wider frame); an image needs the width CSS clients
  // will really give it. Mirrors src/core/paddingCap.ts in the importer —
  // the build guard and the generator must agree about what fits.
  let frameBox = 600;
  let box = 600;
  let leafInset = 0;
  let columnPadTaken = false;
  const frames = [];
  const hits = [];
  const imgHits = [];
  // Underfill (2026-09-29): a row of two or more columns that sums SHORT of
  // its frame. The overflow test above could never see it — the
  // 16px-baseline re-cut left three CTA Heroes at 16+240+312+16 = 584 in a
  // 600 frame, a 16px dead strip on the right that shipped with zero WARN.
  // Percentage columns count at their share of the frame, so a 50% + 40%
  // row is caught too (MJML's own rounding stays inside the 1px slack). A
  // lone column is a deliberate centred box (Quote Block's 472) and is
  // never measured.
  const unders = [];

  const closeFrame = (at) => {
    const f = frames.pop();
    if (!f) return;
    cell = f.savedCell; // sibling cells are scoped to their frame
    // A LONE column still overflows if it is wider than its frame — the
    // 2026-08-18 hero defect (a 550px column left in a 32px-padded
    // section) hid here, because summing siblings skipped single-column
    // frames entirely. Only the sibling-sum case needs two columns.
    const sum = f.cols.reduce((a, b) => a + b, 0);
    if (sum > f.frame + 1) hits.push({ ...f, sum, at });
    else if (f.fill.length > 1) {
      const filled = f.fill.reduce((a, b) => a + b, 0);
      if (filled < f.frame - 1) unders.push({ ...f, cols: f.fill, sum: filled, at });
    }
  };

  /** Horizontal insets a content td takes out of its carrier. */
  const inset = (style) => {
    let pad = 0;
    const p = /(?:^|;)\s*padding:\s*([^;]+)/.exec(style);
    if (p) {
      const v = p[1].trim().split(/\s+/).map((x) => parseFloat(x) || 0);
      pad += v.length === 1 ? 2 * v[0] : v.length <= 3 ? 2 * v[1] : v[1] + v[3];
    }
    for (const side of ['left', 'right']) {
      const s = new RegExp(`padding-${side}:\\s*(\\d+)`).exec(style);
      if (s) pad += Number(s[1]);
      const b = new RegExp(`border-${side}:\\s*(\\d+)`).exec(style);
      if (b) pad += Number(b[1]);
    }
    const b = /(?:^|;)\s*border:\s*(\d+)/.exec(style);
    if (b) pad += 2 * Number(b[1]);
    return pad;
  };

  for (const e of events) {
    if (e[5] !== undefined) {
      // A section's own content td is the innermost content box from here
      // on, so it always resets `cell` — outer frames stay open across a
      // whole block, so gating this on frame depth would silently skip
      // every plain section nested inside a wrapper.
      cell = carrier - inset(e[5]);
      frameBox = cell;
      box = cell;
      leafInset = 0;
      columnPadTaken = false;
      continue;
    }
    if (e[4]) {
      // A max-width can only NARROW. Taking the baked number at face value
      // let a wrapper whose gutter grew measure its children against the
      // width the OLD gutter produced.
      carrier = Math.min(Number(e[4]), cell);
      continue;
    }
    if (e[6] !== undefined) {
      leafInset = inset(e[6]);
      continue;
    }
    if (e[7]) {
      if (Number(e[7]) > box - leafInset + 1) {
        imgHits.push({ img: Number(e[7]), box: box - leafInset, at: e.index });
      }
      continue;
    }
    if (e[8] !== undefined) {
      // A column's OWN padding is the inter-column gutter and lands on a
      // vertical-align cell, not on a word-break content cell.
      if (!columnPadTaken) {
        box -= inset(e[8]);
        columnPadTaken = true;
      }
      continue;
    }
    if (e[2]) {
      const raw = e[3].replace('-', '.');
      const px = e[2] === 'px' ? Number(raw) : (cell * Number(raw)) / 100;
      if (frames.length) {
        const top = frames[frames.length - 1];
        top.cols.push(px);
        // The fill model for the underfill test: a percentage column is its
        // share of the FRAME the row sits in. `cell` cannot serve — a
        // conditional td has already narrowed it to the column's own ghost,
        // so `cell * 50 / 100` halves a halved number (every 50+50 row read
        // as 142+142 in a 568 frame).
        top.fill.push(e[2] === 'px' ? px : (top.frame * Number(raw)) / 100);
      }
      box = e[2] === 'px' ? Number(raw) : Number(raw) === 100 ? frameBox : (frameBox * Number(raw)) / 100;
      leafInset = 0;
      columnPadTaken = false;
      continue;
    }
    for (const t of (e[1] || '').matchAll(/<table[^>]*>|<\/table>|<td[^>]*style="([^"]*)"/g)) {
      if (t[0].startsWith('</table')) {
        closeFrame(e.index);
        continue;
      }
      if (t[0].startsWith('<table')) {
        frames.push({ frame: cell, cols: [], fill: [], savedCell: cell });
        continue;
      }
      const w = /width:(\d+(?:\.\d+)?)px/.exec(t[1] || '');
      // Clamp, never widen — the Word engine does (2026-08-21, EoA VNLmGlXZ…).
        if (w) cell = Math.min(Number(w[1]), cell);
    }
  }
  while (frames.length) closeFrame(html.length);

  return { hits, imgHits, unders };
}

guard('column geometry check', () => {
  // _live.html only: _local-debug.html embeds the whole source MJML as JSON,
  // including its own START: markers, which mis-attributes every later hit.
  // These regexes are tuned to MJML's own output shape — never point this
  // check at DELIVERED html, whose attributes EN rewrites (valign, bgcolor).
  // Probes are deliberate experiments — they carry markup a catalog page must
  // never carry (a frozen ghost overflowing on purpose, say) — so livePages()
  // excludes them exactly as `sources` does.
  const pages = livePages();
  if (!pages.length) {
    console.log('  check-catalog: no dist/*_live.html — run npm run build; skipping column geometry');
    return;
  }

  for (const { page, rel, srcText } of pages) {
    const html = read(`dist/${page}`) || '';

    // MJML's [if mso | IE] conditionals mirror the column tree exactly, so the
    // frames they open give sibling identity without a tree parser.
    // The section content td carrying `direction:ltr` is REAL markup, not part
    // of an MSO conditional, so it needs its own branch — a plain section's
    // frame comes from nowhere else.
    const { hits, imgHits, unders } = scanGeometry(html);

    for (const hit of unders) {
      const marker = html.lastIndexOf('<!-- START: ', hit.at);
      const name = marker < 0 ? '(unknown block)' : /<!-- START: (.+?) -->/.exec(html.slice(marker))[1];
      const inSrc = srcText.indexOf(`<!-- START: ${name} -->`);
      const at = inSrc < 0 ? '' : `:${lineAt(srcText, inSrc)}`;
      warn(
        `${rel}${at} "${name}" — ${hit.cols.length} columns (${hit.cols.map((c) => Math.round(c)).join('+')}) total ${Math.round(hit.sum)}px in a ${Math.round(hit.frame)}px frame (${Math.round(hit.frame - hit.sum)}px short); the row stops short of the content baseline — re-cut the widest column to fill it`,
      );
    }

    for (const hit of imgHits) {
      const marker = html.lastIndexOf('<!-- START: ', hit.at);
      const name = marker < 0 ? '(unknown block)' : /<!-- START: (.+?) -->/.exec(html.slice(marker))[1];
      const inSrc = srcText.indexOf(`<!-- START: ${name} -->`);
      const at = inSrc < 0 ? '' : `:${lineAt(srcText, inSrc)}`;
      warn(
        `${rel}${at} "${name}" — a ${hit.img}px image in a ${Math.round(hit.box)}px content box (${Math.round(hit.img - hit.box)}px over); it cannot shrink with the frame, so it overflows its column`,
      );
    }

    for (const hit of hits) {
      const marker = html.lastIndexOf('<!-- START: ', hit.at);
      const name = marker < 0 ? '(unknown block)' : /<!-- START: (.+?) -->/.exec(html.slice(marker))[1];
      const inSrc = srcText.indexOf(`<!-- START: ${name} -->`);
      const at = inSrc < 0 ? '' : `:${lineAt(srcText, inSrc)}`;
      warn(
        hit.cols.length < 2
          ? `${rel}${at} "${name}" — a lone ${Math.round(hit.sum)}px column in a ${Math.round(hit.frame)}px frame (${Math.round(hit.sum - hit.frame)}px over); it overflows the body instead of filling the frame — drop its width= so it fills`
          : `${rel}${at} "${name}" — ${hit.cols.length} fixed-width columns total ${Math.round(hit.sum)}px in a ${Math.round(hit.frame)}px frame (${Math.round(hit.sum - hit.frame)}px over); CSS clients wrap the last column`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 4. No importer opt-out flag on the SECOND twin of a light/dark pair.
//    The importer folds an adjacent light-only/dark-only twin pair — same
//    component, consecutive, values equal apart from src — into ONE logical
//    element: the second of the pair is dropped from every census BEFORE any
//    flag on it is read (mergeSwapPairs, then the swapDropped filter). So an
//    opt-out flag there is computed and discarded. It keys on ORDER, not
//    colour: TPL authors light-first, so it is the dark twin today, but a
//    dark-first pair would invert it.
//    Caused by: five dead data-no-display-toggle flags on footer logo dark
//    twins. Removed 2026-08-10 per the documented rule, re-entered via a
//    file rename and again via aa4d813 (which read the flag's absence as a
//    gap and "fixed" it), re-found by the 2026-08-17 dead-flag audit. A rule
//    that lives only in prose loses; this assertion is the durable copy.
// ---------------------------------------------------------------------------

/** The five importer opt-out flags — all read only AFTER the twin merge. */
const OPT_OUT_FLAGS = [
  'data-no-display-toggle',
  'data-no-link-toggle',
  'data-no-width-toggle',
  'data-no-background-color',
  'data-no-direction-toggle',
];

// ---------------------------------------------------------------------------
// 3b. Padding-growth census: which frames cannot take the whole scale.
//
//    A section's gutter is editable in EN, but the widths MJML DERIVED from
//    it are frozen at compile time — a fixed-px column, an image sized to
//    fill its column, a proportional MSO ghost. Growing the gutter past the
//    point where that geometry stops fitting wraps the columns.
//
//    The importer caps those option lists at import (src/core/paddingCap.ts),
//    so this is not a warning — it is the COUNT, produced by a command
//    instead of written down in prose where it would rot. Run
//    `npm run check-catalog -- --padding-census` for the per-frame list
//    before deciding a block should be re-authored to reflow instead.
// ---------------------------------------------------------------------------

guard('padding growth census', () => {
  // Probes excluded by livePages(), as in the column-geometry check above.
  const pages = livePages();
  if (!pages.length) return;
  const detail = process.argv.includes('--padding-census');

  let capped = 0;
  let total = 0;
  const rows = [];

  for (const { page, rel, catalog, srcText } of pages) {
    const html = read(`dist/${page}`) || '';

    // The scale the template itself declares — the same values the importer
    // turns into options. No declaration means no editable padding at all.
    const cfg = /<!--\s*en-tools-config\s*([\s\S]*?)-->/.exec(srcText);
    let scale = [];
    try {
      const parsed = JSON.parse(cfg?.[1] ?? '{}');
      scale = [...new Set(Object.values(parsed.spacingScale ?? {}).concat(
        Object.values(parsed.widthPresets ?? {}),
      ))].filter((n) => typeof n === 'number').sort((a, b) => a - b);
    } catch {
      scale = [];
    }
    if (!scale.length) continue;

    // data-max-gutter: author-declared ceilings for geometry the scan
    // cannot measure (a fixed-width pill run inside an mj-text is frozen
    // exactly like a px column, but it is content, not structure). The
    // importer clamps its option ladders from the same attribute
    // (declaredGutterCap in src/core/mjmlProps.ts); the census must agree
    // or one instrument is lying. data-* never reaches the compiled HTML,
    // so resolve source-side: within a block, the Nth compiled probe-td
    // pairs with the Nth source frame — valid only when the counts agree
    // (alternate arrangements are dropped before compile, which desyncs
    // any block that carries them; those get a warning, not a mispair).
    // Frames are named by the NEAREST PRECEDING START marker — the same
    // rule blockOf() applies to the compiled HTML below, so ordinals on
    // the two sides enumerate identically (a paired START/END regex would
    // swallow the nested Main Content wrapper whole and name nothing).
    const declaredCaps = new Map(); // block name -> per-frame cap (number|null)
    for (const t of srcText.matchAll(/<mj-(?:section|wrapper)\b[^>]*>/g)) {
      const marker = srcText.lastIndexOf('<!-- START: ', t.index);
      const name =
        marker < 0
          ? '(unknown block)'
          : /<!-- START: (.+?) -->/.exec(srcText.slice(marker))[1];
      const g = /\bdata-max-gutter\s*=\s*"([^"]*)"/.exec(t[0]);
      const n = g ? parseFloat(g[1]) : NaN;
      if (!declaredCaps.has(name)) declaredCaps.set(name, []);
      declaredCaps.get(name).push(Number.isFinite(n) && n >= 0 ? n : null);
    }
    for (const [k, v] of declaredCaps) if (!v.some((c) => c !== null)) declaredCaps.delete(k);

    const baseline = scanGeometry(html);
    const over = baseline.hits.length + baseline.imgHits.length;

    const blockOf = (index) => {
      const marker = html.lastIndexOf('<!-- START: ', index);
      return marker < 0 ? '(unknown block)' : /<!-- START: (.+?) -->/.exec(html.slice(marker))[1];
    };
    // Compiled probe-td count per block, for the ordinal-pairing guard.
    const tdCount = new Map();
    for (const m of html.matchAll(/<td[^>]*style="([^"]*direction:\s*(?:ltr|rtl)[^"]*)"/g)) {
      if (!/(?:^|;)\s*padding:\s*([^;]+)/.test(m[1])) continue;
      const name = blockOf(m.index);
      tdCount.set(name, (tdCount.get(name) ?? 0) + 1);
    }
    const seenTds = new Map();
    const mispaired = new Set();

    for (const m of html.matchAll(/<td[^>]*style="([^"]*direction:\s*(?:ltr|rtl)[^"]*)"/g)) {
      const style = m[1];
      const pad = /(?:^|;)\s*padding:\s*([^;]+)/.exec(style);
      if (!pad) continue;
      total++;
      const name = blockOf(m.index);
      const ord = seenTds.get(name) ?? 0;
      seenTds.set(name, ord + 1);
      const at = m.index + m[0].indexOf(style);
      const head = html.slice(0, at);
      const tail = html.slice(at + style.length);
      const v = pad[1].trim().split(/\s+/);
      const top = v[0] ?? '0';
      const bottom = v.length >= 3 ? v[2] : top;
      let max = null;
      for (const px of scale) {
        const swapped = style.replace(
          /((?:^|;)\s*padding:\s*)([^;]+)/,
          `$1${top} ${px}px ${bottom} ${px}px`,
        );
        const r = scanGeometry(head + swapped + tail);
        if (r.hits.length + r.imgHits.length > over) continue;
        if (max === null || px > max) max = px;
      }
      const caps = declaredCaps.get(name);
      if (caps) {
        if (caps.length !== (tdCount.get(name) ?? 0)) {
          if (!mispaired.has(name)) {
            mispaired.add(name);
            warn(
              `${name}: data-max-gutter declared but source frames (${caps.length}) != compiled paddings (${tdCount.get(name) ?? 0}) — declaration not applied to the census`,
            );
          }
        } else {
          const d = caps[ord];
          if (d !== null && max !== null && d < max) max = d;
        }
      }
      if (max !== null && max < scale[scale.length - 1]) {
        capped++;
        // Rows from a page other than the catalog name it: the autoresponders
        // reuse catalog blocks, and an unlabelled repeat reads as a duplicate.
        rows.push(`${name} — up to ${max}px (scale reaches ${scale[scale.length - 1]}px)${catalog ? '' : ` — ${rel}`}`);
      }
    }
  }

  console.log(
    `  check-catalog: padding growth — ${capped} of ${total} frames cannot take the full declared scale` +
      (detail ? '' : ' (--padding-census to list them)'),
  );
  if (detail) for (const r of rows.sort()) console.log(`    ${r}`);
});

guard('inert twin flag check', () => {
  /** Attributes as a comparable map, dropping what the merge ignores:
   *  src (deliberately excluded from the importer's equality test),
   *  css-class (the light-only/dark-only discriminator), and every data-*
   *  (annotation, not structure — same reasoning as normalize()). */
  const comparable = (attrs) => {
    const map = new Map();
    for (const a of attrs.matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)) {
      if (a[1] === 'src' || a[1] === 'css-class' || a[1].startsWith('data-')) continue;
      map.set(a[1], a[2] ?? '');
    }
    return map;
  };
  const sameAttrs = (a, b) =>
    a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);

  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    for (const block of topBlocks(text)) {
      // Elements of each mj-* component in document order, as the merge sees them
      const byName = new Map();
      for (const m of block.body.matchAll(/<(mj-[\w-]+)\b([^>]*?)\/?>/g)) {
        if (m[1] === 'mj-raw') continue;
        const list = byName.get(m[1]) ?? [];
        list.push({ attrs: m[2], index: m.index });
        byName.set(m[1], list);
      }
      for (const list of byName.values()) {
        for (let i = 0; i + 1 < list.length; i += 1) {
          const [a, b] = [list[i], list[i + 1]];
          const cls = (e) => (/\scss-class="([^"]*)"/.exec(e.attrs) || [, ''])[1];
          const twins =
            (cls(a).includes('light-only') && cls(b).includes('dark-only')) ||
            (cls(a).includes('dark-only') && cls(b).includes('light-only'));
          if (!twins || !sameAttrs(comparable(a.attrs), comparable(b.attrs))) continue;
          for (const flag of OPT_OUT_FLAGS) {
            if (!new RegExp(`(?:^|\\s)${flag}(?:[\\s/=]|$)`, 'i').test(b.attrs)) continue;
            warn(
              `src/${f}:${lineAt(text, block.start + b.index)} "${block.name}" — ${flag} on the SECOND twin of a light/dark pair is inert: the importer folds it into the first twin before any flag on it is read, so the FIRST twin's flag governs the pair; delete this one`,
            );
          }
          i += 1; // the pair is consumed, exactly as the merge consumes it
        }
      }
    }
  }
});


// ---------------------------------------------------------------------------
// 5. An <a> must never wrap a <table> (or other block-level markup).
//    EN's inliner AUTO-CLOSES the anchor at the first table: the delivered
//    payload carries `<a …></a><table…>` — an EMPTY link with the row content
//    expelled after it, unclickable in every client. Measured 2026-08-18
//    (probe 0Mgmjr… vs its compiled build: 167 delivered chars to </a> where
//    the build wraps 1,160). The Question Block was the catalog's only
//    instance; this keeps the shape from coming back.
// ---------------------------------------------------------------------------

/**
 * Known anchor-wraps-table instances tracked elsewhere and deliberately not
 * fixed yet. One dated line each — delete when the block is restructured.
 * (The Question Block sat here 2026-08-18 until its per-cell restructure
 * landed the same day; the set now enforces the rule with zero exceptions.)
 */
const ANCHOR_ALLOWLIST = new Set([]);

guard('anchor-wraps-table check', () => {
  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    // Comments narrate markup ("update width on every <a …>") — scan real
    // markup only, so a match that STARTS inside <!-- … --> is skipped.
    const inComment = (i) => {
      const open = text.lastIndexOf('<!--', i);
      return open !== -1 && text.indexOf('-->', open) > i;
    };
    for (const m of text.matchAll(/<a\s[^>]*>(?:(?!<\/a>)[\s\S])*?<(table|div|section)\b/gi)) {
      if (inComment(m.index)) continue;
      const region = text.lastIndexOf('<!-- START: ', m.index);
      const name = region < 0 ? '' : (/<!-- START: (.+?) -->/.exec(text.slice(region)) || [, ''])[1];
      if (ANCHOR_ALLOWLIST.has(name)) continue;
      warn(
        `src/${f}:${lineAt(text, m.index)} an <a> wraps a <${m[1]}> — EN auto-closes the anchor there and the delivered link arrives EMPTY (unclickable in every client); use per-cell anchors around inline content instead`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// 6. data-link-group integrity. Sibling anchors sharing a group name and a
//    byte-identical href fold into ONE URL field at import (the Question Block
//    row shape). Two author errors defeat the fold silently: a lone member
//    (nothing to fold — inert flag; the app's dead-flag audit also reports
//    it) and mismatched hrefs (the importer fails open to separate fields,
//    which is exactly the desync the group exists to prevent).
// ---------------------------------------------------------------------------

guard('link-group integrity check', () => {
  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    // Group scope is one mj-text's inner markup; the NEAREST enclosing
    // START marker is the honest block scope (markers nest — a flat regex
    // would swallow everything into the outer "Main Content" region and
    // let same-named groups in different blocks collide).
    const groups = new Map();
    for (const a of text.matchAll(/<a\s[^>]*data-link-group\s*=\s*"([^"]+)"[^>]*>/gi)) {
      const at = text.lastIndexOf('<!-- START: ', a.index);
      const block = at < 0 ? '' : (/<!-- START: (.+?) -->/.exec(text.slice(at)) || [, ''])[1];
      const href = /\bhref\s*=\s*"([^"]*)"/.exec(a[0]);
      const key = `${block}\u0000${a[1]}`;
      const list = groups.get(key) ?? [];
      list.push({ href: href ? href[1] : '', index: a.index });
      groups.set(key, list);
    }
    for (const [key, members] of groups) {
      const [block, name] = key.split('\u0000');
      if (members.length < 2) {
        warn(
          `src/${f}:${lineAt(text, members[0].index)} data-link-group="${name}" in "${block}" has a single member — the flag folds nothing; group another anchor or drop it`,
        );
      } else if (new Set(members.map((m) => m.href)).size > 1) {
        warn(
          `src/${f}:${lineAt(text, members[0].index)} data-link-group="${name}" in "${block}" mixes hrefs — the importer falls back to separate fields that can desync; make every member's href byte-identical`,
        );
      }
    }
  }
});

// ---------------------------------------------------------------------------
// 7. mobile-only needs its MSO guard. The .mobile-only hide/reveal pair lives
//    entirely in media queries (completed 2026-08-18 — the hide is wrapped so
//    EN cannot inline it), and the Word engines ignore @media wholesale: an
//    element classed mobile-only that Word can parse renders in Outlook
//    desktop alongside its desktop fork. The mobile variant must sit inside
//    the revealed conditional <!--[if !mso]><!--> … <!--<![endif]--> so Word
//    never sees it.
// ---------------------------------------------------------------------------

guard('mobile-only MSO-guard check', () => {
  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    const spans = [];
    let i = 0;
    for (;;) {
      const open = text.indexOf('<!--[if !mso]><!-->', i);
      if (open === -1) break;
      const close = text.indexOf('<!--<![endif]-->', open);
      if (close === -1) break;
      spans.push([open, close]);
      i = close + 1;
    }
    for (const m of text.matchAll(/css-class="[^"]*\bmobile-only\b[^"]*"/g)) {
      const inside = spans.some(([a, b]) => m.index > a && m.index < b);
      if (!inside)
        warn(
          `src/${f}:${lineAt(text, m.index)} an element classed mobile-only sits outside <!--[if !mso]><!--> … <!--<![endif]--> — Word ignores @media, so Outlook desktop would render BOTH forks; wrap the mobile variant in the revealed conditional`,
        );
    }
  }
});

/**
 * What of a head-resident sheet can reach the delivered <head>: its @-blocks
 * plus any rule on a state pseudo-class no inliner can resolve onto an element
 * (:hover, …; guide §2 measured `:hover` KEPT). `:root` is inlined onto
 * <html> (guide §2), so it drops out like any plain rule.
 */
function atRulesOnly(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let depth = 0;
  let start = 0;
  let quote = '';
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    // Braces inside quoted strings never end a rule, and a stray '}' never
    // drives the depth negative: one odd rule must not hide the rest (an
    // under-count is the unsafe direction). Mirrors the importer's
    // deliveredShellStyleBytes walker (headStyles.ts).
    if (quote) {
      if (c === '\\') i += 1;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth += 1;
    else if (c === '}') {
      if (depth === 0) start = i + 1;
      else if (--depth === 0) {
        const rule = text.slice(start, i + 1);
        const sel = rule.slice(0, rule.indexOf('{')).trim();
        // Pseudo-elements are unmeasured, so they stay counted (erring safe)
        if (sel.startsWith('@') || /:(hover|focus|active|visited)\b|::/.test(sel)) out += rule;
        start = i + 1;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// §8 Gmail CSS budget + importer head-CSS couplings (2026-08-18).
// Gmail discards the ENTIRE head stylesheet past 16,384 total <style> bytes
// (guide §2b-bis). The importer ships the field in compact form, and EN
// RE-PRINTS it at send — comments stripped, plain top-level rules inlined
// away, comma groups split, colon-space formatting — inflating a compact
// field ×1.30 net (measured 2026-08-18, EoA TlHVjaQ…: 9,713 compact →
// 12,644 delivered; EN_CSS_REPRINT_FACTOR in the importer's headStyles.ts,
// keep the two in step). This guard simulates the compact field per
// compiled page, estimates the DELIVERED size (×1.30), and warns when a
// shipping master passes the 15,000-byte working target (14,000 → 14,141
// on 2026-08-25, the user's lucky number; → 15,000 on 2026-09-29, user
// decision, when the 16px content baseline plus the video overlay work put
// the master at ~14,400 — an advisory line either way; keep it in step with
// the importer's GMAIL_CSS_TARGET) or when ANY page
// would land within a builder-chrome hoist (HOIST_ALLOWANCE, 250 delivered
// bytes) of the cliff. The comment said ~700 until 2026-08-21, contradicting
// its own constant thirty lines down; the canary it also reserved for was
// archived the same day. The mjml_extra-blocks catalog it names was deleted
// then too — there is one catalog now, and it sits ~2,800 bytes clear.
// The guard also protects a silent app coupling nothing else connects
// across the repos: the inert audit's Desktop labels need the td.button
// mobile pins to keep parsing.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §9 ALL-CAPS button labels (2026-08-18, user-decided). Every button label
// ships uppercase as its authored default — literal text, so the minted
// Text fields stay per-email re-caseable. Two carriers, because this rule
// escaped twice: mj-button content (the bulk transform missed the first
// button after the mj-attributes defaults element) and raw pill anchors
// (border-radius:100px <a>s inside cta-groups, which are not mj-buttons at
// all). Entities, tags, and {replacement~…} merge tags don't count as
// letters.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Every fixed-px column inside an mj-group must be pinned below the
// breakpoint. mj-group NEVER stacks: it converts each child column to a
// percentage, so an authored px width survives only above 600px and any
// fixed inline padding inside the column eats the shrunken width first
// (guide §6e). The catalog reached full coverage on 2026-08-21 — .poll-icon,
// .signature-img, .stream-icon, .icon-row-icon, .step-icon, .episode-icon —
// and this guard is what keeps it there, since the failure is invisible on
// desktop and only obvious when a row happens to hold a MATCHED PAIR (the
// Podcast Streaming badges rendered 45px and 29px for months).
// ---------------------------------------------------------------------------

guard('grouped fixed-px columns are pinned for mobile', () => {
  const css = read('src/styles.css') || '';
  const pinned = new Set();
  const mobile = /@media[^{]*max-width:\s*599px[^{]*\{([\s\S]*)\n\}/.exec(css);
  if (mobile) {
    for (const m of mobile[1].matchAll(/([^{}]+)\{[^{}]*width:\s*(?:\d+px|calc\()[^{}]*!important[^{}]*\}/g)) {
      for (const sel of m[1].split(',')) {
        const t = /\.([\w-]+)\s*$/.exec(sel.trim());
        if (t) pinned.add(t[1]);
      }
    }
  }
  // Largest fixed left/right padding on any element inside this column.
  const insetOf = (body) => {
    let max = 0;
    for (const m of body.matchAll(/padding="([^"]+)"/g)) {
      const p = m[1].trim().split(/\s+/).map((v) => parseInt(v, 10) || 0);
      const [t, r = t, , l = r] = p;
      max = Math.max(max, l + r);
    }
    return max;
  };
  const MOBILE_VW = 375;
  const THRESHOLD = 0.15;
  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    for (const g of text.matchAll(/<mj-group[^>]*>([\s\S]*?)<\/mj-group>/g)) {
      // The gutter of the enclosing section decides how much width is left.
      const before = text.slice(0, g.index);
      const sec = /<mj-section\b[^>]*?padding="([^"]+)"[^>]*>(?![\s\S]*<mj-section\b)/.exec(before);
      const gutter = sec ? parseInt(sec[1].trim().split(/\s+/)[1] ?? '0', 10) || 0 : 0;
      const avail = MOBILE_VW - 2 * gutter;
      const cols = [...g[1].matchAll(/<mj-column\b([^>]*?)width="(\d+)px"([^>]*?)>([\s\S]*?)<\/mj-column>/g)];
      const total = cols.reduce((n, c) => n + Number(c[2]), 0);
      if (!total) continue;
      for (const col of cols) {
        const px = Number(col[2]);
        const body = col[4];
        if (/^\s*&nbsp;\s*$/.test(body)) {
          // An EDGE spacer rail IS the block's gutter (2026-09-29). Unpinned it
          // shrinks with the viewport, so the CTA Heroes' 16px rails rendered
          // ~10px at 375 while every other block sat at 16. Warn below 12px
          // (three-quarters of the 16px mobile baseline): the 25px photo-band
          // rails render ~15.6px, which the docs accept.
          const edge = col === cols[0] || col === cols[cols.length - 1];
          const at375 = (px / total) * avail;
          const cls = /css-class="([^"]*)"/.exec(col[1] + col[3]);
          const tokens = cls ? cls[1].split(/\s+/) : [];
          if (edge && cols.length > 1 && at375 < 12 && !tokens.some((t) => pinned.has(t))) {
            warn(
              `src/${f}:${lineAt(text, g.index + g[0].indexOf(g[1]) + col.index)}: the ${col === cols[0] ? 'left' : 'right'} ${px}px edge spacer rail inside an mj-group has no mobile pin — ` +
                `mj-group converts it to a percentage below 600px, so the gutter renders about ${at375.toFixed(1)}px at ${MOBILE_VW} ` +
                `(guide §6e). Pin it: .<token> { width: ${px}px !important }, and give the content column a calc() companion so the row still fits`,
            );
          }
          continue;
        }
        const inset = insetOf(body);
        if (!inset) continue;
        // Rails only. A column that IS the row (a text column spanning the
        // frame) carries its padding as a deliberate gutter and is supposed
        // to shrink with the viewport — Photo Banner's 550-of-600 column at
        // 32px a side is the shape this would otherwise misreport. The
        // failure lives in the narrow rail beside it.
        if (px / total > 0.35) continue;
        // What this column renders at on a phone, and what the fixed inset
        // costs it there. Wide content columns are SUPPOSED to shrink; the
        // failure is a narrow rail whose fixed padding survives the shrink.
        const rendered = (px / total) * avail;
        if (inset / rendered <= THRESHOLD) continue;
        const cls = /css-class="([^"]*)"/.exec(col[1] + col[3]);
        const tokens = cls ? cls[1].split(/\s+/) : [];
        if (tokens.some((t) => pinned.has(t))) continue;
        warn(
          `src/${f}: a ${px}px mj-column inside an mj-group carries ${inset}px of fixed ` +
            `inline padding but no mobile pin (css-class ${cls ? `"${cls[1]}"` : 'absent'}) — ` +
            `mj-group converts it to a percentage below 600px, so it renders about ` +
            `${Math.round(rendered)}px at ${MOBILE_VW} and the inset eats ` +
            `${Math.round((inset / rendered) * 100)}% of it (guide §6e). ` +
            `Pin it: .<token> { width: ${px}px !important }`,
        );
      }
    }
  }
});

guard('ALL-CAPS button label check', () => {
  const stripNonText = (s) =>
    s.replace(/<[^>]+>|&[#a-zA-Z0-9]+;|\{[^}]*\}/g, '');
  for (const name of sources) {
    const src = read(`src/${name}`) ?? '';
    const offenders = [];
    // mj-button contents — paired scan that skips self-closed elements
    // (the mj-attributes defaults declaration)
    for (const m of src.matchAll(/<mj-button\b(?:[^>]*?)(\/?)>/g)) {
      if (m[1] === '/') continue;
      const close = src.indexOf('</mj-button>', m.index + m[0].length);
      if (close === -1) continue;
      const text = stripNonText(src.slice(m.index + m[0].length, close));
      const letters = text.replace(/[^a-zA-Z]/g, '');
      if (letters && letters !== letters.toUpperCase()) {
        offenders.push(`mj-button "${text.trim().slice(0, 40)}"`);
      }
    }
    // pill anchors — the raw-html button family
    for (const m of src.matchAll(/<a[^>]*border-radius:100px[^>]*>([\s\S]*?)<\/a>/g)) {
      const text = stripNonText(m[1]);
      const letters = text.replace(/[^a-zA-Z]/g, '');
      if (letters && letters !== letters.toUpperCase()) {
        offenders.push(`pill anchor "${text.trim().slice(0, 40)}"`);
      }
    }
    for (const o of offenders) {
      warn(
        `src/${name}: ${o} is not ALL CAPS — button labels ship uppercase defaults (editors re-case per email via the Text field)`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Type-table census — guide §8 item 3a, automated (2026-09-28). Every
// font-size/line-height pair that ships must be a row of the brand type table
// or a documented lockup (guide §5). README.MD owns both lists — the rows are
// its "Type scale" table, the lockups are the `(N/N …)` pairs in its "tuned
// lockups" note — so a new lockup is documented there or it warns here; this
// file keeps no copy of either.
//
// Censused: styles.css, head <style>/<mj-style>, mj-attributes and element
// attributes, inline styles, in every page and partial — import-excluded
// category dividers included: they never become blocks, but they were
// brought onto the table anyway (14/18, user decision 2026-09-28) and are
// held there. Skipped, because none of it is type: the builder-band sheet
// (data-en-tools-band, editor chrome), the 🐞 toolbar (the same regex
// emit-variants strips it with), and 0 sizes (structural resets on spacer
// and bar cells). A LONE size or line-height is resolved against the body
// default read from the `p` rule, because that is what it inherits in RTE
// copy: the divider labels authored font-size:14px alone and rendered 14/24.
// Why it exists: a 4/8 `&nbsp;` spacer <p> in CTA Hero (w/ heading) shipped
// from 2026-07-02 until a manual 3a pass caught it on 2026-09-27.
// ---------------------------------------------------------------------------
guard('type-table census', () => {
  const readme = read('README.MD') ?? '';
  const scale = /^## Type scale[\s\S]*?(?=^## )/m.exec(readme)?.[0] ?? '';
  const rows = new Set(
    [...scale.matchAll(/^\|[^|\n]*\|[^|\n]*\|\s*(\d+)px\s*\|\s*(\d+)px\s*\|/gm)].map((m) => `${m[1]}/${m[2]}`),
  );
  const note = /^- [^\n]*\blockups?\b[\s\S]*?(?=\n- |\n\s*\n|(?![\s\S]))/m.exec(scale)?.[0] ?? '';
  const lockups = new Set([...note.matchAll(/\((\d+)\/(\d+)\b/g)].map((m) => `${m[1]}/${m[2]}`));
  const blank = (s) => s.replace(/[^\n]/g, ' ');
  const stylesCss = (read('src/styles.css') ?? '').replace(/\/\*[\s\S]*?\*\//g, blank);
  const body = /(?:^|\})\s*p\s*\{([^}]*)\}/.exec(stylesCss)?.[1] ?? '';
  const decl = (s, prop) => new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}"!]+)`, 'i').exec(s)?.[1]?.trim() ?? null;
  const px = (v) => /^(\d+(?:\.\d+)?)px$|^(0)$/i.exec(v ?? '')?.slice(1).find((x) => x !== undefined);
  const BODY = { fs: px(decl(body, 'font-size')), lh: px(decl(body, 'line-height')) };
  if (!rows.size || !lockups.size || !BODY.fs || !BODY.lh) {
    const missing = !rows.size ? 'README.MD "Type scale" table' : !lockups.size ? 'README.MD "tuned lockups" note' : 'body default (the `p` rule in src/styles.css)';
    warn(`type-table census could not read the ${missing}, so it did not run`);
    return;
  }

  const files = [
    ...sources,
    ...PARTIAL_DIRS.flatMap((d) =>
      existsSync(join(ROOT, 'src', d)) ? readdirSync(join(ROOT, 'src', d)).filter((n) => n.endsWith('.mjml')).map((n) => `${d}/${n}`) : [],
    ),
    'styles.css',
  ];
  for (const f of files) {
    const raw = read(`src/${f}`) ?? '';
    // Every exclusion blanks in place, so offsets still map to raw lines.
    const text = raw
      .replace(/[ \t]*<div id="tpl-debug-btn"[\s\S]*?<\/div>/, blank)
      .replace(/<style\b[^>]*\bdata-en-tools-band\b[\s\S]*?<\/style>/g, blank)
      .replace(/<!--(?!\[if|<!\[endif)[\s\S]*?-->/g, blank);

    const found = [];
    const regions = f.endsWith('.css')
      ? [[0, text]]
      : [...text.matchAll(/<(mj-style|style)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => [m.index + m[0].indexOf('>') + 1, m[2]]);
    for (const [off, css] of regions) {
      for (const r of css.replace(/\/\*[\s\S]*?\*\//g, blank).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        found.push({ at: off + r.index + r[1].length, fs: decl(r[2], 'font-size'), lh: decl(r[2], 'line-height'), what: `${r[1].trim().split('\n').pop().trim()} {…}` });
      }
    }
    if (f.endsWith('.mjml')) {
      for (const m of text.matchAll(/\sstyle\s*=\s*"([^"]*)"/g)) {
        found.push({ at: m.index, fs: decl(m[1], 'font-size'), lh: decl(m[1], 'line-height'), what: `style="${m[1].slice(0, 60)}${m[1].length > 60 ? '…' : ''}"` });
      }
      for (const m of text.matchAll(/<(mj-[\w-]+)\b([^>]*)>/g)) {
        const attr = (n) => new RegExp(`\\s${n}\\s*=\\s*"([^"]*)"`).exec(m[2])?.[1]?.trim() ?? null;
        found.push({ at: m.index, fs: attr('font-size'), lh: attr('line-height'), what: `<${m[1]}> attributes` });
      }
    }

    for (const { at, fs, lh, what } of found) {
      if (fs === null && lh === null) continue;
      const where = `src/${f}:${lineAt(raw, at)}`;
      const [s, l] = [px(fs), px(lh)];
      if ((fs !== null && s === undefined) || (lh !== null && l === undefined)) {
        warn(`${where}: ${what} sets ${[fs && `font-size ${fs}`, lh && `line-height ${lh}`].filter(Boolean).join(', ')} — the type table is absolute px per size, never a ratio or relative unit (guide §5)`);
        continue;
      }
      if (s === '0' || l === '0') continue;
      const pair = `${s ?? BODY.fs}/${l ?? BODY.lh}`;
      if (rows.has(pair) || lockups.has(pair)) continue;
      const lone = s === undefined || l === undefined ? ` (the ${s === undefined ? 'size' : 'line-height'} is inherited from the ${BODY.fs}/${BODY.lh} body default)` : '';
      warn(
        `${where}: ${what} ships ${pair}${lone} — not a row of the README.MD type table and not a documented lockup (guide §5, §8 item 3a). ` +
          `Map it to a row by intent, or record it as a lockup in README.MD's "tuned lockups" note with a comment at the source line`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// §N No literal EN container merge tag in a source (2026-08-20). The importer
// joins the template shell as beforeBlocks + CONTAINER_TAG + afterBlocks and
// then splits it back on the FIRST occurrence of that tag
// (autoEnableTemplateReplacements, templateProps.ts). A literal anywhere in
// the source — including inside an HTML comment, which is how this happened —
// makes the split land at the literal instead of at the real container:
// beforeBlocks is truncated mid-comment, the comment loses its terminator and
// swallows the entire stylesheet that follows it, and every rule in it dies.
// The visible symptom was every light/dark image pair rendering BOTH halves,
// because .dark-only{display:none} never parsed. It is also wrong at export,
// where the literal would ship as a second container placeholder. Written as
// split fragments here so this guard cannot trip over its own source text.
// ---------------------------------------------------------------------------
guard('No literal EN container tag in sources', () => {
  const TAG = '{{' + 'container~main' + '}}';
  for (const f of sources) {
    const text = read(`src/${f}`);
    if (text === null) continue;
    let at = text.indexOf(TAG);
    while (at !== -1) {
      warn(
        `src/${f}:${text.slice(0, at).split('\n').length} — literal ${TAG} in the source.` +
          ` The importer splits the template shell on the FIRST occurrence, so this truncates` +
          ` beforeBlocks here instead of at the real container — an unterminated comment then` +
          ` swallows the stylesheet. Describe the placeholder in prose instead of writing it.`,
      );
      at = text.indexOf(TAG, at + TAG.length);
    }
  }
});

// ---------------------------------------------------------------------------
// §N Builder band span must lead the body (2026-08-20). A TRIPWIRE with zero
// live instances: the template band moved to a [data-container="main"]:before
// rule the same day, so no catalog source authors a band span any more and
// this guard currently matches nothing. It stays because the trap it catches
// is real and silent. shell.beforeBlocks is html.slice(0, seg.beforeEnd), and
// beforeEnd is the offset of the FIRST '<!-- START: ... -->' marker of ANY
// name — the segmenter has no special knowledge of "Main Content".
// partials/debug-toolbar.mjml carries its own START/END pair, so it segments
// as block #1; anything authored after that include lands INSIDE the toolbar
// block, which the app then drops wholesale via isDebugBlock(). That is how
// the #template-version span went missing from every exported Email Template
// before the container rule replaced it: the head kept the band's content
// rule while the element it targeted was silently discarded. If a band span
// is ever authored into a body again, it has to precede BOTH the first
// include and the first START marker.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// §N Builder band width tracks the EMAIL width (2026-08-20, user-raised).
// The block band is absolutely positioned and centres itself over the email
// column via max-width. That literal has no way to learn the email width, so
// widening the email (div[data-container]{max-width}, which lives in the
// BAND sheet in each page's template head since 2026-08-24 — builder chrome
// beside the other builder chrome) would silently leave the band centred on
// the OLD width. This ties them together, per page.
// ---------------------------------------------------------------------------
guard('Builder band width tracks the email width', () => {
  for (const f of sources) {
    const text = read(`src/${f}`);
    if (!text || !text.includes('marketing-tools-banner')) continue;
    const emailWidth = /div\[data-container\]\s*\{[^}]*?max-width:\s*(\d+)px/.exec(text);
    if (!emailWidth) {
      warn(`src/${f} — could not find div[data-container]{max-width} (band sheet) to compare the builder band against`);
      continue;
    }
    const band = /\.marketing-tools-banner\s*\{[^}]*?max-width:\s*(\d+)px/.exec(text);
    if (!band) {
      warn(`src/${f} — the builder band sets no max-width; it will not centre over the email column`);
      continue;
    }
    if (band[1] !== emailWidth[1]) {
      warn(
        `src/${f} — builder band max-width is ${band[1]}px but the email is ${emailWidth[1]}px ` +
          `(div[data-container] in styles.css). The band will centre on the wrong width`,
      );
    }
  }
});

guard('Builder band span leads the body', () => {
  for (const f of sources) {
    const text = read(`src/${f}`);
    if (text === null) continue;
    const span = text.indexOf('class="marketing-tools-banner"');
    if (span < 0) continue; // autoresponder sources carry no band
    const bodyAt = text.indexOf('<mj-body');
    const after = (needle) => {
      const i = text.indexOf(needle, bodyAt);
      return i < 0 ? Infinity : i;
    };
    const firstInclude = after('<mj-include');
    const firstStart = after('<!-- START:');
    const blocker =
      firstInclude < span ? `<mj-include> at line ${text.slice(0, firstInclude).split('\n').length}`
      : firstStart < span ? `<!-- START: --> marker at line ${text.slice(0, firstStart).split('\n').length}`
      : null;
    if (blocker) {
      warn(
        `src/${f}:${text.slice(0, span).split('\n').length} — the builder band span sits AFTER a ${blocker}.` +
          ` shell.beforeBlocks stops at the first START marker, so this span lands inside that block` +
          ` instead of the template shell and never reaches the exported Email Template. Move it directly` +
          ` under <mj-body>, above every include.`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// §N Head mirror matches the catalog head (2026-09-28). broken-blocks.mjml
// promises main's head verbatim so a block under repair behaves there as it
// did in the catalog. That promise was a sentence, and it rotted: two commits
// that moved rules into main's head (the viewport fork 2026-08-22, the
// light/dark swap 2026-08-24) skipped the holding pen, and for a month its
// page rendered BOTH halves of every twin pair (measured 2026-09-27) while
// every other check passed. Compared per top-level head element, comments
// stripped; the en-tools-config comment is compared on its own, as JSON.
// Allowed: a different <mj-title>, and <mj-style> elements main does not
// carry (rules for a block parked there, like .hero-photo-fallback).
// ---------------------------------------------------------------------------
const HEAD_MIRRORS = ['broken-blocks.mjml'];

guard('Head mirror matches the catalog head', () => {
  const main = read(`src/${CATALOG}`);
  if (main === null) return;
  const HEAD_EL = /<(mj-[\w-]+)\b[^>]*?(?:\/>|>[\s\S]*?<\/\1>)/g;
  const elements = (text) =>
    [...(/<mj-head>([\s\S]*?)<\/mj-head>/.exec(text)?.[1] ?? '').replace(/<!--[\s\S]*?-->/g, '').matchAll(HEAD_EL)].map(
      (m) => ({
        tag: m[1],
        key: m[1] === 'mj-title' ? '<mj-title>'
          : m[0].replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim(),
      }),
    );
  const config = (text) => JSON.parse(/<!--\s*en-tools-config\s*([\s\S]*?)-->/.exec(text)?.[1] ?? '{}');
  const short = (s, at = 0) => JSON.stringify(s.slice(Math.max(0, at - 30), at + 60));
  const mainEls = elements(main);
  const mainKeys = mainEls.map((e) => e.key);
  const mainCfg = config(main);

  for (const f of HEAD_MIRRORS) {
    const text = read(`src/${f}`);
    if (text === null) continue; // the holding pen is deleted once it empties

    const cfg = config(text);
    const drift = [];
    for (const k of new Set([...Object.keys(mainCfg), ...Object.keys(cfg)])) {
      const [a, b] = [mainCfg[k], cfg[k]];
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
      if (a && b && typeof a === 'object' && typeof b === 'object') {
        for (const s of new Set([...Object.keys(a), ...Object.keys(b)])) {
          if (JSON.stringify(a[s]) !== JSON.stringify(b[s])) drift.push(`${k}.${s}`);
        }
      } else drift.push(k);
    }
    if (drift.length) {
      warn(`src/${f} — en-tools-config differs from ${CATALOG}'s at ${drift.join(', ')}; copy ${CATALOG}'s across`);
    }

    const els = elements(text).filter((e) => !(e.tag === 'mj-style' && !mainKeys.includes(e.key)));
    const keys = els.map((e) => e.key);
    const missing = mainEls.filter((e) => !keys.includes(e.key));
    const extra = els.filter((e) => !mainKeys.includes(e.key));
    for (const m of missing) {
      // One missing and one extra of the same tag is the same element, edited
      // on one side: point at the first byte where they part.
      const pair = extra.filter((e) => e.tag === m.tag);
      if (pair.length === 1 && missing.filter((e) => e.tag === m.tag).length === 1) {
        const x = pair[0];
        extra.splice(extra.indexOf(x), 1);
        let i = 0;
        while (m.key[i] === x.key[i]) i += 1;
        warn(`src/${f} — its <${m.tag}> differs from ${CATALOG}'s: ${CATALOG} has ${short(m.key, i)}, this page has ${short(x.key, i)}; copy ${CATALOG}'s across`);
      } else {
        warn(`src/${f} — its head lacks this <${m.tag}> from ${CATALOG}'s: ${short(m.key)}; copy it across, in the same position`);
      }
    }
    for (const x of extra) {
      warn(`src/${f} — its head carries a <${x.tag}> that ${CATALOG}'s does not: ${short(x.key)}; remove it, or add it to ${CATALOG} too`);
    }
    if (!missing.length && !extra.length && keys.join('\0') !== mainKeys.join('\0')) {
      warn(
        `src/${f} — its head elements are in a different order from ${CATALOG}'s (${els.map((e) => e.tag).join(' → ')} vs ` +
          `${mainEls.map((e) => e.tag).join(' → ')}); CSS cascades in source order, so match ${CATALOG}'s`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// §N Column Width opt-out. The 50px width ladder in styles.css was deleted
// on 2026-08-20 once every block stopped offering a Column Width dropdown
// (user decision: Highlighted Text, Quote Block, CTA Text Block and Footer
// go back to left/right padding). That freed ~1,325 delivered bytes under
// Gmail's cliff, but it leaves a trap: MJML still emits an incidental
// `.mj-column-px-N` class for each real column width, and the importer's
// columnWidthOptions() accepts ANY head width divisible by 50. So a new
// px-width column that forgets `data-no-width-toggle` would mint a Column
// Width dropdown offering whatever arbitrary widths the catalog happens to
// use (200/300/550 today) — a menu that looks authored but is an accident.
// Percentage widths never mint the field, so only px widths are checked.
// ---------------------------------------------------------------------------
// §N Column Width opt-out. The 50px width ladder in styles.css was deleted
// on 2026-08-20, once every block stopped offering a Column Width dropdown
// (user decision: Highlighted Text, Quote Block, CTA Text Block and Footer
// go back to left/right padding). That freed ~1,325 delivered bytes under
// Gmail's cliff, but it leaves a trap: MJML still emits an incidental
// `.mj-column-px-N` class for every real column width, and the importer's
// columnWidthOptions() accepts ANY head width divisible by 50. A new
// eligible column that forgets `data-no-width-toggle` would therefore mint
// a Column Width dropdown offering whatever widths the catalog happens to
// use (200/300/550 today) — a menu that looks authored but is an accident.
//
// Eligibility mirrors mjmlProps.ts fixedPxColumns() + its `eligible` filter
// EXACTLY, and that narrowness is the point: an over-broad version of this
// guard fired on 93 px columns that can never mint a field. A field needs a
// LONE mj-column in its parent (an mj-group child never qualifies) with an
// integer px width >= 50. Keep the two in step if that filter ever moves.
// ---------------------------------------------------------------------------
guard('Column Width opt-out on eligible columns', () => {
  for (const f of sources) {
    const text = read(`src/${f}`);
    if (text === null) continue;
    // Walk containers, collecting each one's DIRECT column/group children.
    const eligible = [];
    const frames = [];
    const open = [];
    for (const m of text.matchAll(/<(\/?)(mj-wrapper|mj-section|mj-group|mj-column)((?:(?!>)[\s\S])*?)(\/?)>/g)) {
      const [, closing, tag, attrs, selfClose] = m;
      if (closing) {
        if (tag !== 'mj-column') {
          const done = open.pop();
          if (done) frames.push(done);
        }
        continue;
      }
      const top = open[open.length - 1];
      if ((tag === 'mj-column' || tag === 'mj-group') && top) {
        top.kids.push({ tag, attrs, index: m.index ?? 0, parentTag: top.tag });
      }
      if (tag !== 'mj-column' && !selfClose) open.push({ tag, kids: [] });
    }
    while (open.length) frames.push(open.pop());
    for (const fr of frames) {
      if (fr.kids.length !== 1) continue; // not lone in its parent
      const kid = fr.kids[0];
      if (kid.tag !== 'mj-column') continue; // groups never mint the field
      if (kid.parentTag === 'mj-group') continue; // group members are excluded
      const w = /\bwidth\s*=\s*"(\d+)px"/i.exec(kid.attrs); // integer px only
      if (!w || Number(w[1]) < 50) continue;
      if (/\bdata-no-width-toggle\b/.test(kid.attrs)) continue;
      eligible.push({ px: w[1], line: text.slice(0, kid.index).split('\n').length });
    }
    for (const e of eligible) {
      warn(
        `src/${f}:${e.line} — lone <mj-column width="${e.px}px"> has no` +
          ` data-no-width-toggle, so it mints a Column Width dropdown; the 50px` +
          ` ladder was deleted (2026-08-20), so that menu would offer whatever` +
          ` incidental .mj-column-px-N widths the catalog emits`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// §8b Source-side CSS budgets (2026-08-21).
//
//    The per-page guard below prices the COMPILED head, which is the number
//    Gmail actually drops — but it names the page, not the file that grew.
//    Until now nothing measured src/styles.css at all, so growth was caught
//    late and attributed to whichever page happened to be largest. That was
//    the open "Gmail CSS-cliff canary" item: the old full catalog used to
//    ride ~100 bytes inside the cliff and trip on any styles.css growth, and
//    deleting it removed the alarm without replacing it.
//
//    Both budgets below are DERIVED, not invented, and the derivation is the
//    point — if the page target moves, recompute rather than nudge.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// §7b Alternate arrangements must be pairable (2026-08-21).
//
//    data-alt-arrangement folds a sibling section into its predecessor's
//    arrangement Select as a third option instead of rendering it. If the
//    pairing fails at import the section renders on its own — the block ships
//    the same content twice — and the only signal is an infoNote nobody reads
//    at build time. These are the preconditions the importer checks, checked
//    here in the repo where the author is editing.
// ---------------------------------------------------------------------------

guard('alternate arrangement check', () => {
  for (const name of sources) {
    const src = read(`src/${name}`) ?? '';
    for (const m of src.matchAll(/<mj-section\b[^>]*\bdata-alt-arrangement\s*=\s*"([^"]*)"[^>]*>/g)) {
      const at = `src/${name}:${lineAt(src, m.index)}`;
      if (!m[1].trim()) {
        warn(`${at} data-alt-arrangement needs a non-empty label — it becomes the option's name`);
      }
      if (/data-(fully|import)-exclude/.test(m[0])) {
        warn(`${at} an alternate arrangement cannot also be excluded — exclusion runs first and would strand the pairing`);
      }
      // Its partner is the immediately preceding sibling section.
      const before = src.slice(0, m.index);
      const prev = before.lastIndexOf('<mj-section');
      if (prev < 0) {
        warn(`${at} data-alt-arrangement="${m[1]}" has no preceding mj-section to pair with`);
        continue;
      }
      // Nothing but whitespace and comments may sit between them, or they are
      // not siblings in the sense the importer's adjacency rule means.
      const between = src.slice(src.indexOf('</mj-section>', prev) + '</mj-section>'.length, m.index);
      if (between.replace(/<!--[\s\S]*?-->/g, '').trim()) {
        warn(`${at} data-alt-arrangement="${m[1]}" is not immediately after its partner — markup sits between them`);
      }
      // The partner must not itself be an alternate. Two consecutive alternates
      // pair against each other, which the importer accepts silently and which
      // ships the second one's markup with nothing tagging it.
      const prevOpen = src.slice(prev, src.indexOf('>', prev) + 1);
      if (/\bdata-alt-arrangement\b/.test(prevOpen)) {
        warn(`${at} data-alt-arrangement="${m[1]}" follows another alternate — an alternate's partner must be a primary section`);
      }
      // COPY EQUALITY. Pairing matches on VALUE, so a one-byte drift in the
      // alternate silently unpairs it: the option disappears, the alternate
      // renders as its own section (the same content twice), and every band
      // after it renumbers — which renames fields in EN emails already built
      // on this block. The importer says so only at info level, so the check
      // has to live here, next to the author. Compare mj-text bodies: they are
      // what the pairing's value equality actually turns on.
      const bodyOf = (open) => {
        const end = src.indexOf('</mj-section>', open);
        return end < 0 ? '' : src.slice(src.indexOf('>', open) + 1, end);
      };
      const textsOf = (body) =>
        [...body.matchAll(/<mj-text\b[^>]*>([\s\S]*?)<\/mj-text>/g)]
          .map((t) => t[1].replace(/\s+/g, ' ').trim())
          .filter(Boolean);
      const altTexts = textsOf(bodyOf(m.index));
      const primaryTexts = textsOf(bodyOf(prev));
      for (const t of altTexts) {
        if (primaryTexts.includes(t)) continue;
        const near = primaryTexts.find((x) => x.slice(0, 24) === t.slice(0, 24));
        warn(
          `${at} data-alt-arrangement="${m[1]}" has copy its partner does not: ${JSON.stringify(t.slice(0, 70))}` +
            (near ? ` — closest partner copy is ${JSON.stringify(near.slice(0, 70))}` : '') +
            '. Pairing matches on value, so this drops the option, renders the alternate as its own section, and renumbers every band after it',
        );
      }
    }
  }
});

guard('alternate member check', () => {
  // data-alt-member folds an element into the Display Select of the member
  // directly before it in its column (Video Block: WATCH Button / Play Icon /
  // Exclude). The importer only notes an unpaired alternate at info level —
  // and an unpaired one RENDERS IN PLACE, overlay stacked on overlay — so the
  // pairing rules are checked here, next to the author.
  const MEMBER = /<(mj-(?:image|text|button|divider))\b([^>]*)>/g;
  for (const name of sources) {
    const src = read(`src/${name}`) ?? '';
    const members = [...src.matchAll(MEMBER)].map((m) => ({
      index: m.index,
      attrs: m[2],
      column: src.lastIndexOf('<mj-column', m.index),
    }));
    for (const [i, m] of members.entries()) {
      const label = /\bdata-alt-member\s*=\s*"([^"]*)"/.exec(m.attrs);
      const at = `src/${name}:${lineAt(src, m.index)}`;
      if (!label) {
        if (/\bdata-option-label\b/.test(m.attrs)) {
          const next = members[i + 1];
          if (!next || next.column !== m.column || !/\bdata-alt-member\b/.test(next.attrs)) {
            warn(`${at} data-option-label with no data-alt-member directly after it in the same column — the label names nothing`);
          }
        }
        continue;
      }
      if (!label[1].trim()) warn(`${at} data-alt-member needs a non-empty label — it becomes the option's name`);
      // The primary is the member before it in the same column; a light/dark
      // pair's dark twin folds into its light twin, so step past it.
      let p = i - 1;
      if (p >= 0 && /dark-only/.test(members[p].attrs)) p -= 1;
      const primary = p >= 0 && members[p].column === m.column ? members[p] : null;
      if (!primary) {
        warn(`${at} data-alt-member="${label[1]}" has no member before it in its column — it would render in place`);
        continue;
      }
      if (/\bdata-alt-member\b/.test(primary.attrs)) {
        warn(`${at} data-alt-member="${label[1]}" follows another alternate — its primary must be an ordinary member`);
      }
      if (!/\bdata-option-label\s*=\s*"[^"]+"/.test(primary.attrs)) {
        warn(`${at} data-alt-member="${label[1]}": its primary has no data-option-label, so the Select's first option reads "Include Block"`);
      }
      const siblings = members.filter((x) => x.column === m.column && !/\bdata-alt-member\b|dark-only/.test(x.attrs));
      if (/\bdata-no-display-toggle\b/.test(primary.attrs) || (!/\bdata-display-toggle\b/.test(primary.attrs) && siblings.length < 2)) {
        warn(`${at} data-alt-member="${label[1]}": its primary gets no Display Select (add data-display-toggle), so the alternate would render in place`);
      }
    }
  }
});

guard('source CSS budgets', () => {
  const EN_CSS_REPRINT_FACTOR = 1.3; // same measured factor as §8

  const compact = (css) => {
    const tight = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};:,])\s*/g, '$1')
      .replace(/;}/g, '}');
    return tight.length + 3 * (tight.match(/}/g) || []).length;
  };

  // styles.css is ~60% of the delivered head. The rest of the head (MJML's
  // resets, the column ladder, the builder band) costs ~5,850 delivered
  // (measured 2026-09-29 on main: 14,383 page − 8,533 styles.css; it was
  // ~5,283 when this guard was written, and the ladder and builder band have
  // grown since), so against the 15,000 page target (14,141 until
  // 2026-09-29) styles.css may reach ~9,150 before the page itself trips.
  // Re-measure the rest when the ladder moves, or this share stops firing
  // first — at 9,710 (15,000 − the stale 5,283) it never could.
  const STYLES_CSS_BUDGET = 9150;
  const css = read('src/styles.css');
  if (css !== null) {
    const delivered = Math.round(EN_CSS_REPRINT_FACTOR * compact(css));
    if (delivered > STYLES_CSS_BUDGET) {
      warn(
        `src/styles.css is ~${delivered} delivered bytes (${compact(css)} compact × ${EN_CSS_REPRINT_FACTOR}) — past its ${STYLES_CSS_BUDGET}-byte share of the 15,000 page target. It is the largest single contributor to the head, so trim it here rather than hunting the page total`,
      );
    }
  }

  // Every distinct mj-column width="Npx" mints a head class, and MJML emits
  // each TWICE — once under @media (min-width:600px) and once as a
  // .moz-text-html twin — for ~174 delivered bytes a width. The ceiling sits
  // just above today's count (18 on 2026-09-29, with ~617 bytes to the
  // 15,000 target, about three widths) to give an early signal rather than a
  // post-mortem. Reuse an existing width before minting a new one.
  const MAX_COLUMN_WIDTHS = 20;
  const live = read('dist/main_live.html');
  if (live !== null) {
    const widths = [...new Set([...live.matchAll(/\.mj-column-px-(\d+)\s*\{/g)].map((m) => m[1]))];
    if (widths.length > MAX_COLUMN_WIDTHS) {
      warn(
        `dist/main_live.html carries ${widths.length} distinct fixed column widths (${widths.sort((a, b) => a - b).join(', ')}) — past the ${MAX_COLUMN_WIDTHS} ceiling, ~174 delivered bytes each. Reuse an existing width instead of minting one`,
      );
    }
  }
});

guard('Gmail CSS budget + head coupling check', () => {
  const EN_CSS_REPRINT_FACTOR = 1.3; // measured; mirrors headStyles.ts
  // Reserves space for CSS that is hoisted at send and therefore invisible to
  // the measurement below. It was 700 (canary + builder chrome) until
  // 2026-08-20, when the builder-band sheet moved INTO the template head to
  // survive an email built without the Template Styles block. That sheet is
  // measured directly now, so reserving it again would double-count it — the
  // comment used to price it at 454 delivered bytes, which was wrong (it is
  // ~902), though the double-count argument holds at any size. The diagnostic
  // canary this still reserves for was archived on 2026-08-21, so the 250 is
  // now pure conservatism; keep it until something measurable replaces it.
  const HOIST_ALLOWANCE = 250;
  // Probes excluded by livePages(), as in the column-geometry check.
  const pages = livePages();
  if (!pages.length) {
    console.log('  check-catalog: no dist/*_live.html — skipping the CSS budget check');
    return;
  }
  for (const { page } of pages) {
    const html = read(`dist/${page}`) || '';
    const headEnd = html.indexOf('</head>');
    const head = headEnd === -1 ? html : html.slice(0, headEnd);
    let css = '';
    for (const m of head.matchAll(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi)) {
      // The head-resident template sheet ships its PLAIN top-level rules to
      // EN's inliner, which writes them onto elements and drops them from the
      // delivered head; only its @-blocks survive into what Gmail measures.
      // Measured 2026-09-25 in two delivered heads (EoA d0S0nH…, 8lOZqo…):
      // the .wysiwyg containment rules were inlined and absent from <head>.
      css += /data-en-tools-template-css/.test(m[1]) ? atRulesOnly(m[2]) : m[2];
    }
    // Simulate the importer's compactCss: strip comments, tighten around
    // punctuation, then add back its one-line-per-rule newline/indent
    // overhead (~3 bytes per rule) so the byte count tracks the real field.
    const tight = css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .replace(/\s*([{};:,])\s*/g, '$1')
      .replace(/;}/g, '}');
    const ruleLines = (tight.match(/}/g) || []).length;
    const compactBytes = tight.length + 3 * ruleLines;
    const estimated = Math.round(EN_CSS_REPRINT_FACTOR * compactBytes);
    // Every page is a shipping master now. This used to exempt
    // mjml_extra-blocks, which was deleted on 2026-08-21 — the test could
    // never be false again, so it went with it.
    if (estimated > 15000) {
      warn(
        `dist/${page}: estimated delivered head CSS is ${estimated} bytes (${compactBytes} compact × ${EN_CSS_REPRINT_FACTOR} EN re-print) — past the 15,000-byte working target under Gmail's 16,384 cliff (guide §2b-bis); every Gmail surface drops the ENTIRE stylesheet past the limit`,
      );
    }
    if (estimated + HOIST_ALLOWANCE > 16384) {
      warn(
        `dist/${page}: estimated delivered head CSS ${estimated} bytes + ${HOIST_ALLOWANCE} hoisted (canary + builder chrome) crosses Gmail's 16,384 cliff — trim styles.css before anything else lands`,
      );
    }
    const mobileBlocks = [...css.matchAll(/@media[^{]*max-width\s*:\s*(\d+)px[^{]*\{/g)];
    const hasButtonPin = mobileBlocks.some((m) => {
      if (parseInt(m[1], 10) >= 600) return false;
      // crude body scan from this block onward — enough for a presence check
      const from = css.slice(m.index ?? 0, (m.index ?? 0) + 4000);
      return /td\.button[^{]*\{[^}]*!important/.test(from);
    });
    if (!hasButtonPin) {
      warn(
        `dist/${page}: no td.button !important rule found in a sub-600px media block — the inert audit's Desktop label pins would vanish (parseMobilePins reads these)`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Outlook.com contrast gate for the dark branches (2026-09-24).
//     Outlook.com's dark handler walks every element and repaints, inline
//     with !important, any whose computed text fails 4.5:1 against a #333333
//     base, or whose ground fails 4.5:1 against its text (Outlook source,
//     transformElementForDarkMode.ts:44,69; base baseDarkThemePalette.ts:35;
//     archived in the private repo's docs/archive/owa-darkmode-sim/). A value
//     that fails is overridden however the CSS is written, so it is a design
//     defect, not a CSS one. Text must clear 5.4:1 (margin: the base is from
//     2021 code); a ground must clear 4.5:1 against the text on it (the same
//     rule's color, else the branch's .email-body text).
//     Accepted exceptions are flagged UPSTREAM, on the source element whose
//     class the rule anchors on: data-outlook-repaint-ok. The rule passes
//     only when EVERY source element carrying that class has the flag.
// ---------------------------------------------------------------------------
guard('Outlook contrast gate', () => {
  const css = read('src/styles.css');
  if (!css) return;
  const lum = (hex) => {
    let h = hex.replace('#', '');
    if (h.length === 3) h = [...h].map((c) => c + c).join('');
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(h.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const BASE = '#333333';
  const HEX = /#([0-9a-f]{3}|[0-9a-f]{6})\b/i;
  const decl = (body, prop) => {
    const m = new RegExp(`(?:^|[;\\s])${prop}\\s*:\\s*([^;!]+)`, 'i').exec(body);
    const v = m && HEX.exec(m[1]);
    return v ? v[0] : null;
  };
  // Every source tag's class list and whether it carries the flag.
  const tags = [];
  for (const f of sources) {
    const text = read(`src/${f}`) || '';
    for (const m of text.matchAll(/<[a-z][\w-]*\b[^>]*\b(?:css-class|class)="([^"]*)"[^>]*>/gi)) {
      tags.push({ f, line: lineAt(text, m.index), classes: m[1].split(/\s+/), ok: /\sdata-outlook-repaint-ok\b/.test(m[0]) });
    }
  }
  for (const marker of ['@media (prefers-color-scheme: dark)', '@media only screen and (max-width: 9999px)']) {
    const start = css.indexOf(marker);
    if (start === -1) continue;
    let i = css.indexOf('{', start) + 1;
    let depth = 1;
    const from = i;
    while (depth && i < css.length) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    const block = css.slice(from, i - 1).replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...block.matchAll(/([^{}]+)\{([^}]*)\}/g)].map((m) => ({
      sels: m[1].split(',').map((s) => s.trim().replace(/^\[data-ogsc\]\s*/, '')),
      body: m[2],
    }));
    const pageText = decl((rules.find((r) => r.sels.includes('.email-body')) || { body: '' }).body, 'color') || '#ffffff';
    for (const r of rules) {
      const color = decl(r.body, 'color');
      const ground = decl(r.body, 'background-color');
      const fails = [];
      if (color && ratio(color, BASE) < 5.4) fails.push(`text ${color} is ${ratio(color, BASE).toFixed(2)}:1 against Outlook's ${BASE} base (needs 5.4)`);
      if (ground) {
        const on = color || pageText;
        if (ratio(ground, on) < 4.5) fails.push(`ground ${ground} is ${ratio(ground, on).toFixed(2)}:1 against its text ${on} (needs 4.5)`);
      }
      if (!fails.length) continue;
      const anchors = r.sels.map((s) => (/\.([\w-]+)/.exec(s) || [])[1]).filter(Boolean);
      const users = tags.filter((t) => anchors.some((a) => t.classes.includes(a)));
      const accepted = anchors.length === r.sels.length && users.length > 0 && users.every((t) => t.ok);
      if (accepted) continue;
      const missing = users.filter((t) => !t.ok).map((t) => `src/${t.f}:${t.line}`);
      warn(
        `styles.css ${marker} — "${r.sels.join(', ')}": ${fails.join('; ')}. Outlook.com dark repaints it whatever the CSS says. Fix the value, or accept the repaint by flagging every element carrying that class with data-outlook-repaint-ok${missing.length ? ` (unflagged: ${missing.join(', ')})` : ''}`,
      );
    }
  }
});

// ---------------------------------------------------------------------------
// Box Border safety (BugHerd 295, 2026-09-25). data-border-toggle="#hex" on
//     an mj-text gives it a Box Border (None / 2px / 4px, 16px inner padding)
//     on its own cell. A border is safe only where nothing inside has to add
//     up to an exact width: a plain full-width column. Warn when the flag sits
//     in a column with an explicit width, inside an mj-group (never stacks,
//     percentage math), in a section/wrapper with a background image (fixed
//     heights, v:rect), on a text whose own padding is not 0 (the importer
//     refuses it), or without a default hex (ditto).
//
//     Policy (2026-09-26): every Text-category text that COULD take a border
//     must offer one. Between the Text divider's END comment and the next
//     category's START, an mj-text that passes every check above but carries
//     no data-border-toggle warns unless it opts out with data-no-border-toggle
//     (template-only; the importer never reads it). Texts that cannot qualify
//     (fixed-width columns, padded or shared columns) are skipped by the rule
//     itself, so they need no opt-out.
//
//     The same flag on an mj-column (2026-09-27, the CTA Text Block) boxes
//     the whole column. Warn unless it has padding="0" of its own, is its
//     section's only column, sits outside mj-group and background-image
//     frames, and holds only texts, auto-width buttons, spacers and mj-raw:
//     MJML sizes anything fixed-width from the unbordered column.
// ---------------------------------------------------------------------------
guard('Box Border safety', () => {
  const TAG = /<(\/?)(mj-section|mj-wrapper|mj-group|mj-column|mj-text|mj-[a-z-]+)\b([^>]*?)(\/?)>/g;
  const attr = (a, n) => {
    const m = new RegExp(`\\s${n}=(?:"([^"]*)"|'([^']*)')`).exec(a);
    return m ? (m[1] ?? m[2]) : undefined;
  };
  // Blank comments and mj-raw bodies (same length, newlines kept) so a tag
  // named in prose or raw markup never enters the stack.
  const blank = (t) => t.replace(/[^\n]/g, ' ');
  for (const f of sources) {
    const raw = read(`src/${f}`) || '';
    const text = raw
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/(<mj-raw\b[^>]*>)([\s\S]*?)(<\/mj-raw>)/g, (_, o, body, c) => o + blank(body) + c);
    const stack = [];
    const checks = [];
    const colChecks = [];
    const textFrom = raw.indexOf('<!-- END: Category — Text Blocks -->');
    const nextCat = textFrom < 0 ? -1 : raw.indexOf('<!-- START: Category — ', textFrom);
    const inTextCategory = (i) => textFrom >= 0 && i > textFrom && (nextCat < 0 || i < nextCat);
    for (const m of text.matchAll(TAG)) {
      const [, close, name, attrs, selfClose] = m;
      if (close) {
        for (let i = stack.length - 1; i >= 0; i -= 1) {
          if (stack[i].name === name) {
            stack.splice(i);
            break;
          }
        }
        continue;
      }
      const parent = stack[stack.length - 1];
      if (parent) parent.members.push({ name, attrs });
      const flagged = /\sdata-border-toggle\b/.test(attrs);
      if (name === 'mj-column' && flagged) {
        const problems = [];
        const hex = attr(attrs, 'data-border-toggle');
        if (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) problems.push('no default hex (write data-border-toggle="#006837")');
        const pad = attr(attrs, 'padding');
        if (pad === undefined || !/^0(px)?$/.test(pad.trim())) problems.push('no padding="0" of its own (MJML emits no column cell to border without one)');
        if (stack.some((t) => t.name === 'mj-group')) problems.push('it sits inside an mj-group');
        if (stack.some((t) => (t.name === 'mj-section' || t.name === 'mj-wrapper') && attr(t.attrs, 'background-url'))) {
          problems.push('its section has a background image');
        }
        const entry = { name, attrs, members: [] };
        colChecks.push({ where: `src/${f}:${lineAt(raw, m.index)}`, col: entry, section: parent, problems });
        stack.push(entry);
        continue;
      }
      if (name === 'mj-text' && (flagged || inTextCategory(m.index))) {
        const problems = [];
        const hex = attr(attrs, 'data-border-toggle');
        if (flagged && (!hex || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex))) problems.push('no default hex (write data-border-toggle="#006837")');
        const pad = attr(attrs, 'padding');
        if (pad === undefined) problems.push('no padding="0" of its own (MJML\'s default text padding is not 0)');
        else if (!/^0(px)?$/.test(pad.trim())) problems.push(`its own padding is "${pad}", not 0`);
        const col = [...stack].reverse().find((t) => t.name === 'mj-column');
        if (col && attr(col.attrs, 'width')) problems.push(`its column has an explicit width (${attr(col.attrs, 'width')})`);
        if (stack.some((t) => t.name === 'mj-group')) problems.push('it sits inside an mj-group');
        if (stack.some((t) => (t.name === 'mj-section' || t.name === 'mj-wrapper') && attr(t.attrs, 'background-url'))) {
          problems.push('its section has a background image');
        }
        const optOut = /\sdata-no-border-toggle\b/.test(attrs);
        checks.push({ where: `src/${f}:${lineAt(raw, m.index)}`, col, problems, flagged, optOut });
      }
      if (!selfClose && name !== 'mj-text' && name !== 'mj-raw') {
        stack.push({ name, attrs, members: [] });
      }
    }
    // Evaluated after the pass: a column's members are only known once it closes
    for (const { where, col, section, problems } of colChecks) {
      if (section?.name !== 'mj-section' || section.members.filter((t) => t.name === 'mj-column').length !== 1) {
        problems.push('it is not the only column of its section');
      }
      for (const t of col.members) {
        if (t.name === 'mj-button' && /px\s*$/.test(attr(t.attrs, 'width') ?? '')) problems.push('it holds a fixed-width mj-button');
        else if (!['mj-text', 'mj-button', 'mj-spacer', 'mj-raw'].includes(t.name)) problems.push(`it holds an ${t.name}`);
        else if (t.name === 'mj-text' && /\sdata-border-toggle\b/.test(t.attrs)) problems.push('a text inside carries its own data-border-toggle');
      }
      if (problems.length) warn(`${where}: column data-border-toggle is not border-safe here: ${[...new Set(problems)].join("; ")}`);
    }
    for (const { where, col, problems, flagged, optOut } of checks) {
      const members = (col?.members ?? []).filter((t) => t.name !== 'mj-raw' && !/\sdata-style-dark-mode\b/.test(t.attrs));
      if (!col || members.length !== 1) problems.push('it is not the only member of its column (the importer refuses it: Spacing Below owns that padding)');
      if (flagged && optOut) warn(`${where}: carries both data-border-toggle and data-no-border-toggle; keep one`);
      else if (flagged && problems.length) warn(`${where}: data-border-toggle is not border-safe here: ${problems.join('; ')}`);
      else if (!flagged && !optOut && !problems.length) {
        warn(`${where}: Text-category text could take a Box Border but offers none. Add data-border-toggle="#006837", or opt out with data-no-border-toggle`);
      }
    }
  }
});

console.log(
  warnings
    ? `check-catalog: ${warnings} WARNING(S) — see above`
    : `check-catalog: ${sources.length} sources verified — backgrounds, column geometry, grouped column pins, twin flags, anchors, link groups, mobile-only guards, head mirror, type table, CSS budget, Outlook contrast gate, box borders clean`,
);
