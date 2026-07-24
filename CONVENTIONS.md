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

### Lead-in prompt for upstream agents (copy-paste, then attach this file)

> You are working on the MJML source of an Engaging Networks email
> template (repo:
> https://github.com/4site-interactive-studios/tpl-en-marketing-tools —
> blocks live in
> https://github.com/4site-interactive-studios/tpl-en-marketing-tools/blob/main/src/main.mjml
> and
> https://github.com/4site-interactive-studios/tpl-en-marketing-tools/blob/main/src/demo.mjml
> — keep BOTH copies in sync). The attached "Conventions & Business
> Logic" document (public mirror, fetch it if no copy is attached:
> https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/CONVENTIONS.md
> ) is the
> authoring contract for the importer that converts this template into
> EN blocks with auto-generated editable fields. Read the WHOLE document
> first. Then, for the task I give you below, make the template natively
> match the importer's expected outcomes:
> - Vertical pacing is bottom-only, on the declared spacing scale;
>   redistribute rather than change rendering (total inter-element gap =
>   upper.bottom + lower.top must stay identical when moving padding).
> - Never remove, rename, or "fix" any data-* attribute; keep data-style-*
>   flags accurate for every property you touch.
> - If the design genuinely needs values outside the documented defaults,
>   do not ignore the grid — declare the template's own expectations in
>   the en-tools-config head comment instead.
> - Verify when done: grep both copies for content elements
>   (mj-image/text/button/divider) with non-zero TOP padding (only the
>   documented overlay/inset exemptions may remain), for columns with
>   bottom padding (none allowed), and for pacing values off the declared
>   scale.
>
> Task: [describe the change]

## The pacing scale (spacing)

- **None / Half / Regular / Double / Triple = 0 / 8 / 16 / 32 / 48 px**
  (the DEFAULTS — a template can declare its own names, values, and step
  count via en-tools-config, below). Labels carry the px:
  "Regular - 16px". (`src/core/templateConfig.ts`)
- The scale is **closed**: no free-text spacing and no per-field "Original"
  escape. Off-grid authored values **snap to the closest step, ties round
  UP** (24px → Double, 12px → Regular, 10px → Half, 60px → Triple). The
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
  "spacingScale": { "None": 0, "Half": 8, "Regular": 16, "Double": 32, "Triple": 48 },
  "widthPresets": { "Full Bleed": 0, "Regular": 16, "Double": 32 },
  "geometryReachPx": 64
} -->
```

- **Semantics**: `spacingScale` (name → px; needs a 0 step and ≥2 entries;
  names and step count are free) drives every pacing Select's options,
  labels, and snapping targets. `widthPresets` (name → px) drives the
  Block Width dropdown. `geometryReachPx` is the hard-coded-geometry
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
  the value, or change the declaration deliberately (both copies of the
  template, same commit).

## Geometry guard — what never gets a spacing field

Values that are design geometry, not pacing, stay hard-coded with NO field
(never a free-text fallback):

- Frame/content paddings **above 64px** (`SCALE_REACH_PX`): hero photo
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
decided by the template source, not per-block tool logic. Horizontal insets
on content components stay hard-coded (docs/future-enhancements.md #2).

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
  **"Block Width"** Select: **Full Bleed / Regular / Double = 0 / 16 / 32 px**
  per side, plus a per-block **"Original (Npx)"** for off-grid gutters —
  width presets and button widths are the only places Original survives.
- Qualification (`blockSupportsWidthPreset`): every column width-auto or %,
  symmetric decomposable side padding. **Fixed-px-column blocks get NO
  preset** (their columns can't resize — Outlook overflow risk); they keep
  numeric handling via the four-side path.
- One dropdown, not a width+padding pair: auto/% columns follow the padding,
  so the single tag filling both side slots of the composite (mso-padding-alt
  copies included) drives the whole effect.

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
6. **Spacing** — Spacing Below · Padding Top/Right/Bottom/Left · Block Width
   (the width preset is a frame control, so it sits with padding)

Frame/header sections have no Display toggle or primary content, so they
naturally begin at Appearance (Background Color) and end at Spacing
(Padding → Block Width). Merge-tag NAMES and the HTML are untouched by the
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

## Replacement typing (what becomes a dropdown)

- **Colors** → Select backed by the project's brand palette (text vs
  background groups), defaults normalized to lowercase hex, authored casing
  kept in `originalValue`.
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
- **Image Position / Column Order**: multi-column sections whose columns
  differ structurally get "Image Position" Left/Right (2 cols w/ image) or
  "Column Order" Normal/Reversed. Structurally identical columns are
  excluded (reversing = swapping contents, which per-column fields already
  allow). Grouped columns target the mj-group's direction.
- **Button widths**: Select — "Automatically Resize", 100px steps capped at
  the column's usable content width, "Npx (full width)" at the cap, plus
  Original for off-grid authored widths. Button font size stays editable;
  other button typography intentionally left alone (user said hold off).
- **Column/Group widths are NEVER exposed** (px or %): on-screen width is
  pinned by shared-head classes (`mj-column-per/px-N !important`); a
  replacement would change Outlook alone and desync it. See
  docs/future-enhancements.md #1 for the enumerated-dropdown path back.
- **Spacer-only sections** get no frame padding fields (the spacer height
  is the one knob).
- **Side-by-side columns** get no padding fields; content sub-elements get
  no per-side padding fields (Spacing Below is the only content spacing
  knob).

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
- `data-*` contract warnings are whitelisted, never "fixed".

## Import pipeline decisions

- Compiled HTML is formatted with **js-beautify** before segmentation
  (prettier took ~46s on a ~1MB doc; js-beautify ~60ms). The instrumented
  parallel compile stays unformatted (ordinal matching only). Formatting is
  fail-open.
- Thumbnail probing is async, after load — never blocks the import.
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
  counts.
- **`data-import-exclude`**: dev-only labeling/visual blocks. Ships as an
  mj-raw `<div data-import-exclude>` wrapper so it SURVIVES compilation;
  the block renders in previews but starts unchecked in exports
  (`src/state/store.ts`, `ExportPanel`), with an override warning when
  exported directly.
- **`data-folder="<id>"`** (raw MJML; on category dividers and blocks):
  EN folder routing. Precedence: block's own attr > import-form input >
  category divider's attr > account default
  (`src/core/blocks.ts` `assignBlockFolders`). Divider values prefill the
  import form.
- **`data-no-display-toggle`** (valueless, on content components): opts
  the component out of the auto-generated Include/Exclude Block Display
  Select (`src/core/mjmlProps.ts` columnMembers) — used for
  never-hideable content (sender identification, unsubscribe text,
  required logos, interdependent thermometer figures).

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
