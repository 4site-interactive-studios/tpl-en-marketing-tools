<!-- MIRROR — DO NOT EDIT HERE. Canonical source: email-to-en-marketing-tools (private repo), docs/conventions.md. Re-mirrored on every change. -->

# Conventions & Business Logic

The decided-with-Bryan rules that drive this tool. This is the persistent
record of WHY the generator behaves the way it does — every entry below was
an explicit product decision, not an implementation accident. Update this
file in the same commit whenever a convention is added or changed, and
review it before every commit (CLAUDE.md enforces this).

Implementation lives mostly in `src/core/mjmlProps.ts`
(`autoEnableReplacements`); tests encode every rule.

## How to use this document

Two audiences:

1. **Developers of this tool** — the contract your changes must honor
   (see CLAUDE.md's pre-commit review).
2. **AI agents working on the source MJML** (the TPL template repo). This
   document IS the upstream authoring contract: given the lead-in prompt
   below, an agent should be able to audit and update template blocks so
   they natively produce the expected importer outcomes — without access
   to this repo or any chat history.

### Companion document

A portable, repo-agnostic version of the authoring rules lives in
`docs/mjml-authoring-guide.md` (public mirror:
https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/MJML-AUTHORING-GUIDE.md).
That guide is the one to hand to a NEW MJML repo: it carries the measured
EN CSS-inliner behavior, the bottom-only pacing rationale, the data-*
contract, a QA checklist, and its own copy-paste agent prompt. THIS
document remains the exhaustive, importer-specific contract. When a rule
generalizes beyond this template, it belongs in both.

### Lead-in prompt for upstream agents (copy-paste)

Keep this current. It is the entry point for every AI session in the TPL
repo, so a stale prompt silently teaches the wrong rules.

```text
You are working on the MJML source of the Trust for Public Land email
system, whose compiled output is imported into Engaging Networks (EN)
Marketing Tools as blocks and a template.

Repo: https://github.com/4site-interactive-studios/tpl-en-marketing-tools
- src/mjml_all-blocks.mjml (formerly demo.mjml) is the full block
  catalog. src/tpl_all-blocks.mjml (formerly example.mjml) is a
  deliberately curated SUBSET of it — same "Category — X" dividers (9 in
  each), fewer blocks. A change to a block they SHARE belongs in both;
  never add blocks to tpl_all-blocks.mjml to "restore parity." The
  repo's
  CLAUDE.md records the exact delta.
- src/tpl_unified-blocks.mjml (formerly main.mjml) is the master
  template.
- src/styles.css is the shared stylesheet, compiled into the head.

Two documents govern this work. Fetch and read BOTH in full before making
any change, and treat them as binding:

1. MJML Authoring Guide for EN Marketing Tools (best practices, EN's
   measured CSS-inliner behavior, the data-* contract, the QA checklist):
   https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/MJML-AUTHORING-GUIDE.md

2. Conventions & Business Logic (the importer's full contract: how every
   editable field is generated, named, ordered, and suppressed):
   https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/CONVENTIONS.md

Non-negotiables while you work:
- Vertical pacing is BOTTOM-ONLY, on the declared spacing scale. When you
  move padding, keep the total inter-element gap identical
  (upper.bottom + lower.top must not change). Columns never carry bottom
  padding.
- Never remove, rename, or "fix" any data-* attribute. They are VALUELESS
  flags (data-no-display-toggle, not ="true"), and they are the only
  channel design intent has into the importer. Keep data-style-* accurate
  for every property you touch.
- If a design needs values outside the declared defaults, do not silently
  ignore the grid. Change the en-tools-config head declaration
  deliberately, in every src/*.mjml that declares one, in the same
  commit.
- EN runs a CSS inliner on every SEND and it cannot be turned off. It is
  a send/render-time transform: the stored template keeps your source
  verbatim, so an export proves nothing — verify against the delivered
  HTML. Any CSS that must survive untouched has to be nested inside a
  CONDITIONAL media query (bare @media screen does not work). [data-ogsc]
  rules at top level are deleted outright.
- Any rule inside a media query that must beat an inlined base rule needs
  !important. This is what keeps the light/dark image swap working.
- An editable background image must bind ALL FOUR compiled carriers: the
  div's inline background shorthand, the wrapper table's background
  attribute, the second url() in that table's style, and the v:fill src
  inside the [if mso | IE] conditional.

Verify when done, and report what each check returned:
- confirm every block tpl_all-blocks.mjml shares with
  mjml_all-blocks.mjml is still
  identical (the block LISTS are intentionally different)
- run the full QA checklist in section 8 of the authoring guide — it is
  the single copy of those checks, do not restate them here

If you added or changed a convention, say so explicitly so the canonical
documents can be updated. A rule that only lives in a chat transcript is
considered lost.

Task: [describe the change]
```

## The pacing scale (spacing)

- **None / Half / Single / Double / Triple = 0 / 8 / 16 / 32 / 48 px**
  (the DEFAULTS — a template can declare its own names, values, and step
  count via en-tools-config, below). Labels carry the px:
  "Single - 16px". (`src/core/templateConfig.ts`)
- The scale is **closed**: no free-text spacing and no per-field "Original"
  escape. Off-grid authored values **snap to the closest step, ties round
  UP** (24px → Double, 12px → Single, 10px → Half, 60px → Triple). The
  authored value is preserved as `originalValue` so deleting a field
  restores the HTML byte-exact. (`snapToSpacingScale`)
- Applies to: content components' **Spacing Below**, **spacer heights**
  (stack spacers when more than Triple is needed), and **frame
  (section/wrapper/column) paddings on all four sides** — vertical AND
  horizontal — except where the width preset takes over (below).

## Template-declared expectations: `en-tools-config`

The upstream MJML may declare its own expectations in ONE JSON comment
inside `<mj-head>` (parsed from the prepared source by
`parseTemplateConfig`, `src/core/templateConfig.ts`; comments survive
`prepareMjml`):

```html
<!-- en-tools-config {
  "spacingScale": { "None": 0, "Half": 8, "Single": 16, "Double": 32, "Triple": 48 },
  "widthPresets": { "Full Bleed": 0, "Single": 16, "Double": 32 },
  "geometryReachPx": 64
} -->
```

- **Semantics**: `spacingScale` (name → px; needs a 0 step and ≥2 entries;
  names and step count are free) drives every pacing Select's options,
  labels, and snapping targets. `widthPresets` (name → px) drives the
  Block Padding Left/Right dropdown. `columnWidthsPx` (optional; a non-empty array of
  whole px numbers ≥ 50, e.g. `[120, 240, 480]`) curates the Column
  Width ladder template-wide — see the column-width bullet for the
  precedence (`data-width-options` beats it) and the head-class guard.
  `geometryReachPx` is the hard-coded-geometry
  threshold. Partial declarations merge over the defaults per key; unknown
  keys are ignored; invalid keys fall back to defaults with a parse
  warning surfaced in the issues badge.
- **Persistence**: parsed at import, stored as `Project.templateConfig`,
  reused on re-imports and by validation.
- **Out-of-sync flagging**: every import-time snap (authored value ≠
  imported default) and every off-preset gutter is recorded on the block
  (`Block.pacingNotes`) and surfaced by the validator as a warning naming
  the authored value, the declared scale, and what it imported as — the
  burn-down list for bringing the source in line with its own declaration.
- **Rule for agents**: never leave authored values silently off-grid — fix
  the value, or change the declaration deliberately (every src/*.mjml
  that declares one — TPL has five — same commit).

## Geometry guard — what never gets a spacing field

Values that are design geometry, not pacing, stay hard-coded with NO field
(never a free-text fallback):

- Frame/content paddings **above `geometryReachPx`** (default 64; the test
  is `n <= reach`, so a value EQUAL to the reach is still spacing — which
  is why a Quadruple=64 step and geometryReachPx=64 coexist): hero photo
  reserves (Match Hero 160px, Image with overlay 350px), video bands
  (90–110px). In composite splices the out-of-reach side stays a literal
  while in-reach sides still get Selects.
- Spacer heights **below 8px** (3–4px spacers are decorative color bars —
  tri-color dividers, footers) or above 64px.
- Padding shorthands the decomposer can't parse (%, em, calc…) — the closed
  scale means they must never fall back to a free-text field.
- **mj-group paddings** are never fielded at all (groups are layout
  plumbing; their columns and contents carry the controls).

## Vertical pacing convention (authoring contract, shared with the TPL repo)

Inter-element space is the **upper element's bottom padding**. The LAST
element in a column supplies the column's bottom space; **columns never
carry bottom padding** (`validateColumnPacing` warns). Spacing Below is
**self-gating**: a content component (mj-image/text/button/divider) gets the
Select only when its authored padding is bottom-only — explicit
`padding-bottom`, or a shorthand whose top is 0 (`padding="0"` counts, and
yields a Spacing Below defaulting to None). Components authored with top or
all-around padding (e.g. an 8px inset image) are NOT on the convention and
stay fully hard-coded. Whether a block's image shows Spacing Below is
decided by the template source, not per-block tool logic.

**Horizontal insets** (2026-08-09, closing future-enhancements #2): a
qualifying component's NON-ZERO on-scale right/left shorthand slots become
"Inset Right" / "Inset Left" Selects on the same closed scale, spliced into
the same composite (mso-padding-alt copies included). Zero and off-scale
sides stay literal — the field only exists where the template authored a
real inset — and every Spacing Below gate applies unchanged (bottom-only,
on-scale bottom, sole-member consolidation). Off-grid sides snap with a
pacingNote. Total left offset = block gutter + content inset; the disjoint
"Inset" vocabulary (never "Padding") is what keeps the two knobs
distinguishable, and the fields sort directly under Spacing Below.
Explicit padding-left/right attributes on content components remain
unhandled (none exist upstream; documented limitation).

**Sole-member consolidation** (2026-07-23): when a column's content is a
SINGLE element (Creek Quiz bands, plain text/divider blocks), that element
gets NO Spacing Below — the frame's own padding Selects are the one pacing
control, and a second knob for the same space is duplicative. The element's
authored padding stays hard-coded. Light/dark image twins count as one
member. Mirrors the spacer-only-section and single-member-display-toggle
precedents.

Non-spacer blocks never bake in whitespace spacers (the Quote/CTA blocks'
20px top/bottom spacer sections were removed upstream 2026-07-23) — editors
add the standalone Spacer block manually when they want that gap. Decorative
color-bar spacers (3–4px, colored backgrounds) are visual elements, not
spacing, and stay.

## Width presets (horizontal gutters)

- Qualifying blocks' symmetric section/wrapper side padding becomes ONE
  **"Block Padding Left/Right"** Select whose options are the declared
  `widthPresets` ladder (bare names; default config **Full Bleed / Single
  / Double = 0 / 16 / 32 px** per side, TPL declares five steps through
  Quadruple = 64), plus a per-block **"Original (Npx)"** for off-grid
  gutters — width presets and button widths are the only places Original
  survives. Labeled **"Block Width" until 2026-08-11** (user-decided
  rename): the value IS the side padding, so the width framing inverted
  polarity — "Quadruple" sounded wider but made content narrower. The
  padding name matches the sibling "Block Padding Top/Bottom" fields; the
  merge-tag NAME stays `block_width` (`block_1_width`, `wrapper_width`, …)
  — labels are display-only, tags are byte-stable.
- Qualification (`blockSupportsWidthPreset`): every column width-auto or %,
  symmetric decomposable side padding. **Fixed-px-column blocks get NO
  preset** (their columns can't resize — Outlook overflow risk); they keep
  numeric handling via the four-side path.
- One dropdown, not a width+padding pair: auto/% columns follow the padding,
  so the single tag filling both side slots of the composite (mso-padding-alt
  copies included) drives the whole effect.

## Inert paddings — never ship a field that does nothing

A padding field is worthless if changing it doesn't change the rendering.
Two mechanisms are detected statically at import and the field is
suppressed. The reason lands in `Block.infoNotes` and the validator
surfaces it at **'info' level, not as a warning** (2026-08-03,
user-decided): the source is correct as written and nothing can be
burned down — the note only explains WHY the field is missing and what
the working control is, so it must keep that explanation in its message.
`Block.pacingNotes` (snaps, off-preset gutters) stay warnings — those ARE
actionable in the source. The same info treatment applies to the other
deliberate suppressions: Outlook-only paddings and unsafe
direction-flip skips.

- **Structural pin** (`gutterStructurallyPinned`, mjmlProps.ts): MJML bakes
  `600 − 2·gutter` into compiled descendants — a wrapped section's
  `max-width`, or an image/td width sized to fill the frame. Those baked
  widths never move, so SHRINKING the gutter re-centers the same box,
  pixel-identically. A frame Width preset whose gutter is pinned is NOT
  created (the gutter stays literal; top/bottom Selects remain; the inner
  section's own Width is the working control). Zero gutters never pin —
  600px is the natural cap and stays responsive. On the current template
  this suppresses: Video Block (inset) + Countdown Card wrappers (48→504),
  Image (inset) w/ Caption (48→504 image). These pins are INHERENT to MJML
  compilation (verified 2026-08-03): a wrapper always bakes its inner
  section's max-width, and mj-image always bakes a computed px td width —
  they cannot be authored away without giving up the structure. Stat Row
  (off-white) WAS on this list (32→536) until 2026-08-03, when the
  upstream wrapper>section was flattened to section>column (bg/border on
  the column) — color-only inset cards don't need a wrapper, so the
  gutter unpins and a live Block Padding Left/Right field appears.
- **Outlook-only copies**: a padding whose EVERY occurrence sits inside an
  MSO conditional comment or an `mso-*` property would edit Outlook alone —
  invisible in the preview, silently desyncing every other client. No field
  (same reasoning that removed Outlook-only column widths).
- **Inset-box sections** (2026-07-27, `loneFixedPxColumn` in
  `sectionShapes`): a section whose only content is a lone fixed-px column
  (Highlighted Text's 480px green box, Quote Block) centers that column in
  the side-padding slack — symmetric Block Padding Left/Right edits move
  nothing. Those two sides stay literal; Block Top/Bottom and the column's
  own four paddings (the real box inset) keep their Selects: 8 padding
  fields → 6.

Related readability rule: all four padding sides share ONE field-order
rank, so two frames' paddings list contiguously (Block Top/Bottom, then
Column Top/Right/Bottom/Left) instead of interleaving side-by-side.

Known but NOT suppressed (documented trade-offs):

- **Mobile-only CSS pinning**: `.inset-gutter` / `.two-col-column` head
  rules override some paddings with `!important` below 600px. The fields
  work at desktop width — where email is judged — so they stay; just know
  the mobile rendering is fixed by the template's own CSS.
- **Grow-direction asymmetry**: a pinned gutter's WIDEN direction would
  have an effect (it compresses the child); the dropdown is suppressed
  anyway because most of its options would be dead — one working option
  out of five is a trap, not a control.

**Empirical oracle** (`window.__auditPadding()` in dev builds,
src/components/paddingAudit.ts): renders every padding-family Select
option at 600px and geometry-diffs against the default render — the ground
truth the static guards are checked against. Current template: 416/416
fields live after suppression (2026-08-03: the Stat Row flatten added a
live width preset and moved the card's bottom inset onto the button's
Spacing Below). Run it after template-structure changes;
any newly-flagged field means a new mechanism to detect or a candidate to
prune. The Inert Dropdown Audit below generalizes this oracle to every
Select, both viewports, and pixel comparison; `__auditPadding()` remains
the fast padding-family path.

## Inert Dropdown Audit — every Select, pixel ground truth

The geometry oracle covers one family at one viewport. The **Inert
Dropdown Audit** (the `Inert Audit` header button) generalizes it to every
Select replacement: per block × Select × option it renders the block with
ONLY that option applied (every other field at its default) at 600px
(desktop — the `min-width:600px` breakpoint matches at exactly 600) and
375px (mobile), light mode only, and compares raster **pixels** (SHA-256
over the RGBA bytes), not geometry — color and font fields are in scope. A
field is INERT at a viewport iff every option rasters byte-identical to
the all-defaults baseline. Implementation: `src/core/inertAudit.ts`
(classification + the runner — pure, vitest-covered against a scripted
fake engine), `src/components/inertAuditRender.ts` (iframe pool →
`foreignObject` raster → pixel hash),
`src/components/InertDropdownAuditPanel.tsx` (matrix UI + resume),
`src/core/inertAuditReport.ts` (the downloadable markdown matrix).

Determinism contract — what makes the matrix trustworthy:

- Every image reference (`src`, CSS `url()`, legacy VML `background=`) is
  stubbed to a per-URL **tinted** placeholder before load, so network
  variance can never fake a diff (and the canvas is never tainted). The
  tint (hue from the URL's crc32) keeps a genuine image swap visible;
  dimensions come from a one-time-per-run natural-size probe
  (`probeImageDims`), falling back to the referencing `<img>`'s
  width/height attributes, then 600×200 — whatever a URL resolves to first
  is frozen for the whole run.
- The audit head rewrites `prefers-color-scheme: dark` media conditions to
  a never-matching condition (`neutralizeDarkScheme`) — a dark-OS machine
  renders the light-only sweep identically to a light one (a
  `color-scheme: light` style alone does NOT defeat the media query) — and
  freezes animations, transitions, and the caret.
- A settle timeout NEVER falls through to comparison (the paddingAudit
  races resolve-and-continue; here every timeout yields **unproven**,
  retried once). After each block × viewport the baseline is re-rendered
  fresh and must hash identically, or the whole block × viewport is
  downgraded to unproven — determinism is witnessed per block, not
  assumed.
- The engine self-tests at startup (double-render determinism, dark
  neutralization, breakpoint evaluation at 600 vs 375 inside the raster
  context) and REFUSES to run if any tripwire fails — a lying matrix is
  worse than no matrix.

Verdict vocabulary the matrix never conflates: **inert** (proven, per
viewport) · **inert at defaults** (the option's substituted body is
byte-equal to the baseline's — e.g. its tag only exists inside another
Select's non-default conditional fragment; proven without rendering but
only for the current defaults) · **unproven** (a render failed — never
counted as inert). Image-URL-flavored Selects are **static-exempt**
("image swap"): with every src stubbed, a src change is a display change
by definition — and dark-only swaps are invisible in a light-only sweep —
so they are listed for eyeball review instead of render-tested. Display
toggles ARE render-tested and double as positive controls: Exclude
collapses content, so a Display toggle reporting inert is an engine-bug
tripwire, not a finding. Link toggles are render-tested too but EXPECTED
inert — Exclude Link strips only the `<a>` wrapper, which moves zero
pixels — so the matrix annotates them "non-visual by design (href-only)"
rather than presenting them as removal candidates: the control changes
behavior, not rendering (measured on the unified catalog 2026-08-09, all
link toggles inert@both, all Display toggles live). A zero-height render
(a Spacer at `None - 0px`) hashes as a deterministic empty raster —
collapsing a block IS a display change, not an error.

Results persist per row under `localStorage['en-tools:inert-audit:v1']`
(its own key — never inside the project state), keyed by block id +
replacement name and fingerprinted over the block html, the Select's
option values, EVERY sibling default (the baseline substitutes them all),
and the audit head — any render-relevant edit reverts exactly the affected
rows to pending. Runs are cancellable (cancel = pause), resumable across
reloads, and batchable by category chip; Re-import regenerates block ids,
which correctly invalidates everything.

Two pre-registered mechanisms are expected on the mobile axis and are
documented trade-offs, not new discoveries: the `.inset-gutter` /
`.two-col-column` mobile `!important` pinning and grow-direction asymmetry
(see "Known but NOT suppressed" above).

## Dark-Mode Image Audit — every light/dark image pair, ink from pixels

The `Dark Audit` header button runs the dark-mode legibility audit for any
imported project. It answers three questions per block: which images swap
for dark mode (and which merely pretend to), whether each asset's ink can
survive a ground of the opposite polarity, and which combinations deserve
an eyeball in real renders. Implementation: `src/core/darkModeAudit.ts`
(enumeration + classification + flags — pure, vitest-covered against a
scripted fake pixel reader), `src/components/darkModeAuditPixels.ts` (the
browser pixel reader), `src/components/DarkModeImageAuditPanel.tsx` (the
tile table), `src/core/darkModeAuditReport.ts` (the downloadable markdown
work order).

Mechanics, in the order they matter:

- **Enumeration substitutes the whole block html BEFORE tokenizing.** Most
  images never exist as literal `<img>` tags in the canonical string — the
  display-toggle pattern stores entire image fragments inside Select
  defaults, and srcs live in Image/ImageURL defaults. Swap roles are found
  by climbing ancestors from each `<img>` (compiled MJML puts `css-class`
  on the wrapper table, never the img); adjacent light/dark twins pair
  WITHOUT requiring src equality, mirroring the importer's own
  `mergeSwapPairs`. A pair pointing at one file is reported as
  `same-src-pair` — scaffolding that exposes the Dark Mode Image URL field
  but ships no visible swap. This is html-based on purpose: EN imports
  carry no `mjmlSource`, and the audit must work for them too.
- **Four renditions per pair**: the light and dark image, each on a white
  tile and a dark tile. The dark tile defaults to the darkest surface the
  template itself authors (background replacement defaults, background
  carriers in the html, the body background — minimum luma, `#111111`
  fallback) and is overridable in the panel. Tiles are plain `<img>`
  elements — image DISPLAY is CORS-exempt, so they render off any host.
- **Ink classification** runs on pixels (Rec.601 luma, 0–255): >5%
  transparency makes an asset transparent-ink; among its opaque pixels a
  >50% majority above luma 190 is `light` ink, below 80 is `dark`;
  **≥15% of BOTH polarities is `self-contrast`** — the contrast-outline
  signature (a rim in the opposite polarity of the ink), checked before
  the majorities so outlined art never re-flags; the rest are `colored`
  or `opaque`, which carry their own contrast. Pixel reads require a
  CORS-clean fetch, which only the project's Source URL provides (GitHub
  raw serves CORS headers; the asset CDN measurably does not — see the
  asset-currency section below). Without one, ink reports an explicit
  `unknown` with the fix named — never a silent wrong answer.
- **Flags are concerns, never verdicts**: `bg-dependent-ink` (transparent
  ink whose polarity matches what its authored surface inverts TO, with no
  distinct dark artwork — the strongest signal, per the measured guide-§2c
  failure model: Outlook desktop dark inverts surfaces, never images),
  `dark-cutout-on-dark`, `white-chip-on-dark`, and informational
  `orphan-swap-class` / `same-src-pair` / `pixels-unreadable`. The
  markdown report is a work order for an agent in the template repo,
  pointing at the contrast-outline recipe as the proven remedy.

## Viewport-scoped controls — codified audit truths

The 2026-08-09 audit round on the unified catalog (458 Selects, two
byte-identical runs) hardened into policy (user-decided):

- **A Select proven inert at BOTH viewports is removed** — its tag reverts
  to the original value, exactly like a manual delete. Two exemptions
  survive: **Link toggles** (Exclude Link strips only the `<a>` wrapper —
  zero pixels move, but clickability changes: behavior, not rendering) and
  **BACKGROUND colors on blocks that carry background images** (invisible
  under the loaded image, but Outlook desktop does not load background
  images — the color IS the Outlook fallback; carriers = CSS `url()` and
  the legacy `background=` attribute, never foreground `src=`, per
  `blockHasBackgroundImage`). The exemption is `paletteGroup: 'background'`
  only: a TEXT color renders ON TOP of the image, so its inertness is not
  explained by the image failing to load and it stays a finding.
- **A Select inert at exactly ONE viewport keeps working but its LABEL says
  where**: `Desktop ` prefix when it is inert at 375px, `Mobile ` when
  inert at 600px ("Desktop Alignment", "Mobile Spacing Below"). LABELS
  ONLY — merge-tag names never carry the prefix, so exports stay
  byte-stable. `classifyAttribute` and the audit's own family classifier
  read through the prefixes.
- **Unexplained findings are never removed silently.** Removals whose
  mechanism has no codified explanation (today: every color-family removal,
  including the open `text_color`-on-background-image finding) are
  review-flagged and listed default-UNCHECKED in the Apply modal.

Codified STATIC guards (generator-level, so they survive re-import; each
suppression lands in `Block.infoNotes` at 'info' level):

- **Full-width images get no live Alignment**: when an image's rendered
  width meets or exceeds its column's content width at a viewport, `align`
  has nothing to move there. Evaluated per viewport by
  `measureColumnGeometry` (the generalized button-width walk): desktop from
  the 600px column math; mobile from the compiled 375px reality —
  `fluid-on-mobile` images raster 100%-wide, `mj-group` members keep their
  percent widths, everything else stacks to the full frame. Dead at both →
  no field + infoNote; dead at one → the label carries the viewport prefix
  at generation time.
- **Symmetric sections get no Column Order**: a column list whose
  (width, signature) pairs read the same forwards and backwards — the
  `25px spacer | content | 25px spacer` Outlook pattern — makes the swap
  the identity. Skipped + infoNote (the identical-signature skip alone
  misses it: empty spacer signatures differ from the content column's).
- **Column Width is desktop-only, always**: the `.mj-column-px-*` ladder is
  `min-width:600px`-gated, so enumerated column widths label as
  `Desktop Column Width` (`Column N - Desktop Width`) from birth. Names
  keep the unprefixed form (`column_width`).

**Where the labels come from.** The template's own mobile CSS is the
declaration: a property forced with `!important` inside a media query below
the breakpoint cannot be edited there, so a control over it is
desktop-only. `parseMobilePins` reads that from the compiled head the
importer already holds (`shell.beforeBlocks`), `parseAttributeClassDefaults`
adds the template-wide `<mj-attributes>` css-class defaults so an element
with no authored class still matches (TPL gives every `mj-button`
`css-class="button"`, which is why button alignment is pinned everywhere),
and the generator prefixes the label at import. `align`, `width`, `height`
and the four `padding-*` sides map to CSS properties (padding since
2026-08-17, when the flush-mobile rules left eight Block Padding Left/Right
fields mislabeled until the audit caught them); a per-side padding query
also honors a pinned `padding` SHORTHAND, and per-side Selects decomposed
from one `padding` attribute are scoped individually — the flush classes
zero left/right below the breakpoint while top/bottom keep working. An
unrecognized selector pins nothing — it fails closed to a normal always-on
control that the audit can still catch. One deliberate narrowing: a
selector's pin keys on the class tokens of its FIRST compound only. In the
house `.class element` pattern the scope class is always first; taking
every token would over-pin — `.flush-mobile-capflush .wysiwyg { padding-…
!important }` restores copy insets inside flush blocks only, but `wysiwyg`
is the template-wide default on every `mj-text`, and pinning that token
would label every text field in the catalog desktop-only. This is why
viewport labels survive re-import without anyone running the audit and
applying its verdicts by hand. The labels' premise — that the pinning
CSS actually reaches the inbox — is measured, not assumed: EN keeps the
mobile media queries verbatim at send, and the pin rules (`td.button` and
its carrier twin, `.flush-mobile-*`, `.inset-gutter`, `.two-col-column`)
arrive byte-intact in the delivered payload (EoA aafUJU…, 2026-08-18).

Two carriers, one value: a pin only settles the question when it covers
EVERY compiled carrier of the value. MJML writes a button's `align` onto
two cells — the outer `td.button` and the inner cell holding the `<a>` —
so `td.button { text-align:center !important }` centers the pill while a
label that WRAPS keeps its desktop alignment inside it. The template pins
both cells (`td.button table td`, added 2026-08-10); without that second
rule the control measures inert only for short copy and silently comes
back to life when the copy grows, which no label can describe honestly.
When adding a mobile pin, pin every carrier or claim nothing.

**What the CSS cannot say.** Some controls are dead at one viewport for
reasons that are not in any stylesheet: a centered content-sized child
makes symmetric gutters invisible, and a short column's trailing spacing
is absorbed by its taller sibling until the columns stack. Both depend on
rendered geometry, so the importer cannot derive them — the author
declares them with `data-desktop-only-<token>` / `data-mobile-only-<token>`
(see the data-* contract). Declaration beats inference where they
disagree, and the audit checks the claim either way.

**The PASS/FAIL check.** Every audited row carries a verdict of its own:
a field **PASSES** when its measured behavior matches what its label and
kind promise, and **FAILS** otherwise. The rule is defined so that PASS is
exactly "Apply findings has nothing to propose for this row"
(`assessRow` / `planVerdictApplication` share the policy, and a test
holds the equivalence):

- live at both viewports, no viewport prefix → PASS
- inert at one viewport, label names the WORKING viewport → PASS
- inert at both, link toggle or color-under-background-image → PASS
- static-exempt image swap → PASS
- inert at one viewport with a missing, wrong, or stale prefix → FAIL
  (relabel; a "Desktop …" label on a control that is dead at 600px is as
  wrong as no label at all)
- inert at both, anything else → FAIL (remove)
- skipped (no options / one option / all options equal the default) → FAIL
  (nothing to choose)
- unproven → FAIL (could not prove — re-run; never silently a PASS)

The matrix shows it as a Check column with a FAIL-only filter, and the
markdown report carries the column plus a `Checks: N PASS · M FAIL` line.
A catalog is "clean" when every row reads PASS. The goal is that a
fresh import already reads all-PASS without anyone applying anything: the
static guards plus the CSS-derived viewport labels do at import what the
audit would otherwise have to prove and a human apply by hand.

Audit-driven remedies (template-CSS- or content-dependent — not statically
decidable) go through **Apply findings** in the audit panel:
`planVerdictApplication` turns done rows into remove/relabel/keep-exempt
actions; the modal lists them grouped with checkboxes; the applier
(`applyActionsToProject`, wrapped by `applyInertAuditFindings`) reverts
removed tags in the block HTML AND inside every sibling's default/option
values — Display/Link fragments nest sibling tags, which a plain delete
would orphan — then reindexes field order. Known members of this class:
centered-pin gutters (a fixed-px auto-centered child narrower than every
candidate content width — the Logo Hero logo, the Divider rule — where
whether MOBILE releases the pin depends on template CSS), the mobile
centering pins (`td.button` rules), and trailing spacing absorbed by a
taller sibling column at desktop.

## Sections (EN panel groups) & ordering

The panel is a **two-level tree**. **Header sections carry NO glyph** — they
are parents (the block name, and each band); **leaf content groups nest one
level down with the `└─` glyph**. So a band and its content read as
`Section 3` / `└─ Section 3 Text`, never `└─ Section 3` / `└─ Section 3
Text`. One consistent depth, one consistent addressing scheme per block.
Merge-tag NAMES are unchanged by any of this (they stay `block_2_padding_top`,
`text_1_content`, …); only the panel grouping LABELS move, so exports stay
byte-stable. (`resolveSection` in `src/core/mjmlProps.ts`.)

- **Block header = the block's name, always first** — for single- AND
  multi-band blocks (no glyph). It carries block-level frame settings
  (band 1's padding/width/background). Never "Block 1" at the top.
- **Bands** (each mj-section, numbered in document order): band 1 lives
  under the block-name header; **band N>1 heads a `Section N` group (no
  glyph — it is a parent)**, carrying that band's frame settings. (An
  mj-section whose frame fields are all suppressed still anchors its
  content's grouping.)
- **Content groups** are the leaves — always nest with the glyph, addressing
  uniform within the block (never a mix of "Column M X" and a bare "X"):
  - **Single-column**: `└─ <Component>` (e.g. `└─ Text`, `└─ Button`),
    numbered per-component WITHIN THE BAND when repeated: `└─ Text 1` /
    `└─ Text 2`. In a multi-band block the band is prefixed for
    disambiguation: `└─ Section 2 Text`.
  - **Side-by-side columns** (a component maps one-instance-per-column onto
    one row): `└─ Column M <Component>`, uniformly for every component in
    the row (band-prefixed when multi-band: `└─ Section 2 Column 1 Image`).
    (`columnPlacements` + `columnGroupOf`.)
- **"Block N" is retired as a panel label** — it used to name three
  unrelated things (band index, repeated-component index, segmenter
  auto-name) with independent counters that diverged. Bands are now
  `Section N`; component repeats are `<Component> N` scoped to their band.
- **Column/group frame settings**: `Column N Settings` / `Group N Settings`
  (headers, no glyph) only when several coexist; a lone column's frame folds
  into its band's header.
- **All-zero padding is suppressed**: a lone column authored `padding="0"`
  (or a shorthand expanding to all zeros) gets NO Column Padding fields —
  four "None" Selects are redundant noise; the block-level padding is the
  real control. Genuine inset-box columns (non-zero padding, usually with a
  background-color/border) still surface their controls. (`keepsPadding` →
  `isAllZeroPadding`.)
- Image Position / Column Order controls land in their band's frame section
  (block name for band 1, `└─ Section N` beyond).

### Field order WITHIN a section

Sections keep document order; the FIELDS inside each one are sorted into a
logical editing sequence (not raw MJML scan order, which buried Content at
the bottom and split the dark URL from its light twin). The canonical rank
(`FIELD_ORDER` / `fieldPriority` in `src/core/mjmlProps.ts`):

1. **Visibility** — **Display is always first** in its group — it decides
   whether the rest of the group even matters, so it leads.
2. **Primary content** — Content (RTE) · Image URL · **Dark Mode Image URL
   (immediately after its light twin)** · Label · Link URL · Alt Text
3. **Appearance** — Text Color · Background Image · Background Color · other
   colors · Border Radius · Font Size · Letter Spacing · Line Height
4. **Dimensions** — Width in Pixels / button Width · Height
5. **Position** — Alignment · Image Position / Column Order / Direction
6. **Spacing** — Spacing Below · Padding Top/Right/Bottom/Left · Block
   Padding Left/Right (the width preset is a frame control, so it sits
   with padding)

Frame/header sections have no Display toggle or primary content, so they
naturally begin at Appearance (Background Color) and end at Spacing
(Padding sides → Padding Left/Right). Merge-tag NAMES and the HTML are untouched by the
sort — it is purely the panel/export display order.

### Options WITHIN a Select

- **Natural order, default not hoisted**: option lists keep their intrinsic
  order (palette order, font stacks, the pacing/preset scale). An off-list
  custom default (a color not in the palette, a font not in the document) is
  appended at the END, never hoisted to the top. (`resolvePaletteOptions`,
  `fontOptions`.)
- **`(default)` marker**: at export, the option whose value is the current
  default gets a trailing " (default)" on its label — "Centered" →
  "Centered (default)" — so the EN editor sees which choice is the template
  baseline. Applied only at the export boundary (`markDefaultOption` in
  `src/core/export/replacementMap.ts`) and idempotent (a stale marker is
  stripped and re-placed), so the stored replacement and re-imports stay
  clean.

## Labels & names

- Numbered labels use a dash and keep the full property label:
  "Image 1 - Width", "Text 2 - Text Color" (never a collapsed "Text 2 Color").
- Inside a component's OWN section the label is bare ("Display", "Padding
  Top", "Alt Text (Describe the Image)") — the header names the component.
  Fields shown in a FOREIGN group keep their prefix (it disambiguates).
- Merge-tag names always keep the fully qualified numbered form, with
  stutter collapsed: `image_1_url`, not `image_1_image_url`.
- Free numeric px fields keep the "… in Pixels" label suffix — the px unit
  lives in the HTML right after the tag, and editors type bare numbers
  (validator enforces).
- "Container Background Color" reads "Background Color".
- Multi-instance numbering counts only instances that actually surface
  fields; merged swap pairs count once.
- **Block names carry their category, PREPENDED** (2026-07-29): at import
  every block after a "Category — X" divider is renamed "Category — Name"
  so the EN block library reads — and sorts by — the group at a glance
  (`prependBlockCategories`). The divider's `data-category-short` supplies
  the prefix when present ("Text — Heading"); the full category name is
  the fallback. No collision with divider detection, which requires the
  literal word "Category" up front. The prepend happens AFTER replacement
  generation, so the top-level replacement section keeps mirroring the
  PLAIN name — the category never leaks into sections, labels, or
  merge-tag names. Thumbnail slugs/probes and per-block download filenames
  also use the plain name (`blockBaseName`) so existing
  `thumbnail-<slug>.png` assets keep matching. Dividers, pre-divider
  blocks, and user renames are left alone. Declared short names
  (2026-07-29): Headers/Heroes, Text, Buttons, Images, Text and Images,
  Engagement, Utility, Signature, Footer. ("Images and Text" became
  "Text and Images" 2026-08-11, user-decided, so the prefix sorts next
  to "Text" in EN's block lists.) (2026-08-03, user-decided:
  the empty Fundraising & Campaign category was removed and Content
  Features merged into Engagement & Interactive — Progress Meter,
  Countdown Card, and the Content blocks all live under Engagement now;
  the Campaign and Content short names are retired.)

## Replacement typing (what becomes a dropdown)

- **Colors** → Select backed by the project's brand palette (text vs
  background groups), defaults normalized to lowercase hex, authored casing
  kept in `originalValue`. The palette is TEMPLATE-AUTHORED only
  (2026-08-01 QA): a hex enters it via an attribute value or inline style
  in an importable block, or an mj-attributes default. Stripped before
  scanning: `<mj-style>` blocks (the merged stylesheet — client-compat
  shims, dark-mode overrides, and hover states are rendering plumbing,
  never dropdown options), debug-block regions, and data-fully-exclude
  variants (leaf blocks only — container wrappers never match). Border
  colors never feed the palette either — borders export as plain Text
  fields, not palette dropdowns. A color the stylesheet or an excluded
  variant shares with live block markup survives via those occurrences
  (e.g. #8DC63F is authored in blocks, so its dark-mode override in the
  stylesheet costs it nothing).
  The panel's usage badges are **role-aware** (2026-08-03, user-decided):
  each occurrence is classified by the property owning it
  (`countColorRoles`, src/core/colorUsage.ts) — `color:`/`color=` counts
  as text; `background`/`background-color`/`bgcolor`/`fillcolor` as
  background — so a hex living in both palette groups shows different
  numbers per row, and click-to-filter targets that role's block set.
  Borders, shadows, and other roles count in NEITHER badge (the palette
  dropdowns never drive them); their total is named in the tooltip.
- **Fonts** → Select over the document's font-family stacks.
- **Enumerable attributes** (align, vertical-align, direction, target,
  font-weight — keywords normalized to numeric) → constrained Selects.
- **Free numbers** are the exception, not the rule: anything that can be a
  bounded dropdown should be one (2026-07-20 dev call: free-form numbers
  break emails; editors pick named options).
- **Sanctioned free-number "in Pixels" fields** (explicit user decisions to
  leave editable as-is, revisit later if needed): image/divider Width,
  Font Size (must stay editable), Line Height, Letter Spacing,
  Border Radius. Spacing/padding/height NEVER appears as free text.
  Exception: none of these are surfaced on hand-authored `<a>` button-links
  — see "Button-link parity" below.

## Other generated controls

- **Display toggles**: components in a column with ≥2 non-spacer members
  get a "Display" Select — "Include Block" (the full HTML fragment,
  MSO conditionals included, as the option value — EN supports raw HTML
  with nested {replacement~…} tags inside Select option values) /
  "Exclude Block" (comment placeholder). Never on a column's only member.
  `data-no-display-toggle` opts out upstream; complex hand-authored texts
  are skipped with a code comment. Applies template-wide.
- **Dark-mode images**: light/dark swap pairs merge (src EXCLUDED from the
  equality check so differing artwork still pairs); the dark twin's src
  becomes "Dark Mode Image URL" in the light image's group.
- **Link toggles** (2026-07-31, QA-driven): every mj-image with a live
  href gets a "Link" Select — "Include Link" carries the component's
  fragment with its <a> wrapper(s), "Exclude Link" the same fragment with
  each anchor's open/close stripped (the href tag goes with the opener; it
  still resolves via the Include value, which the validator counts).
  Light/dark pairs toggle as one unit. Generated BEFORE Display, so a
  Display fragment nests {replacement~image_N_link} — EN resolves
  option-value tags recursively at that depth, VERIFIED 2026-08-09 with
  the nesting probe (docs/archive/en-nesting-probe.json): the FULL Display ×
  Link matrix ran in one real TPL send, all four combinations rendered
  their exact expected state, zero literal tags. The same send also
  proved the same block added multiple times keeps INDEPENDENT
  Replacement selections per instance. `data-no-link-toggle` opts out
  upstream. Label is bare "Link", sorted directly under Display.
- **Image Position / Column Order** (the content-swap control): exists to
  reverse CONTENT ordering, never to reverse text — so it is generated ONLY
  at the section/column-frame level, never on inner elements like a Text
  (direction:rtl on text re-renders it right-to-left instead of reordering
  anything). Multi-column sections whose columns differ structurally get
  "Image Position" Left/Right (2 cols w/ image) or "Column Order"
  Normal/Reversed. **"Image Position" only when exactly ONE column carries
  an image and the other carries TEXT** — the classic image-beside-a-body-of-
  copy control. Any other pairing (image vs button, image vs image, photo vs
  signature card) is a swap of two peers, and naming that "Image Position"
  describes the wrong thing (2026-08-10, user-reported on CTA Hero (green
  button)). Structurally identical columns are excluded (reversing =
  swapping contents, which per-column fields already allow) — with
  identity judged INCLUSIVE of the structures inside the columns
  (2026-08-11, user-decided): the deep signature covers descendant
  members and their layout attributes, masking only content values
  (src/href/alt/title) and `data-*` annotation
  (`deepMemberSignature`, src/core/mjmlProps.ts). Two plain images side
  by side still count as identical (swap = swap the URLs), but mirrored
  insets, alignments, differing member widths, or per-column colors — a
  logo beside a photo (Logo Hero (w/ image, green)), the Tri-color
  divider's three stripes — make the swap a real layout change and keep
  the control. Also excluded are SYMMETRIC layouts — (width, deep
  signature) pairs reading the same forwards and backwards, e.g. the
  `25px spacer | content | 25px spacer` Outlook pattern, where reversing
  is the identity (2026-08-09, audit-proven; infoNote explains). Grouped
  columns target the mj-group's direction.

  **The value is the whole ROW, twice — not a direction keyword**
  (2026-08-11). The control's two option VALUES are complete compiled
  fragments of the row, one per order, exactly like a Display toggle one
  level deeper. Two failures forced it, both measured 2026-08-10:

  - `align` is PHYSICAL and a direction flip is not. A logo pinned left
    beside a button pinned right points outward as authored; after the flip
    both point INWARD and the content collapses into the middle (CTA Hero
    (green button) lost 238px of span, CTA Hero (logo and background image)
    252px). EN has no expressions, so one Select cannot drive mirrored values
    in two places — but it CAN carry two finished arrangements.
  - Outlook never flipped at all. Its column order lives in the MSO
    conditional `<td>` cells and Word ignores the divs `direction` sits on,
    so the control was silently inert there. Reordering the cells inside the
    fragment fixes Outlook too.

  `reverseCompiledRow` rebuilds the row: each `<td …>` cell descriptor
  travels WITH its column (it carries that column's width and classes, e.g.
  `two-col-column-outlook first-column`, `width:296px`), and only
  `[if mso | IE]` conditionals delimit cells — the `[if !mso]` dark-mode
  wrappers inside a column are carried along untouched. It locks onto the row
  by scanning candidate openers, so an enclosing frame's own wrapper is
  skipped, and returns null on any shape it does not recognise: an
  unrecognised row gets NO control rather than markup the pass did not
  understand. The pass runs LAST so the Link and Display fragments already
  exist and are absorbed into both orders (EN resolves the nesting — proven
  to 4 levels through a real send, 2026-08-11).

  **Alignment is BAKED per order** for box-level pinned members
  (2026-08-11, user-decided): their Alignment field is dropped and the
  literal travels with the column, left in one order and right in the other.
  It cannot be both editable and mirrored — one field resolves to one value,
  so a shared `{replacement~…_alignment}` would put the same physical align
  in both orders and re-create the collapse. `mj-text` is never baked: it
  fills its column, so its align moves glyphs inside a full-width box (a
  photo caption) and neither strands layout nor should flip.

  **Known limit — anything behind another fragment cannot mirror.** A tag
  resolves to ONE value regardless of the selected order, so a pinned member
  whose alignment lives inside a Link or Display fragment (an image with an
  href) keeps a shared alignment across both orders. On CTA Hero (green
  button) the button mirrors and the logo does not. Fixing it would mean
  inlining those nested fragments for pinned members, costing them their
  Link and Display toggles as well — not done; the alignment is adjusted by
  hand for those members after a flip.

  **`data-no-direction-toggle`** remains the upstream opt-out, for a row
  whose mirrored arrangement is a design decision that should ship as its
  own block — already how the catalog handles `Story Card (image left…)`
  vs `(image right…)`.

  **Text-shield invariant**: flipping the frame to rtl only reorders columns
  because MJML re-pins `direction:ltr` on every column div, shielding
  descendants (verified empirically: columns swap x-positions while text
  keeps computed direction ltr). The generator enforces this: a section
  whose columns do NOT all pin direction:ltr gets no swap control at all
  (pacingNote explains) — a swap that mangles text is worse than no swap.
- **Button widths**: Select — "Automatically Resize", 100px steps capped at
  the column's usable content width, "Npx (full width)" at the cap, plus
  Original for off-grid authored widths.
- **Button-link parity** (2026-07-27): hand-authored `<a>` buttons inside
  mj-text expose EXACTLY what real mj-buttons do — Label, Link URL,
  Text/Background Color (+ the width Select where present). Their inline
  typography (font-size/family/weight, letter-spacing, line-height) and
  border-radius stay hard-coded: anchors carry those inline only because
  they can't inherit mj-attributes defaults, and surfacing them gave
  button-links MORE knobs than real buttons (`ANCHOR_STYLE_PROPS`).
  Supersedes the earlier "keep Font Size editable" note for button-links.
- **Column widths: enumerated dropdown for lone inset-box columns ONLY**
  (2026-08-09, closing future-enhancements #1 v1). A section's single
  fixed-px column (Highlighted Text's 480px card) gets a "Desktop Column
  Width" Select (the `.mj-column-px-*` ladder is min-width:600px-gated, so
  the control only acts at desktop — see "Viewport-scoped controls"; the
  merge-tag name stays `column_width`) whose ONE tag is spliced into BOTH
  width copies — the digits of
  the `mj-column-px-N` class suffix on the column div and the `width:Npx`
  in the MSO conditional immediately before it — so the head class rule
  and Outlook move together. Options are the 50px-step widths whose
  `.mj-column-px-N` head class actually exists (derived from
  shell.beforeBlocks at import — an option without a live class would
  render in Outlook alone), capped at the row's available width, plus an
  "Original (Npx)" escape for off-ladder authored widths
  (`fixedPxColumns`, `columnWidthOptions`). The ladder can be CURATED
  (2026-08-09): a per-column `data-width-options="150,250,350"` attribute
  wins, else the template's en-tools-config `columnWidthsPx`, else the
  50px steps. Curation replaces the 50px-step rule but keeps both guards
  — every curated value still needs a live `.mj-column-px-N` head class
  and must fit the row cap; failing values are dropped with an infoNote,
  an unparseable attribute is ignored with an infoNote, and a curated
  list that leaves nothing falls back to the 50px ladder. Eligibility is
  strict and fails closed with an infoNote on any compiled-shape
  mismatch: ungrouped, integer, ≥50px, lone in its section, no
  `data-no-width-toggle`.
  Everything else stays NEVER exposed: side-by-side siblings (PERMANENT
  product decision 2026-08-09 — user-defined widths on siblings have too
  many failure modes; not a v2 candidate), mj-groups and group MEMBERS
  (members compile with computed inline PERCENT widths the splice cannot reach — mobile would
  desync), and all %-widths (`mj-column-per-N !important` head pinning,
  no enumerated path).
- **Spacer-only sections** get no frame padding fields (the spacer height
  is the one knob).
- **Side-by-side columns** get no padding fields; content sub-elements get
  no per-side padding fields (Spacing Below is the only content spacing
  knob).

## The programmatic RAW HTML utility block

Block exports can carry one synthetic block the MJML never authored:
**"Utility — RAW HTML"** (`rawHtmlBlockExport`,
`src/core/export/blockExport.ts`). Its content is exactly
`{replacement~raw_html}` — a single HTML-type Replacement (EN's raw-code
box, a distinct type from RTE's rich-text editor) — so editors can paste
arbitrary markup (probe blocks, one-off embeds) straight into a broadcast
without a template round-trip. Semantics:

- Shown as a visible row at the END of the export panel's block list
  ("generated at export" badge), CHECKED by default — exporting a single
  block no longer silently brings it along; uncheck it like any block
  (2026-08-11, user-decided; supersedes the earlier
  append-regardless-of-selection behavior). "Select all" / "All groups"
  re-include it; a specific group filter drops it (it belongs to no
  group). The per-group ZIP honors the same row and ships it as its OWN
  file (`en-block-utility-raw-html.json`) so bulk imports never
  duplicate it.
- Stamped with the current settings (client, owner, DEFAULT folder — it
  belongs to no category, so per-category folders don't apply).
- Its thumbnail follows the standard base-name convention
  (`thumbnail-raw-html.png` under the asset root). The image itself is a
  designed asset shipped with the App (`public/thumbnail-raw-html.png`),
  not a block render: the Thumbnails ZIP includes that copy, and the
  Missing-thumbnails audit probes for it at the root like any other.

## Template Styles block — head CSS ships as a block (2026-08-10, user-decided)

EN cannot propagate template edits into existing draft emails — a changed
template means recreating every draft from scratch. CSS is the template
part that actually needs post-hoc fixes, so at MJML import
(`extractHeadStyles`, src/core/headStyles.ts) the STYLESHEET TEXT of every
plain `<style>` element in the shell's `<head>` is moved OUT into a
synthetic **"Template Styles"** block placed FIRST in the block list.
Editors drop it in as the first block of every email; a CSS fix then ships
by swapping that one block inside a draft instead of rebuilding the whole
email. (`<style>` inside `<body>` is parsed by all major clients; the
trade-off was accepted deliberately.)

- **Only CSS travels** (2026-08-15, revised when EN's CSS Editor field
  was discovered): the field is `type: "CSS"`, which holds bare rules
  and nothing else, so anything that is markup rather than a rule STAYS
  in the email template — stylesheet `<link>`s (mj-font loaders),
  style-bearing MSO conditional comments
  (`<!--[if lte mso 11]><style>.mj-outlook-group-fix…`), and any
  `<style>` sitting inside a downlevel-revealed wrapper — **both
  spellings**, the comment form `<!--[if !mso]><!--> … <!--<![endif]-->`
  and the bare `<![if !mso]> … <![endif]>` (the tokenizer files the bare
  form as a doctype token, so the two behaved oppositely until
  2026-08-15) — whose whole point is the client targeting that
  unwrapping the rules would discard. The head
  also keeps `<title>`, metas, the MSO OfficeDocumentSettings block, and
  scripts. Those carriers are therefore NOT per-email editable — the
  trade the CSS field buys.
- A `<style media="…">` keeps its condition by being re-wrapped as
  `@media … { … }` on the way out. Dropping the tag without that would
  silently make a conditional sheet unconditional — MJML emits exactly
  one such element, carrying the `.moz-text-html` desktop widths. Its
  condition tracks `<mj-breakpoint>`, so it reads
  `screen and (min-width:600px)` throughout this catalog and
  `min-width:480px` only in a source that leaves MJML's default alone.
- **A sheet containing `@import` is left behind whole**, in the shell.
  `@import` must precede every style rule in its stylesheet, and
  extraction CONCATENATES sheets — MJML emits its reset sheet first and
  `mj-style` last, so a merged `@import` would land mid-sheet and be
  discarded by every parser. Keeping the element intact keeps the
  `@import` first inside its own sheet (2026-08-15). Idiomatic MJML
  never trips this: `mj-font`'s `@import` already rides a
  downlevel-revealed wrapper, which stays behind for its own reason. It
  bites only a hand-written `@import` in `<mj-style>` / `<mj-include
  type="css">` — which is therefore not per-email editable.
- **The block's content is a builder placeholder plus ONE CSS-type
  replacement** (2026-08-11, user-decided — supersedes the CSS-derived
  theme Selects that briefly lived here; the type changed HTML → CSS on
  2026-08-15): `buildStylesBlockHtml()` emits a hidden
  `<span id="head-styles">` and a `<style>` targeting EN's
  `.en__emailbuilder__block` wrapper — inside EN's email builder the
  block renders as a labeled black band ("Email Template — Head CSS
  Styles Block") instead of a zero-height sliver, while at send time the
  span stays display:none and EN's inliner prunes the builder-only rules
  (they match nothing) — followed by
  `<style type="text/css">{replacement~head_styles}</style>`. **The
  block owns that `<style>` wrapper**, because a CSS-type value carries
  rules only. The `head_styles` replacement (type `CSS`, EN's CSS
  Editor; label "Head CSS Styles"; section = the base block name)
  carries the extracted head CSS as its default, values hard-coded — so
  the CSS is self-editable per email, in place, without any template
  round-trip.
- No theme Selects exist on the block: the extracted CSS keeps its
  authored literal values. The shell's template replacements keep only
  what remains inline there: the body/wrapper `background_color`.
- **CAVEAT (2026-08-11, measured; reproduced and scoped 2026-08-13):**
  EN HTML-escapes `>` in the CSS held by an **HTML-type** Replacement
  (`>` → `&gt;`), killing every child-combinator selector silently. Four
  structured sends pinned the trigger down: an **edit** persists the
  escape; import, send, and an untouched open+save are all clean
  (byte-identical payloads). Scope is the Replacement VALUE only — six
  child combinators in ordinary block markup came through raw in the
  same sends. Two measurement traps, each of which cost a round: EN
  PRUNES rules matching nothing (so a `.abcd { color: initial }` canary
  vanishes and looks like a pass), and a plain rule is INLINED (which
  dissolves the selector you are trying to inspect) — canaries must
  match a real element and sit inside a conditional media query. Full
  report and PoC block: docs/en-bug-html-replacement-escapes-css.md.
  The CSS Editor (`type: "CSS"`) was cleared by a live canary
  2026-08-18 (EoA Hd4yy…): the two-rule pair from the bug report, added
  to the Head CSS Styles field, EDITED and resubmitted, delivered `>`
  byte-intact (2 occurrences, 0 escaped) and fired in Apple Mail and
  Outlook.com. The escape is an HTML-type-Replacement defect only —
  which vindicates the 2026-08-15 type change. The authoring ban on
  child combinators stays regardless (guide §2d): the HTML surface
  still escapes, and Gmail/Word add their own reasons.
- Detection elsewhere is content-based (`isStyleOnlyHtml`), never
  name-based — the detector accepts `<style>`s, stylesheet `<link>`s,
  the `#head-styles` marker span, and bare merge-tag text (where the
  head_styles tag stood before the block owned its own `<style>`):
  previews, thumbnails, and the padding audit re-compose the styles
  block into their document `<head>` (`composePreviewChrome`, which
  drops the marker span and lets the head_styles tag substitute
  downstream), so per-block rendering keeps the template styling even
  though the shell head carries only its conditional CSS.
- EN JSON imports are untouched: a template pasted from EN keeps its
  styles wherever they are (round-trips stay byte-stable). Extraction runs
  only when a project is created from MJML.
- The block is named **"Utility — Template Styles"** with
  `category: 'Utility'` — the same shape as "Utility — RAW HTML" — so
  replacement sections and the thumbnail slug still mirror the base name
  via `blockBaseName` (2026-08-11, user-decided). Its EN folder comes
  from the import form's "Utilities" entry when one exists (i.e. the
  source has a Utilities category divider); otherwise default folder. It
  still sits FIRST in the block list, before the first "Category — X"
  divider — but `groupBlocksByCategory` files a pre-divider block whose
  explicit `category` matches a group's short (or full) name into that
  group, so group views and the per-group ZIP put it under Utilities
  (`en-blocks-utilities.json`) instead of Ungrouped (2026-08-11,
  user-decided).
- Its thumbnail is a designed explainer asset shipped with the App
  (`public/thumbnail-template-styles.png`, same visual language as the
  RAW HTML one — dark slate card, green `{ }` icon, "keep it the FIRST
  block" subtitle), used in the thumbnails ZIP instead of a real block
  render: the block's content is an invisible stylesheet, so a render
  would be a blank white card (2026-08-10, user-decided). The ZIP job
  detects the block by content (`isStyleOnlyHtml`), not name, per the
  detection rule above. Falls back to the name card if the asset cannot
  be fetched; the standard `thumbnail-template-styles.png` naming keeps
  probes and uploads working unchanged.
- **The Spacer block gets the same treatment** (2026-08-15,
  user-decided): a block that is nothing but vertical space snapshots as
  an empty card, so the ZIP ships `public/thumbnail-spacer.png` (same
  visual language — dark slate card, green measure-between-two-rules
  icon) instead of a render. Detection is content-based like the other
  two: `isSpacerOnlyHtml` (src/core/blocks.ts) requires at least one
  mj-spacer div (`height` + `line-height` in its inline style) and
  nothing in the block that can put ink on the page — no image, link,
  rule, visible ground or border, Outlook-only art inside a conditional
  comment, or text beyond the hairspace the spacer itself carries.
  Unlike RAW HTML, the Spacer is a real catalog block, so the
  missing-thumbnail probe and the ZIP filename already cover it through
  the normal base-name path.
- **The detector errs toward REJECTION, deliberately.** A false negative
  costs a real render (correct, merely unstyled); a false positive ships
  a card labelled "SPACER" for a block that is not one. The rule that
  forced this: **a coloured ground is ink.** The Tri-color Divider is
  three 4px `mj-spacer` columns whose only content is
  `container-background-color`, so with an image-only ground test it
  read as blank space and shipped the Spacer card under
  `thumbnail-divider-tri-color.png` (caught by audit, 2026-08-15). The
  ground test must NOT be a blanket one, though: white, `transparent`,
  and a merge tag that RESOLVES to either all count as *not* ink,
  because the genuine Spacer's own `<td>` carries
  `background:{replacement~spacer_background_color}` after generation
  and `#ffffff` before it. Also invisible without explicit handling: the
  tokenizer emits an MSO conditional as ONE comment token, so `walk()`
  never enters it and VML/`mso`-only imagery has to be matched in the
  comment text.
- **Classify against RESOLVED values — pass the block's replacements.**
  `isSpacerOnlyHtml(html, replacements)` substitutes defaults before the
  ink test, because by the time a block reaches the thumbnail job the
  generator has rewritten every ground into `{replacement~…}` and the
  literal colours are gone. Skipping this is how the Tri-color Divider
  survived the ground test for one day (2026-08-15): a fixture taken
  from the COMPILED catalog classified correctly while the real,
  generated block did not. **Any test for this detector must use the
  post-generation shape** — a merge-tag fixture with its defaults —
  or it cannot fail. A tag with no matching field stays unresolved and
  counts as unknown, not ink.
- One helper owns the choice for both consumers:
  `shippedThumbnailFor(block)` (src/components/thumbnailRender.ts), used
  by the thumbnails ZIP and by the in-app Replacements Visualizer. They
  drifted before — the ZIP shipped the designed cards while the
  Visualizer rendered the same blocks as blank white tiles.
- The theme merge-tag names stay in `TEMPLATE_REPLACEMENT_NAMES` (now
  including `head_styles`) even though only `background_color` and
  `head_styles` are minted today — content blocks keep reserving the
  whole vocabulary so no block field ever shares a tag with a
  template-level one (the 2026-08-10 shadowing rule; same precedent as
  email_title after its revert).
- **The shipped CSS must contain zero child combinators** — the escape
  above, reproduced 2026-08-13 and triggered by EDITING the field. The
  rule and the escape-safe selector idioms (`.class element` is the one
  form that survives both EN's escaping and Gmail's indifference to
  attribute selectors) are portable and live in the authoring guide
  §2d; the importer's guard is below under Validator.

## Per-send strings the template must NOT own: title, preview text (2026-08-10, user-decided)

One EN template serves many emails. The title and the preview text belong
to a SEND, not to a template, and the sender already types both in EN when
they build the email. A template that carries either one is asking for the
same string twice — and whatever value stays baked in is wrong for every
email after the first.

**The title gets no field, and neither carrier survives**
(`enableShellContentReplacements`, src/core/templateProps.ts). MJML bakes
`<mj-title>` into the shell two ways, and the importer strips both:

- the head `<title>` element, and
- the `aria-label` MJML ≥4.14 mirrors onto the body wrapper div.

The aria-label is the one that actually misbehaves: that wrapper spans the
ENTIRE email, so a screen reader announces the whole body as a single
string that only repeats the title. Removing it is an accessibility gain,
not a loss. Nothing else on the wrapper tag is touched —
`aria-roledescription`, `role`, `lang`, `dir` and the inline style all
stay.

An earlier same-day design made this an `email_title` Text replacement
driving both carriers; it was reverted for the reason above, and
`email_title` left `TEMPLATE_REPLACEMENT_NAMES` with it (nothing mints it
now, so nothing can collide with it).

**Preview text deliberately gets NO replacement.** Measured 2026-08-10 by
sending a blank template (no preheader element in its content) through
Marketing Tools: EN injects its own hidden
`<p style="display:none !important; …">` as the first child of `<body>`,
filled from the email's per-send **Preview Text** setting, and prepends
the same text to the text/plain alternative. A template-authored
preheader (mj-preview output) would sit right after EN's injected one, so
Gmail-style snippets would show BOTH lines. Consequences:

- `<mj-preview>` was removed from the TPL broadcast sources
  (tpl_unified-blocks / mjml_all-blocks / tpl_all-blocks) the same day;
  the autoresponder sources (donation-thank-you, recurring) KEEP theirs —
  they don't go out through Marketing Tools broadcasts.
- The validator warns when a shell still bakes in a hidden
  preheader-shaped element (`validateShell`,
  src/core/validate.ts) and points at the mj-preview removal.
- An earlier same-day `preview_text` replacement was reverted once the
  send test disproved the "EN adds no preheader" assumption.

## Validator (src/core/validate.ts)

- Orphaned `{replacement~…}` tags are errors; tags nested inside Select
  option values count as used and must resolve.
- Select defaults must match one of their options.
- "… in Pixels" fields must hold bare numbers.
- Columns carrying bottom padding get the pacing warning; so do content
  elements carrying TOP padding (the gap belongs to the previous element's
  Spacing Below — top-carriers are self-gated out of the control entirely,
  leaving the spacing hard-coded). These warnings track the upstream
  bottom-only conversion; overlay/background-image insets keep theirs until
  converted or explicitly exempted.
- Editor-safe CSS guard (`validateEditorSafeCss`): every CSS payload a
  block ships is scanned for child-combinator selectors, and each one
  warns. Two carriers, because a Replacement can hold CSS either way:
  `<style>` contents (in the block HTML and inside replacement values),
  and the WHOLE value of a **CSS-type** replacement, which is bare rules
  with no `<style>` to unwrap. The second branch is what covers the
  Template Styles block's `head_styles` field — the largest CSS payload
  the importer emits. It was added 2026-08-15 with the CSS Editor
  switch: the guard had gone blind to exactly the payload it exists for,
  because the head CSS stopped being wrapped in a `<style>` the regex
  could find. EN escapes `>` in CSS text when a code field is edited and
  resubmitted, invalidating the selector (guide §2d); comments are
  stripped before scanning, so a `>` inside a CSS comment stays legal.
- `data-*` contract warnings are whitelisted, never "fixed".

## Import pipeline decisions

- The import form's MJML SOURCE prefills with the TPL master template —
  `https://github.com/4site-interactive-studios/tpl-en-marketing-tools/blob/main/src/tpl_unified-blocks.mjml`
  (`DEFAULT_MJML_URL`, src/core/mjml.ts; 2026-08-10, user-decided) — since
  importing exactly that file is this tool's day-to-day use.
- Compiled HTML is formatted with **js-beautify** before segmentation
  (prettier took ~46s on a ~1MB doc; js-beautify ~60ms). The instrumented
  parallel compile stays unformatted (ordinal matching only). Formatting is
  fail-open.
- Thumbnail probing is async, after load — never blocks the import.
- **One background image = FOUR compiled carriers.** MJML expands a single
  `mj-section background-url` into the div's inline `background:` shorthand,
  the wrapper table's `background=` attribute, a second `url()` in that
  table's style, and a `v:fill src` inside the `[if mso | IE]` conditional.
  A Replacement must tag ALL of them or an editor's image swap lands in
  some clients and not others (Outlook reads the VML, Apple Mail/Gmail read
  the CSS background). Occurrence classification therefore has to see
  through the `url('…')` wrapper: its quote used to hide the declaration
  name, leaving CSS carriers classified as bare `style` and rejected while
  the attribute carriers of the same image bound normally
  (`cssPropertyBefore`, `src/core/replacements.ts`, fixed 2026-08-05).
  Asset-root rewriting already covered all four (`rewriteAssetPaths` is a
  string pass, so MSO comments are not skipped).
- Export panel ZIPs are asset-root-ready: FLAT filenames only (EN CDN
  folders are flat). Six counted buttons (2026-08-04): Block Imagery /
  Block Thumbnails / Block Imagery and Thumbnails, plus Missing variants
  of each. Imagery collects every image the blocks reference (rendered
  defaults + Select option values, so display-toggle fragments and dark
  twins are seen; relative paths resolve source URL first, asset root
  second); combined ZIPs merge both sets with thumbnails winning name
  clashes. Missing ZIPs fetch from the SOURCE, never from the root that
  lacks them.
- **Asset-root checking is EXISTENCE-only** — the line the UI must not
  cross. `findMissingAtRoot` / `probeImage` load `<root>/<filename>` in an
  `<img>`, which CORS never gates, so "is the file there?" is answerable
  against any CDN (verified 2026-08-04: on the TPL Rackspace root
  `facebook.png` probes true while `icon-circle.png` probes false).
  "Are the bytes still current?" is NOT answerable: `fetch` throws,
  `crossOrigin` images fail to load, canvas `getImageData` throws
  SecurityError on the tainted canvas, and resource-timing sizes report
  0. So a present-but-stale file (re-exported artwork under the same
  name) can never be detected client-side — the panel says so plainly
  when nothing is missing rather than implying everything is current.
  Byte diffing would require `Access-Control-Allow-Origin` on the CDN
  container; until then, re-upload the full Block Imagery ZIP after
  changing artwork (uploads are idempotent).
- **Compiled HTML is rejected with a plain-English error.** A `dist/` file
  or GitHub Pages URL segments fine but carries none of the MJML the
  generator reads, and the compiler's own "Malformed MJML" message sends
  people hunting the wrong problem. The analyze step detects a document
  that STARTS with `<!doctype html>`/`<html>` and names the fix, deriving
  `src/<name>.mjml` from a `dist/<name>.html` URL. Detection is on the
  document's opening, NOT on the presence of an `<mjml>` tag — the TPL
  build embeds its raw MJML source inside the compiled HTML for the debug
  toolbar's exporter, so a tag search matches and lets it through.
- **Asset-root staleness is UNKNOWABLE from the browser** — do not try to
  "just download the image and compare" (measured 2026-08-06 against the
  live Rackspace root). A plain `<img>` loads fine, but drawing it to a
  canvas taints the canvas and `getImageData` throws SecurityError;
  `crossOrigin="anonymous"` fails to load at all; `fetch` throws; and
  resource-timing reports `encodedBodySize: 0`. That is the deliberate
  defense against exactly this read, not a bug to work around. Only
  `naturalWidth`/`naturalHeight` survive on a tainted image, which cannot
  catch a recolor at identical dimensions. Hence existence-only auditing;
  the real fixes are CORS headers on the container or re-uploading the
  full imagery ZIP when art changes.
- **Re-import** re-fetches the stored source URL and rebuilds with the
  project's saved settings (folder IDs included). GitHub raw's CDN caches
  ~5 min — a re-import right after an upstream push can be stale once.
- Per-category EN folder IDs: `data-folder` on a block > form input >
  category divider's `data-folder` > default folder. Category dividers are
  `Category — X` blocks; extraction pairs same-name START/END so wrappers
  like "Main Content" don't swallow categories. Counts + a blocks-per-folder
  modal show what lands where.

## data-* contract — full reference

These attributes come from the upstream TPL repo. NEVER remove, rename, or
"fix" them in MJML source, and never flag them as errors. MJML rejects
data-* on its own tags, so the TPL build round-trips them
(`scripts/annotate-excluded.mjs` → compile → `restore-excluded.mjs`); the
importer whitelists all data-*-only MJML validator warnings
(`src/core/mjml.ts` `isDataAttributeWarning`).

- **`data-style-*`** (valueless flags on MJML tags, and on raw `<a>`
  buttons inside mj-text): declare WHICH properties of that element are
  meant to be editor-exposed Replacements. Padding always expands to all
  four (`data-style-padding-top/-right/-bottom/-left`);
  `data-style-dark-mode` marks the dark twin of a light/dark image pair.
  Known variants: align, alignment, alt, background-color,
  background-position, background-size, background-url, border,
  border-color, border-width, color, dark-mode, direction, height, href,
  padding-top/right/bottom/left, src, vertical-align, width. Stripped by
  the compiler. NOTE: the importer currently surfaces properties by
  scanning the MJML itself — these flags are declared intent that agents
  must keep accurate (per TPL PLAYBOOK §6a), not an enforcement input.
- **`data-fully-exclude`** (raw MJML; block-level): the block is a
  redundant variant — dropped entirely at import
  (`src/core/blocks.ts` `isFullyExcludedBlock`), skipped from category
  counts. A family must normally keep ONE un-flagged canonical (the inset
  variant where one exists) — default content is a block's value, so
  structural dedupe alone must not erase a whole family. 2026-07-29
  audit (user-decided): restored canonicals Two-Line Banner (light
  green), Linked Header Row, Body Text (inset), Deadline Panel,
  Subscription Panel; DELIBERATELY fully excluded with no canonical
  (do not re-flag as errors): WYSIWYG Text, Text w/ Bullet Lists,
  Text + Link Paragraph CTA, Linked List Block, Join Links Block.
- **`data-import-exclude`**: dev-only labeling/visual blocks. Ships as an
  mj-raw `<div data-import-exclude>` wrapper so it SURVIVES compilation;
  the block renders in previews but starts unchecked in exports
  (`src/state/store.ts`, `ExportPanel`), with an override warning when
  exported directly.
- **`data-folder="<id>"`** (raw MJML; on category dividers and blocks):
  EN folder routing. Precedence: block's own attr > import-form input >
  category divider's attr > account default
  (`src/core/blocks.ts` `assignBlockFolders`). Divider values prefill the
  import form. Detection is a plain regex over the block's raw source
  fragment (`folderIdOf`), so a block whose only content is an
  `<mj-include>` (the include tag is replaced wholesale when partials
  inline) can carry the attribute on an HTML comment between its START
  comment and the include — `<!-- data-folder="6409" … -->`.
- **`data-category-short="<name>"`** (raw MJML; on category dividers,
  same div as data-folder): the category's short display name
  ("Headers/Heroes" for "Headers and Heroes"). When present it replaces
  the full category name in member blocks' prepended name prefix
  ("Text — Heading" instead of "Text Blocks — Heading");
  folder grouping and the import form keep using the full divider name
  (`src/core/blocks.ts` `categoryShortNameOf`).
- **Reading these flags**: most data-* opt-outs are VALUELESS
  (`data-no-display-toggle`, not `…="true"`). `getAttr` only matches
  name=value pairs and silently returns undefined for a bare flag, so
  detection must use `hasAttrFlag` (`src/core/mjmlProps.ts`), which accepts
  both forms. A bare `data-no-display-toggle` was being ignored entirely
  until 2026-07-31 for exactly this reason.
- **`data-no-width-toggle`** (valueless, on mj-column OR on an
  mj-section/mj-wrapper frame): on a lone fixed-px column it opts out of
  the enumerated Column Width Select — for inset boxes whose width is
  load-bearing design geometry. On a frame it pins the gutter out of the
  Block Width preset Select (the width-preset consumer in
  `src/core/mjmlProps.ts`), the same effect a structurally pinned gutter
  gets automatically. The two consumers are mutually exclusive by
  construction: a block containing any px column never offers the preset.
- **`data-width-options`** (VALUED — the one exception in this family, on
  mj-column): `data-width-options="150,250,350"` curates that column's
  Column Width ladder, overriding en-tools-config `columnWidthsPx` and
  the default 50px steps. Whole px numbers ≥ 50, comma-separated; each
  still needs a live `.mj-column-px-N` head class and must fit the row.
  An unparseable list is ignored with an infoNote.
- **`data-no-link-toggle`** (valueless, on mj-image): opts the image out
  of the auto-generated Include/Exclude Link Select
  (`src/core/mjmlProps.ts` link-toggle generator) — for images whose link
  must never be removable (e.g. a legally required logo link).
- **`data-link-group="<name>"`** (valued, on raw `<a>` tags inside
  hand-authored component markup): sibling anchors in one scanned fragment
  that share a group name and a byte-identical href are ONE logical link.
  The first member mints the URL field (`scanEmbeddedAnchors`); later
  members ride as `extraFragments` on that candidate, and pass 1 splices
  the same tag into every carrier — one value, several carriers, nothing
  to desync (added 2026-08-18 for the Question Block row: EN auto-closes
  an `<a>` wrapping a `<table>`, so the row is per-cell anchors sharing
  a group). Failure modes are deliberate: members with DIFFERING hrefs
  fall back to separate per-anchor fields (fail open — they are not one
  link; TPL `check-catalog` §6 warns), and a member whose compiled
  fragment cannot be resolved drops the WHOLE field (fail closed — a
  partial bind would recreate the desync; every anchor keeps its authored
  href). A lone member is inert and the dead-flag audit reports it —
  raw-element flags are audited by removing the attribute from source AND
  compiled html together, mirroring a real rebuild. Raw-anchor URL fields
  have no Link toggle (that is mj-image-only), so the group has no toggle
  to desync either.
- **`data-no-display-toggle`** (valueless, on content components): opts
  the component out of the auto-generated Include/Exclude Block Display
  Select (`src/core/mjmlProps.ts` columnMembers) — used for
  never-hideable content (sender identification, unsubscribe text,
  required logos, interdependent thermometer figures).
- **`data-no-direction-toggle`** (valueless, on the mj-section or — when
  the columns are grouped — the mj-group that owns the flip): creates no
  Image Position / Column Order control. For a row whose mirrored
  arrangement is a design decision that should ship as its own block rather
  than a toggle. Since 2026-08-11 the control carries both orders as
  fragments and mirrors box-level alignment itself, so this is a taste
  judgement, not a workaround — the automatic suppression it used to
  accompany is gone (see the content-swap control above).
- **`data-no-background-color`** (valueless, on any element with an
  authored `background-color`): keeps the color in the compiled output but
  creates NO editable field. For a background that provably cannot show —
  the tri-color divider's section, whose three columns tile the full
  content width with opaque spacers (audited 2026-08-10; the same partial
  is the Footer's first section, so one flag covers both blocks). Deleting
  the attribute instead would also remove the dead field, but this keeps
  the value as a client fallback. Distinguish from a background that is
  merely covered by an IMAGE — that one stays editable, because Outlook
  desktop does not load background images and the color is what shows
  there (see "Viewport-scoped controls").
- **`data-desktop-only-<token>` / `data-mobile-only-<token>`** (valueless,
  on the element that OWNS the control): declares that the control works at
  only one viewport, and the importer prefixes its LABEL accordingly
  ("Desktop Block Padding Left/Right", "Mobile Spacing Below"). The merge-tag NAME never
  changes. Tokens use the `data-style-*` property vocabulary where one
  exists — `align`, `direction`, `width` — plus `spacing-below` for the
  pacing control. Put the flag on the frame for `width`/`direction`, on the
  content component for `spacing-below`/`align`. This is the channel for
  the cases no static rule can reach:
  - a **centered, content-sized child in a uniformly painted frame** — the
    gutter changes, nothing moves (CTA Button's pill is centered by the
    mobile CSS, so its Width is `data-desktop-only-width`; the single-color
    divider is a fixed 280px centered box at desktop and only stretches
    below the breakpoint, so it is `data-mobile-only-width`);
  - **trailing spacing absorbed by a taller sibling column**, live only
    once the columns stack (`data-mobile-only-spacing-below`);
  - **column order that the mobile stack flattens**
    (`data-desktop-only-direction`).

  A declaration is a CLAIM, not an escape hatch: the audit still measures
  every option, and a false claim comes back as a FAIL on the very next
  run. Where the control is dead at BOTH viewports, use
  `data-no-width-toggle` (frames as well as columns) rather than a scope
  flag — there is no honest label for a control that never does anything.

  These flags are annotation, not structure: the TPL build's subsumption
  normalizer (`scripts/annotate-excluded.mjs`) strips the whole importer
  directive family before grouping, so flagging one variant never orphans
  its `data-fully-exclude` twin.

### Every flag must earn its place — the dead-flag check

A flag the importer ignores is worse than no flag. It reads as a deliberate
decision forever, nothing in the source says it stopped mattering, and it
ships in the compiled HTML of every block that carries it. So the rule is:
**if removing a `data-*` changes nothing, the source should not have it.**

`src/core/flagAudit.ts` proves this per occurrence rather than guessing —
strip the attribute from the block's MJML, regenerate with the SAME config,
instance regions, and viewport declarations, and compare the generated merge
tags, fields, and notes. Byte-identical means the flag earns nothing. It runs
on every import and the findings land in the block's `infoNotes`, so the
validator surfaces them at 'info' level next to the other "why is this field
missing" explanations.

Two rules keep it honest:

- **Scope is the flags the importer READS** (`data-no-*`,
  `data-width-options`, `data-desktop-only-*`, `data-mobile-only-*`).
  `data-style-*` is authoring annotation this generator never consults, and
  routing/segmentation flags (`data-import-exclude`, `data-fully-exclude`,
  `data-folder`, `data-en-path`, `data-category-short`) are read BEFORE
  generation — testing either family against the generator would call every
  one of them dead.
- **A flag name inside a comment is prose, not markup.** The convention is to
  comment WHY a flag is there, and a good comment names it; a match only
  counts inside an opening `<mj-…>` tag.

Single-occurrence removal cannot see flags that prop each other up (two
members each opting out of a control that only exists while one of them is
in), so when a block has several dead flags the check also removes the whole
set at once; if THAT differs, every finding is marked to be removed one at a
time. Same blind spot the single-field dropdown sweep has, same remedy.

Findings on the TPL catalogs (2026-08-10): five dead
`data-no-display-toggle` flags — both texts in the Progress Meter Block
(which generates no Display fields at all), and the light/dark image twins in
the two Footers. **The SECOND twin (by authoring order) of a merged
light/dark pair never gets its own toggle of any kind** — `mergeSwapPairs`
folds it into the first twin BEFORE any opt-out flag on it is read, so every
flag in the `data-no-*` family is inert there. The rule keys on order, not
colour: TPL authors light-first, so today it is always the dark twin, but a
dark-first pair would invert it.

This finding has now recurred twice, which is the real lesson. The
2026-08-10 removal did not survive a catalog file rename, and on 2026-08-16
a fix re-added the flag to a dark twin after reading its absence as a gap —
against this very passage. The 2026-08-17 audit re-found all five; they are
removed again, and the rule now lives where prose cannot lose it: TPL's
`check-catalog.mjs` warns at build time on ANY opt-out flag on the second
twin of a matched pair. (The same session closed two adjacent gaps:
`data-no-direction-toggle` was missing from `IMPORTER_FLAG_RE` — the audit
had never tested it — and from TPL `normalize()`'s strip list, where
toggling it could split a subsumption group.)

## EN's CSS inliner (not optional — measure it, don't fight it)

- **EN always inlines the template's CSS and the behavior cannot be turned
  off** (confirmed with Bryan 2026-08-05; an earlier version of this section
  wrongly told agents to disable it). Anything this template needs in the
  head `<style>` is therefore at the inliner's mercy, and the mitigation is
  to KNOW what it does, not to try to prevent it.
- **What is at stake.** MJML already inlines everything inlinable at build
  time, so what survives in the head `<style>` is precisely what CANNOT be
  inlined: `@media (prefers-color-scheme: dark)`, the `[data-ogsc]`
  Outlook.com branch, `:root { color-scheme: light dark;
  supported-color-schemes: light dark }`, `:hover` affordances, and the
  mobile-only `!important` overrides documented above as load-bearing for
  padding Replacements and column pinning. An inliner that flattens plain
  rules and DROPS the rest removes dark mode and mobile behavior from every
  send while leaving no trace in the block JSON.
- **Diagnostic symptom** (worth recognizing in a QA report): images do NOT
  double up — `.dark-only { display:none }` is inlinable and survives —
  while text stays dark-on-dark and no light/dark asset swap happens. That
  combination means the media queries were stripped, not that the blocks
  are authored wrong.
- **Measuring it**: `docs/archive/en-css-inliner-probe.html` round-trips one
  uniquely-marked probe per construct. Measured 2026-08-07 by saving it as a
  Marketing Tools TEMPLATE and test-sending it. The BLOCK pipeline was
  measured separately on 2026-08-09 and behaves the same way with one
  addition: a `<style>` inside block markup goes through the same inliner —
  plain rules are inlined and the element removed from the body, while
  conditional media queries are kept verbatim but HOISTED into the email's
  head stylesheet, with same-condition queries merged. Hoisting makes block
  CSS global to the whole email, so scope block class names (guide §2):

| Probe | Construct | Verdict | Consequence |
| :---- | :---- | :---- | :---- |
| 01 | plain rule (control) | INLINED | the inliner definitely runs |
| 02 | `:root { color-scheme }` | INLINED onto `<html>` | semantics preserved, survives |
| 03 | `@media (prefers-color-scheme: dark)` | **KEPT** verbatim | dark mode survives |
| 04 | `[data-ogsc] .x` | **DROPPED** | Outlook.com dark branch is lost |
| 05 | `@media only screen and (max-width:480px)` | **KEPT** verbatim | mobile `!important` overrides survive |
| 06 | `.dark-only { display:none }` | INLINED | swap still works — only because 03 keeps `!important` |
| 07 | `:hover` | **KEPT** | |
| 08 | `div[class="x"] { … !important }` | INLINED, **`!important` stripped** | attribute selectors resolve, priority does not |
| 09 | unused rule | DROPPED (pruned) | harmless |
| 10 | `@media screen` (unconditional) | INLINED (flattened) | only *conditional* media queries are retained |
| 11 | MSO conditional comment | **KEPT** intact | Outlook scaffolding is safe |
| 12 | `[data-ogsc]` nested in `@media (max-width)` | **KEPT** | the rescue: nesting saves it |
| 13 | `[data-ogsc]` nested in `@media (prefers-color-scheme)` | **KEPT** | same, inside the dark block |
| 14 | plain inlinable rule nested in a media query | **KEPT, not inlined** | a media query protects ANY rule |

  Structural transformations EN also applies: a hidden preheader `<p>` is
  injected as the first body child; `background-color` in a style attribute
  becomes a `bgcolor` ATTRIBUTE (on `<body>` and `<td>`); the retained
  `<style>` is reformatted and loses `type="text/css"`; head comments and
  `<!--[if mso]-->` blocks survive untouched.

### Authoring rules this forces (all proven by the run above)

- **Any rule inside a retained media query that must beat a base rule needs
  `!important`.** The base rule gets INLINED onto the element, and an inline
  style beats any stylesheet rule that lacks `!important`. The light/dark
  swap survives only because `@media (prefers-color-scheme: dark)` declares
  `.dark-only { display: block !important }` — drop that one keyword and
  dark mode silently stops swapping while everything still looks fine in the
  editor.
- **Do not rely on `!important` that you wrote on an INLINABLE rule.** It is
  stripped during inlining (probe 08).
- **`@media screen` is not a safe hiding place** — unconditional queries are
  flattened and inlined. Only queries with a real condition (`min-width` /
  `max-width` / `prefers-color-scheme`) are retained.
- **A conditional media query is a reliable "do not touch" wrapper** (probes
  12–14, round 2). Anything nested inside one comes back verbatim — even a
  plain inlinable rule (14) and even `[data-ogsc]` selectors that are
  DROPPED at top level (12, 13). This is the escape hatch for any CSS that
  must survive EN untouched.
  - Use a condition that is always true but not statically evaluable:
    `@media only screen and (max-width: 9999px) { … }`. Bare `@media screen`
    does NOT work — it is flattened and inlined (probe 10).
  - **Caveat**: the wrapper also hides the rule from clients that ignore
    media queries, notably Outlook desktop's Word engine. Only park rules
    there when no Word-engine client needs them. `[data-ogsc]` qualifies
    (Outlook.com is a web client and honors media queries); base layout CSS
    does not.
- **`[data-ogsc]` at TOP LEVEL does not survive.** `src/styles.css` carries
  13 such rule blocks — the deliberate Outlook.com dark branch including
  its `.dark-only`/`.light-only` pair. At top level every one is removed at
  send time — the exported template still shows the raw rule, so this can
  only be verified against delivered HTML. **Wrapped upstream 2026-08-07**
  in the sole `@media only screen and (max-width: 9999px)` block in that
  file (grep for it — line numbers here drifted once already and sent a
  reader to unrelated code) so the whole branch now survives; do not
  unwrap it.

## Process

- "Commit" from Bryan means commit AND push to origin/main.
- Upstream template repo:
  github.com/4site-interactive-studios/tpl-en-marketing-tools — authoring
  conventions (bottom-only pacing, the 0/8/16/32/48 grid, columns without
  bottom padding) are enforced there too; template fixes happen upstream,
  then re-import.
- Byte-exact invariant: deleting a replacement restores the original HTML
  via `originalValue` (documented exception: a decomposed padding shorthand
  restores as the canonical 4-token expansion).
- Deferred ideas go to docs/future-enhancements.md with enough context to
  pick up cold.
