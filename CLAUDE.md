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
still resolve, the demo/example delta is exactly the documented subset, no
top-level `[data-ogsc]`, every dark-mode declaration carries `!important`, no
absolute CDN URL in source, every `§N` cross-reference resolves, and the
mirrors still carry their header. Run it alone with `npm run check-docs`.
`scripts/check-catalog.mjs` is its sibling for the blocks: both-attribute
backgrounds, unhooked dark-mode grounds, and fixed-width columns overflowing
their frame (that one needs a built `dist/`). Run it with
`npm run check-catalog`. Both are WARN-only; the build must print zero.
**Prefer a check over a sentence** — a count written in prose rots; a command
that produces the count cannot.

## Catalogs

| File | Role |
| :--- | :--- |
| `src/tpl_unified-blocks.mjml` | master template (formerly main.mjml) — **the primary catalog** |
| `src/mjml_extra-blocks.mjml` | blocks that exist in NO other catalog, with `Category — X` dividers |
| `src/donation-thank-you.mjml`, `src/recurring-donation-thank-you.mjml` | standalone autoresponders |

**`mjml_all-blocks.mjml` became `mjml_extra-blocks.mjml` on 2026-08-20**
(user decision). It had become a near-superset of the master template: of its
124 leaf blocks, 72 were byte-duplicates of blocks in
`tpl_unified-blocks.mjml`, so every catalog edit had to be made twice — the
same sync tax that retired `tpl_all-blocks.mjml`. The file now holds ONLY what
lives nowhere else: **22 blocks**, plus the six `Category — X` dividers whose
folders still have content. The 30 `data-fully-exclude` colour/alignment demos
that were unique to it were dropped in the same pass (they never exported; git
history has them).

Read it as the leftovers, not a catalog: anything wanted for real work belongs
in the master template. Both files are equal citizens to the tooling —
version-sync hashes a block name across BOTH, and check-docs resolves doc
citations against BOTH.

**`tpl_all-blocks.mjml` was removed on 2026-08-17** (commit 17f036a, following the 2026-08-15 catalog audit). It was a strict subset of
`mjml_all-blocks.mjml` — 135 of its 143 blocks, differing by exactly one line
(the `mj-title`) — created to give a shorter demonstration page. It carried
nothing unique, was never once edited independently in its lifetime, and
required a matching edit on 14 of the 15 catalog commits in its last 90 days.
That sync tax was its whole cost and its whole risk. If a shorter showcase is
wanted again, derive it at build time from the full catalog rather than
maintaining a second copy: `scripts/annotate-excluded.mjs` already reads
`src/*.mjml` and writes transformed copies to `.build/`, which is the hook.

**The standalone `Caption` block was removed on 2026-08-18** (user
decision): every image block already carries its caption inline (the
`mj-class="caption"` text under the photo), so a detached caption
section had no remaining use and one more block to scroll past. The
`caption` mj-class, the mobile 16px caption indent, and all inline
captions are untouched. Recover the markup from git history or from any
image block's trailing caption section (`css-class="block caption"`,
`padding="8px 0 0"`) if a detached caption is ever wanted again; the
already-uploaded EN block must be deleted in EN by hand.

**Twenty colour/alignment variants were removed from
`mjml_all-blocks.mjml` on 2026-08-20** (user decision), along with the
`Signature Card (square photo)`/`(round photo)` pair. All twenty were
`data-fully-exclude` demo blocks — four `Logo Hero`s, six `Heading`s,
three `Two-Line Banner`s, four `CTA Button`/`CTA Buttons 2x1`s and three
`Footer`s — differing from a surviving family baseline only by background
colour or alignment. Both are now editable Selects, so the variants
demonstrated states an editor can already produce, and each cost a sync
on every catalog edit. 122 leaf blocks remain (was 143); the catalog is
17 KB lighter.

The signature pair was replaced by unified's single
`Signature Card (photo)`, whose `data-image-shape-toggle` makes the photo
shape a Circle/Square Select — one block and a control instead of two
fixed blocks. It retires the pre-rounded `_round.png` asset FROM THE
CATALOG only: both autoresponders still reference that file.

**Deliberately KEPT**, though also `data-fully-exclude`: anything whose
family would otherwise vanish (`Text w/ Bullet Lists`,
`Text + Link Paragraph CTA`, `Linked List Block`, `Join Links Block`,
`Header Row`), anything a scanned doc cites, and every STRUCTURAL variant
— `(outline)`, `(text only)`, `(w/ dark-mode swap)`, `(inset)`,
`(dynamic width)`, `(arrow graphic)`, `(two-line, mixed weight)`. Those
demonstrate layouts a Select cannot reproduce. Recover any of them from
git history.

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
- **Probe lifecycle.** `src/probe_*.mjml` files are temporary instruments
  (check-catalog already skips the `probe_` prefix; nothing else in the
  pipeline names them). When every claim a probe was built to test is
  measured and recorded, archive it in the SAME session that records the
  last verdict: `git mv` the source into `archive/probes/`, `git rm` its
  three dist artifacts (the raw `.mjml` copy plus the `_live.html` and
  `_local-debug.html` variants — the build never cleans dist, so they
  linger otherwise), and add a row to `archive/probes/README.md`. A probe
  still
  carrying any unverified claim stays in `src/`. `archive/` is invisible
  to the build (annotate-excluded reads `src/` non-recursively). Archive,
  never delete — annotated probes are the instruments for re-measuring EN
  later.
- **Probe colors.** Probe instruments (canary bars, test swatches) use
  colors the template already carries — the brand palette or the extended
  background-Select entries (Crimson, Royal Blue, Purple, Sage, …) —
  never a newly invented hex (user decision 2026-08-18: canary bar text
  is Earth `#362229`, not an ad-hoc `#111111`). Signal semantics pick the
  nearest existing color, not a new one.
