# MJML Project Playbook

Every customization this project layers on top of stock MJML, written so the
whole setup can be reproduced in another MJML project. Sections are ordered the
way you'd set up a new repo. The "Porting checklist" at the bottom is the
short version.

---

## 1. Project layout

```
src/
  main.mjml  ← master template — the primary catalog
  main.mjml   ← blocks that live nowhere else (see CLAUDE.md)
  donation-thank-you.mjml
  recurring-donation-thank-you.mjml    ← standalone autoresponders
  styles.css           ← shared CSS, pulled in via mj-include
  partials/            ← reusable mj-include fragments
    debug-toolbar.mjml
    tri-color-divider.mjml
    green-rule-divider.mjml
  assets/              ← images + debug.js (synced to dist at build)
scripts/               ← build passes (§2)
  annotate-excluded.mjs  restore-excluded.mjs
  emit-variants.mjs      watch.mjs
dist/                  ← build output; this is what gets served/previewed
  <name>_local-debug.html ← relative assets + debugger (working copy)
  <name>_live.html        ← absolute assets, no debugger (send-ready, §2)
  assets/originals/    ← full-res originals, NOT synced/overwritten by builds
CLAUDE.md              ← repo-specific instructions agents load first
MJML-AUTHORING-GUIDE.md  ← MIRROR, do not edit — authoring rules + QA checklist
CONVENTIONS.md         ← MIRROR, do not edit — the importer's contract
.claude/launch.json    ← preview server definition (http-server on dist/)
```

Multiple pages are free: the build globs `src/*.mjml`, so adding
`src/anything.mjml` yields `dist/anything_local-debug.html` **and**
`dist/anything_live.html` with no config change — see §2 for the difference
between the two, and CLAUDE.md for the catalogs' roles.

## 2. Build pipeline (`package.json`)

```json
"build": "node scripts/annotate-excluded.mjs && mjml ./.build/*.mjml -o ./dist/ --config.allowIncludes=true --config.validationLevel=skip && node scripts/restore-excluded.mjs && rsync -a --delete --exclude='originals/' ./src/assets/ ./dist/assets/ && cp ./src/*.mjml ./dist/ && node scripts/emit-variants.mjs && node scripts/check-docs.mjs",
"watch": "node scripts/watch.mjs",
"preview": "npx --yes http-server ./dist -p 8642 -c-1"
```

Each step exists for a reason:

- `scripts/annotate-excluded.mjs` — **prebuild annotation pass.** Copies
  `src/*.mjml` (+ partials, styles.css) to a gitignored `.build/` dir, adding
  `css-class="… fully-excluded"` to every tag flagged `data-fully-exclude` and
  `class="import-excluded"` to the `data-import-exclude` wrapper divs. The
  mjml CLI compiles `.build/`, never `src/`, so the flags survive compilation
  as classes while the sources keep only the `data-*` attributes as the
  single source of truth. It also computes STRUCTURE GROUPS (blocks identical
  after masking every Replacement-managed property — the exclusion rules in
  §6d), injects two JSON `<script>` payloads into each page's `<head>` — the
  `{ blockName: anchorName }` manifest (`data-tpl-structure-groups`) and the
  raw source + includes (`data-tpl-raw-source`), which the debugger's export
  reads before falling back to fetching `dist/<name>.mjml` — and validates the
  data-fully-exclude flags against those groups on every build: group anchors
  must be unflagged, follow-on members must be flagged; mismatches print WARN
  lines in the build output.
- `scripts/restore-excluded.mjs` — **post-build restoration pass.** Converts
  the smuggled marker classes in `dist/*.html` back into real attributes:
  `fully-excluded` (and its `-outlook` twin) becomes
  `data-fully-exclude="true"` on the same element, and the redundant
  `import-excluded` class is dropped (its wrapper div already carries
  `data-import-exclude="true"`). Net effect of annotate → compile → restore:
  the compiled HTML carries the exact `data-*` attributes the source declares
  — which MJML would otherwise reject/strip — with no marker classes left in
  the shipped markup. Everything downstream addresses exclusions uniformly as
  `[data-fully-exclude]` / `[data-import-exclude]`.
