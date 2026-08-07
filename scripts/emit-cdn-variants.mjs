#!/usr/bin/env node
/**
 * Emit a send-ready twin of every compiled page — runs LAST in the build.
 *
 * Each src/*.mjml therefore produces two files in dist/:
 *
 *   <name>.html       relative asset paths + the debug overlay — the working
 *                     copy, and what the preview server serves.
 *   <name>.cdn.html   absolute asset URLs + no debugger — paste-in ready for
 *                     an EN send or an autoresponder, with nothing that
 *                     depends on this repo being served.
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
 */
import { readdirSync, readFileSync, writeFileSync } from 'fs';
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

for (const f of readdirSync(DIST)) {
  if (!f.endsWith('.html') || f.endsWith('.cdn.html')) continue;
  const src = readFileSync(join(DIST, f), 'utf8');
  const { html: noDebug, removed } = stripDebugger(src);
  const { html, count } = absolutize(noDebug);
  const name = f.replace(/\.html$/, '.cdn.html');
  writeFileSync(join(DIST, name), html);

  const leftover = (html.match(/["'(]assets\//g) || []).length;
  console.log(
    `cdn: ${name} — ${count} asset URLs absolutized, ${removed} bytes of debug chrome removed` +
      (leftover ? `, WARN ${leftover} relative refs remain` : ''),
  );
}
