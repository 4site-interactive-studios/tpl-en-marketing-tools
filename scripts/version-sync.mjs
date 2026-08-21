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
 *  - email-template            tpl_unified-blocks.mjml SHELL (every
 *                              <!-- START/END --> block region replaced by
 *                              a name sentinel) + styles.css. Block edits
 *                              inside the file bump the BLOCK, not this.
 *  - catalog-shell             mjml_extra-blocks.mjml shell, same treatment
 *                              (mj-attributes defaults, category dividers).
 *  - autoresponder:<file>     each thank-you file, whole.
 *  - partial:<file>           each src/partials/*.mjml, whole.
 *  - block:<name>             the block's marker regions concatenated
 *                              across mjml_all + tpl_unified (a divergent
 *                              copy in either catalog bumps the one entity).
 *  - head-css                 the COMPILED head <style> contents of
 *                              dist/tpl_unified-blocks_live.html — the exact
 *                              CSS the importer bakes into the Template
 *                              Styles block, whose EN name carries this
 *                              version ("Utility — Template Styles vN").
 *                              Compiled, not source: mjml generates
 *                              structural head CSS (column ladders) that
 *                              source hashing would miss. Because dist is
 *                              stale when the main pass runs (pre-compile),
 *                              the build re-syncs this ONE entity after
 *                              emit-variants via `--head-css`.
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
 * The block-region separator is FROZEN at the pre-rename filename on purpose.
 * It existed only to keep a block's regions distinguishable while the same
 * name could live in two catalogs. With one catalog it carries no
 * information — but changing these bytes would re-hash all 62 blocks and bump
 * every EN block name for a rename that altered no block's content, and the
 * version rides in the EN block name. Ledger continuity beats tidiness.
 */
const BLOCK_REGION_SEP = '@@tpl_unified-blocks.mjml@@';

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

/** Compiled head <style> contents of the unified master's live artifact */
export function headCssContent() {
  const html = read(`dist/${CATALOG.replace('.mjml', '')}_live.html`);
  return [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((m) => m[1])
    .join('\n');
}

export function computeEntities() {
  const entities = {};
  const unified = read(`src/${CATALOG}`);

  entities['email-template'] = sha(shellOf(unified) + '\n@@styles@@\n' + read('src/styles.css'));
  // 'catalog-shell' was the second catalog's shell. mjml_extra-blocks.mjml
  // was deleted on 2026-08-21 once its keepers had moved into the master, so
  // the entity is deliberately GONE rather than left to pin forever to the
  // hash of an empty string. syncedManifest rebuilds from computed entities,
  // so it drops out of versions.json on the next run with no hand-editing.
  entities['head-css'] = sha(headCssContent());

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
  for (const [name, content] of blocks) entities[`block:${name}`] = sha(content);
  return entities;
}

export function baseline() {
  try {
    return JSON.parse(execSync('git show HEAD:versions.json', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch {
    return {};
  }
}

export function syncedManifest() {
  const base = baseline();
  const entities = computeEntities();
  const manifest = {};
  const bumped = [];
  for (const key of Object.keys(entities).sort()) {
    const hash = entities[key];
    const prev = base[key];
    if (!prev) {
      manifest[key] = { version: 1, hash };
      if (Object.keys(base).length) bumped.push(`${key} -> v1 (new)`);
    } else if (prev.hash === hash) {
      manifest[key] = prev;
    } else {
      manifest[key] = { version: prev.version + 1, hash };
      bumped.push(`${key} -> v${prev.version + 1}`);
    }
  }
  return { manifest, bumped };
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.argv.includes('--head-css')) {
  // Post-compile pass: dist is now FRESH — re-sync only the head-css entity
  // against the committed baseline and rewrite the manifest in place.
  const base = baseline();
  const hash = sha(headCssContent());
  const manifest = JSON.parse(read('versions.json') || '{}');
  const prev = base['head-css'];
  const next = !prev
    ? { version: 1, hash }
    : prev.hash === hash
      ? prev
      : { version: prev.version + 1, hash };
  const changed = JSON.stringify(manifest['head-css']) !== JSON.stringify(next);
  manifest['head-css'] = next;
  const sorted = {};
  for (const k of Object.keys(manifest).sort()) sorted[k] = manifest[k];
  writeFileSync(join(ROOT, 'versions.json'), JSON.stringify(sorted, null, 2) + '\n');
  console.log(
    changed
      ? `version-sync --head-css: head-css -> v${next.version} (${next.hash})`
      : `version-sync --head-css: head-css steady at v${next.version}`,
  );
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