- `scripts/watch.mjs` — watches `src/` and re-runs the full build on change
  (plain `mjml -w` can't see the annotation step).

- `--config.allowIncludes=true` — required for `mj-include` (partials + styles.css).
- `--config.validationLevel=skip` — **load-bearing.** The converter metadata
  (§6) puts non-standard `data-*` attributes directly on MJML tags. At default
  validation these produce warnings; `skip` silences them AND strips the
  unknown attributes from compiled HTML, so the emails ship clean. The
  attributes only need to exist in the *raw* `.mjml`, which the converter scans.
- `rsync -a --delete` instead of `cp -R` — `cp` never removes stale files from
  `dist/assets/`, which bit us after PNG→JPG swaps (old PNGs lingered and got
  referenced). `--exclude='originals/'` protects the originals archive in dist
  from `--delete`.
- `cp ./src/*.mjml ./dist/` — ships raw (un-annotated) sources next to the
  compiled HTML for the converter and as the debugger's fallback source of
  exclusion flags (§5).
- `scripts/emit-variants.mjs` — **names both variants.** It renames each
  compiled `dist/<name>.html` to `dist/<name>_local-debug.html` and writes
  `dist/<name>_live.html` beside it, with every relative
  asset path rewritten to an absolute URL under the EN asset root, and all
  dev chrome removed (every `<script>` — the debugger plus the two injected
  JSON payloads — and the 🐞 toolbar). The rewrite covers all four carriers
  MJML emits for one background image (§7) plus `<img src>`; missing any one
  renders the old photo in some clients and the new one in others. EN's CDN
  folders are flat, so `assets/sub/logo.png` collapses to `<root>logo.png`.
  The root is TPL's by default and overridable with `TPL_ASSET_ROOT=…`; see
  CLAUDE.md. Source MJML always keeps relative paths (guide §7) — the
  absolute form is a build artifact, never something you author.

- `scripts/check-docs.mjs` — **documentation lint.** Asserts the things that
  actually rotted before: every block name cited in a doc still resolves, the
  demo/example delta is exactly the documented subset, no top-level
  `[data-ogsc]`, every dark-mode declaration carries `!important`, no absolute
  asset root in source, every `§N` cross-reference resolves, and both mirrors
  still carry their DO-NOT-EDIT header. WARN-only, like the annotate pass —
  it never blocks a build. Run alone with `npm run check-docs`.

- `scripts/check-catalog.mjs` — **catalog lint**, the sibling of the above for
  the BLOCKS rather than the prose. A 2026-08-15 audit found the catalog's
  defects were not random but clustered into patterns that are all arithmetic
  or a grep, so each is now a build-time assertion: no tag carrying both
  `background-color` and `background-url` (Word paints the colour instead of
  the photo), every light container background inside a `.block` section has a
  dark-mode hook in BOTH branches, and no set of fixed-width columns exceeds
  its frame. The last one reads compiled `dist/*_live.html`, because the frame
  is only resolved there — it skips with a note if `dist/` is absent. Same
  WARN-only contract. Run alone with `npm run check-catalog`.

Preview: `.claude/launch.json` runs `npx http-server <repo>/dist -p 8642 -c-1`
(`-c-1` disables caching so rebuilds show immediately); `npm run preview` is
the same server from the CLI. Always preview from `dist/`, never from `src/`.

## 3. `mj-head` conventions

- `<!-- en-tools-config { … } -->` — **first thing in `mj-head`**, declaring
  the template's `spacingScale`, `widthPresets`, and `geometryReachPx`. It
  must be identical in every `src/*.mjml`. Full semantics in §6.0.
- `mj-breakpoint width="600px"` — single mobile breakpoint; email width is 600.
- `mj-title` — always present for local previews, but it never reaches the
  EN template: the importer STRIPS both compiled carriers (the head
  `<title>` and the `aria-label` MJML mirrors onto the body wrapper — the
  latter an accessibility hazard, since a screen reader would announce the
  whole email as one string repeating the title). The sender titles the
  email in EN itself.
- **NO `mj-preview` in broadcast sources** (tpl_unified-blocks,
  mjml_all-blocks): EN Marketing Tools injects its own
  hidden preheader `<p>` from each email's per-send **Preview Text**
  setting (measured 2026-08-10 on a blank-template send — it also prepends
  the text to the text/plain part), so a template-baked preheader would
  DOUBLE the inbox snippet. The importer's validator warns if one sneaks
  back in. The autoresponder sources (donation-thank-you, recurring) KEEP
  their `mj-preview` — they do not send through Marketing Tools broadcasts.
- `mj-attributes` sets the inherited baseline once: `mj-text` (Tahoma
  sans-serif stack, 18/24, `css-class="wysiwyg"`), `mj-button` (pill:
  `border-radius="100px"`, `inner-padding="12px 16px"`, letter-spacing, brand
  green background), `mj-image padding="0"`.
- Reusable variants live in `mj-class` (e.g. `caption`: 10/16 + top padding)
  and are applied with `mj-class="caption"` rather than repeating attributes.
- `mj-style` holds mobile-only overrides under `@media (max-width: 599px)`
  (caption gutter with `!important` to beat inline td padding; `.cta-item`
  stacking for side-by-side CTAs). Note `.inset-gutter` — which collapses
  desktop inset gutters to 32px on phones — lives in `styles.css`, not here.
- `mj-raw` in head injects the metas MJML has no tag for:

  ```html
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <meta name="format-detection" content="telephone=no" />
  ```

- `<mj-include path="./styles.css" type="css" />` pulls shared CSS: heading
  scale (h1 32/42 … with `mso-line-height-rule: exactly`), link color, the
  light/dark image-swap classes (§5), and a
  `div[data-container] { max-width:600px; margin:0 auto; }` shim for the email
  builder the HTML gets pasted into.

## 4. Block system: START/END comments + naming grammar

Every content block is wrapped in comments that **survive MJML compilation**:

```html
<!-- START: Logo Hero (w/ image) -->
<mj-section ...> ... </mj-section>
<!-- END: Logo Hero (w/ image) -->
```

These are the backbone of everything else — the debug overlay, duplicate
detection, and the raw-MJML↔compiled-HTML mapping all key off block names.
Names must match exactly (case-sensitive) between START and END.

### Naming grammar

    Family (qualifier, qualifier, w/ feature)

- **Family** — the structural identity (`Logo Hero`, `Quiz Block`,
  `CTA Buttons 2x1`). Stripping every parenthetical yields the *group key*:
  blocks sharing a key are variants of one family and group/stack together
  in the debugger.
- **Qualifiers** — comma-separated inside one parenthetical, lowercase
  (proper nouns exempt), ordered:
  1. surface/color: `(dark)`, `(off-white bordered)`, `(light green)`
  2. layout/alignment: `(centered)`, `(image left)`, `(full width)`
  3. features, prefixed `w/`: `(w/ badge image)`, `(w/ arrow heading)`,
     `(w/ dark-mode swap)`
- An **unqualified name** is the family baseline and may coexist with
  qualified variants (`Video Block` + `Video Block (inset)`).
- `NxN` denotes repetition and layout — columns × rows: `CTA Buttons 2x1`,
  `Images 3x1`, `Story Card 2x1`, and inside a parenthetical when it
  qualifies a variant: `Photo and Text Grid Block (2x2)`,
  `Quiz Block (3x1 buttons)`. It
  superseded the older `Dual`/`Triple` words, which no longer appear
  anywhere in the catalog — do not reintroduce them. The `x` pairing
  combinator (`Logo Header x CTA`) is likewise retired with no surviving
  instance; express combinations as qualifiers.
- Avoid baking qualifiers into the family name (`… Left Aligned` — wrong;
  `(left)` — right), and avoid "and"/"with" chains.

**Rules the tooling depends on:**

- **Identical full names are reserved for byte-identical repeats** — the
  "Hide duplicates" toggle keeps the first occurrence and hides the rest by
  exact name, so two different blocks must never share a name.
- Names are **case-sensitive** (`Signature card` ≠ `Signature Card`).
- Adjacent same-family blocks merge into one comparison run when grouped;
  non-adjacent instances are indexed (· 1/n).
- `(dev only — remove for production)` marks non-shipping chrome (the Debug
  Toolbar); such blocks are excluded from the overlay entirely.
- `Category — <Label>` blocks are catalog navigation chrome, not content.
  `&` is preferred in their labels (`Images & Media`); "and" is acceptable
  where it reads better (`Headers and Heroes`). Renaming a category churns
  its EN folder, so treat existing labels as fixed.
- An outer `<!-- START: Main Content -->` wrapper encloses the whole body
  (also skipped by the overlay).

`scripts/check-docs.mjs` asserts that every block name cited anywhere in the
docs still resolves to a block, family, or category in EITHER catalog —
`src/main.mjml` or `src/main.mjml`.

## 5. Debug overlay (`assets/debug.js` + `partials/debug-toolbar.mjml`)

A 🐞 floating button (fixed bottom-right, injected via `mj-raw` in the
debug-toolbar partial) lazy-loads `assets/debug.js` on first click. The script
is a self-contained IIFE exposing `window.__tplDebug` — no dependencies, works
on any page that has the START/END comments.

Panel options:

Options are grouped into four sections; BLOCKS (total parsed), STRUCTURE
(unique structures) and EXCLUDED (flagged blocks, both kinds) headers carry
live counts:

| Section | Option | What it does |
|---|---|---|
| BLOCKS | Outline blocks | Draws a colored outline + name chip per block |
| BLOCKS | Show block labels | Toggles the name chips (nested under Outline blocks; on by default) |
| STRUCTURE | Group by structure | Groups by structure-group manifest: one color + the anchor block's name per structure; adjacent same-group blocks merge into runs (name-family fallback on pages without a manifest). First enable also turns on stacking + stripes |
| STRUCTURE | Stack side-by-side | Gathers ALL members of a structure group — from anywhere on the page — into one horizontal scroll-snap strip at the first member's position (fully reversible per-element DOM move) |
| STRUCTURE | Striped background | Hatches the strip backgrounds (on by default with grouping) |
| EDIT | Edit blocks | Turns every block content-editable (click into text and type) and adds ↑ ↓ ✎ ✕ chips to each block outline: move the block up/down one slot on the page, rename it (prompt pre-filled with the current name; renamed chips show the new name + `*`, and clicking a chip still copies the ORIGINAL name), or mark it for deletion (block dims + greys out and its chip gains a ✕ prefix; the chips collapse to a single ↺ that undoes the mark). Enabling edit mode dissolves any active stacking. Nothing writes to source — it builds a change request |
| EDIT | Copy changes | Copies a JSON changeset keyed by ORIGINAL block names (the stable identifiers): per-block `newName`, `deleted: true`, and `textEdits` (`{before, after}` per changed text node, diffed against a baseline snapshotted when edit mode first turns on), plus a full-page `order` array when blocks were moved. Paste it to Claude to apply against the MJML source. Caveat: blocks whose text is rewritten by live scripts (countdown timers) can't hold manual text edits |
| EXCLUDED | Highlight all excluded | Red tint + red ✕ over every excluded block — both `data-fully-exclude` variants and `data-import-exclude` chrome |
| EXCLUDED | Export / Copy .mjml | The page's raw .mjml with every excluded/dev-only top-level block removed and every mj-include inlined (type="css" becomes mj-style; partials spliced in) — fully self-contained and compilable from anywhere. A scope selector (shown when the page has Category headers) narrows the export to one category section, or downloads a .zip containing one .mjml per section plus the full template (dependency-free store-mode zip); Copy is disabled in zip mode |
| EXCLUDED | Copy HTML | The compiled page as served, minus every `<script>` (the debugger and both injected JSON payloads) and the 🐞 toolbar — i.e. the send-ready HTML. Re-fetches from the server so debugger surgery can never leak in; on `file://` pages it falls back to a cleaned clone of the live DOM. Same output as `<name>_live.html` but with relative asset paths |
| EXCLUDED | Hide all excluded | Hides all of those blocks — what remains is exactly what imports (one block per structure group) |

Exclusion detection reads the `[data-fully-exclude]` / `[data-import-exclude]`
attributes the annotate → compile → restore pipeline carries into the compiled
HTML (§2) — synchronous, works even on `file://` (`.fully-excluded` is also
accepted for builds that skip the restore pass). Hiding never touches content
elements' style attributes (which would re-serialize them); it toggles a
`data-tpl-debug-hidden` attribute matched by an injected stylesheet, so the
DOM restores byte-identically.

Fallback for builds without the annotation pass: the script fetches the page's
own raw source (`location.pathname.replace(/\.html$/, '.mjml')` — hence the
`cp *.mjml` build step), stack-parses the START/END markers in the text, and
maps flagged blocks back to the DOM by name. If neither source is available,
the checkbox greys out with a tooltip instead of breaking.

"Turn off" resets all state, removes overlays, and restores hidden blocks.

## 6. Converter metadata (`data-*` attributes for MJML → EN import)

### 6.0 `en-tools-config` — the template's declared expectations

One JSON comment at the top of `<mj-head>` (both copies, kept identical)
declares the template's spacing scale, width presets, and geometry
threshold. The importer derives every pacing dropdown's names, px values,
and snapping targets from it, and flags any authored value that is out of
sync with the declaration. If a design change needs different steps (e.g.
Half = 10px), change THIS declaration and the authored values together —
never leave values silently off the declared grid. Schema and semantics: see the "Template-declared expectations" section of
CONVENTIONS.md at this repo's root (a public mirror of the converter's
authoring contract; canonical source lives in the private
email-to-en-marketing-tools repo).


