#!/usr/bin/env node
/**
 * Name the two compiled variants of every page — runs LAST in the build.
 *
 * Each src/*.mjml therefore produces two files in dist/, named for what they
 * are FOR rather than for how they were made:
 *
 *   <name>_local-debug.html   relative asset paths + the debug overlay — the
 *                             working copy, and what the preview server
 *                             serves. This is the compiler's own output,
 *                             renamed in place.
 *   <name>_live.html          absolute asset URLs + no debugger — paste-in
 *                             ready for an EN send or an autoresponder, with
 *                             nothing that depends on this repo being served.
 *
 * Source MJML always keeps RELATIVE paths (guide §7: authoring absolute CDN
 * URLs defeats environment portability). The absolute form is a build
 * artifact, never something you author.
 *
 * Neither output is the importer's input — it reads src/<name>.mjml (also
 * copied into dist/) and rejects compiled HTML by design. This rewrite
 * deliberately parallels the importer's own rewriteAssetPaths: that one
 * feeds block/template JSON, this one feeds a paste-in HTML send.
 *
 * Rewriting covers every carrier MJML emits for one image, because a section
 * background compiles into four of them and missing any one renders the old
 * photo in some clients and the new one in others (guide §4):
 *   1. the div's inline  background:url('assets/x.jpg')
 *   2. the wrapper table's  background="assets/x.jpg"  attribute
 *   3. a second url() inside that table's style
 *   4. the  v:fill src="assets/x.jpg"  inside the [if mso | IE] conditional
 * plus ordinary <img src>. EN's CDN folders are flat, so every path collapses
 * to <ASSET_ROOT><filename> regardless of any subdirectory in source.
 *
 * The live copy is then COMPACTED — every byte removed is render-inert
 * (2026-09-27; see compactLive below): authoring prose comments, line
 * indentation and trailing blanks, and CSS comments. Nothing a client, EN's
 * inliner or this repo's checks read is touched, and a built-in guard proves
 * it on every build. _local-debug stays exactly as the compiler wrote it.
 */
import { readdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

/** TPL's EN asset root. Flat folder — filenames must be unique repo-wide. */
const ASSET_ROOT =
  process.env.TPL_ASSET_ROOT ||
  'https://bd6ca9cefa6fb6e0adf1-c2f9aa1adb9f60a775f60074e4c86031.ssl.cf5.rackcdn.com/20002/';

const root = ASSET_ROOT.replace(/\/+$/, '') + '/';

/** assets/sub/dir/logo.png -> <root>logo.png (EN CDN folders are flat) */
const toAbsolute = (path) => root + path.split('/').pop();

function absolutize(html) {
  let count = 0;
  const swap = (m, pre, path, post) => {
    count += 1;
    return pre + toAbsolute(path) + post;
  };
  const out = html
    // <img src="assets/…">, and any other src= attribute
    .replace(/(\bsrc=")(assets\/[^"]+)(")/g, swap)
    // <table background="assets/…">
    .replace(/(\bbackground=")(assets\/[^"]+)(")/g, swap)
    // url('assets/…') — the div shorthand AND the table style's second copy
    .replace(/(url\(')(assets\/[^']+)('\))/g, swap)
    .replace(/(url\(")(assets\/[^"]+)("\))/g, swap)
    .replace(/(url\()(assets\/[^)'"]+)(\))/g, swap);
  return { html: out, count };
}

/**
 * Strip dev-only chrome: every <script> (the debugger plus the build-injected
 * structure-groups and raw-source JSON payloads) and the floating 🐞 toolbar
 * with its START/END comments. Mirrors the debugger's own "Copy HTML".
 */
function stripDebugger(html) {
  const before = html.length;
  const out = html
    .replace(/[ \t]*<script\b[\s\S]*?<\/script>[ \t]*\n?/gi, '')
    .replace(/[ \t]*<!--\s*(?:START|END): Debug Toolbar[\s\S]*?-->[ \t]*\n?/g, '')
    .replace(/[ \t]*<div id="tpl-debug-btn"[\s\S]*?<\/div>[ \t]*\n?/, '');
  return { html: out, removed: before - out.length };
}

/* ---------- delivery compaction ---------- */

/*
 * Mirror of the importer's compactEmailHtml (email-to-en-marketing-tools,
 * src/core/compact.ts — KEEP IN STEP, like applyInlineFluid in
 * restore-excluded.mjs). The app runs it on every import, so the EN
 * templates and blocks carry the same bytes this paste does.
 *
 * Removed: prose comments (the MJML's inline notes — EN delivers body
 * comments untouched, guide §2), line indentation and trailing blanks, and
 * blank-line runs (collapsed to one newline — no line is ever joined to
 * another). KEPT byte-for-byte: conditional comments (hidden AND revealed —
 * `<!--[if !mso]><!-->` is one complete comment to this scan), START:/END:
 * markers (check-catalog names blocks by them), `- Not Displayed` markers,
 * en-tools-keep, EVERY start tag (attribute values are never compacted), the
 * bodies of the raw-text/RCDATA elements and CDATA. The scan ends a comment
 * where an HTML tokenizer does: `-->`, `--!>`, or abruptly as `<!-->` /
 * `<!--->`.
 */
const HOLD = '\u0000';
const TAG_INNARDS = String.raw`(?:[^<>"']|"[^"]*"|'[^']*')*`;
const COMMENT_SRC = String.raw`<!--(?:>|->|[\s\S]*?--!?>)`;
const RAW_ELEMENTS = 'style|script|pre|textarea|title|xmp|iframe|noembed|noframes|noscript';
const OPAQUE_RE = new RegExp(
  [
    COMMENT_SRC,
    String.raw`<(${RAW_ELEMENTS})\b${TAG_INNARDS}>[\s\S]*?<\/\1\s*>`,
    String.raw`<!\[CDATA\[[\s\S]*?\]\]>`,
    String.raw`<[a-zA-Z][\w:.-]*${TAG_INNARDS}>`,
  ].join('|'),
  'gi',
);
const HELD_RE = new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g');
const KEEP_COMMENT_RE =
  /^<!--\s*(?:\[if\b|<!\[endif\]|(?:START|END):|en-tools-keep\b)|- Not Displayed\s*--!?>$/i;
const HEAD_END_RE = /<\/head\s*>/i;
const EDGE_BLANKS_RE = /^[ \t]+|[ \t]+$/gm;
const BLANK_RUN_RE = /\n(?:[ \t]*\n)+/g;

const isProseComment = (c) => c.startsWith('<!--') && !KEEP_COMMENT_RE.test(c);

function dropProseComments(html, headAware) {
  const held = [];
  const masked = html.replace(OPAQUE_RE, (m) => `${HOLD}${held.push(m) - 1}${HOLD}`);
  const head = headAware ? HEAD_END_RE.exec(masked) : null;
  const from = head ? head.index : 0;
  // `a <!-- note --> b` keeps ONE space; `a<!-- x -->b` never had one.
  let out = masked.slice(0, from);
  let pos = from;
  HELD_RE.lastIndex = from;
  for (let m = HELD_RE.exec(masked); m; m = HELD_RE.exec(masked)) {
    if (!isProseComment(held[Number(m[1])])) continue;
    out += masked.slice(pos, m.index);
    pos = m.index + m[0].length;
    if (/[ \t]$/.test(out)) while (masked[pos] === ' ' || masked[pos] === '\t') pos += 1;
    HELD_RE.lastIndex = pos;
  }
  return { text: out + masked.slice(pos), held };
}

const restoreHeld = (text, held) => text.replace(HELD_RE, (_, i) => held[Number(i)]);

/**
 * The app's compactEmailHtml leaves head COMMENTS to its stripHeadComments;
 * the paste has no importer, so `headAware: false` takes the head's prose
 * (en-tools-config, the VIEWPORT FORK notes, …) with the rest. The
 * en-tools-keep stamp stays, as it does in the app.
 */
function compactEmailHtml(html, { headAware = true } = {}) {
  const { text, held } = dropProseComments(html, headAware);
  return restoreHeld(text.replace(EDGE_BLANKS_RE, '').replace(BLANK_RUN_RE, '\n'), held);
}

/**
 * Walk a stylesheet the way a CSS tokenizer does — quoted strings and
 * unquoted url() are opaque (a `/*` inside either is content) — handing each
 * comment to `onComment(textSoFar, comment, nextChar)` for its replacement.
 */
function mapCssComments(css, onComment) {
  let out = '';
  for (let i = 0; i < css.length; ) {
    const c = css[i];
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < css.length && css[j] !== c && css[j] !== '\n') j += css[j] === '\\' ? 2 : 1;
      out += css.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if ((c === 'u' || c === 'U') && !/[\w-]$/.test(out) && /^url\(\s*[^\s"')]/i.test(css.slice(i, i + 64))) {
      const close = css.indexOf(')', i);
      const end = close === -1 ? css.length : close + 1;
      out += css.slice(i, end);
      i = end;
      continue;
    }
    if (c === '/' && css[i + 1] === '*') {
      const close = css.indexOf('*/', i + 2);
      const end = close === -1 ? css.length : close + 2;
      out += onComment(out, css.slice(i, end), css.slice(end, end + 1));
      i = end;
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/**
 * A comment only separates tokens, so deleting it is safe exactly when white
 * space or a `{ } ; ,` (which never fuse with a neighbour) already sits on one
 * side. Anywhere else (`and/**` + `/(`, `1/**` + `/.5em`) it is KEPT and
 * counted — deleting it could mint a new token.
 */
const CSS_SEPARATOR = /[\s{};,]/;
const cssCommentRemovable = (before, next) =>
  before === '' || CSS_SEPARATOR.test(before.slice(-1)) || next === '' || CSS_SEPARATOR.test(next);

/**
 * CSS comments, line indentation and blank lines out of one stylesheet.
 * Nothing else moves: at-rule preludes keep their exact text (EN merges
 * @media blocks by condition STRING — guide §2a), declarations and
 * ` !important` keep their spacing. EN strips CSS comments at send anyway
 * (guide §2), so this costs the delivered email nothing; it trims the paste
 * (about a quarter of an autoresponder, ~5% of the catalog).
 */
function compactCss(css) {
  let kept = 0;
  const out = mapCssComments(css, (before, comment, next) => {
    if (cssCommentRemovable(before, next)) return '';
    kept += 1;
    return comment;
  });
  return { css: out.replace(EDGE_BLANKS_RE, '').replace(/\n{2,}/g, '\n'), kept };
}

/** Every stylesheet OUTSIDE a comment (conditional-comment sheets stay verbatim) */
function compactStyles(html) {
  let kept = 0;
  const out = html.replace(
    new RegExp(`${COMMENT_SRC}|(<style\\b${TAG_INNARDS}>)([\\s\\S]*?)(<\\/style\\s*>)`, 'gi'),
    (m, open, body, close) => {
      if (!open) return m;
      const r = compactCss(body);
      kept += r.kept;
      return open + r.css + close;
    },
  );
  return { html: out, kept };
}

function compactLive(html) {
  const { html: styled, kept } = compactStyles(html);
  return { html: compactEmailHtml(styled, { headAware: false }), kept };
}

/* ---------- the guard: prove the compaction render-inert, every build ---------- */

/*
 * Deliberately NOT built on the compactor's own shortcuts: it normalises only
 * what a client ignores (white space runs collapse to one space; a CSS
 * comment is a token separator; white space around `{ } ; ,` is nothing), so
 * a compactor mistake — joined words, a swallowed element, a fused CSS token —
 * shows up as a difference instead of agreeing with itself.
 */
function parts(html) {
  const re = new RegExp(
    [
      COMMENT_SRC,
      String.raw`<(${RAW_ELEMENTS})\b${TAG_INNARDS}>[\s\S]*?<\/\1\s*>`,
      String.raw`<!\[CDATA\[[\s\S]*?\]\]>`,
      String.raw`<\/?[a-zA-Z][\w:.-]*${TAG_INNARDS}>`,
      String.raw`<!doctype[^>]*>`,
    ].join('|'),
    'gi',
  );
  const tags = [];
  const comments = [];
  const sheets = [];
  const raw = [];
  let text = '';
  let pos = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    text += html.slice(pos, m.index);
    pos = m.index + m[0].length;
    const t = m[0];
    if (t.startsWith('<!--')) {
      comments.push(t);
      continue;
    }
    if (m[1]) {
      const open = t.slice(0, t.indexOf('>') + 1);
      const body = t.slice(open.length, t.lastIndexOf('<'));
      tags.push(open);
      if (m[1].toLowerCase() === 'style') sheets.push(body);
      else raw.push(body);
    } else tags.push(t);
    text += '§TAG§';
  }
  text += html.slice(pos);
  return { tags, comments, sheets, raw, text: text.replace(/\s+/g, ' ').trim() };
}

/** CSS as a client tokenizes it: comments separate, white space runs collapse */
const cssShape = (css) =>
  mapCssComments(css, () => ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,])\s*/g, '$1')
    .trim();

function guard(page, before, after) {
  const a = parts(before);
  const b = parts(after);
  const problems = [];
  const firstDiff = (x, y) => {
    for (let i = 0; i < Math.max(x.length, y.length); i += 1) if (x[i] !== y[i]) return i;
    return -1;
  };
  let i = firstDiff(a.tags, b.tags);
  if (i !== -1) problems.push(`tag #${i} differs: ${JSON.stringify(a.tags[i])} -> ${JSON.stringify(b.tags[i])}`);
  if (a.text !== b.text) {
    i = firstDiff(a.text, b.text);
    problems.push(`text differs at ${i}: ${JSON.stringify(a.text.slice(i, i + 60))} -> ${JSON.stringify(b.text.slice(i, i + 60))}`);
  }
  const kept = a.comments.filter((c) => !isProseComment(c));
  i = firstDiff(kept, b.comments);
  if (i !== -1) problems.push(`kept comment #${i} differs: ${JSON.stringify((kept[i] || '').slice(0, 80))}`);
  const cond = (list) => list.filter((c) => /^<!--\s*(?:\[if|<!\[endif)/i.test(c)).length;
  if (cond(a.comments) !== cond(b.comments)) problems.push(`conditional comments ${cond(a.comments)} -> ${cond(b.comments)}`);
  i = firstDiff(a.sheets.map(cssShape), b.sheets.map(cssShape));
  if (i !== -1) problems.push(`stylesheet #${i} parses differently`);
  i = firstDiff(a.raw, b.raw);
  if (i !== -1) problems.push(`raw-text body #${i} (pre/textarea/title/…) differs`);
  const longest = (h) => Math.max(...h.split('\n').map((l) => Buffer.byteLength(l)));
  if (longest(after) > longest(before)) problems.push(`a line grew: longest ${longest(before)} -> ${longest(after)} bytes`);
  for (const p of problems) console.log(`variants: WARN ${page} compaction is not render-inert — ${p}`);
  return problems.length;
}

for (const f of readdirSync(DIST)) {
  // Only the compiler's raw <name>.html is input; both named variants are
  // outputs and must never be reprocessed (absolutizing twice is a no-op,
  // but stripping an already-stripped page would hide a real regression).
  if (!f.endsWith('.html') || f.endsWith('_live.html') || f.endsWith('_local-debug.html')) {
    continue;
  }
  const src = readFileSync(join(DIST, f), 'utf8');
  const { html: noDebug, removed } = stripDebugger(src);
  const { html: absolute, count } = absolutize(noDebug);
  const { html, kept } = compactLive(absolute);
  guard(f, absolute, html);
  const bytes = (s) => Buffer.byteLength(s, 'utf8');
  const saved = bytes(absolute) - bytes(html);

  const live = f.replace(/\.html$/, '_live.html');
  const local = f.replace(/\.html$/, '_local-debug.html');
  writeFileSync(join(DIST, live), html);
  renameSync(join(DIST, f), join(DIST, local));

  const leftover = (html.match(/["'(]assets\//g) || []).length;
  console.log(
    `variants: ${local} + ${live} — ${count} asset URLs absolutized, ` +
      `${removed} bytes of debug chrome removed, compacted ${bytes(absolute)} -> ${bytes(html)} ` +
      `(-${saved}, ${((100 * saved) / bytes(absolute)).toFixed(1)}%)` +
      (kept ? `, ${kept} CSS comment(s) kept where removal could fuse two tokens` : '') +
      (leftover ? `, WARN ${leftover} relative refs remain` : ''),
  );
}
