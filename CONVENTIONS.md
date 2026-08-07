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
- src/demo.mjml and src/example.mjml are the block catalogs. They carry
  the same block set and the same "Category — X" dividers. KEEP THEM IN
  SYNC: a change to a block in one belongs in the other.
- src/main.mjml is the master template.
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
  deliberately, in both catalogs, in the same commit.
- EN runs a CSS inliner on every template save and it cannot be turned
  off. Any CSS that must survive it untouched has to be nested inside a
  CONDITIONAL media query (bare @media screen does not work). [data-ogsc]
  rules at top level are deleted outright.
- Any rule inside a media query that must beat an inlined base rule needs
  !important. This is what keeps the light/dark image swap working.
- An editable background image must bind ALL FOUR compiled carriers: the
  div's inline background shorthand, the wrapper table's background
  attribute, the second url() in that table's style, and the v:fill src
  inside the [if mso | IE] conditional.

Verify when done, and report what each check returned:
- grep both catalogs for content elements (mj-image/text/button/divider)
  with non-zero TOP padding — only the documented overlay/inset
  exemptions may remain
- grep for columns with bottom padding — none allowed
- grep for pacing values off the declared scale
- grep for [data-ogsc] at top level in styles.css — each one must be
  nested inside a conditional media query
- confirm demo.mjml and example.mjml still carry the same block set
- run the full QA checklist in section 8 of the authoring guide

If you added or changed a convention, say so explicitly so the canonical
documents can be updated. A rule that only lives in a chat transcript is
considered lost.

Task: [describe the change]
```

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
  gutter unpins and a live Block Width field appears.
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
live Block Width and moved the card's bottom inset onto the button's
Spacing Below). Run it after template-structure changes;
any newly-flagged field means a new mechanism to detect or a candidate to
prune.

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
  (2026-07-29): Headers/Heroes, Text, Buttons, Images, Images and Text,
  Engagement, Utility, Signature, Footer. (2026-08-03, user-decided:
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
  Display fragment nests {replacement~image_N_link} — EN must resolve
  option-value tags recursively one level deeper than Display alone
  (verify in EN before relying on it). `data-no-link-toggle` opts out
  upstream. Label is bare "Link", sorted directly under Display.
- **Image Position / Column Order** (the content-swap control): exists to
  reverse CONTENT ordering, never to reverse text — so it is generated ONLY
  at the section/column-frame level, never on inner elements like a Text
  (direction:rtl on text re-renders it right-to-left instead of reordering
  anything). Multi-column sections whose columns differ structurally get
  "Image Position" Left/Right (2 cols w/ image) or "Column Order"
  Normal/Reversed. Structurally identical columns are excluded (reversing =
  swapping contents, which per-column fields already allow). Grouped
  columns target the mj-group's direction.
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
  import form.
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
- **`data-no-link-toggle`** (valueless, on mj-image): opts the image out
  of the auto-generated Include/Exclude Link Select
  (`src/core/mjmlProps.ts` link-toggle generator) — for images whose link
  must never be removable (e.g. a legally required logo link).
- **`data-no-display-toggle`** (valueless, on content components): opts
  the component out of the auto-generated Include/Exclude Block Display
  Select (`src/core/mjmlProps.ts` columnMembers) — used for
  never-hideable content (sender identification, unsubscribe text,
  required logos, interdependent thermometer figures).

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
- **Measuring it**: `docs/en-css-inliner-probe.html` round-trips one
  uniquely-marked probe per construct. Measured 2026-08-07 by saving it as a
  Marketing Tools TEMPLATE and test-sending it (block pipeline not yet
  measured separately):

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
  13 such rule blocks (lines ~212–297, the deliberate Outlook.com dark
  branch including its `.dark-only`/`.light-only` pair). At top level every
  one is removed on template save, so Outlook.com falls back to its own
  auto-inversion. They are contiguous, so wrapping that whole region in the
  media query above rescues all of them — until that lands, treat
  Outlook.com dark mode as not actually deployed.

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
