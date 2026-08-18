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

/** Catalog sources. probe_* files are deliberate experiments, not catalog pages. */
const sources = readdirSync(join(ROOT, 'src'))
  .filter((n) => n.endsWith('.mjml') && !n.startsWith('probe_'))
  .sort();

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

guard('column geometry check', () => {
  const dist = existsSync(join(ROOT, 'dist')) ? readdirSync(join(ROOT, 'dist')) : [];
  // _live.html only: _local-debug.html embeds the whole source MJML as JSON,
  // including its own START: markers, which mis-attributes every later hit.
  // These regexes are tuned to MJML's own output shape — never point this
  // check at DELIVERED html, whose attributes EN rewrites (valign, bgcolor).
  const pages = dist.filter((n) => n.endsWith('_live.html')).sort();
  if (!pages.length) {
    console.log('  check-catalog: no dist/*_live.html — run npm run build; skipping column geometry');
    return;
  }

  for (const page of pages) {
    const html = read(`dist/${page}`) || '';
    const base = page.replace(/_live\.html$/, '');
    const srcText = read(`src/${base}.mjml`);
    if (srcText === null) continue; // a page with no source is not ours to police

    // MJML's [if mso | IE] conditionals mirror the column tree exactly, so the
    // frames they open give sibling identity without a tree parser.
    // The section content td carrying `direction:ltr` is REAL markup, not part
    // of an MSO conditional, so it needs its own branch — a plain section's
    // frame comes from nowhere else.
    const events = [
      ...html.matchAll(
        /<!--\[if mso \| IE\]>([\s\S]*?)<!\[endif\]-->|<div class="mj-column-(px|per)-([\d-]+) mj-outlook-group-fix[^"]*"|<div [^>]*style="[^"]*max-width:(\d+)px|<td[^>]*style="([^"]*direction:\s*ltr[^"]*)"/g,
      ),
    ];

    // `cell` is the width of the innermost open cell. A conditional <table>
    // opens a frame whose width is that cell — the tds INSIDE it are the
    // sibling columns, not the frame. That distinction is the whole check:
    // MJML nests an mj-group's columns one conditional deeper, so a group's
    // children are measured against the cell the GROUP occupies.
    let carrier = 600; // mj-body default; no catalog page overrides it
    let cell = 600;
    const frames = [];
    const hits = [];

    const closeFrame = (at) => {
      const f = frames.pop();
      if (!f) return;
      cell = f.savedCell; // sibling cells are scoped to their frame
      if (f.cols.length < 2) return;
      const sum = f.cols.reduce((a, b) => a + b, 0);
      if (sum > f.frame + 1) hits.push({ ...f, sum, at });
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
        continue;
      }
      if (e[4]) {
        carrier = Number(e[4]); // most recent constrained wrapper, not the max
        continue;
      }
      if (e[2]) {
        const raw = e[3].replace('-', '.');
        const px = e[2] === 'px' ? Number(raw) : (cell * Number(raw)) / 100;
        if (frames.length) frames[frames.length - 1].cols.push(px);
        continue;
      }
      for (const t of (e[1] || '').matchAll(/<table[^>]*>|<\/table>|<td[^>]*style="([^"]*)"/g)) {
        if (t[0].startsWith('</table')) {
          closeFrame(e.index);
          continue;
        }
        if (t[0].startsWith('<table')) {
          frames.push({ frame: cell, cols: [], savedCell: cell });
          continue;
        }
        const w = /width:(\d+(?:\.\d+)?)px/.exec(t[1] || '');
        if (w) cell = Number(w[1]);
      }
    }
    while (frames.length) closeFrame(html.length);

    for (const hit of hits) {
      const marker = html.lastIndexOf('<!-- START: ', hit.at);
      const name = marker < 0 ? '(unknown block)' : /<!-- START: (.+?) -->/.exec(html.slice(marker))[1];
      const inSrc = srcText.indexOf(`<!-- START: ${name} -->`);
      const at = inSrc < 0 ? '' : `:${lineAt(srcText, inSrc)}`;
      warn(
        `src/${base}.mjml${at} "${name}" — ${hit.cols.length} fixed-width columns total ${Math.round(hit.sum)}px in a ${Math.round(hit.frame)}px frame (${Math.round(hit.sum - hit.frame)}px over); CSS clients wrap the last column`,
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

console.log(
  warnings
    ? `check-catalog: ${warnings} WARNING(S) — see above`
    : `check-catalog: ${sources.length} sources verified — backgrounds, column geometry, twin flags, anchors, link groups, mobile-only guards clean`,
);