Purpose: a downstream converter scans the **raw MJML** and turns templates into
Engaging Networks JSON imports. The attributes are machine-readable markers; at
`validationLevel=skip` they compile away to nothing, so they're invisible in
the shipped HTML (except `data-import-exclude`, deliberately).

### 6a. `data-style-*` — RETIRED 2026-08-18; do not author new ones

**This vocabulary is retired** (guide §5 owns the ruling). The converter
never read these flags — it surfaces properties by scanning the raw MJML
itself — and the strip-and-regenerate audit proved that removing all 8,376
instances changed zero generated fields, so they came out of every source
on 2026-08-18. The one survivor is `data-style-dark-mode`, which THIS
repo's build consumes to pair light/dark images (§6c); keep authoring that
one.

What the vocabulary declared, kept as the historical record: valueless
flags placed directly on MJML tags (and on raw `<a>` tags inside
`mj-text`), naming which style properties were meant to be editor-exposed.
Shorthand was always expanded — a tag with any padding got all four
`data-style-padding-*` flags.

| Component | Flags |
|---|---|
| `mj-section` | padding-top/right/bottom/left, background-color, border, direction (+ background-url/position/size when a background image is present) |
| `mj-column` | background-color, border, 4×padding, vertical-align |
| `mj-text` | alignment, 4×padding, color |
| `mj-button` | align, 4×padding, background-color, border, direction, color, href, width ("auto" or px) |
| `mj-image` | src, href, alt, width, align (+ `data-style-dark-mode` on dark copies, §6c) |
| `mj-divider` | border-color, border-width, width |
| `mj-social-element` | href |
| `mj-spacer` | height |
| raw pill `<a>` (has `border-radius` in style) | the full button set |
| plain inline `<a>` | color, href |

