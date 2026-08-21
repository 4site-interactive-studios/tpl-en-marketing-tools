# Repo instructions — TPL EN Marketing Tools

Facts specific to THIS repo. The two governing documents are mirrors of a
private repo and cannot be corrected here, so anything TPL-specific that
contradicts or extends them lives in this file.

| Doc | Owns | Editable here |
| :-- | :-- | :-- |
| `MJML-AUTHORING-GUIDE.md` | **portable** rules: EN's measured CSS-inliner behavior, bottom-only pacing, the spacing scale, the `data-*` contract, the §8 QA checklist | **No — mirror** |
| `CONVENTIONS.md` | the importer's contract: how every editable field is generated, named, ordered, suppressed | **No — mirror** |
| `PLAYBOOK.md` | **repo-specific** detail: build pipeline, block system + naming grammar (§4), debug overlay, converter metadata as applied here | Yes |
| `CLAUDE.md` | catalog roles, asset root, and **anything the mirrors get wrong for this repo** | Yes |

**One rule, one owner.** If a rule is portable, the guide owns it and
PLAYBOOK points at it — see PLAYBOOK §7a for the model ("guide §2 is
canonical for the measured behavior"). Restating a portable rule locally is
how it drifts; four of the defects found on 2026-08-07 were exactly that.

**Correcting a mirror.** Both carry a `DO NOT EDIT HERE` header — they are
re-mirrored from `docs/` in the private `email-to-en-marketing-tools` repo
and edits here are overwritten on the next mirror. When one is wrong:

1. Record the correct rule in this file so work can continue.
2. Hand the user relay text naming the file, the line, and the replacement.
3. Do not edit the mirror, and do not silently work around it.

**Automated drift checking.** `scripts/check-docs.mjs` runs with every build
and asserts the things that actually rotted before: block names cited in docs
still resolve, no top-level `[data-ogsc]`, every dark-mode declaration carries `!important`, no
absolute CDN URL in source, every `§N` cross-reference resolves, and the
mirrors still carry their header. Run it alone with `npm run check-docs`.
`scripts/check-catalog.mjs` is its sibling for the blocks: both-attribute
backgrounds, unhooked dark-mode grounds, and fixed-width columns overflowing
their frame (that one needs a built `dist/`). Run it with
`npm run check-catalog`. Both are WARN-only; the build must print zero.
**Prefer a check over a sentence** — a count written in prose rots; a command
that produces the count cannot.

## Source layout

| Path | Role |
| :--- | :--- |
| `src/main.mjml` | the master template — the ONLY catalog |
| `src/autoresponders/*.mjml` | standalone autoresponders |
| `src/probes/*.mjml` | live QA instruments, when any exist (see Probe lifecycle) |
| `src/partials/*.mjml` | includes; never compiled on their own |

`scripts/lib/source-pages.mjs` is the single owner of that list. Four scripts
used to enumerate `src/` independently, which is exactly the shape that
survives a flat directory and breaks the moment one grows — enumerate through
the helper, never with a bare `readdirSync('src')`.

**Pages compile FLAT into `dist/`** whatever subfolder they came from:
`mjml ./.build/*.mjml` reads one level, and every downstream consumer keys on
the bare filename. `annotate-excluded.mjs` rewrites a subfolder page's
`../partials/…` includes to `./partials/…` on the way into `.build/` so they
still resolve; author them relative to the file's real location.

**`src/probes/` exists only while a probe does.** When the last probe is
archived the directory goes with it, and a new probe re-creates it. The
helper skips a missing directory, so nothing else needs to know.

**The layout changed on 2026-08-21** (user decision): `tpl_unified-blocks.mjml`
became `main.mjml` — the name it carried before the 2026-08-17 consolidation —
and `mjml_extra-blocks.mjml` was DELETED once the blocks worth keeping had
moved into the master. Recover any of its 16 leftovers from git history.

Two ledger consequences, both handled in `version-sync.mjs` rather than by
hand-editing `versions.json`:

- The `catalog-shell` entity was the second catalog's shell. It is deliberately
  gone, not left to pin forever to the hash of an empty string.
- The block-region separator is FROZEN at the old filename. It only ever
  existed to keep a block's regions distinguishable while a name could live in
  two catalogs; changing those bytes would re-hash all 62 blocks and bump every
  EN block name for a rename that changed no block's content. The six
  `Category — …` dividers DID bump, correctly: they existed in both catalogs,
  so their entity genuinely lost half its content.

## Two HTML outputs per page

Every `src/*.mjml` compiles to **two** files in `dist/`:

| Output | Asset URLs | Debugger | Use |
| :--- | :--- | :--- | :--- |
| `<name>_local-debug.html` | relative (`assets/x.png`) | **kept** | working copy; what the preview server serves |
| `<name>_live.html` | absolute | **stripped** | paste-in ready for an EN send / autoresponder |

**Neither is what the importer reads.** It consumes `src/<name>.mjml` (the
build copies the raw sources into `dist/` alongside the HTML) and explicitly
*rejects* compiled HTML with a plain-English error — see CONVENTIONS.md.
The `_live.html` rewrite therefore duplicates the importer's own
`rewriteAssetPaths` on purpose: that one feeds block/template JSON from the
MJML, this one feeds a paste-in HTML send. Both assume EN's flat CDN folder.

`scripts/emit-variants.mjs` names both as the last build step: it renames the
compiler's own output to `_local-debug.html` and writes `_live.html` beside it. It rewrites all four carriers MJML emits for one background image
(guide §4) plus `<img src>`, and removes every `<script>` and the 🐞 toolbar.

**TPL's EN asset root** (flat folder — filenames must be unique repo-wide):

```
https://bd6ca9cefa6fb6e0adf1-c2f9aa1adb9f60a775f60074e4c86031.ssl.cf5.rackcdn.com/20002/
```

Override for another environment with `TPL_ASSET_ROOT=… npm run build`.

**Source MJML always keeps relative paths** (guide §7 — absolute URLs in
source defeat environment portability). The regression test is the whole
CDN domain, which must return nothing:

```bash
grep rackcdn.com src/*.mjml
```

Every asset is repo-local under `src/assets/`. The one historical
exception — footer social icons hard-coded to the legacy `/2184`
container — was retired 2026-08-09 by copying the four icons into
`src/assets/`: importer rewriting and the missing-at-root audit skip
absolute URLs, so an off-root asset breaks silently if its container is
ever retired. A future genuinely-external asset (guide §7) needs a note
here plus an allowlist entry in `scripts/check-docs.mjs` assertion 5.

## Working rules

- Never commit or push unless asked. "Commit" means commit **and** push to
  `origin/main`.
- **Git discipline** (parallel AI sessions push here many times a day):
  fetch + fast-forward before starting work; never run `git checkout`
  variants inside compound/scripted commands (a stray `git checkout
  HEAD~0` once detached HEAD — the commit landed off-branch and `git push
  origin main` exited 0 as a no-op); before committing, `git status -sb`
  must show `## main...`, not `## HEAD (no branch)`; after every push,
  verify `git ls-remote origin main` equals `git rev-parse HEAD`.
- Run `npm run build` after any source change; it must print zero `WARN`
  lines. Then run the guide's §8 QA checklist and report what each check
  returned.
- **Versioning.** `versions.json` gives every artifact an integer version
  (the email template's shell+stylesheet, each block, each autoresponder
  and partial), anchored to content hashes. The build's `version-sync`
  first step bumps any entity whose content differs from its LAST COMMIT;
  check-docs warns when the manifest is stale. Never hand-edit or reset
  it — the committed history is the ledger. Full contract:
  CONVENTIONS.md "Versioning".
- **Probe lifecycle.** `src/probes/*.mjml` files are temporary instruments
  (check-catalog already skips the `src/probes/` directory; nothing else in the
  pipeline names them). When every claim a probe was built to test is
  measured and recorded, archive it in the SAME session that records the
  last verdict: `git mv` the source into `archive/probes/`, `git rm` its
  three dist artifacts (the raw `.mjml` copy plus the `_live.html` and
  `_local-debug.html` variants — the build never cleans dist, so they
  linger otherwise), and add a row to `archive/probes/README.md`. A probe
  still carrying any unverified claim stays in `src/probes/`. When the LAST
  probe leaves, delete the now-empty `src/probes/` too; a new probe
  re-creates it, and `source-pages.mjs` skips a directory that is not there.
  `archive/` is invisible to the build (the source enumerator only walks the
  directories it names). Archive, never delete — annotated probes are the
  instruments for re-measuring EN later.
- **Probe colors.** Probe instruments (canary bars, test swatches) use
  colors the template already carries — the brand palette or the extended
  background-Select entries (Crimson, Royal Blue, Purple, Sage, …) —
  never a newly invented hex (user decision 2026-08-18: canary bar text
  is Earth `#362229`, not an ad-hoc `#111111`). Signal semantics pick the
  nearest existing color, not a new one.
