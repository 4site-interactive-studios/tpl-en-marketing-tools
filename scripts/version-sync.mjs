#!/usr/bin/env node
/**
 * version-sync — content-hash-anchored versioning for every EN artifact.
 *
 * Each entity below gets an integer version in versions.json. The baseline
 * is the manifest AS COMMITTED (git show HEAD:versions.json), so a bump
 * means "this entity's content differs from the last commit": rebuilding
 * never double-bumps, and iterating locally cannot inflate numbers — an
 * entity is exactly one version ahead of HEAD until the change is
 * committed, at which point the new manifest becomes the next baseline.
 * The committed history of versions.json IS the version ledger; never
 * hand-edit the file and never reset a number.
 *
 * Entities and what "directly changed" means for each:
 *  - email-template            the template markup EN STORES: the compiled
 *                              head (minus the sheets head-css covers) and
 *                              the body wrapper outside the blocks, comments
 *                              and whitespace normalised — see
 *                              templateMarkupContent. Adding, removing or
 *                              reordering a block, the en-tools-config
 *                              comment, head prose and mj-attributes defaults
 *                              move it only if that markup changes. Hashed
 *                              from dist, so re-resolved post-compile with
 *                              head-css. (Until 2026-09-29 it hashed the
 *                              main.mjml SOURCE shell, which bumped on all
 *                              of the above.)
 *  - catalog-shell             mjml_extra-blocks.mjml shell, same treatment
 *                              (mj-attributes defaults, category dividers).
 *  - autoresponder:<file>     each thank-you file, whole.
 *  - partial:<file>           each src/partials/*.mjml, whole.
 *  - block:<name>             the block's marker regions concatenated
 *                              across mjml_all + tpl_unified (a divergent
 *                              copy in either catalog bumps the one entity).
 *  - head-css                 the COMPILED head <style> contents of
 *                              dist/main_local-debug.html, EXCEPT the
 *                              data-en-tools-band chrome, which stays in the
 *                              template — the exact
 *                              CSS the importer bakes into the Template
 *                              Styles block, whose EN name carries this
 *                              version ("Utility — Template Styles vN").
 *                              Compiled, not source: mjml generates
 *                              structural head CSS (column ladders) that
 *                              source hashing would miss. Because dist is
 *                              stale when the main pass runs (pre-compile),
 *                              the build re-syncs this ONE entity after
 *                              emit-variants via `--head-css`. Read from
 *                              _local-debug, the compiler's own output:
 *                              _live strips the sheets' comments and
 *                              indentation for the paste (emit-variants),
 *                              and hashing that would bump this entity on
 *                              a byte change the importer's compactCss
 *                              erases anyway (2026-09-27; the two files'
 *                              sheets were byte-identical before then, so
 *                              the switch itself moved no hash).
 *
 * A renamed block starts over at version 1 under its new name; git history
 * carries the lineage. Entities that no longer exist are dropped from the
 * manifest (history preserves their final version).
 */
import { createHash } from 'node:crypto';
import { sourcePages, CATALOG } from './lib/source-pages.mjs';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : '');
const sha = (s) => createHash('sha256').update(s).digest('hex').slice(0, 12);

/**
 * Separates a block's regions inside its hash. It was FROZEN at the
 * pre-rename filename through 2026-08-21 to spare ~62 blocks a version bump
 * for a rename that changed no content — the version rides in the EN block
 * name, so a mass bump means re-uploading everything. Unfrozen once the user
 * confirmed the imports are still being finalised and a one-time bump costs
 * nothing. With a single catalog it carries no information; it survives only
 * so the hash keeps a stable shape if a second catalog ever returns.
 */
const BLOCK_REGION_SEP = '@@block@@';

/**
 * START/END markers NEST (a "Main Content" region wraps a whole catalog),
 * so blocks are the LEAF pairs — regions containing no other marker pair.
 * Container pairs stay part of the shell.
 */
function leafRegions(text) {
  const tokens = [...text.matchAll(/<!-- (START|END): (.+?) -->/g)];
  const stack = [];
  const leaves = [];
  for (const t of tokens) {
    if (t[1] === 'START') {
      stack.push({ name: t[2], start: t.index, hasChild: false });
    } else {
      const top = stack.pop();
      if (!top || top.name !== t[2]) continue; // unbalanced — leave to check-docs
      if (!top.hasChild) leaves.push({ name: top.name, start: top.start, end: t.index + t[0].length });
      if (stack.length) stack[stack.length - 1].hasChild = true;
    }
  }
  return leaves;
}

/** The file with each leaf block region replaced by a stable name sentinel. */
function shellOf(text) {
  const leaves = leafRegions(text);
  let out = '';
  let pos = 0;
  for (const l of leaves) {
    out += text.slice(pos, l.start) + `<!-- BLOCK: ${l.name} -->`;
    pos = l.end;
  }
  return out + text.slice(pos);
}

