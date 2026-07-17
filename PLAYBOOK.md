# MJML Project Playbook

Every customization this project layers on top of stock MJML, written so the
whole setup can be reproduced in another MJML project. Sections are ordered the
way you'd set up a new repo. The "Porting checklist" at the bottom is the
short version.

---

## 1. Project layout

```
src/
  main.mjml            ← block catalog (one page per .mjml in src/)
  demo.mjml            ← mockup mirror / second page
  styles.css           ← shared CSS, pulled in via mj-include
  partials/            ← reusable mj-include fragments
    debug-toolbar.mjml
    tri-color-divider.mjml
    green-rule-divider.mjml
  assets/              ← images + debug.js (synced to dist at build)
dist/                  ← build output; this is what gets served/previewed
  assets/originals/    ← full-res originals, NOT synced/overwritten by builds
NAMING.md              ← block naming grammar (see §4)
.claude/launch.json    ← preview server definition (http-server on dist/)
```

Multiple pages are free: the build globs `src/*.mjml`, so adding
`src/anything.mjml` yields `dist/anything.html` with no config change.

## 2. Build pipeline (`package.json`)

```json
"build": "node scripts/annotate-excluded.mjs && mjml ./.build/*.mjml -o ./dist/ --config.allowIncludes=true --config.validationLevel=skip && node scripts/restore-excluded.mjs && rsync -a --delete --exclude='originals/' ./src/assets/ ./dist/assets/ && cp ./src/*.mjml ./dist/",
"watch": "node scripts/watch.mjs"
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
  §6d), injects a `{ blockName: anchorName }` JSON manifest into each page's
  <head> (`<script data-tpl-structure-groups>`), and validates the
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

Preview: `.claude/launch.json` runs `npx http-server <repo>/dist -p 8642 -c-1`
(`-c-1` disables caching so rebuilds show immediately). Always preview from
`dist/`, never from `src/`.

## 3. `mj-head` conventions

- `mj-breakpoint width="600px"` — single mobile breakpoint; email width is 600.
- `mj-attributes` sets the inherited baseline once: `mj-text` (Tahoma
  sans-serif stack, 18/24, `css-class="wysiwyg"`), `mj-button` (pill:
  `border-radius="100px"`, `inner-padding="12px 16px"`, letter-spacing, brand
  green background), `mj-image padding="0"`.
- Reusable variants live in `mj-class` (e.g. `caption`: 10/16 + top padding)
  and are applied with `mj-class="caption"` rather than repeating attributes.
- `mj-style` holds mobile-only overrides under `@media (max-width: 599px)`
  (caption gutter with `!important` to beat inline td padding; `.cta-item`
  stacking for side-by-side CTAs; `.inset-gutter` collapsing desktop inset
  gutters to the standard 32px).
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
<!-- START: Logo Header (light green, centered) -->
<mj-section ...> ... </mj-section>
<!-- END: Logo Header (light green, centered) -->
```

These are the backbone of everything else — the debug overlay, duplicate
detection, and the raw-MJML↔compiled-HTML mapping all key off block names.
Names must match exactly (case-sensitive) between START and END.

Grammar (full spec in `NAMING.md`): `Family (qualifier, qualifier, w/ feature)`

- Stripping parentheticals yields the *group key*; blocks sharing a key are
  variants of one family and group/stack together in the debugger.
- Qualifier order: surface/color → layout/alignment → `w/` features.
- `x` combines different things ("Logo Header x CTA"); `Dual`/`Triple` denote
  repetition.
- Identical full names are reserved for byte-identical repeats (that's what
  "Hide duplicates" collapses).
- `(dev only — remove for production)` marks non-shipping chrome; the overlay
  skips it. `Category — <Label>` blocks are catalog navigation chrome.
- An outer `<!-- START: Main Content -->` wrapper encloses the whole body
  (also skipped by the overlay).

## 5. Debug overlay (`assets/debug.js` + `partials/debug-toolbar.mjml`)

A 🐞 floating button (fixed bottom-right, injected via `mj-raw` in the
debug-toolbar partial) lazy-loads `assets/debug.js` on first click. The script
is a self-contained IIFE exposing `window.__tplDebug` — no dependencies, works
on any page that has the START/END comments.

Panel options:

Options are grouped into three sections whose headers carry live counts —
BLOCKS (total parsed), STRUCTURE (unique structures), EXCLUDED (flagged
blocks, both kinds):

| Section | Option | What it does |
|---|---|---|
| BLOCKS | Outline blocks | Draws a colored outline + name chip per block |
| BLOCKS | Show block labels | Toggles the name chips (nested under Outline blocks; on by default) |
| STRUCTURE | Group by structure | Groups by structure-group manifest: one color + the anchor block's name per structure; adjacent same-group blocks merge into runs (name-family fallback on pages without a manifest). First enable also turns on stacking + stripes |
| STRUCTURE | Stack side-by-side | Gathers ALL members of a structure group — from anywhere on the page — into one horizontal scroll-snap strip at the first member's position (fully reversible per-element DOM move) |
| STRUCTURE | Striped background | Hatches the strip backgrounds (on by default with grouping) |
| EXCLUDED | Highlight all excluded | Red tint + red ✕ over every excluded block — both `data-fully-exclude` variants and `data-import-exclude` chrome |
| EXCLUDED | Export / Copy .mjml | The page's raw .mjml with every excluded/dev-only top-level block removed and every mj-include inlined (type="css" becomes mj-style; partials spliced in) — fully self-contained and compilable from anywhere; as a file download or a clipboard copy |
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

