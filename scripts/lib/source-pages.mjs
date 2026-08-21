/**
 * Where the source pages live — the single owner of that answer.
 *
 * `src/` was flat until 2026-08-21, when the catalog became `main.mjml`, the
 * autoresponders moved into `src/autoresponders/`, and probes got their own
 * `src/probes/` (user decision). Four scripts had each enumerated `src/`
 * independently; a layout with subfolders is exactly the change that would
 * have made three of them agree and the fourth quietly skip a page, so the
 * enumeration lives here now.
 *
 * PAGE_DIRS is ordered: '' first, so the catalog leads every listing.
 * A directory that does not exist is skipped — `src/probes/` is expected to
 * be absent whenever no probe is in flight (a probe is archived the session
 * its last claim is measured, and the folder goes with it).
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Directories under src/ that hold compilable PAGES, in listing order. */
export const PAGE_DIRS = ['', 'autoresponders', 'probes'];

/** Directories under src/ that hold includes, never compiled on their own. */
export const PARTIAL_DIRS = ['partials'];

/**
 * Every source page, as `{ dir, file, rel }` — `rel` is the src-relative path
 * ('main.mjml', 'autoresponders/donation-thank-you.mjml'). `base` is the
 * filename without .mjml, which is what dist/ and versions.json key on:
 * pages compile FLAT into dist regardless of which subfolder they came from.
 */
export function sourcePages(root) {
  const out = [];
  for (const dir of PAGE_DIRS) {
    const abs = join(root, 'src', dir);
    if (!existsSync(abs)) continue;
    for (const file of readdirSync(abs).filter((n) => n.endsWith('.mjml')).sort()) {
      out.push({ dir, file, rel: dir ? `${dir}/${file}` : file, base: file.replace(/\.mjml$/, '') });
    }
  }
  return out;
}

/** The catalog page every other page is measured against. */
export const CATALOG = 'main.mjml';