### 6b. `data-import-exclude` — "skip this block entirely"

For catalog chrome (the `Category — …` header bars) that must never import.
MJML rejects unknown attributes on `mj-section` at default validation *and*
this flag must survive into compiled HTML (the converter's exclusion happens
there, and the debugger's hide toggle uses it), so it's applied as an
`mj-raw` div wrapper around the section:

```html
<mj-raw><div data-import-exclude="true" data-folder="6399" data-category-short="Headers/Heroes"></mj-raw>
  <mj-section> ... </mj-section>
<mj-raw></div></mj-raw>
```

The wrapper survives compilation as-is, so the attribute is directly
queryable in the compiled HTML.

Category wrappers also carry `data-folder="<id>"` — the Engaging Networks
import-folder ID for every block that FOLLOWS that header (until the next
category header). The converter reads it from the raw MJML to route each
block's import; the header block itself still never imports. Each wrapper
also carries `data-category-short="<label>"` — the short name the importer
prefixes onto block names (e.g. `Headers/Heroes`, `Text and Images`).

**The live map is printed by every build** — `npm run build` emits a
`categories (n): <folder> <label> [<short>]` line per catalog page. Read it
there rather than from a list here; a hand-copied map goes stale on the next
category change (this one did).

(Retired 2026-08-03: Fundraising & Campaign 6402 and Content Features 6403
merged into Engagement & Interactive 6408 — the Progress Meter, Countdown
Card, and all Content Features blocks live there. Retired with the same
consolidation: Heading Banners & Rows 6405, absorbed into Text Blocks 6400.
Retirements are worth recording; current state is not.)

A block can override its section's folder by carrying `data-folder="<id>"`
directly on its own top-level tag (e.g. the block's `mj-section`): the
converter resolves a block's folder as block-level `data-folder` → the
import form's folder input → enclosing category header's `data-folder` →
the account default. Divider values prefill the import form.

**`data-no-display-toggle`** (valueless, on `mj-image`/`mj-text`/`mj-button`/
`mj-divider` only): opts a component OUT of the importer's auto-generated
per-component Display replacement (Include/Exclude Block). The importer adds
that toggle to every such component sharing its column with another non-spacer
component; this flag marks the ones editors must never be able to hide —
legally required footer text (sender identification, Unsubscribe/Privacy
links, photo credits), the required footer logos, and composite pieces whose
siblings break without them (the thermometer's figures + bar). Presence-only,
composes with `data-style-*` on the same tag, stripped from compiled HTML
like the rest of the contract, and ignored by the structure-group normalizer. Like the other `data-*` metadata,
a block-level `data-folder` exists only in the raw MJML (validationLevel=skip
strips it from compiled HTML); the category wrappers keep theirs in compiled
output because they're raw divs.

### 6c. Dark-mode image pairs + `data-style-dark-mode`

Every `mj-image` gets a dark-mode twin: identical attributes, own swappable
`src` (defaults to the same/equivalent asset), marked `data-style-dark-mode`.
The light copy gets `css-class="light-only"`, the dark copy `"dark-only"` and
is wrapped in an MSO-hiding conditional so Outlook never renders both:

```html
<mj-image src="..." css-class="light-only" ... />
<mj-raw><!--[if !mso]><!--></mj-raw>
<mj-image src="..." css-class="dark-only" ... data-style-dark-mode />
<mj-raw><!--<![endif]--></mj-raw>
```

Backed by CSS in `styles.css`: `.dark-only { display:none }`, flipped by both
`@media (prefers-color-scheme: dark)` and `[data-ogsc]` (Outlook.com dark
mode). The `[data-ogsc]` branch **must stay nested inside a conditional media
query** — EN's inliner deletes those rules at top level, and the base
`display:none` gets inlined, so every flip also needs `!important`. See §7a.

### 6d. `data-fully-exclude` — "duplicative variant, don't re-import"

Placed on sections that are identical to an earlier block once you ignore:
font color, background color, image URLs (`src`/`alt`/background-url),
borders, padding, direction, `align` on `mj-button`/`mj-text`/`mj-image` and
`vertical-align` on `mj-column` (alignment is an exposed Replacement on all
four; absent = the MJML default, `left`/`top`), `href` values, `mj-button`
width values (`width="auto"` compiles to `width:auto` — CSS-identical to no
width — so every button authors one and the value is replaceable), `mj-image`
width and `mj-spacer` height values (explicit px everywhere; the converter
stamps the number into both compiled sites — `width:{{w}}px` in the td style
and unitless `width="{{w}}"` on the img), **and the entire contents of
`mj-text` and `mj-button`** (body copy and button labels are editable
content). Divider width stays structural: MJML derives its compiled px from
the container, so the authored value never matches the shipped one. Attribute
*presence* stays structural — a section with a background-url is never
duplicative of one without; only values are ignored. With those becoming
converter variables, such blocks are redundant — first occurrence survives,
later ones are flagged. (The annotate pass validates these every build, so trust its output over
any number written here.)
The annotate pass (§2) encodes these rules, derives the structure groups from
them, and verifies the flags on every build — a follow-on block missing its
flag (or a flagged anchor) prints a WARN in the build output. Grouping,
exclusion, and the debugger's "Group by structure" view are all one concept:
a structure group is one importable block; its follow-on members are the
excluded variants that only differ in Replacement values.

Column width is deliberately NOT a variable: MJML fans one
`mj-column width="480px"` into a class *name* (`mj-column-px-480`), shared
head CSS rules, and MSO ghost-table widths — a 1:1 value replacement can't
reach all of those, so width/inset variants remain distinct blocks. The annotate → restore pipeline (§2) carries this attribute
through to the corresponding elements in the compiled HTML. Determining which blocks qualify is a normalization pass: strip
the ignored attributes, mask `mj-text` bodies and image srcs, compare.

### 6e. Expected validator noise

Any standard MJML validator (editors, linters, external warning reports) will
flag these sources — **by design**:

- `Attribute data-style-* / data-fully-exclude / data-folder / data-no-display-toggle is illegal` on
  flagged tags — the converter metadata contract (§6a/§6b/§6d). The attributes exist only
  in raw MJML; the pipeline compiles with `validationLevel=skip` (§2), which
  strips them from shipped HTML.
- `Attribute width has invalid value: auto for type Unit` on every auto-width
  `mj-button` — the explicit "shrink-to-fit" convention. Confirmed harmless:
  at default ("soft") validation MJML logs the message but exits 0 and passes
  `width:auto` through to the button table's inline style, which renders
  identically to an absent width in every client.

Both classes of message are safe to whitelist/ignore in external MJML-warning
reporting. Strict validation mode is incompatible with these sources by
design — the pipeline's level is `skip`.

Do NOT "fix" `width="auto"` by removing it: uniform width *presence* is what
keeps button structures unified (§6d), and the converter's width-Replacement
contract relies on the attribute always being present ("auto" = shrink-to-fit,
a px value = fixed). Removing it re-splits structure groups.

## 7. Email-client compatibility patterns

- **Pill CTA hybrid (side-by-side buttons):** raw `<a>` pills inside
  `mj-text`, joined by MSO ghost-table conditionals
  (`<!--[if mso]></td><td ...><![endif]-->`) so Outlook gets real table cells
  while everyone else gets inline-blocks. `.cta-item` + the head `mj-style`
  rule makes them stack on mobile. `mso-padding-alt` moves pill padding onto
  the ghost td for Outlook.
- **Column width math for n-up layouts:**
  `(600 − section padding − (n−1)·gap) / n`, rounded down.
- **`mj-group`** wherever columns must NOT stack on mobile (e.g. the
  tri-color divider's three 200px spacer columns).
- **Insets are padding, not column width:** a narrowed text block is authored
  as a full-width column with section side-padding (`16px 64px` — Quadruple
  on the declared scale, giving a ~472px content width) plus
  `css-class="… inset-gutter"`, whose shared mobile rule collapses the
  gutters to 32px on phones. Keep the side value on the scale; an off-grid
  inset snaps at import and desyncs from the other inset blocks. Never author an inset via a px
  column: MJML bakes column widths into class names (not Replaceable, §6d) and
  the column collapse leaves zero-margin full-bleed text on mobile. The
  `inset-gutter` token is ignored by the structure normalizer (it's the
  responsive companion of a padding value), but imported blocks must carry the
  class + its CSS for padding Replacements to behave on mobile.
- **Fixed-width buttons:** keep ≤ 300px. A 400px `mj-button` plus 32px section
  padding overflows a 375px phone (rendered 464px → horizontal scroll).
- **Element width × block width can jointly overflow (QA hazard):** in EN,
  element widths (button/image px) and block widths (padding presets) are
  independent Replacements — a full-width button inside a block whose width
  preset was widened past Double can exceed the 600px canvas and break out of
  its container. There is no build-time guard for values chosen in EN, so warn
  editors in block documentation, keep `css-class="button fixed-width"` on
  buttons inside hero/background sections (its mobile rule caps them at
  container width), and re-run the 375px overflow scan (§9 step 4) after
  geometry changes.
- **Background-image sections (Outlook):** MJML emits the `v:rect`/`v:fill`
  VML automatically, but Outlook cannot honor horizontal section padding
  inside one — author these sections with vertical-only padding and fake the
  gutters with an `mj-group` of `25px` spacer columns around a `550px` content
  column (the NGS pattern; see any CTA Hero). Every `background-url` container
  must also author a real `background-color` — without it MJML omits `color=`
  on `v:fill` and Outlook shows black/transparent when the image fails.
- **Outlook renders all buttons square:** Outlook ignores `border-radius` on
  table cells, for both `mj-button` and the raw pill hybrids. This is accepted
  graceful degradation — do NOT reach for VML roundrect wrappers; they break
  the converter's label/color Replacement bindings and bloat every block.
- **`mso-line-height-rule: exactly`** on every heading line-height in
  styles.css.
- Headings use a separate display stack ("Helvetica Neue", Arial) from body
  copy (Tahoma).

### 7a. Dark mode

The whole dark treatment lives in styles.css: a `:root { color-scheme: light
dark; supported-color-schemes: light dark; }` declaration, an
`@media (prefers-color-scheme: dark)` block, and a `[data-ogsc]`-prefixed
mirror of it wrapped in `@media only screen and (max-width: 9999px)` (see
below for why). Every declaration inside both carries `!important` — blocks
author their ink inline (dark text on light section colors), and only
`!important` outranks an inline style.

Two mechanisms do the work: elements pair a `light-only` and a `dark-only`
twin (see §6c) for asset swaps, and the rules above repaint text, buttons,
and backgrounds. `.block div` is in the forced-white selector list because
`mj-text` compiles to a `<div>` carrying inline `color` — text written
without a `<p>`/`<span>` wrapper is reachable no other way.

**EN's CSS inliner cannot be turned off**, so the dark treatment is authored
around it. MJML-AUTHORING-GUIDE.md §2 is canonical for the measured
behavior (measured through the TEMPLATE pipeline; the block pipeline has not
been separately probed). The two findings this file depends on:

- **A conditional media query is EN's "do-not-touch" wrapper.** Anything
  nested inside one returns verbatim. `[data-ogsc]` rules at *top level* are
  deleted outright, which is why the whole OWA branch here lives inside
  `@media only screen and (max-width: 9999px)`. Do not unwrap it, and do not
  substitute a bare `@media screen` — an un-evaluable condition is what makes
  the wrapper work.
- **`!important` is stripped from any rule EN inlines**, and the base rules
  (`.dark-only { display: none }`) do get inlined onto the element. Every
  declaration inside both dark branches therefore needs `!important` to
  outrank that inline style. Dropping the keyword breaks the swap silently —
  it still looks right in source, in local preview, and in the EN editor.

Symptom of a broken swap: images don't double up (so the inlined
`display:none` survived), but text stays dark-on-dark and no asset swaps.
Verify by viewing source on a received test — the media queries should be
present in the head, unmodified.

Client support, since dark mode is not uniformly addressable:

| Client | Honors | Notes |
|---|---|---|
| Apple Mail, iOS Mail | `prefers-color-scheme` | Full control; auto-darkens backgrounds even without our CSS, which is why missing CSS reads as black-on-black |
| Outlook.com / OWA | `[data-ogsc]` | Needs the mirrored branch; media query never runs |
| Gmail app, Outlook Windows desktop | neither | They apply their own color transform. Only asset choice and transform-tolerant colors help — e.g. Word's inversion of a dark plum section to pink is not addressable from CSS |

## 8. Asset policy

- **Format:** photographs are JPG; anything needing transparency (logos,
  cut-out subjects, product shots on colored blocks) stays PNG.
- **PNG size cap:** EN limits PNG file size — downscale large PNGs (here:
  premium products to max 500px wide) rather than converting.
- **Originals archive:** before converting/resizing, copy the untouched file
  to `dist/assets/originals/` (rsync-excluded, never overwritten).
- **Naming prefixes:** `photo-`, `icon-`, `logo-`, `premium-`, `staff-`,
  `state-`, `text-`, `cta-`, `image-`; variants suffixed with `_` (`_white`,
  `_color-overlay`). `placeholder.png` is the one intentional exception.
- **Paths and the flat CDN folder** are governed by
  MJML-AUTHORING-GUIDE.md §7: source stays relative, and filenames must be
  unique repo-wide because every asset resolves to `<root>/<filename>`. The
  absolute-URL form is a build artifact (`<name>_live.html`, §2), never
  authored.
- **Contrast outlines are the standard for transparent text/lettering art**
  (adopted 2026-08-12, superseding the brief signature flatten from earlier
  the same day): every transparent PNG whose ink depends on its background —
  the four wordmark variants, both signatures, both quote glyphs, both
  Giving Tuesday badges, both `text-and-arrow` graphics, the podcast cover,
  and the state outline — carries a rim in the opposite polarity (light ink →
  `#362229` plum rim, dark ink → white rim), drawn from the image's own
  alpha. The rim is invisible on the intended background and becomes the
  contrast border when a client (Outlook desktop dark, guide §2c) inverts
  the surface without touching the image. Mechanics that keep pairs safe:
  the canvas is EXPANDED so the rim never clips at the artwork's edge, every
  variant in a family grows by the same margin so light/dark twins keep
  matching dimensions, and each `mj-image` `width` attribute was scaled by
  the canvas-growth ratio so the artwork renders at its pre-outline size.
  A new asset in one of these families must receive the same treatment and
  the same margin; untouched originals live in `dist/assets/originals/`, and
  `scripts/outline-assets.py` (Pillow) regenerates every treated file from
  that archive byte-identically — it owns the exact parameters (rim = 4.5%
  of the original's short side, odd, feathered 0.6; family margin = max
  family rim // 2 + 2) and prints the width-rescale ratios.

### Pending asset work (needs designed art — from the 2026-08-11 EoA rounds)

The self-contrasting wordmark need was RESOLVED 2026-08-12 by the contrast
outlines above. Still open:

1. **Footer social icons.** The four `icon-*` social PNGs are white ink on
   transparency over the Footer's `#000000` section; Outlook dark inverts
   the section to white and the icons vanish. They render through
   `mj-social`, not `mj-image`, so they were not part of the outline pass —
   the prescribed fix is the same contrast-outline treatment (plum rim),
   applied when these are next re-cut.

One further art call, lower stakes: `photo-person_overlay.jpg`'s baked
overlay fades to `#000000` abruptly (~10% of its height). The hero's fallback
color now matches the baked black (2026-08-12), so uncovered area blends, but
only a re-graded fade can soften the photo-to-black transition itself.

## 9. Verification workflow (per change)

These steps are repo-specific and run **in addition to** the QA checklist in
MJML-AUTHORING-GUIDE.md §8, which CLAUDE.md requires after every source
change.

1. `npm run build` must exit clean — zero `WARN` lines from the annotate
   pass (structure groups), `check-docs` (documentation drift), or
   `check-catalog` (block defects).
2. START/END pairing audit: scan each `.mjml` for unmatched/misnested markers
   (the debugger also warns in console).
3. Headless-Chrome screenshots of `dist/*.html` at ~700px and ~480px; compare
   against mockup tiles for new blocks.
4. Mobile overflow scan at 375px:
   `document.documentElement.scrollWidth > clientWidth`, plus a walker that
   reports any element wider than the viewport.
5. When only metadata changed, diff compiled HTML against the previous build —
   it should be byte-identical (proves `validationLevel=skip` stripped
   everything).

## 10. Porting checklist

Copy verbatim, then adapt:

- [ ] `package.json` build/watch/preview scripts (§2) + `mjml` dependency
- [ ] `scripts/` (annotate-excluded, restore-excluded, emit-variants,
      watch) + add `.build` to .gitignore
- [ ] `src/assets/debug.js` — fully generic, no project-specific code
- [ ] `src/partials/debug-toolbar.mjml` — the 🐞 launcher
- [ ] `MJML-AUTHORING-GUIDE.md` + `CONVENTIONS.md` — mirrors of the private
      canonical docs; copy, never edit locally
- [ ] `.claude/launch.json` — adjust path/port
- [ ] `styles.css` scaffolding: heading scale w/ mso rules, `.light-only`/`.dark-only`
      swap CSS with the `[data-ogsc]` branch **wrapped in
      `@media only screen and (max-width: 9999px)`** and `!important` on every
      declaration in both dark branches (§7a), `div[data-container]` shim

Adapt per project:

- [ ] `CLAUDE.md` — repo-specific instructions: catalog roles, asset root,
      anything the mirrors get wrong for this project
- [ ] `en-tools-config` head comment — declare the spacing scale, width
      presets, and `geometryReachPx` (§6.0); identical in every `src/*.mjml`
- [ ] `mj-head` baseline (`mj-attributes`, `mj-class`es, brand fonts/colors)
- [ ] Wrap every block in START/END comments following the grammar
- [ ] Do NOT author the retired `data-style-*` vocabulary (§6a) — the
      converter reads properties from the MJML itself
- [ ] Pair every `mj-image` with a `dark-only` twin (§6c)
- [ ] Wrap catalog chrome in `data-import-exclude` mj-raw divs (§6b)
- [ ] Flag duplicative variants `data-fully-exclude` after the catalog settles (§6d)
- [ ] Set up `dist/assets/originals/` and follow the asset policy (§8)