/**
 * Markup with render-inert prose removed: every comment except a conditional
 * one (`[if …]` / `<![endif]`) and the en-tools-keep stamp, and every
 * whitespace run. It is what the importer leaves when it stores HTML
 * (compactEmailHtml drops prose comments), so a comment or reindent edit
 * moves no version. Shared by the template and the block hashes.
 */
const keepComment = (c) => /^<!--\s*\[if\b|<!\[endif\]|^<!--\s*en-tools-keep\b/i.test(c);
function withoutProse(markup) {
  return markup
    .replace(/<!--[\s\S]*?-->/g, (c) => (keepComment(c) ? c : ''))
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

/** CSS with comments and whitespace runs removed, as the importer's compactCss leaves it. */
function withoutCssProse(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Old-rule hashes, filled as entities are computed (2026-09-29). Blocks
 * hashed their raw source region and head-css the raw compiled sheets, so a
 * prose-comment edit bumped an EN block name for markup EN never stores.
 * resolveEntry uses these to adopt the new comment-free hash at the SAME
 * version when the committed hash still equals the old-rule one: the
 * definition change itself bumps nothing (the legacyTemplateHash precedent).
 */
const LEGACY = {};

/** Compiled head <style> contents of the unified master, as the compiler wrote them */
export function headCssContent() {
  // Scripts out first: _local-debug carries the raw MJML as a JSON payload
  // whose `<style …>` text (its `</` escaped) must never pair with a real
  // closing tag further down — exactly what stripDebugger removes for _live.
  const html = read(`dist/${CATALOG.replace('.mjml', '')}_local-debug.html`).replace(
    /<script\b[\s\S]*?<\/script>/gi,
    '',
  );
  return (
    [...html.matchAll(/<style([^>]*)>([\s\S]*?)<\/style>/gi)]
      // The builder band is CHROME: data-en-tools-band marks it exempt from
      // extraction, so it stays in the TEMPLATE and never enters the Template
      // Styles block this version labels. Hashing it here made a band edit
      // bump "CSS Styles Block vN" for CSS that block does not carry — the
      // mirror of the styles.css double-count fixed in computeEntities.
      .filter((m) => !/\bdata-en-tools-band\b/i.test(m[1]))
      .map((m) => m[2])
      .join('\n')
  );
}

/**
 * The template EN STORES, as the importer carves it out of the compiled
 * master: the head, and the body wrapper before the first block and after
 * the last one (store.ts: beforeBlocks + afterBlocks around segmentEmail's
 * block span). Everything the importer drops before storing is dropped here
 * too, so only a change to that markup moves the version (user rule
 * 2026-09-29: "the template's version should not change unless the markup
 * of the template itself changes"):
 *   - every block region: adding, removing or reordering a block is not a
 *     template change (the old source-shell hash bumped on each);
 *   - the head <style> sheets except the data-en-tools-band chrome: they
 *     ship in the Template Styles block under head-css;
 *   - comments other than conditional ones and the en-tools-keep stamp: the
 *     importer strips the en-tools-config comment and head authoring prose,
 *     and prose comments are render-inert anywhere;
 *   - whitespace runs, so reindenting the source moves nothing.
 * mj-attributes / mj-class defaults therefore bump nothing unless they
 * change this markup; the blocks they re-render keep their versions, since
 * no block's markup changed either (user decision, same day).
 * Read from _local-debug (the compiler's own output), scripts removed.
 */
export function templateMarkupContent() {
  const html = read(`dist/${CATALOG.replace('.mjml', '')}_local-debug.html`).replace(
    /<script\b[\s\S]*?<\/script>/gi,
    '',
  );
  const bodyAt = html.search(/<body\b/i);
  if (bodyAt < 0) return '';
  const head = html.slice(0, bodyAt);
  const body = html.slice(bodyAt);
  const starts = [...body.matchAll(/<!--\s*START:[\s\S]*?-->/g)];
  const ends = [...body.matchAll(/<!--\s*END:[\s\S]*?-->/g)];
  const before = starts.length ? body.slice(0, starts[0].index) : body;
  const lastEnd = ends[ends.length - 1];
  const after = lastEnd ? body.slice(lastEnd.index + lastEnd[0].length) : '';
  return withoutProse(
    head.replace(/<style([^>]*)>[\s\S]*?<\/style>/gi, (m, attrs) =>
      /\bdata-en-tools-band\b/i.test(attrs) ? m : '',
    ) + before + after,
  );
}

/**
 * The retired definition (the main.mjml SOURCE shell), kept only to re-anchor
 * the ledger when the definition changed: a committed hash that still equals
 * it means nothing changed under the old rule, so the entity adopts the new
 * hash at the SAME version instead of bumping for a definition change.
 */
export function legacyTemplateHash() {
  return sha(shellOf(read(`src/${CATALOG}`)));
}

/** Next manifest entry for one entity against its committed baseline. */
function resolveEntry(key, hash, prev) {
  if (!prev) return { version: 1, hash, date: today() };
  if (prev.hash === hash) return prev;
  if (key === 'email-template' && prev.hash === legacyTemplateHash()) return { ...prev, hash };
  if (LEGACY[key] !== undefined && prev.hash === LEGACY[key]) return { ...prev, hash };
  return { version: prev.version + 1, hash, date: today() };
}

/** Entities hashed from dist/, re-resolved by the post-compile pass. */
const POST_COMPILE = {
  'head-css': () => {
    const raw = headCssContent();
    LEGACY['head-css'] = sha(raw);
    return sha(withoutCssProse(raw));
  },
  'email-template': () => sha(templateMarkupContent()),
};

export function computeEntities() {
  const entities = {};
  const unified = read(`src/${CATALOG}`);

  // The stored template's markup (templateMarkupContent). Hashed from dist,
  // which is stale here, so the post-compile pass re-resolves it with
  // head-css. styles.css was once concatenated in (2026-08-21 lockstep bug);
  // the source shell replaced that and was itself replaced 2026-09-29.
  entities['email-template'] = POST_COMPILE['email-template']();
  // 'catalog-shell' was the second catalog's shell. mjml_extra-blocks.mjml
  // was deleted on 2026-08-21 once its keepers had moved into the master, so
  // the entity is deliberately GONE rather than left to pin forever to the
  // hash of an empty string. syncedManifest rebuilds from computed entities,
  // so it drops out of versions.json on the next run with no hand-editing.
  entities['head-css'] = POST_COMPILE['head-css']();

  for (const pg of sourcePages(ROOT).filter((x) => x.dir === 'autoresponders')) {
    entities[`autoresponder:${pg.base}`] = sha(read(`src/${pg.rel}`));
  }
  const partialsDir = join(ROOT, 'src/partials');
  if (existsSync(partialsDir)) {
    for (const f of readdirSync(partialsDir).filter((n) => n.endsWith('.mjml')).sort()) {
      entities[`partial:${f.replace('.mjml', '')}`] = sha(read(`src/partials/${f}`));
    }
  }

  const blocks = new Map();
  for (const l of leafRegions(unified)) {
    blocks.set(l.name, (blocks.get(l.name) ?? '') + `\n${BLOCK_REGION_SEP}\n` + unified.slice(l.start, l.end));
  }
  for (const [name, content] of blocks) {
    LEGACY[`block:${name}`] = sha(content);
    entities[`block:${name}`] = sha(withoutProse(content));
  }
  return entities;
}

export function baseline() {
  try {
    return JSON.parse(execSync('git show HEAD:versions.json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    return {};
  }
}

/**
 * Each bump stamps the entity with the day it happened (`date`, YYYY-MM-DD)
 * — "when did this last change", carried alongside the version. A steady
 * entity keeps its committed date untouched; entities versioned before
 * dates existed gain one on their next real bump. The importer fills the
 * template head's __TEMPLATE_DATE__ placeholder from email-template's date
 * the same way it fills v__TEMPLATE_VERSION__.
 */
const today = () => new Date().toISOString().slice(0, 10);

export function syncedManifest() {
  const base = baseline();
  const entities = computeEntities();
  const manifest = {};
  const bumped = [];
  for (const key of Object.keys(entities).sort()) {
    const prev = base[key];
    manifest[key] = resolveEntry(key, entities[key], prev);
    if (!prev) {
      if (Object.keys(base).length) bumped.push(`${key} -> v1 (new)`);
    } else if (manifest[key].version !== prev.version) {
      bumped.push(`${key} -> v${manifest[key].version}`);
    }
  }
  return { manifest, bumped };
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--head-css')) {
  // Post-compile pass: dist is now FRESH — re-resolve the entities hashed
  // from it (head-css, email-template) against the committed baseline and
  // rewrite the manifest in place. The flag keeps its original name.
  const base = baseline();
  const manifest = JSON.parse(read('versions.json') || '{}');
  const notes = [];
  for (const [key, hashOf] of Object.entries(POST_COMPILE)) {
    const next = resolveEntry(key, hashOf(), base[key]);
    const changed = JSON.stringify(manifest[key]) !== JSON.stringify(next);
    manifest[key] = next;
    const moved = base[key] && next.version !== base[key].version;
    notes.push(`${key} ${moved || !base[key] ? '->' : 'steady at'} v${next.version}${changed ? ` (${next.hash})` : ''}`);
  }
  const sorted = {};
  for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k];
  writeFileSync(join(ROOT, 'versions.json'), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`version-sync --head-css: ${notes.join(', ')}`);
  process.exit(0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { manifest, bumped } = syncedManifest();
  const out = JSON.stringify(manifest, null, 2) + '\n';
  const current = read('versions.json');
  if (current !== out) writeFileSync(join(ROOT, 'versions.json'), out);
  console.log(
    bumped.length
      ? `version-sync: ${bumped.length} bump(s) vs HEAD — ${bumped.join(', ')}`
      : `version-sync: ${Object.keys(manifest).length} entities, all at their committed versions`,
  );
}