Purpose: a downstream converter scans the **raw MJML** and turns templates into
Engaging Networks JSON imports. The attributes are machine-readable markers; at
`validationLevel=skip` they compile away to nothing, so they're invisible in
the shipped HTML (except `data-import-exclude`, deliberately).

### 6a. `data-style-*` — "expose this property as editable"

Valueless flags placed directly on MJML tags (and on raw `<a>` tags inside
`mj-text`). They declare which style properties the converter must surface as
Replacement options. Shorthand is always expanded — a tag with any padding gets
all four `data-style-padding-*` flags.

| Component | Flags |
|---|---|
| `mj-section` | padding-top/right/bottom/left, background-color, border, direction (+ background-url/position/size when a background image is present) |
| `mj-column` | background-color, border, padding ×4, vertical-align |
| `mj-text` | alignment, padding ×4, color |
| `mj-button` | align, padding ×4, background-color, border, direction, color, href, width (every button authors an explicit width — `auto` for shrink-to-fit — so width presence is uniform and the value is a clean Replacement) |
| `mj-image` | src, href, alt, width, align (+ `data-style-dark-mode` on dark copies, §6c). Every image authors an explicit px width; "fill container" = the padding-chain ceiling (600 minus section/column/image side padding, × column fraction). Percent widths are forbidden (MJML misparses them); the build warns on missing/percent/over-ceiling widths |
| `mj-divider` | border-color, border-width, width |
| `mj-social-element` | href |
| `mj-spacer` | height |
| raw pill `<a>` (has `border-radius` in inline style) | the full button set + color + href |
| plain inline `<a>` | color, href |

### 6b. `data-import-exclude` — "skip this block entirely"

For catalog chrome (the 12 `Category — …` header bars) that must never import.
MJML rejects unknown attributes on `mj-section` at default validation *and*
this flag must survive into compiled HTML (the converter's exclusion happens
there, and the debugger's hide toggle uses it), so it's applied as an
`mj-raw` div wrapper around the section:

```html
<mj-raw><div data-import-exclude="true"></mj-raw>
  <mj-section> ... </mj-section>
<mj-raw></div></mj-raw>
```

The wrapper survives compilation as-is, so the attribute is directly
queryable in the compiled HTML.

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
`@media (prefers-color-scheme: dark)` and `[data-ogsc]` (Outlook.com dark mode).

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
later ones are flagged. (This project: 7 in main, 38 in demo.)
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

- `Attribute data-style-* / data-fully-exclude is illegal` on nearly every
  tag — the converter metadata contract (§6a/§6d). The attributes exist only
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
  as a full-width column with section side-padding (480px look = `16px 60px`,
  526px = `0 37px`) plus `css-class="… inset-gutter"`, whose shared mobile rule
  collapses the gutters to 32px on phones. Never author an inset via a px
  column: MJML bakes column widths into class names (not Replaceable, §6d) and
  the column collapse leaves zero-margin full-bleed text on mobile. The
  `inset-gutter` token is ignored by the structure normalizer (it's the
  responsive companion of a padding value), but imported blocks must carry the
  class + its CSS for padding Replacements to behave on mobile.
- **Fixed-width buttons:** keep ≤ 300px. A 400px `mj-button` plus 32px section
  padding overflows a 375px phone (rendered 464px → horizontal scroll).
- **`mso-line-height-rule: exactly`** on every heading line-height in
  styles.css.
- Headings use a separate display stack ("Helvetica Neue", Arial) from body
  copy (Tahoma).

## 8. Asset policy

- **Format:** photographs are JPG; anything needing transparency (logos,
  cut-out subjects, product shots on colored blocks) stays PNG.
- **PNG size cap:** EN limits PNG file size — downscale large PNGs (here:
  premium products to max 500px wide) rather than converting.
- **Originals archive:** before converting/resizing, copy the untouched file
  to `dist/assets/originals/` (rsync-excluded, never overwritten).
- **Naming prefixes:** `photo-`, `icon-`, `logo-`, `premium-`, `staff-`,
  `state-`, `text-`, `cta-`; variants suffixed with `_` (`_white`, `_color-overlay`).
- All MJML references are relative (`assets/foo.jpg`) so dist is portable.

## 9. Verification workflow (per change)

1. `npm run build` must exit clean.
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

- [ ] `package.json` build/watch scripts (§2) + `mjml` dependency
- [ ] `scripts/` (annotate-excluded, restore-excluded, watch) + add `.build` to .gitignore
- [ ] `src/assets/debug.js` — fully generic, no project-specific code
- [ ] `src/partials/debug-toolbar.mjml` — the 🐞 launcher
- [ ] `NAMING.md` — the naming grammar
- [ ] `.claude/launch.json` — adjust path/port
- [ ] `styles.css` scaffolding: heading scale w/ mso rules, `.light-only`/`.dark-only`
      + `[data-ogsc]` swap CSS, `div[data-container]` shim

Adapt per project:

- [ ] `mj-head` baseline (`mj-attributes`, `mj-class`es, brand fonts/colors)
- [ ] Wrap every block in START/END comments following the grammar
- [ ] Apply the `data-style-*` matrix (§6a) to every tag as it's authored
- [ ] Pair every `mj-image` with a `dark-only` twin (§6c)
- [ ] Wrap catalog chrome in `data-import-exclude` mj-raw divs (§6b)
- [ ] Flag duplicative variants `data-fully-exclude` after the catalog settles (§6d)
- [ ] Set up `dist/assets/originals/` and follow the asset policy (§8)
