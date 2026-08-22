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
- src/main.mjml is the master template and the ONLY catalog. Autoresponders
  live in src/autoresponders/, live QA probes in src/probes/ (a directory
  that exists only while a probe does), includes in src/partials/. Pages
  compile FLAT into dist/ whatever subfolder they came from, so every
  downstream consumer keys on the bare filename.
- There is no second catalog. src/mjml_extra-blocks.mjml — the pruned
  remains of the old full catalog — was DELETED on 2026-08-21 once the
  blocks worth keeping had moved into the master, and the file was renamed
  back to main.mjml at the same time. The repo's CLAUDE.md records the exact
  delta and the two versions.json consequences.
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
  channel design intent has into the importer. Keep data-style-dark-mode
  accurate
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
- confirm every block the two catalogs share is still identical (after the
  2026-08-20 prune they share none, so this should find nothing to compare —
  a shared name reappearing means a duplicate crept back in)
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
  "classSpacingScales": { "caption": { "None": 0, "Quarter": 4, "Half": 8, "Single": 16 } },
  "widthPresets": { "Full Bleed": 0, "Single": 16, "Double": 32 },
  "geometryReachPx": 64,
  "brandColors": { "Snow": "#F5FAF1", "Fern": "#39B54A" }
} -->
```

**The comment never ships** (2026-08-20, user decision). MJML passes head
comments straight through, so the compiled `<head>` carried all ~851 bytes of
it into `shell.beforeBlocks` and therefore into the exported template's
`content` — internal authoring configuration sitting in the head of every
delivered email. `stripTemplateConfigComment` removes it at IMPORT, against the
pre-blocks slice, so every consumer of the shell sees the same bytes: the
export, the template preview (`targetHtml`), validation, and the brand-color
usage scan — which had been reading the palette DECLARATION as shell usage of
every brand color. Stripping at export instead would have desynced those
offsets from `shell.beforeBlocks`. The config is parsed from the MJML source
(`project.inputRaw`), never from the shell, so nothing downstream loses it.

- **Semantics**: `spacingScale` (name → px; needs a 0 step and ≥2 entries;
  names and step count are free) drives every pacing Select's options,
  labels, and snapping targets. `classSpacingScales` (optional; class
  name → scale, each validated by the same rules as `spacingScale`)
  scopes an override scale to elements whose `mj-class` OR `css-class`
  list names the key (read quote-agnostically) — options, snapping, and
  snap notes for that element's spacing fields; first declared key wins;
  invalid entries are skipped per class with a parse warning. It covers
  content components' Spacing Above/Below and Insets AND frame padding
  Selects (sections/wrappers/columns, including the vertical Selects of
  the Block Padding composite) — so both inline captions
  (`mj-class="caption"`) and the standalone caption SECTIONS
  (`css-class="block caption"`) ride the same grid. Spacer heights and
  the Block Padding Left/Right preset deliberately stay on the main
  scale/presets. This is how captions ride a Quarter - 4px grid without
  widening every other spacing dropdown (2026-08-18, user-decided).
  **A class scale carries its OWN geometry reach — its top step**
  (`configForAttrs`, `src/core/mjmlProps.ts`; semantics change 2026-08-19,
  user-decided for the CTA Hero reveal). A hero-reveal scale running to
  500px therefore mints a 350px photo reserve as a Select on ITS elements
  while everything unclassed keeps the global `geometryReachPx` — a class
  scale never widens what counts as geometry anywhere else. The declared
  `geometryReachPx` must still cover the MAIN scale's largest step
  (checked unconditionally, even when the key is omitted); class scales
  self-cover and are exempt from that check. Before 2026-08-19 the reach
  was global and the coverage check spanned every scale — an off-scale
  class step used to be impossible. `widthPresets` (name → px) drives the
  Block Padding Left/Right dropdown. `columnWidthsPx` (optional; a non-empty array of
  whole px numbers ≥ 50, e.g. `[120, 240, 480]`) curates the Column
  Width ladder template-wide — see the column-width bullet for the
  precedence (`data-width-options` beats it) and the head-class guard.
  `geometryReachPx` is the hard-coded-geometry
  threshold. `brandColors` (optional; name → hex) declares the brand
  palette: the declared colors join every color group under their
  declared names ("Snow - #f5faf1") — **included even when no block uses
  the color yet** — and censused extras are auto-named by nearest CSS
  color (auto-names never collide with declared names). Invalid hex
  values are skipped per entry with a parse warning. Without the key the
  palette is derived purely from the color census, unchanged.
  (`extractBrandColors`, `src/core/colors.ts`.) Partial declarations
  merge over the defaults per key; unknown
  keys are ignored; invalid keys fall back to defaults with a parse
  warning surfaced in the issues badge.
- **Palette order** (2026-08-18, user-specified — supersedes both the
  declaration-order lead and the earlier hue-band sort): every color
  group renders in a PERCEPTUAL PATH ORDER, dark → light — the shortest
  open path through OKLab (Ottosson 2020 conversion; unweighted
  Euclidean; solved as a cycle with a zero-distance dummy node:
  nearest-neighbor tour, 2-opt to convergence, split at the dummy,
  oriented by endpoint L). Declaration order decides nothing but names.
  This is the default order everywhere the list renders — dropdown
  options, the sidebar palette, exports — with no UI control
  (`orderColorsPerceptually`, `src/core/colors.ts`; acceptance fixture
  in `colors.test.ts` pins total path length and max step).
- **Persistence**: parsed at import, stored as `Project.templateConfig`,
  reused on re-imports and by validation.
- **Out-of-sync flagging**: every import-time snap (authored value ≠
  imported default) and every off-preset gutter is recorded on the block
  (`Block.pacingNotes`) and surfaced by the validator as a warning naming
  the authored value, the declared scale, and what it imported as — the
  burn-down list for bringing the source in line with its own declaration.
- **Rule for agents**: never leave authored values silently off-grid — fix
  the value, or change the declaration deliberately (every src/*.mjml
  that declares one — TPL has four — same commit).

## Head authoring comments never ship

The template `<head>` is where the 4Site templates document themselves —
why there are no `mj-style` `@media` blocks, how the builder bands are
gated, which selectors must never be merged into one list. That prose is
input for the humans and agents working in the MJML repo, not email
content, and MJML passes head comments straight through.

**Head comments are dropped at IMPORT** (2026-08-20, user decision),
by `stripHeadComments` (`src/core/headStyles.ts`), applied to the
pre-blocks slice alongside `stripTemplateConfigComment` — same placement
and for the same reason: every consumer of the shell (the export, the
template preview via `targetHtml`, validation, the usage scans) must see
the same bytes, and stripping at export instead would desync those
offsets from `shell.beforeBlocks`. On the TPL all-blocks template the two
strips together remove **3,590 bytes** from the head of every delivered
email.

**MSO ghost widths are left exactly as MJML emits them** — and the reason is
worth keeping, because the opposite was shipped for a day.

MJML derives the width of the Outlook ghost cell around a column group from
the section's authored gutter (`600 − 2·32 = 536`) and freezes it at compile
time. The importer rewrites the padding value in every carrier,
`mso-padding-alt` copies included, but never a width DERIVED from it — so a
grown gutter leaves a 536px ghost inside a 472px cell. That looked like an
Outlook defect, and on 2026-08-21 an import-time pass (neutralizeGhostWidths,
since deleted — deliberately not cited as a live symbol) rewrote such a ghost
to `width:100%` wherever it stood for a lone 100% column.

**A probe refuted both halves of that** (EoA `VNLmGlXZ…`, archived at
`archive/probes/probe_ghost-width.mjml` in the TPL repo; Outlook 2021 Win11
and M365 Win11 agreed to the pixel):

- **The Word engine CLAMPS a stale ghost to the cell it sits in.** A 536px
  ghost in a 64px-padded cell rendered **472px**, not 536px. Growing a gutter
  was never the defect it looked like.
- **`width:100%` on a nested ghost table makes Word shrink-wrap it.** The
  same 536px band rendered **244px** — just the width of its text. The
  rewrite was a regression, and it was reverted the day it was measured.

Two things follow. The `Unsafe growth` cap below stands, because it exists
for a different failure — fixed-px columns and images that cannot reflow,
which break in CSS clients, not in Word. And both geometry scanners
(`src/core/paddingCap.ts`, TPL `check-catalog.mjs`) now **clamp** a ghost
width to the enclosing cell rather than taking it at face value, which is
what Word does: without that they report an overflow Outlook never has and
would strip padding options from 57 frames for no reason.

KEPT, because they are function rather than prose:

- **Conditional comments**, both downlevel-hidden
  (`<!--[if mso]> … <![endif]-->`) and downlevel-revealed
  (`<!--[if !mso]><!-->` … `<!--<![endif]-->`). Removing either half of a
  revealed pair corrupts the Outlook branches the whole layout rests on.
- **Anything inside `<style>` or `<script>`**, where a legacy `<!--` is
  part of the sheet, not a note about it.

The band sheet's own CSS comments are stripped too — a narrow pass over the
`data-en-tools-band` `<style>` only. That sheet documents itself (which
literal tracks the email width, which guard enforces it) and the note is for
whoever edits the MJML, not for the delivered email. Every OTHER stylesheet
keeps its comments exactly as authored: `styles.css` ships its "NO CHILD
COMBINATORS" warning inside the Template Styles block on purpose.

Blank-line runs in the head collapse to a single newline — both the gaps a
strip leaves behind and the ones MJML's own compile leaves between
`mj-head` children (the gap after the `lte mso 11` conditional). Safe only
because `<style>` and `<script>` are masked out first: inside a sheet a
blank line is formatting, not a gap.

Only the FIRST `<head>` is processed, and the body is left byte-identical
— block comments (`<!-- START: … -->`, the `- Not Displayed` markers) are
untouched, and the segmenter still depends on them.

**Rule for agents**: document the head freely. Prose in `<mj-head>` costs
the delivered email nothing, so the constraint on head comments is
clarity, not byte budget. This matters because the budget is real
elsewhere: EN rejects a message whose `contentHtml` exceeds a measured
**299,760 bytes** with `{"message":"Message contentHtml too long"}`
(2026-08-20 — see the authoring guide for the full measurement).

## Builder-band colors never enter the palette

The builder bands borrow **EN Marketing Tools' own UI colors** — text
`#4e535c` on `#d0d5dd` — so the labels read as an extension of the app
rather than as part of the email (2026-08-20, user decision). That makes
them chrome, and chrome must not reach the email's palette.

`stripNonPaletteRegions` (`src/core/colors.ts`) therefore drops the
`data-en-tools-band` `<style>` before the color census, matched on the
attribute exactly like the head-extraction exemption it mirrors
(`BAND_STYLE_ATTR`, `src/core/headStyles.ts`).

This only became visible when the bands moved OFF `#000000`/`#ffffff`.
Both were already palette members, so censusing them changed nothing;
the greys are not, and without the exemption they surfaced as a text
option and a background option in every color dropdown across the
catalog (measured 2026-08-20 on the unified catalog: text 12 → 11,
background 13 → 12 once exempted).

Verified end to end by importing the unified catalog: each grey appears
exactly twice in `shell.beforeBlocks` — the band stylesheet itself, where
it belongs — and **zero** times in any block HTML, any shell or block
replacement, or `brandColors`.

**Rule for agents**: a band may use any color the EN builder UI uses,
because band CSS is exempt. Everything else in the template still answers
to the brand palette.

## Button-row alignment binds two carriers

A stacked pill row (`.cta-group` inside an `mj-text`) authors its alignment
TWICE: the group div's inline `text-align`, which every CSS client reads,
and `align` on the MSO conditional `<table>`, which is the only one the Word
engine reads. Editing either alone leaves Outlook where it was.

The raw-content scanner mints ONE `text-align` candidate per `.cta-group`
and folds the MSO table in as one of its `extraFragments`, so a single tag splices
into both carriers (`autoEnableReplacements`, `src/core/mjmlProps.ts`;
2026-08-20). `text-align` is already an enumerable property, so the field
ships as a Left/Center/Right **Select** with no extra wiring.

Pairing discipline is the pill-bgcolor rule directly above it, verbatim:

- **zero** MSO carriers — a div-only row has no Outlook copy to desync, so
  the single claim stands;
- **matched** count AND value — bind both;
- **any other** mismatch — mint nothing and leave a note. A partial bind is
  exactly the desync the twin carrier exists to prevent.

It labels **"Alignment"**, not the property-derived "Text Alignment" — the
control moves the whole row, not glyphs inside a box (`labelOverride`,
`src/core/properties.ts`). The property stays `text-align` rather than
inventing one to dodge the label map, which is what keeps the mobile-pin
lookup working on it.

The value belongs to the ROW, not to a button, so it never rides
"Button 1"'s ordinal space: it takes an authored `data-group-label`, or
**"Button Row"** by default. Re-measured 2026-08-21: **one** of the four
CTA Buttons blocks mints it (`CTA Buttons 2x1`), labeled **Desktop
Alignment** — the mobile CSS centres `.cta-group`, so the viewport-scope
machinery says so in the label. The other three are fixed-width or two-line
rows whose pills already fill the frame, so alignment has nothing to move:
`CTA Buttons 3x1 (fixed width)` says so with `data-no-alignment-toggle`, the
other two are suppressed by measurement. The earlier claim of "all four",
and of a "Text Alignment" label, were both wrong — that label is forbidden
by the rule above.

## Image Position option labels follow the rendered side

The Image Position / Column Order Select carries two whole compiled
arrangements, and its option labels used to assume "first column = left".
That is only true left-to-right. `direction:rtl` lays the columns out from
the RIGHT, so the first column is the rightmost one.

Story Card (image on the side) authors the image column first under
`direction="rtl"` — measured at desktop width, the image renders on the
**right** — while the field offered "Left" (the authored order) and
"Right" (the reversed one). Exactly inverted, and shipped that way
(reported 2026-08-20).

The labels are now derived from where the image actually lands:

```
normal renders image LEFT  ⇔  (image column is first) XOR (row is rtl)
```

so a left-to-right row with the image first still reads Left/Right, and the
rtl row reads Right/Left. The authored arrangement stays the DEFAULT either
way — only the words change, so delete-restore is still byte-exact.
**Column Order** (Normal/Reversed) is unaffected: those words describe the
swap itself, not a side, and are direction-agnostic by construction.

## The reversed row's splices and mirrors must be disjoint

Building the reversed arrangement applies two kinds of edit to the same
slice: the row's own `{replacement~…}` splices, and `mirrorEdits` — pinned
regions whose physical `align` is flipped so the mirrored layout does not
collapse inward.

Those two sets MUST NOT overlap, because `mirrorPins` changes LENGTH
(`align="left"` → `align="right"` is one character longer). Apply both and
the later splice's end offset lands short, leaking the tail of the region
into the output.

Containment runs BOTH ways, and only one direction was originally checked:

- a splice inside a mirror region — already baked into the mirrored text,
  so it must not be applied again (this was handled);
- **a mirror region inside a splice** — a Display toggle replaces a member's
  entire `<tr>` with one tag, and the pinned element it mirrors lives within
  that `<tr>`. Mirroring is moot there (the tag overwrites it) but applying
  both is not.

Story Card (image on the side) shipped the second case to EN as a literal
stray `>` in its reversed option — splice `[6178, 7374]` around region
`[6213, 7340]`, measured 2026-08-20. Any overlap now drops the mirror,
leaving `applyToSlice` a strictly disjoint set.

**Coverage note — CLOSED 2026-08-22.** This had no unit test for a long
time: several synthetic fixtures reproduced the Display toggles and the
swap control without ever firing a mirrorEdit, so a passing test proved
nothing. It is now covered the way this note always said it had to be — a
fixture built from the REAL compiled row
(`src/core/__fixtures__/compiled-icon-row.json`, the Icon Row block exactly
as the pipeline hands it to the generator, instance regions included).

The test asserts the invariant that matters rather than a byte string:
**reversal is a PERMUTATION**, so the reversed option must carry the same
multiset of tags as the default. That is what caught the second bug in this
splice — see "Duplicate pinned regions" below — and it fails on the
pre-fix code with `/td: 5 → 6, /table: 4 → 5`.

**Duplicate pinned regions** (2026-08-22, the second bug here). A light/dark
image twin is pinned TWICE: `mergeSwapPairs` folds the pair, so the light
twin's key already carries BOTH regions, while the dark twin still resolves
to its own — and the dark region arrives from both keys. Two identical
mirrorEdits over one range are not idempotent: `applyToSlice` applies them
in turn and the second re-slices a fragment the first already grew,
re-inserting the region's tail. Seven arrangement values shipped an
over-closed table (Icon Row, Podcast Episode, Steps, Feedback Poll ×3,
Signature Card (photo)); in two of them the duplicated tail resumed
mid-`</tbody>` and leaked `</td>body>` / `</td>tbody>` as VISIBLE text in
every non-Outlook client. `pinnedRegions` now dedupes by range, and
`applyToSlice` DROPS an edit overlapping one already applied rather than
corrupting: a dropped splice orphans its tag, which qc-dump and the
validator already report, where malformed markup reaches the inbox
silently.

## Message size is advisory, never enforced

`validateMessageSizeBudget` (`src/core/validate.ts`) sums the shell plus
EVERY block and flags the total against EN's measured `contentHtml` ceiling.

It sums the AUTHORED html, with `{replacement~…}` tags still in it — not the
substituted string EN actually counts. Most block markup lives inside Select
option defaults, so the two differ, and by an amount that varies per block
(Story Card (image on the side) is 543 bytes of html carrying a 2,967-byte
default). The figure therefore under-reports by a structural margin, which
is tolerable only because the check is advisory: it is a rough ceiling, not
a projection, and the doc called it a projection until 2026-08-21.
Substituting first (`substituteReplacements` before `bytes()`) would make it
one — worth doing if the number ever needs to be trusted rather than
glanced at. **It never raises an error** (2026-08-20, user
decision): a real email draws on a SUBSET of the library, so the projection
is a ceiling rather than a prediction, and a catalog template is expected to
exceed it.

| Projected bytes | Level | Reading |
| --- | --- | --- |
| ≤ 285,000 | silent | comfortable |
| > 285,000 | `info` | inside the headroom band; worth tracking as the library grows |
| > 299,760 | `warning` | an email using every block would fail to save |

The point is that an EN Marketing Tools or Marketing Automations buildout
meets the limit while there is still room to plan around it, rather than at
the moment a save 400s behind an error message that says nothing about size.
Bytes are UTF-8, matching how the ceiling was measured
(`EN_CONTENT_HTML_LIMIT` / `EN_CONTENT_HTML_TARGET`, guide §2f).

## Geometry guard — what never gets a spacing field

Values that are design geometry, not pacing, stay hard-coded with NO field
(never a free-text fallback):

- Frame/content paddings **above `geometryReachPx`** (default 64; the test
  is `n <= reach`, so a value EQUAL to the reach is still spacing — which
  is why a Quadruple=64 step and geometryReachPx=64 coexist): hero photo
  reserves (Match Hero 160px), video bands (90–110px). The Image-with-overlay
  350px reserve graduated to a Select on 2026-08-19 via its hero-reveal class
  scale, whose own reach covers it (see the class-scale rule above). In
  composite splices the out-of-reach side stays a literal while in-reach
  sides still get Selects.
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

**`data-inset-toggle`** (opt-in, 2026-08-18): a flagged spacing component
mints its Inset Selects even when a side is 0 — "None" is on the closed
scale, so a flush element (an image caption matching its photo's edge)
stays adjustable without an authoring round-trip. The flag also unlocks
**Spacing Above** (same closed scale, zero included) and relaxes the
top-must-be-0 gate: THE CAPTION PACING EXCEPTION (user-decided
2026-08-18) — a caption owns its gap ABOVE itself (`padding="4px 0 0"`,
image bottom 0), so Display-hiding the caption removes the gap with it
instead of stranding white space under the photo. Photo captions ride
the caption class scale (`classSpacingScales.caption`) with its
**Quarter - 4px** step and default to Quarter (user decision
2026-08-18); before that they authored 8px on the main scale. This is a
deliberate deviation from the vertical-pacing convention (inter-element
space is otherwise the UPPER element's bottom padding) and applies ONLY
to flagged elements; everything unflagged keeps the template-wide gate.
Spacing Above sorts directly before Spacing Below. The pacing VALIDATOR
honors the exception too (user-dropped 2026-08-18): a flagged element's
top padding never raises the "carries top padding — move it up" warning
(`validateColumnPacing`), because the gap is minted as an editable
Spacing Above rather than hard-coded; unflagged elements keep warning.
The flag never
overrides the closed scale (off-scale sides stay literal), never
bypasses the other gates (sole-member consolidation still wins — do NOT
flag a column's only member, the dead-flag audit will report it), and is
strip-tested per instance like every importer flag (`IMPORTER_FLAG_RE`).
Upstream convention: flag pattern-a captions (the mj-text beside its
image in the same column, authored `padding="0"` = flush with the photo,
matching the image's own side padding); the standalone caption SECTIONS
already carry a Block Padding Left/Right frame control and get no flag —
their gap is the SECTION's top padding, authored `4px` on the caption
scale too (the section's `css-class="block caption"` matches the
`caption` key, so its Block Padding Top Select offers Quarter).
The idiom covers caption-LIKE texts too (2026-08-18, user-directed
sweep): a signature card's name/title text under its signature image is
a caption — image bottom 0, text flagged with `padding="8px 0 …"`.
Caption-LIKE texts carry no `mj-class="caption"`, so they stay on the
MAIN scale (Half - 8px, no Quarter) — only true photo captions ride the
finer caption grid. The
mirror case stays put: where the element ABOVE is the hideable one (the
footer's arrow image, a badge above a button), IT keeps its bottom 8px,
because hiding it should remove the gap — same logic, pointed the other
way.
Mobile note: the `.caption` 16px mobile indent overrides the td padding
under 600px, so caption Insets act at desktop.

**Sole-member consolidation** (2026-07-23): when a column's content is a
SINGLE element (Creek Quiz bands, plain text/divider blocks), that element
gets NO Spacing Below — the frame's own padding Selects are the one pacing
control, and a second knob for the same space is duplicative. The element's
authored padding stays hard-coded. Light/dark image twins count as one
member. Mirrors the spacer-only-section and single-member-display-toggle
precedents.

**Every block ends in a gap** (user decision 2026-08-22, REVERSING the
2026-07-23 rule that non-spacer blocks never bake in whitespace spacers).
Each block's last element is a `css-class="spacer-block"` section holding a
lone `mj-spacer`, which mints ONE field — a Height Select on the pacing
scale — and it defaults to **None/0px on every block** (user decision
2026-08-22, settled after one round at 16px). The control exists everywhere
and is off everywhere: an editor turns it on for the stack that needs air.
The reason the old rule existed — an editor should not pay for whitespace
they did not ask for — is met exactly by that default; the reason a gap is
baked in at all is that two coloured blocks stacked in EN ran their grounds
together with nothing between them and no control to separate them.

It was briefly authored at 16px on the 28 blocks carrying a colour or photo
ground. That was reversed the same day: those 28 are structurally
indistinguishable from each other (Deadline Panel and Two-Line Banner are the
same frame, the same full-width band), so any "colour blocks get a gap" rule
either covers all of them or needs a hand-kept list. Uniform 0 is the rule
that survives an editor adding a block. The standalone **Spacer** block is the
exception and keeps its 16px — that block IS the gap.

That gap is authored, not generated. Two carve-outs in the generator make it
free:

- **A gap section is not a band.** `bandSet` skips it, so a one-section block
  stays one-band. Without that, appending a gap flips the block to multi-band
  and renames every tag it owns from `block_*` to `row_1_*` — measured, and
  merge-tag names are byte-stable by contract, so it would rebind every field
  in emails already built on that block.
- **A gap section is not counted for frame numbering** either (`distinct`),
  which is the second path to the same rename: `block_background_color`
  picked up a numeric infix until it was filtered too.

Both gate on the authored **`spacer-block` class**, NOT on "this section
contains only `mj-spacer`". The tri-colour and green-rule divider partials are
also spacer-only sections, but they are decorative BARS, not gaps — the rule
below — and the broader test renamed Event Invite's and both Footers' fields.
A member sitting in a gap section reports band ordinal 0, which the label
paths now read as "no band" rather than printing "Row 0".

Verified across the catalog: 52 fields added (all of them the new Height),
zero removed, zero relabelled, zero renamed.

Decorative color-bar spacers (3–4px, colored backgrounds) are visual elements,
not spacing, and stay.

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

## The content baseline — 64px in, 472px wide

User decision 2026-08-21. Every block's internal content starts at **64px
from the left edge and ends at 536px**, giving a 472px content column —
the WYSIWYG Text block with its Block Padding Left/Right set to
**Quadruple**. That is the default an editor sees; the whole ladder stays
selectable underneath it. 36 blocks moved (32 → 64), and the audit oracle
reads 365/365 live after the move.

Four groups are OUT, and the reasons differ:

- **Headers and Heroes, Footers, Story Cards** (user-named exceptions).
  They keep the 32px gutter. Heroes and footers are chrome, not body copy;
  Story Cards' 240/296 two-column cards cannot take a 64px gutter at all
  (`maxSafeGutter` caps them at 32, and always did).
- **Full-bleed photo blocks** — Image 1x1, Images 2x1/3x1, Photo Banner,
  Photo Banner (w/ CTA), Photo Banner (overlay panel, w/ CTA), Video Block,
  Countdown Block. Their copy is CENTRED over a photo, so a left edge is
  not an alignment anchor there, and the photo is meant to touch both
  edges. **Progress Meter Block is the exception among them**: its
  GOAL / RAISED / REMAINING row is genuinely left-aligned, so it moved —
  by re-cutting its rails (32+536+32 → 64+472+64), not by adding a gutter
  the photo would have to give up.
- **Spacer and the two Dividers.** Nothing to align; a rule that spans the
  full 600 under 64px-inset copy is deliberate.
- **Centred fixed-px boxes** — Quote Block, Highlighted Text, CTA Text
  Block. They reach the baseline by WIDTH, not padding: 480 → 472 centres
  exactly on 64/536. Their side padding stays literal (inset-box
  suppression, below) because a symmetric change to it still moves
  nothing. Highlighted Text's copy sits at 80 — the box's own 16px inset
  is the panel's design, not a baseline miss. Stat Row's card behaves the
  same way, and its card edge now lands on 64.

**Why the default belongs at the TOP of the ladder.** `maxSafeGutter` asks
whether GROWING a gutter breaks the frozen geometry inside it. Authoring at
64 — the largest declared preset — means every remaining option leaves MORE
room than the authored one, so nothing can be withheld. That is what
un-capped ten controls that used to stop at 32 (Icon Row, Steps Block,
Podcast Episode, Podcast Streaming, Feedback Poll, Signature Card (photo),
Video Block (inset), and the two-column rows in Photo and Text Grid and
Quiz Block (2x2 photos)) — each now offers the full scale on BOTH sides,
and every "capped at 32px — 2 option(s) withheld" info note is gone. The
same move retired a latent trap in the other direction: the fixed-width
pill rows offered 48 and 64 while their pills were sized for 32, so those
two options wrapped the row.

**What has to move with the frame.** Three things do not follow a gutter
change and must be re-cut by hand:

1. **Grouped fixed-px rails.** rail + text must equal the frame: Icon Row
   and Steps 120+416 → 120+352, Podcast Episode 112+424 → 112+360, Podcast
   Streaming 380+78+78 → 316+78+78, Feedback Poll 56+480 → 56+416,
   Signature Card (photo) 110+426 → 112+360 (retargeted onto Podcast
   Episode's pair rather than minting two new classes). Any mobile pin in
   `styles.css` naming a changed rail moves with it — `.signature-img`
   110 → 112.
2. **Fixed-px pill rows**, from the formula already carried in their source
   comments: `(600 − 2·gutter − (n−1)·gap) / n`. 3×157 → 3×136, 2×252 →
   2×220, in CTA Buttons 3x1/2x1 (fixed width), CTA Buttons 2x1 (two-line)
   and Quiz Block (3x1 / 2x2 buttons). Each row lands on exactly 472.
3. **Images sized to fill a percentage column**: Photo and Text Grid and
   Quiz Block (2x2 photos) 248 → 228.

**The column ladder got cheaper, not dearer** — 19 distinct widths → 18
(110, 380, 424, 426, 480, 484, 536 out; 64, 316, 352, 360, 422, 472 in),
because the re-cut widths were deliberately shared between blocks. Head CSS
13,853 → **13,670** delivered, headroom against the 14,000 target 147 →
330.

**Mobile is the cost.** A section gutter is inline px and does not scale, so
64px holds below 600px too: measured at a 375px viewport, a rebased block
gives **247px of content** where it used to give 311, and the grouped rows
are tighter still (Icon Row / Steps text column 127px, Podcast Episode 135,
Podcast Streaming 91). `.inset-gutter` — the mobile collapse-to-32 rule that
WYSIWYG Text (inset) demonstrates — is the obvious remedy, but its
`td[style*=direction]` selector is an attribute selector, which is inert in
Gmail (styles.css header note), so applying it catalog-wide would fix every
client except the largest. Left as a stated cost rather than half-fixed.

## Inert paddings — never ship a field that does nothing

A padding field is worthless if changing it doesn't change the rendering,
and it is WORSE than worthless if changing it breaks the layout. Both are
detected statically at import and the field is suppressed or its option
list is trimmed. The reason lands in `Block.infoNotes` and the validator
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
  this suppresses the side gutter on eleven blocks — Logo Hero, CTA Hero
  (w/ heading), Quote Block, CTA Text Block, Image 1x1, Images 2x1, Images
  3x1, Photo Banner, Progress Meter Block, Spacer, Divider (tri-color)
  (measured 2026-08-21). Video Block (inset) and Countdown Block were on
  this list until their gutter moved 48→32 the same day, and the old entry
  read exactly backwards. Video Block (inset) ships a live Wrapper Padding
  Left/Right (now defaulting to 64 and reaching the whole ladder);
  Countdown Block went full bleed later the same day and has no side
  control again — suppressed by the unsafe-growth cap below, not by this
  pin.
  "Image (inset) w/ Caption" was never a block name. These pins are
  INHERENT to MJML
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
- **Unsafe growth** (2026-08-21, `maxSafeGutter` in `src/core/paddingCap.ts`):
  the mirror image of the structural pin, and the one with teeth. The pin
  asks whether SHRINKING the gutter moves anything; this asks whether
  GROWING it breaks anything. A frozen `mj-column width="240px"`, or an
  image sized to fill its column, cannot follow the padding — so past a
  point the inline-block columns no longer fit and the row wraps, turning a
  two-column card into one column in every CSS client while Word refuses to
  shrink its ghost cells. Every option above that point is dropped from the
  Select; when only the authored value survives, no field is created at all
  and the gutter stays literal. The measurement is check-catalog's own
  `column geometry check` ported into the importer and re-run once per
  candidate value, plus an image rule that guard did not have (mirrored back
  into it, so the two cannot disagree). **Every live copy of the padding
  moves together**: one tag can fill two frames' composites — a hero's outer
  wrapper and its inner image wrapper — and substituting only the first
  understates the shrink by a whole gutter per extra frame (found by the
  rendered oracle on 2026-08-21, after the static scan had passed a 154px
  logo overflowing at Quadruple).

Related readability rule: all four padding sides share ONE field-order
rank, so two frames' paddings list contiguously (Block Top/Bottom, then
Column Top/Right/Bottom/Left) instead of interleaving side-by-side.

Known but NOT suppressed (documented trade-offs):

- **Mobile-only CSS pinning**: `.inset-gutter` / `.two-col-column` head
  rules override some paddings with `!important` below 600px. The fields
  work at desktop width — where email is judged — so they stay; just know
  the mobile rendering is fixed by the template's own CSS.
- **Grow-direction asymmetry**: a pinned gutter's WIDEN direction does have
  an effect — it compresses the child — but the dropdown is suppressed
  anyway because most of its options would be dead, and one working option
  out of five is a trap, not a control. Since 2026-08-21 the widen direction
  is also the DANGEROUS one, and is bounded independently by the unsafe-growth
  cap above: compressing a child that cannot compress is what wraps a row.

**Empirical oracle** (`window.__auditPadding()` in dev builds,
src/components/paddingAudit.ts): renders every padding-family Select
option at 600px and geometry-diffs against the default render — the ground
truth the static guards are checked against. It returns a fourth verdict
besides inert/partial/live: **overflow**, meaning an option BREAKS the
layout rather than merely failing to change it. That is stated as a FIT
test — do a row's columns sum wider than the row? — because counting
distinct column tops cannot tell a wrap from a taller neighbour, and moves
on every vertical Spacing Below when the columns are stacked (10 false
positives, 2026-08-21). An `overflow` row means `paddingCap.ts` let through
a value it should have withheld. Current template (main.mjml,
2026-08-21, after the 64px content baseline): **365/365 fields live, zero
inert, zero overflow** after
suppression and capping. Run it after template-structure changes;
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
the all-defaults baseline.

**Every cell renders under THREE copy states** (`AUDIT_COPY_PROFILES`, in
this order):

1. `as-authored` — the copy the template actually ships, untouched. Without
   it the sweep would only ever judge a control against invented text and
   never against what is really in the catalog.
2. `single-line` — short enough to sit on one line.
3. `wrapped` — long enough to wrap onto a second line in any container the
   catalog has, including caption type at 10px.

A control is inert only if it moves nothing under **all three**. The two
substituted states exist because an editor can type copy of any length: a
control that only bites at one end of that range is NOT dead, and
discarding it would remove something the user can still reach (user
decision 2026-08-19).

The per-state hashes are JOINED into one composite, so equality still means
"identical" and every downstream consumer — storage, resume, the report,
`assessRow` — is untouched. "If not already single-line / not already
wrapped" is handled by EXACT-BODY dedupe in `renderComposite`, never by
guessing: when two states substitute to a byte-identical body — a block with
no copy-bearing field, or authored copy that already equals a probe — they
collapse to one render, so such blocks cost exactly what they did before
copy states existed. What dedupe cannot see is authored copy that already
happens to wrap at a given width, since wrapping is a property of the render
and not of the string; that case pays one extra render rather than risking a
wrong verdict.

This exists because the placeholder copy was hiding live controls.
Measured 2026-08-18: of five fields the sweep called "dead — no option
changes any pixel at either viewport", FOUR were live as soon as the copy
was longer than the catalog's own placeholder. A Block Padding Left/Right
control cannot move a CENTRED "Lorem Ipsum" — the preset shrinks both
sides equally and the centre of a short line never moves (ink fixed at
540,740 across every option) — but with a full sentence it re-wraps and
the ink travels 382,898 → 473,807. A Padding Right control beside a
LEFT-aligned heading has 263px of empty space to eat before it reaches the
words. Short copy hides any control whose only job is to move an edge the
text never reaches, and the failure is silent: the row reads as a dead
control and invites someone to delete a perfectly good field.

`applyCopyProfile` swaps the copy but keeps every tag and inline style, so
heading level, font size and colour survive — the probe must measure the
element an editor actually sees. Only `Text` and `RTE` fields are
rewritten. A block with no copy-bearing field compiles the same body under
both profiles and the runner dedupes it, so those blocks cost exactly what
they did before; `auditRenderCount` still multiplies by the profile count
because it is an honest ceiling for the ETA, not a prediction. Editing
`PROBE_COPY` invalidates every stored row through
`auditContextFingerprint` — a resume must never compare hashes taken under
two different sentences.

Implementation: `src/core/inertAudit.ts`
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
- **Caching is allowed only on the exact input, never on a digest of it.**
  A key weaker than the input could collide and silently corrupt a verdict.
  Three caches qualify, and they are the same premise the "inert at
  defaults" short-circuit already rests on — the raster is a pure function
  of the substituted body at a fixed viewport: identical body strings within
  one block × viewport render ONCE (`runInertAudit`); `stubImages`
  memoizes body→stubbed-body once the placeholder map has frozen; and the
  raster tail is skipped when the serialized SVG is byte-identical to one
  already hashed at that width. Only `ok` outcomes are reusable — a failed
  render is evicted so the next cell needing it gets a fresh attempt.
  **The baseline re-verify passes `bypassCache` and therefore reads and
  writes none of them**; a cached witness is not a witness.
- **Parallelism is a timing knob, never a verdict knob.** The two viewports
  run concurrently and option cells run `concurrency`-wide against an
  iframe pool of the same size. Contention can only make a render slower,
  and a slow render times out to unstable → one retry → **unproven**. The
  failure direction is one-way: starving a render can never manufacture an
  `inert`. Each viewport still re-verifies its baseline strictly AFTER its
  own cells drain, so "the baseline hashed the same before and after this
  block's renders" keeps its exact meaning.
- **The concurrency default is 1, and raising it does not help.** Measured
  by the Speed Test on a real foreground tab (12-core Mac, 101 catalog rows,
  2060 renders per pass): **1-wide 20.73s · 2-wide 19.21s · 4-wide 20.62s ·
  8-wide 21.31s** — eight is SLOWER than one, and all four passes returned
  the same verdict digest. The cause is in the same report: cumulative
  `load` rises 11.8s → 98.4s from 1-wide to 8-wide while wall clock stays
  flat, so each render gets ~8× slower when eight run at once. Iframe parse,
  layout and the foreignObject raster all run on the renderer main thread —
  there is no idle time for a second worker to fill, and a wider pool only
  time-slices the same thread. **An earlier 6.37× reading was an artifact of
  a THROTTLED background tab**, where clamped timers give every render a
  fixed latency floor that overlapping can hide; that floor does not exist
  in the foreground. Never raise this default on the strength of a hidden-tab
  run. The panel control persists per machine under
  `en-tools:inert-audit:concurrency:v3` — machine-local, so deliberately NOT
  in `Settings`, which travels with the project — and is written ONLY on an
  explicit edit: storing it on mount (as it did briefly on 2026-08-19)
  stamps the current default into every browser that opens the panel, after
  which no later default change can reach them.

Three report downloads, strictly nested — **full** ⊇ **Findings Only** ⊇
**Failed Only** — each on its own filename so they can sit side by side.
Findings Only is everything not fully live (dead options, unproven) plus
anything the checks failed. **Failed Only is narrower than "every FAIL": it
is the fields dead at BOTH viewports that nothing excuses** (user decision
2026-08-19) — the removal candidates. It therefore drops three things
Findings keeps: a field dead at only ONE viewport whose label already says
so (working as designed), a mislabelled-but-working control, and an unproven
row (not proven dead is not dead). It also drops the deadness the audit
expects and PASSES — link toggles, which strip only an anchor wrapper and
move zero pixels, and a text colour under a background image — because an
actionable list must not carry known-fine rows. Any filtered report states
its scope and its share of the total in the header, so a short file is never
mistaken for the whole audit. Scope selection is `selectReportScope` /
`isDeadAtBothViewports` in `src/core/inertAuditReport.ts`, vitest-covered
including the nesting property.
The **Speed Test** button turns that claim into a measurement instead of a
promise. It runs the same cold "0 → 100 rows" scope once per `Parallel`
setting (1, 2, 4, 8), each pass re-enumerating rows and building a fresh
engine, and downloads a markdown report — wall clock, render throughput,
per-stage breakdown, and **a verdict digest per pass**. The digest is the
reason it exists: speed numbers are only worth reporting if every pass
produced the same matrix, so the report states agreement outright and says
DIVERGED (loudly, as a correctness bug rather than a speed result) if any
setting disagrees. An unreported warm-up pass runs first so one-time costs —
JIT, and the engine's per-URL image probes, which hit the network once and
are then HTTP-cached — do not land on whichever concurrency went first.
Engine setup is timed separately from the run, because building N iframes
and running the startup tripwires is not what the sweep costs. The whole
thing runs in memory and never touches the resume store. Implementation:
`src/core/inertAuditBench.ts` (pure, vitest-covered — including a test that
a concurrency-dependent verdict IS detected). Reports from a hidden or
backgrounded tab carry a banner saying so: a throttled tab clamps timers and
stops frames, and its numbers describe the browser, not the audit.

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
  A THIRD exemption joined them 2026-08-18: **an Inset whose opposite side
  is live**. `data-inset-toggle` mints the pair together, and only the side
  the copy is pushed away from can move it — a right-aligned caption cannot
  be moved by its left inset. That is the element's CURRENT Alignment
  talking, not a broken control: flip Alignment and the dead side comes
  alive. Without the exemption the pair returns as a FAIL on every sweep
  with no honest fix available (5 such rows in the go-live sweep). A pair
  dead on BOTH sides still reports.
- **A viewport qualifier counts wherever it sits in the label**, not only
  leading (2026-08-18): the enumerated column ladder instances its label as
  "Column 1 - Desktop Width" and is desktop-only by construction, so an
  anchored `^` check read it as unqualified and proposed "Desktop Column 1
  - Desktop Width". `labelViewport` / `stripViewportPrefix` read the word
  anywhere; a qualifier that CONTRADICTS the measurement is still corrected.
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
would label every text field in the catalog desktop-only.

**A pin must reach the BOX the control edits** (2026-08-18, a second
narrowing from the same family of mistakes). Rules come in two forms and
they are not interchangeable: a SELF-form rule (`.caption`, `td.button`)
pins the element that carries the class, while a SCOPE-form rule
(`.flush-mobile-capflush td`) pins boxes NESTED inside it. That matters
because MJML puts a section/wrapper/column `css-class` on the outer
`<div>` while the authored padding lands on an inner `<td>`. So
`parseMobileScopePins` keeps only the scope-form rules, and:
- a FRAME's padding Selects consult the SCOPE map against the frame's own
  classes (its padding cell is nested inside its own classed div) — the
  Block Padding Left/Right preset included, which had never asked at all;
- a content element's INSETS consult the SCOPE map against its ANCESTOR
  frames' classes, plus the self map for a rule that names it directly —
  that is how `.flush-mobile-capflush td` reaches a caption cell whose
  only class is the template-wide `wysiwyg` default;
- everything else keeps asking the self map, unchanged.
Reading self-form rules as if they scoped the inner cell is what stamped a
false "Desktop Padding Right" on the Video Blocks: `.caption` indents the
caption section's div and cannot pin its padding control. This is why
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

Reworked 2026-08-19 (user-decided, all four dials): **group words are
role-aware, structural attribution is uniform, numbering is scoped to what
the editor sees, the `└─` glyph appears only under a REAL parent header
(Variant A), and MERGE-TAG NAMES FOLLOW THE LABELS** — the panel and the
tag vocabulary can no longer drift apart (the old contract kept names
byte-stable while labels moved; that ended with the catalog-wide rename,
one version bump per block). EN emails built on previously imported blocks
are untouched — their copies carry the old tags; the new names take effect
on the next block/template import. (`memberIdentity` + `resolveSection` in
`src/core/mjmlProps.ts`.)

- **Group words (roles)**: an authored `data-group-label` wins verbatim on
  any content element ("Quote", "Episode Title", "Row Link"). An `mj-text`
  otherwise infers: a `cta-group` pill row → **Button Row** (its only
  own fields are the row's Spacing Below/Display — the embedded pills
  still mint their own Button groups); lone `<h1>`–`<h6>` (markup inner
  allowed) → **Heading**; a `caption` class token (mj-class or css-class)
  → **Caption**; all-`<p>` prose → **Paragraph Copy**; anything else
  stays **Text**. Other components keep
  their component word (Image, Button, Divider…). Roles number in their
  own ladders — a Heading never consumes a Text ordinal.
- **Block header = the block's name, always first** — for single- AND
  multi-band blocks (no glyph). It carries block-level frame settings
  (band 1's padding/width/background). Never "Block 1" at the top.
- **Bands** (each mj-section, numbered in document order): band 1 lives
  under the block-name header; **band N>1 heads a `Row N` group (no
  glyph — it is a parent)**, carrying that band's frame settings, whose
  merge tags read `row_2_padding_top` (was `section_2_…` until 2026-08-21,
  and `block_2_…` before that). The band word is **Row**, not Section: an
  mj-section is MJML vocabulary, and what an EN content editor is actually
  looking at is a row of the block (user decision 2026-08-21). The rename
  moved 438 merge tags across 15 blocks. (An
  mj-section whose frame fields are all suppressed still anchors its
  content's grouping.) Twin frames with IDENTICAL authored values each
  claim their own copies: frame occurrence-matching partitions the
  document into per-frame territories (own element plus its preceding
  MSO ghost copies), fixed 2026-08-19 — before that the first section
  claimed every copy and its identical sibling minted no frame fields
  at all (the Photo and Text Grid's field-less Row 3). A territory is
  bounded at the frame's OWN element end, never the document end: the
  copies it exists to reach are emitted BEFORE the element, so only the
  backward extension is load-bearing. Territories partition per KIND, so
  a lone `mj-wrapper` extended to the document end still outran every
  later `mj-section` — Video Block's wrapper swallowed its sibling
  caption section (both authored `padding="0"`) and that row minted no
  padding fields at all, while its inset twin, whose caption is authored
  differently, minted all four (fixed 2026-08-21).
- **Content groups**: in a **single-band block they carry NO glyph** —
  `Heading`, `Text`, `Column 1 Button` sit directly under the block header
  (the glyph implied a hierarchy that wasn't there). In a **multi-band
  block they nest under their band with the glyph**: `└─ Row 2 Text`.
  An AUTHORED group word stands alone even there (`└─ Episode Title` — the
  author chose a globally meaningful name, no Row tag). A **defaulted**
  role word does NOT get that exemption — it is only the component's
  display word, so it stays band-scoped. The button row's `Button Row`
  is defaulted unless `data-group-label` names it, and while it was
  exempt one row of pills split across two panel groups reading alike:
  `└─ Row 2 Button Row` (Spacing Below) and a separate unscoped
  `└─ Button Row` (Desktop Alignment, sorting dead last). Fixed
  2026-08-21; the merge-tag name is deliberately unchanged, since the
  sibling pill tags it belongs with are unscoped too.
- **Column attribution is uniform**: whenever a role family spans 2+
  columns of its band, EVERY member of that family carries its column —
  `Column 1 Heading` / `Column 2 Heading` — whatever the per-column count
  (the old one-per-column gate orphaned Story Card 2x1's second column as
  "Text 3"/"Text 4"). Ordinals count within (band, column, role):
  `Column 1 Text 1` / `Column 1 Text 2`.
- **Names mirror the group + property**: `column_2_heading_content`,
  `row_2_text_content`, `quote_content`, `quote_mark_image_url`
  — always derivable by reading the panel. Reserved-name collisions (the
  template-wide `text_color`) fall back to the un-deduped property words
  (`text_text_color`), never a phantom instance number (was `text_2_color`
  with no "Text 2" anywhere).
- **"Block N" is retired as a panel label** — bands are `Row N`;
  component repeats are `<Role> N` scoped to their band and column.
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
  (block name for band 1, `└─ Row N` beyond).

### Field order WITHIN a section

Sections keep document order; the FIELDS inside each one are sorted into a
logical editing sequence (not raw MJML scan order, which buried Content at
the bottom and split the dark URL from its light twin). The canonical rank
(`FIELD_ORDER` / `fieldPriority` in `src/core/mjmlProps.ts`):

1. **Visibility** — **Display is always first** in its group — it decides
   whether the rest of the group even matters, so it leads.
2. **Primary content** — Content (RTE) · Image URL · **Dark Mode Image URL
   (immediately after its light twin)** · Label (and a two-line pill's
   `Label Line 1` / `Label Line 2`, which rank WITH `Label` — they are the
   same copy, and until 2026-08-21 they took the catch-all rank and sorted
   below both colour pickers in all six two-line groups) · Link URL · Alt
   Text
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
- Merge-tag names mirror the panel path (2026-08-19): group word(s) +
  scoped ordinal + property, with stutter collapsed — `column_1_image_url`
  (not `…_image_image_url`), `heading_level` (Heading + "Heading Level"),
  and a multi-word role ending with the property's first word collapses it
  once: "Row Link" + "Link URL" → `row_link_url`.
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
  Countdown Block, and the Content blocks all live under Engagement now;
  the Campaign and Content short names are retired.)

## Replacement typing (what becomes a dropdown)

- **Colors** → Select backed by the project's brand palette (text vs
  background vs border groups — border added 2026-08-18, user-decided),
  defaults normalized to lowercase hex, authored casing
  kept in `originalValue`. The palette is TEMPLATE-AUTHORED only
  (2026-08-01 QA): a hex enters it via an attribute value or inline style
  in an importable block, or an mj-attributes default. Stripped before
  scanning: `<mj-style>` blocks (the merged stylesheet — client-compat
  shims, dark-mode overrides, and hover states are rendering plumbing,
  never dropdown options), debug-block regions, and data-fully-exclude
  variants (leaf blocks only — container wrappers never match). Border
  colors census into the border group only — the standalone
  `border-color` property, plus the hex inside compound values
  (`border="1px solid #hex"`, per-side variants) — never into text or
  background, so a hairline can't become a "brand" background.
  `border-color` replacements are Selects backed by the border group
  (they drew from the background group before 2026-08-18); compound
  `border` attributes still export as plain Text fields — a compound
  value can't be a color dropdown. A color the stylesheet or an excluded
  variant shares with live block markup survives via those occurrences
  (e.g. #8CC63F is authored in blocks, so its dark-mode override in the
  stylesheet costs it nothing).
  The panel's usage badges are **role-aware** (2026-08-03, user-decided):
  each occurrence is classified by the property owning it
  (`countColorRoles`, src/core/colorUsage.ts) — `color:`/`color=` counts
  as text; `background`/`background-color`/`bgcolor`/`fillcolor` as
  background; `border-color` and open compound border values as border —
  so a hex living in several palette groups shows different
  numbers per row, and click-to-filter targets that role's block set.
  Shadows, gradient stops, and other roles count in NO badge (the palette
  dropdowns never drive them); their total is named in the tooltip.
  Projects imported before the border group existed have no stored
  `border` list — every consumer treats a missing list as empty, and a
  Re-import materializes it.
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
  "Exclude Block" (comment placeholder). Never on a column's only member —
  UNLESS that member asks, with `data-display-toggle` (2026-08-20). That flag is
  the single opt-IN in a vocabulary of opt-outs, and it exists because the
  header/hero blocks put a logo in one column and a lone CTA button in the
  other: both are sole members, so neither could be hidden, and the guide
  forbids adding filler to reach the threshold. The >=2 rule is otherwise
  unchanged. `data-no-display-toggle` BEATS it on the same element (the exempt
  check runs first), and on a light/dark pair the flag must sit on the FIRST
  twin — `mergeSwapPairs` folds the second in before its own flags are read.
  `data-no-display-toggle` opts out upstream, `data-display-toggle` opts a sole
  member in; complex hand-authored texts
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

  **It DEFAULTS to "Exclude Link"** (user decision 2026-08-21, a
  safeguard). A block pulled from the library arriving pre-linked sends
  whatever URL the template author happened to type — a placeholder, or a
  URL right for the catalog and wrong for this send — and an editor who
  does not think to check the image never finds out. Opting IN is a
  deliberate act; opting out is one nobody remembers to make. Note this is
  a `defaultValue`-only change: `originalValue` stays the AUTHORED linked
  fragment, so deleting the field still restores the block byte-exact,
  and an author who wants the link on says so by selecting it. The
  `default != original` shape is the same one 61 other fields already
  use.
- **Heading Level toggles** (2026-08-19, user-decided): an `mj-text`
  flagged `data-heading-level-toggle` whose ENTIRE content is one lone
  `<h1>`–`<h6>` gets a "Heading Level" Select of H1–H4 (plus the
  authored level when it's h5/h6). Markup INSIDE the heading is allowed
  (relaxed same day for the linked header rows — the anchor rides inside
  the narrowed Content value); siblings beside the heading, or another
  heading close within, still void the flag with an import note. Each option's value is the full
  compiled heading with its tag swapped and attributes preserved; the
  Content field is narrowed to the heading's INNER text and rides inside
  every option as a nested tag, so level and copy can never desync.
  Generated before Display, which nests it one level deeper
  (Display ⊃ Heading Level ⊃ Content — within EN's verified resolution
  depth). Markup inside the heading, or siblings beside it, void the flag
  with an import note and the text falls back to the ordinary
  whole-inner Content field. Name `heading_level` (the Heading role's
  base plus the deduped property; scoped/numbered like every member
  field), bare label "Heading Level", sorted with Display/Link above the
  content fields.
- **Text anchors inside complex markup** (2026-08-19, user-decided): an
  `<a>` inside hand-authored table/div markup flagged `data-text-anchor`
  mints its fields under the **Text** family (`text-link` internally)
  instead of "Button N" — for row-link copy that is prose, not a pill
  (the Question Block's sentence). Same fields as a button-link (Label,
  Link URL, hex colors as palette Selects); only the grouping, names,
  and section headers change. Its ordinals live in their own space,
  mirrored by the column-geometry walk so unflagged anchors keep their
  button-width mapping.
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
  logo beside a photo (Logo Hero (w/ image)), the Tri-color
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
    (green button) lost 238px of span, CTA Hero (w/ background image)
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
- **Pill Background Color claims the MSO twin cell too** (2026-08-18): a
  pill's chip color is authored twice — `background-color` in the `<a>`'s
  inline style AND `bgcolor` on its `[if mso]` conditional `<td>` (Word
  ignores the div/anchor styles). The Background Color candidate pairs
  the k-th bg-authoring anchor with the k-th bgcolor-carrying conditional
  cell in the same mj-text and splices ONE tag into both carriers
  (all-or-nothing, the link-group binding). When the pairing cannot be
  proven — cell count ≠ anchor count, or any position's values differ —
  every background field in that fragment is withheld with an infoNote:
  a partial bind IS the Outlook desync the twin exists to prevent
  (`scanEmbeddedAnchors`, msoBgTds). A fragment with NO conditional
  bgcolor cells keeps the single-carrier claim (a div-only row has no
  Outlook copy to desync). Pill Text Color has no MSO analogue (the
  shared `<a>` renders in Word with its inline color) — single carrier
  by design. Single-run stacked anchors (`<a><span>X</span></a>`) mint
  the plain `label` field (2026-08-18; the two-line gate no longer
  requires ≥2 runs).
- **Plain-markup button-ish links stay RTE-editable** (2026-08-18,
  assessed): an anchor styled as a button inside an mj-text whose inner
  markup is NOT complex (no MSO conditionals, tables, or divs — e.g. the
  big Footer's bare DONATE/link row) never reaches the button-link
  scanner; the whole mj-text mints as one RTE Content field, and the
  label and colors are edited there. Deliberate — no dedicated fields.
- **`inline-fluid` grid images** (css-class token on mj-image,
  2026-08-18; probe_fullbleed-grid-images, guide §2b-bis): the compiled
  image's constraining inner td is rewritten from `width:Npx` to
  `width:100%` on EVERY compile — `applyInlineFluid` in
  `src/core/mjml.ts` (main and instrumented compiles share the hook, so
  region offsets never skew) and its mirror in TPL
  `scripts/restore-excluded.mjs` for dist parity. The img keeps its
  Word-facing width ATTRIBUTE and its stock inline `width:100%`, so the
  no-CSS rendering is the correct mobile rendering; desktop is capped by
  the min-width:600 column classes and Outlook by its MSO cells. A
  bordered fluid image also gains `box-sizing:border-box` (100% includes
  the border — the quiz tiles' 3px frames otherwise overflow the
  viewport). Flagged images mint NO "Width in Pixels" field: the width
  attribute would edit Outlook alone — the banned Outlook-only copy.
  Both twins of a swap pair must carry the token (attrs-equal pairing).
  Fail-open per image, idempotent.
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

  **Deleting an authored ladder (2026-08-20).** The option pool is derived
  from live `.mj-column-px-N` head classes, and MJML emits one of those for
  EVERY real column width whether or not a ladder was ever authored. So a
  template that deletes its ladder does not thereby delete the dropdown: an
  eligible column instead offers whatever incidental widths the catalog
  happens to compile (200/300/550 in TPL) — a menu that looks authored but
  is an accident. Retiring the control therefore takes BOTH steps: flag
  every eligible column `data-no-width-toggle` (that is what removes the
  field) and delete the CSS (that is what reclaims the head-CSS bytes).
  TPL did both when it removed the control from Highlighted Text, Quote
  Block, CTA Text Block and Footer (user decision 2026-08-20, reverting
  those to left/right padding), and added a check-catalog guard mirroring
  the eligibility filter above so an unflagged eligible column trips the
  build. The guard is deliberately as narrow as the filter — an earlier
  over-broad version fired on 93 px columns that can never mint a field.
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
  group). The per-group ZIP honors the same row and appends it to the
  UTILITIES group file (`en-blocks-utilities.json`, last item —
  2026-08-18, user-decided; supersedes the separate
  `en-block-utility-raw-html.json`, which now ships only when no
  utilities group exists). It lands in exactly ONE file either way, so
  bulk imports never duplicate it.
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

- **Only CSS travels** (2026-08-15, unchanged by the 2026-08-18 inline
  switch): the block's content `<style>` holds bare rules and nothing
  else, so anything that is markup rather than a rule STAYS
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
  scripts. (Since 2026-08-18 nothing in the block is per-email editable
  anyway — the carrier split now exists for the extraction seam, the
  budget accounting, and the swap-one-block update path.)
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
- **The block's content is a builder placeholder plus the compact CSS
  hard-coded in ONE content `<style>` — and NO replacements**
  (2026-08-18, user-decided: per-email CSS edits are deliberately
  disabled, nothing for EN's editor to expose; supersedes the
  2026-08-15→18 CSS-type "Head CSS Styles" field, which superseded the
  2026-08-11 HTML-type field): `buildStylesBlockHtml(compact, version?)`
  emits a hidden `<span id="head-styles">`, a chrome `<style>` targeting
  EN's `.en__emailbuilder__block` wrapper — inside EN's email builder
  the block renders as a labeled black band instead of a zero-height
  sliver — and the compact CSS in its own `<style>`. The band's label
  text carries the CSS revision: **"Email Template — Head CSS Styles
  Block vN"**, N = the source repo's `versions.json` `head-css` entity
  (fetched best-effort at `../versions.json` then `./versions.json`
  relative to the imported URL; pasted sources go unversioned). The EN
  block NAME stays a stable "Utility — Template Styles" across
  revisions (user-decided) so re-uploads line up in the library. The
  span stays display:none in the send; the builder-only rules are NOT
  pruned — EN ships them (~313 delivered bytes, measured 2026-08-18),
  and the budget meter counts them.
- **Exactly ONE content wrapper — EN ingests a stylesheet once per
  `<style>`** (2026-08-18, measured): during the CSS-Editor era, EN
  substituted the CSS-type value wrapped in its OWN bare `<style>` at
  render (seen nested in the EN message preview, us2 templateId 492);
  with the block html supplying a second wrapper, EN's send pipeline
  ingested the stylesheet **once per wrapper** — every delivered head
  carried TWO full copies (24,952 bytes, over the Gmail cliff, canary
  red) until the block's wrapper was removed, which took the same send
  to 13,325 bytes and turned the canary green on Gmail app and web
  (EoA TlHVjaQ…). The current inline shape carries the CSS in exactly
  one content `<style>` and no merge tag, so there is nothing for EN to
  wrap. LEGACY shapes still get the measured treatment: local previews
  re-create EN's wrap for field-carrying blocks (`wrapBareCssTags`,
  `src/core/render.ts` — in `composePreviewChrome` and
  `buildPreviewDoc`, wrapping only tags NOT already inside a `<style>`),
  wrapped-era persisted projects are HEALED on load (persist migration
  v5 runs `unwrapLegacyStylesBlockHtml`), and the SAME heal runs in
  `importBlocks` (`src/core/export/importer.ts`) — EN-JSON imports
  persist at the current schema version, so the persist migration never
  sees them. That heal is the ONE deliberate byte change in the
  otherwise byte-stable EN round-trip (pinned in `roundtrip.test.ts`);
  every other block round-trips byte-exact.
- **The block ships the COMPACT form** (`compactCss`,
  `src/core/headStyles.ts`, 2026-08-18): comments stripped (EN strips
  them at send anyway, and a comment can never re-trigger the
  cssParserHazard outage class), one rule per line, @media wrappers on
  their own lines with indented one-line rules. Reason: Gmail discards
  the ENTIRE head stylesheet past **16,384 total `<style>` bytes**
  (guide §2b-bis — drop-whole, every Gmail surface), and the app's
  formatter otherwise beautifies ~12KB of pretty-printing into the
  payload (measured: 27,126 delivered where the compiled sheet held
  14,976 sans comments). The authored form lives in the TPL repo.
  compactCss NEVER merges/reorders @media, shortens hex, or rewrites
  selectors — each breaks a measured behavior or an app feature (see
  the §2b-bis coupling notes).
- **The Gmail CSS budget meter** (`CssBudgetMeter`, shown on the block's
  panel; `validateCssBudget` mirrors it in the issues badge): estimated
  DELIVERED bytes = shell-remaining `<style>` bytes +
  `EN_CSS_REPRINT_FACTOR` × (the block's `<style>` bytes — the inline
  CSS plus builder chrome — plus a legacy field's bytes when an
  EN-imported block still carries one; detection is content-based via
  `isStyleOnlyHtml`), against the 16,384 hard limit with a
  14,000 working target (headroom for EN-hoisted block styles, which the
  meter itemizes as "+N if included", also ×factor). EN re-prints all
  head CSS at send — comments stripped, plain top-level rules inlined
  away, comma groups split, colon-space formatting — a net ×1.30 on a
  compact field (measured 2026-08-18, EoA TlHVjaQ…: 9,713 compact →
  12,644 delivered incl. merged-wrapper share). Warning past the target,
  error past the limit. TPL's check-catalog §8 runs the same estimate
  over every compiled page (keep its hardcoded factor in step with
  `headStyles.ts`). The two deliberately differ on HOISTED extras: the
  app meter prices the canary/chrome at raw × factor (worst case — EN
  strips their comments, so the true delivered size is smaller), while
  the TPL guard uses the measured ~700 delivered bytes; the largest catalog
  page is therefore EXPECTED to show red in-app while
  the build guard still passes it — the shipping masters must be green
  under both. The exported block name never carries byte counts.
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
  the `#head-styles` marker span, and bare merge-tag text (the current
  shape, and also where the tag stood in pre-2026-08-15 projects):
  previews, thumbnails, and the padding audit re-compose the styles
  block into their document `<head>` (`composePreviewChrome`, which
  drops the marker span, carries the inline CSS literally, and — for a
  legacy field-carrying block — wraps the bare tag the way EN does so
  the head_styles tag substitutes downstream), so per-block rendering
  keeps the template styling even though the shell head carries only
  its conditional CSS.
- EN JSON imports keep their styles wherever they are; extraction runs
  only when a project is created from MJML. The single exception is the
  wrapped-era styles-block heal above — the one deliberate byte change
  in the otherwise byte-stable round-trip.
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
- The theme merge-tag names stay in `TEMPLATE_REPLACEMENT_NAMES` (still
  including `head_styles`) even though only `background_color` is
  minted today — the styles block mints no field since 2026-08-18, but
  legacy EN imports may still carry `head_styles`, and content blocks
  keep reserving the whole vocabulary so no block field ever shares a
  tag with a template-level one (the 2026-08-10 shadowing rule; same
  precedent as email_title after its revert).
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
  (tpl_unified-blocks / the full catalog, now mjml_extra-blocks) the same day;
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
  with no `<style>` to unwrap. The first branch covers the Template
  Styles block's inline CSS — the largest CSS payload the importer
  emits — since the 2026-08-18 inline switch; the second was added
  2026-08-15 with the CSS Editor switch (the guard had gone blind to
  exactly the payload it exists for, because the head CSS stopped being
  wrapped in a `<style>` the regex could find) and still covers legacy
  field-carrying EN imports. EN escapes `>` in CSS text when a code field is edited and
  resubmitted, invalidating the selector (guide §2d); comments are
  stripped before scanning, so a `>` inside a CSS comment stays legal.
- RTE editor-safe guard (`validateRteEditorSafe`): the mechanical half of
  the ProseMirror findings, so a value that cannot survive an edit is
  caught at import rather than after a send. Scans every RTE value —
  `defaultValue` plus each Select `option.value` — for four constructs,
  at severities chosen by whether a workaround exists:
  - an **anchor** carrying `style`, `class`, `id`, `title`, `rel` or
    `data-*` → **warning**. A link keeps `href` and `target` and nothing
    else, because ProseMirror rebuilds it as a MARK from a fixed
    attribute set. A workaround exists (style it from a class on an
    ANCESTOR, which lives outside the replacement), so it warns and names
    that fix.
  - a **styled inline element** — `em`, `strong`, `b`, `i`, `u`, `s` or a
    `span` — carrying any style property ProseMirror has no mark for →
    **warning** (2026-08-20). The editor re-expresses what it can and
    silently drops the rest, so `font-weight`, `color`, `font-style` and
    `text-decoration` survive in some form while a `font-family`,
    `background-color`, `display` or `border-radius` is gone on the first
    keystroke. Same workaround as the anchor, so same severity.
  - an **MSO conditional** → **error**. It is destroyed outright and
    nothing inside a Content value can survive; the conditional has to
    move into block markup.
  - a **list** → **info**. A paragraph is injected inside every `<li>`,
    no wrapping prevents it, and it is harmless — recorded so nobody
    re-opens it as a bug.

  Ordered deliberately after the catalog was migrated (2026-08-19): landing
  it first would have put 45 warnings in the export panel on day one, which
  is how a check gets ignored. Against the migrated catalog it reports zero
  warnings and zero errors — only the two known lists, at info.
**Builder bands** (2026-08-19). A block whose real content is invisible — head
CSS, an empty raw-HTML field — renders as a zero-height strip in EN's builder
that an editor cannot see or click. A band gives it a body: a marker `<span>`
that is `display:none` in the send, plus rules that only bite while the
template is being edited.

**One gate, one class, one layout rule; each band adds only its own
`content`** — with one exception, below. The gate is `:is(body):has(.en__emailbuilder__block)` (user
design), which asks whether a block wrapper exists ANYWHERE in the document —
true in the builder, false in a delivered email. That single question serves
bands inside a block AND the template's own chrome, which sits outside every
block and no descendant selector can reach. Both halves are load-bearing:
`:has()` supplies the test, `:is()` is belt to its braces, since a selector
carrying a pseudo-class the engine cannot parse is discarded WHOLE — a client
understanding neither drops the rule rather than half-applying it.

Every band SPAN carries `aria-hidden="true"` (the two block bands; the
template band is a pseudo-element and has no node to annotate). The band is
editor chrome, never
content; `display:none` already skips it in a delivered email, so this is the
guard for the case where the CSS does not arrive and an empty span could
otherwise be announced.

Measured in a browser before shipping, both DOM states and the layout: with no
block wrapper the span computes `display:none` at 0px; with one it computes
`display:flex` at 50px and paints its centred label. **`height` is required** —
dropping it collapsed the band to 19px, because a flex container whose only
child is a `::before` shrinks to content and `max-height` never binds.

Sharing is what makes more than one band affordable. EN does NOT prune the
matchless rules at send: they reach the recipient and count against Gmail's
16,384-byte cliff, past which Gmail drops the ENTIRE stylesheet. Copied
verbatim, three bands cost 1,591 delivered bytes; on one shared rule, 697.

The styles block's band reads **"CSS Styles Block vN"** (shortened from
"Email Template — Head CSS Styles Block" on 2026-08-20, user decision: the
band sits inside the block it names, so the prefix said nothing the context
did not). `STYLES_BLOCK_PLACEHOLDER` deliberately keeps the OLD text — it is
the legacy shape the EN-import healer recognises, and rewriting it would
misdescribe blocks already living in EN.

Bands in use: the Template Styles block (`#head-styles`, head-css version) and
the RAW HTML utility block (`#raw-html`) — both spans the app injects into the
block's own content at export — plus the TEMPLATE itself, which works
differently.

**`position: absolute` is the CSS Styles Block band's alone** (user decision
2026-08-21). It sat in the shared `.marketing-tools-banner` rule until then,
which put every band out of flow. That is right for `#head-styles` — the
block's real content is a `<style>`, so it has no height of its own to sit
above — and wrong for every other band, which labels a block with visible
content that an absolutely-positioned label overlaps. The property moved to
its own rule, `:is(body):has(.en__emailbuilder__block) #head-styles`.

Two things about that rule are deliberate. It targets the **id**, not a new
class: every band span already carries a unique id, and those ids are baked
into the stored content of blocks already living in EN, so minting new ones
would desync every uploaded copy. And it is its **own rule**, never merged
into the shared selector list — one unparseable selector discards the whole
rule, and this gate is exactly the kind an older engine may fail to parse.

Cost: ~73 delivered bytes net (a 110-byte rule, less the ~37 the property's
removal saved in the shared one). A cheaper gate exists — `.en__emailbuilder__block`
alone is ~19 bytes lighter — but swapping it is a separate, unverified change;
see the head-CSS reduction work.

The template's own band, `[data-container="main"]:before`, is authored FIRST
in the sheet (2026-08-21). Order is presentational: it labels the whole email
rather than a block inside one, so it reads first. Nothing in the cascade
depends on it — the two selectors match different elements.

**The template band hangs off EN's container, not off a span** (user decision
2026-08-20, replacing the span approach the same day it shipped). A span
authored in the template shell does not work: EN's builder renders blocks
inside the container and does NOT render the template's own surrounding
markup, so a shell span never enters the builder DOM at all. The rule is

```css
[data-container="main"]:before { content: "Email Template v__TEMPLATE_VERSION__"; … }
```

and it is **self-gating**, which is why it needs no `:has()` test: the stored
template carries the `{{container~main}}` placeholder, a delivered email
carries the blocks themselves, and only EN's editor ever renders an element
bearing `data-container="main"`. It also removes a whole class of failure —
there is no body markup left to lose, so the segmentation trap below cannot
touch it, and with no span there is no `aria-hidden` to get wrong.

**Never write the container merge tag literally in a source** (2026-08-20).
Documenting the container rule above, the MJML head comment spelled
`{{container~main}}` out — and that one literal broke the whole catalog.
`autoEnableTemplateReplacements` joins the shell as
`beforeBlocks + CONTAINER_TAG + afterBlocks` and splits it back on the FIRST
occurrence, so the split landed at the comment instead of the real container:
`beforeBlocks` was truncated mid-comment, the comment lost its terminator,
and the unterminated comment swallowed the entire head stylesheet that
followed it. Measured in a browser: **0 `<style>` elements and 0 CSS rules**
in the block preview, so `.dark-only{display:none}` never parsed and every
light/dark image pair rendered BOTH halves. After the fix, 39 rules and
`display:none` at 0×0. It would also have been wrong at export, shipping a
second container placeholder. Two guards now: check-catalog rejects the
literal in any source, and `validateShell` errors when the shell carries more
than the one tag `templateContent` contributes. Describe the placeholder in
prose; never type it.

**Never merge the two selectors into one list.** One unsupported selector
invalidates the WHOLE rule, so folding the container selector in beside
`:is(body):has(…)` would let a client that cannot parse `:has()` take the
template band down with it. They stay two rules; the ~215 delivered bytes of
duplicated layout is the price of that isolation.

**The trap that killed the span approach**, kept because it still applies to
anything else authored in `<mj-body>`: `shell.beforeBlocks` is
`html.slice(0, seg.beforeEnd)`, and `beforeEnd` is the offset of the FIRST
`<!-- START: -->` marker of ANY name — the segmenter has no special knowledge
of "Main Content". `partials/debug-toolbar.mjml` carries its own START/END
pair, so it segments as block #1, and a span authored below that include landed
INSIDE the toolbar block — which `isDebugBlock()` then dropped from the import
wholesale, silently taking the span with it. Measured end-to-end through
`fetchMjmlBundle` → `createProject` → `exportTemplate`: the span sat 714 bytes
inside the toolbar segment and 0 of 77 exported blocks carried a copy. The
failure was quiet and asymmetric — the band's `<style data-en-tools-band>`
lives in `<mj-head>` and survived, so the export shipped a
`#template-version:before` rule with no element to hang it on — and only the
`_live` variant ever looked correct, because `emit-variants.mjs` strips the
toolbar there while the documented import path (raw MJML, includes resolved)
does not. check-catalog's "Builder band span leads the body" guard remains as a
zero-instance tripwire for the next body-authored band.

**Where each piece lives.** The shared layout and the template band's own
label sit in the template `<head>`, in a `<style data-en-tools-band>`.
`extractHeadStyles` skips that marker and leaves it there; every other
`<style>` in the head is still spliced out into the Template Styles block. The
exemption exists because the layout has to work for an email built WITHOUT that
block, and it follows the precedent already in that function, where styles
inside a revealed MSO conditional are left alone. Each BLOCK then carries only
its own span and `content` rule.

The template head's label carries `__TEMPLATE_VERSION__`, not a number. The
placeholder is deliberate: `version-sync` hashes the SOURCE, so a baked-in
version would feed its own hash and bump on every build. `fetchMjmlBundle`
fills it in from `versions.json` at import, matching the leading ` v` so a
missing manifest yields a clean "Email Template" rather than a dangling "v".

**Budget note.** `HOIST_ALLOWANCE` in TPL's `check-catalog` dropped 700 → 250
when the band sheet moved into the head: the sheet is now measured directly
(454 delivered bytes), so reserving it again double-counted it. That left
roughly 50 bytes of headroom until 2026-08-20, when TPL deleted its authored
`.mj-column-px-*` width ladder (see "Deleting an authored ladder" above),
returning ~1,325 delivered bytes. The margin moves with every stylesheet
commit — run TPL's `npm run check-catalog` for the live number rather than
trusting a figure written here. The remaining trim candidates are
still NOT mechanical — client-injected hooks (`.moz-text-html`) and the
dormant-but-sanctioned `.mobile-only` both look dead and are not.

- `data-*` contract warnings are whitelisted, never "fixed".

## Import pipeline decisions

- The import form's MJML SOURCE prefills with the TPL master template —
  `https://github.com/4site-interactive-studios/tpl-en-marketing-tools/blob/main/src/main.mjml`
  (`DEFAULT_MJML_URL`, src/core/mjml.ts; 2026-08-10, user-decided) — since
  importing exactly that file is this tool's day-to-day use.
- Compiled HTML is formatted with **js-beautify** before segmentation
  (prettier took ~46s on a ~1MB doc; js-beautify ~60ms). The instrumented
  parallel compile stays unformatted (ordinal matching only). Formatting is
  fail-open.
- Thumbnail probing is async, after load — never blocks the import. It
  runs once per project + asset root (`thumbnailsProbedRoot` records the
  root; only missing thumbnails are probed when the root changes), and a
  Re-import rebuilds the project with NO probe state and NO per-block
  thumbnails, so the probe re-runs against the current block names — a
  block renamed between imports picks up its `thumbnail-<new-slug>.png`
  automatically (verified live + pinned by `src/state/store.test.ts`,
  2026-08-19). The inverse does not hold: a thumbnail uploaded (or a CDN
  404-cache expiring) AFTER the probe recorded the root is not detected
  until the next Re-import or root change — upload thumbnails before
  importing, or Re-import again afterwards.
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
data-* on its own tags, so the importer reads them from the raw MJML; the
TPL build round-trips only the exclusion flags into compiled HTML
(`scripts/annotate-excluded.mjs` → compile → `restore-excluded.mjs`), and
the importer whitelists all data-*-only MJML validator warnings
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
  (do not re-flag as errors): Text w/ Bullet Lists,
  Text + Link Paragraph CTA, Linked List Block, Join Links Block.
  **Reversed 2026-08-21 (user decision):** Linked List Block and Join
  Links Block now SHIP. They are structurally WYSIWYG Text, which is why
  they were excluded, but that is exactly the erasure this rule warns
  about — an editor who picks "Linked List" should get a linked list, not
  an empty text block to rebuild one in. Linked List Block carries
  `data-visible-duplicate` so the dedupe check stops reporting the pair.
  Linked Header Row was DELETED the same day: unlike these two it added
  no default content, only a link an editor puts in the RTE.
  WYSIWYG Text left that list 2026-08-19 (user-driven block rework):
  the heading/body split + Heading Level Select made the full-width
  variant the family's canonical, so it is importable again; the inset
  variant stays excluded as its duplicate.
- **`data-import-exclude`**: dev-only labeling/visual blocks. Ships as an
  mj-raw `<div data-import-exclude>` wrapper so it SURVIVES compilation;
  the block renders in previews but starts unchecked in exports
  (`src/state/store.ts`, `ExportPanel`), with an override warning when
  exported directly.
- **`data-probe`** (raw MJML; block-level, 2026-08-18, user-decided):
  the block is a PROBE INSTRUMENT (canonical example: the head-CSS
  canary, now archived in TPL `archive/probes/` — the mechanism stays
  for every future probe block). It imports,
  previews, and sends like any block, but its colors are measurement
  signals, not design: the brand-color census skips the flagged region
  (`src/core/colors.ts` `stripNonPaletteRegions` via
  `src/core/blocks.ts` `isProbeBlock`), and the sidebar color-usage
  audit skips the imported block (`BrandColorsEditor`, testing the
  block's persisted `mjmlSource`) — so a probe-only hex never surfaces
  in a color dropdown or a usage badge. A hex the probe shares with real
  block markup survives via its other occurrences. Deliberately NOT in
  `IMPORTER_FLAG_RE`: the flag changes the palette, never the block's
  own generated fields, so the dead-flag strip test (which fingerprints
  generator output only) would misjudge it dead; the data-* audit's
  consumer classification covers it instead.
- **`data-visible-duplicate`** (raw MJML; block-level, 2026-08-18): the
  block's structure deliberately duplicates its dedup-group anchor AND it
  must remain importable — a product decision, not redundancy (Image 1x1
  is the full-bleed shape under the name an editor actually looks for;
  the fixed-width CTA rows are separately-shipped layouts whose widths
  normalize() masks). The TPL build's annotate-excluded honors it: the
  flagged member is exempt from the "duplicates X but is NOT flagged"
  WARN, while a flag on a group ANCHOR or alongside `data-fully-exclude`
  warns as misuse. The importer itself never reads it (the data-* audit
  registry claims it as a TPL pipeline consumer). Always pair it with a
  dated caveat comment naming the anchor and the decision.
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
  Block Padding Left/Right preset Select (the width-preset consumer in
  `src/core/mjmlProps.ts`), the same effect a structurally pinned gutter
  gets automatically. The two consumers are mutually exclusive by
  construction: a block containing any px column never offers the preset.
- **`data-width-options`** (VALUED, on mj-column AND mj-divider):
  on a column, `data-width-options="150,250,350"` curates its Column
  Width ladder, overriding en-tools-config `columnWidthsPx` and the
  default 50px steps — whole px numbers ≥ 50, each still needing a live
  `.mj-column-px-N` head class and fitting the row. On an mj-divider
  (2026-08-19), the list ships the divider's Width as a Select ladder
  verbatim (no head-class guard — divider widths are plain inline
  `width:Npx`), with an `Original (Npx)` escape appended for an
  off-ladder authored width; without the flag the free "Width in
  Pixels" number stays. An unparseable list is ignored with an
  infoNote either way.
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
- **`data-text-anchor`** (valueless, on raw `<a>` tags inside
  hand-authored component markup, 2026-08-19, user-decided): the anchor
  is prose that happens to link — its fields group under the **Text**
  family instead of "Button N" (see "Text anchors inside complex markup"
  under Other generated controls). Composable with `data-link-group`
  across families: the Question Block's icon anchor (unflagged, Button)
  mints the group URL while the flagged copy anchor rides as a carrier
  and mints Text-family Label/Text Color.
**Bare copy gets a Text field, not RTE** (2026-08-19, user-decided). EN's
Content field is a **ProseMirror** editor whose schema requires BLOCK content
at the document root, so it wraps an inline-only value in `<p>` the instant an
editor clicks in and types — irreversibly, and the injected paragraph then
matches the stylesheet's `p` rule instead of its own element's font-size (a
10px caption shipped at 16px). A plain `Text` field is not a ProseMirror
surface at all, so nothing is rewritten.

The importer therefore mints an `mj-text` Content field as `Text` when its
authored inner carries **no markup at all** — no tag, comment or conditional
(`plainCopyContent`, `src/core/mjmlProps.ts`). `data-force-rte` opts an
element back in.

The bar is "no markup" rather than "no FORMATTING markup", and the reason is
measured (EN template 546, 2026-08-19,
`docs/archive/en-rte-normalization-probe.html`). A `Text` field does **not** escape or
rewrite markup — the probe's F1 row carried the same `<span>` as A2 and came
back byte-identical. But the typed character landed OUTSIDE the closing tag,
which is what a Text field is: a literal string input that shows the editor
raw tags. Sending a span-wrapped caption there is safe for the data and
hostile to the person editing it. On RTE the same value keeps its span and
merely gains a paragraph.

That paragraph is not harmless yet, and a stylesheet rule cannot make it so.
**EN's inliner bakes the winning `p` rule onto the injected paragraph as an
INLINE style** — the delivered email carries
`<p style="display:block;font-size:16px;line-height:27px;…">` inside an 18px
element. Whatever rule wins specificity is what gets inlined, `inherit`
included, and inline `inherit` is precisely the construct Outlook's Word
engine cannot be relied on for. A `.wysiwyg p { font-size: inherit }` rule was
tried and reverted for that reason (2026-08-19).

**The importer therefore pre-applies the wrap.** Every RTE Content value that
is inline-only ships already wrapped as
`<p style="margin:0;font-size:Npx;line-height:Mpx;">…</p>`, with the size read
from the wrapper `<div>` MJML stamped — the element's own declared size after
mj-attributes and any mj-class (`preWrapRteValue` / `enclosingTextStyle`,
`src/core/mjmlProps.ts`). The editor's first edit is then a no-op, because
that is exactly the shape probe B1 proved it leaves alone.

Values that already contain block-level markup are left untouched — a heading
or an existing paragraph is not rewritten by the editor anyway, and a list
must never be wrapped in a paragraph. Lists still churn (a paragraph is
injected inside each `<li>`) and no wrap can prevent that, so nothing is
claimed for them. When the div declares no size the wrap fails OPEN rather
than guessing.

Measured on the catalog: 23 values wrapped, 132 already block-level, 2 failed
open, and the wrap is **pixel-identical** to the unwrapped rendering
(10px/16px caption, 205px wide, 29px cell — before and after). The same
caption with a naive size-less paragraph, which is what the editor produces
today, renders at 16px/27px and 328px wide.

The measured fix is B1's: an authored `<p>` carrying its own inline
font-size survives **both** transforms — the editor leaves it untouched, and
EN's inliner does not override it (B1 shipped its authored 12px/16px intact
while the injected paragraphs got 16px/27px). Pre-wrapping copy in a
paragraph that pins its size is therefore the durable answer, and it needs no
stylesheet support at all.

**What EN's editor actually does to an RTE value on the first keystroke:**

| Construct | Result |
| --- | --- |
| bare copy, lone `<span>`, two inline siblings | wrapped in ONE `<p>`; spans and `class` survive |
| `<span style="font-weight:700;color:#362229">` | style re-expressed as marks — `font-weight` becomes `<strong>`, hex becomes `rgb()` |
| an inline element styled with a property that has NO mark (`font-family`, `background-color`, `display`, `border-radius`) | that property is DROPPED — the element survives, its look does not |
| `<p>` already present, with or without inline style | **UNCHANGED — the transform is IDEMPOTENT** |
| `<h1>`–`<h6>` with inline style | UNCHANGED |
| `<br>`, `<strong>`, `<em>`, entities | preserved (the `<br>` is not split into paragraphs) |
| `<a href target rel style>` | **`rel` and `style` STRIPPED**; `href` and `target` kept |
| `<ul><li>` | a `<p>` is injected inside each `<li>` |
| MSO conditional comment | **DESTROYED — the whole conditional is removed** |

**Worked example (2026-08-20, user-reported).** The Signature Card's
"Row 2 Paragraph Copy" changed appearance on its first edit. The value's
`<p>` was NOT the problem — a paragraph is idempotent, per the table above.
The damage was one `<em>` carrying `font-family: Georgia, serif`: an `em` is
a mark, and `font-family` has no mark to become, so it vanished. Sweeping
every RTE value in both catalogs for the same shape found 11 more instances
in all-blocks and 6 in unified, all in the Steps Blocks, where the numbered
badge `<span>` carried `display`, `background-color`, `height`,
`border-radius` and a monospace `font-family` inline — a badge that would
have lost its shape entirely. Both are now styled from the head:
`.signature-text em` for the mark (a mark cannot carry the hook itself), and
a `.step-num` CLASS on the span (measured: a span's `class` survives). The
sweep is now zero in both catalogs, and `validateRteEditorSafe` keeps it
there.

**Ancestor-class styling survives an edit — measured 2026-08-19**
(`docs/archive/en-headsheet-probe.html`, EN template 548, send after the edits). A
rule in the TEMPLATE HEAD targeting a class on an ancestor
(`.cta-link a { … }`, with `css-class` on the `mj-text`) keeps its styling
through an edit in both storage and the delivered email, because the hook
lives in block markup outside the replacement where the editor cannot reach.
That is the sanctioned way to style an RTE-embedded link.

One anomaly from the same series is closed as **unexplained** rather than
solved — a delivered email that lacked styling its storage still had. Three
explanations were formed and measured dead, it has never reproduced, and it
gates nothing: see future-enhancements, "Unexplained: one delivered email lost
styling its storage still had". The evidence for the styling pattern above is
direct and end-to-end and never rested on that anomaly being benign.

**EN sends read block content LIVE, not from a build-time snapshot**
(measured 2026-08-19, `docs/archive/en-build-vs-send-probe.html`): a block edited
AFTER an email was built delivered its post-edit value from that already-built
email. The practical consequence is methodological — a storage-versus-delivery
comparison needs no rebuild to be valid, so every such comparison in this
series holds.

The same probe disproved a hypothesis worth recording so it is not re-formed:
a block-level `<style>` is **not** destroyed by an edit either — the
block-styled control survived identically. An earlier anomaly, where a
delivered email lost styling that storage still had, therefore has some other
cause and did not reproduce. Every candidate explanation — including the
build-time snapshot this same measurement disproves — has been measured dead;
the anomaly is closed as unexplained, not as solved
(docs/future-enhancements.md keeps the diagnostic shortcut if it recurs).

The anchor row was pinned down further on 2026-08-19: an anchor keeps `href`
(and `target`) and **nothing else** — `class`, `style`, `id`, `title` and
`data-*` all go. ProseMirror treats a link as a MARK, rebuilt from a fixed
attribute set, while `span` and `p` are NODES and keep their attributes. So an
RTE-embedded link can only be styled from an ancestor class — the shipped
pattern since 2026-08-19, when the catalogs were swept to ZERO styled anchors
inside RTE values (down from 54), so no edit can break one.

Two of those are authoring rules, not curiosities. **Never put an MSO
conditional inside an RTE value** — one edit deletes it silently. **Never rely
on an anchor's inline `style` or `rel` inside an RTE value** — colour a link
from the stylesheet or the element, which is the same conclusion the
"author copy color on the element" rule already reached for headings.

Idempotence is the important one: because an already-wrapped paragraph
carrying an inline style survives untouched, **authoring the `<p>` ourselves
makes the editor's first edit a no-op**. That, not the type inference, is the
durable fix for markup-bearing copy.

The value is also not narrowed past a `<span>` wrapper, which would make only
the words editable — a narrowed caption has to be re-found by value in the
compiled HTML, where a short string ("Read more") is far less unique than the
whole span, so a miss silently drops the field
(`if (!occurrences.length) continue`) and a false hit splices the wrong place.


- **`data-image-shape-toggle`** (valueless, on mj-image, 2026-08-20,
  user-decided): ships the image's `border-radius` as a two-option Select —
  **Square** (`0`) / **Circle** (`50%`) — instead of the free-text "Border
  Radius" field that attribute normally mints. The image must author a
  `border-radius`; the flag constrains that field, it does not create one.
  Circle is a PERCENTAGE so it holds at whatever width the editor picks.
  **Opt-in on purpose**: a radius is not always a shape choice — the Quiz
  photos' `18px` is a soft corner that is neither shape, and
  `imageShapeSelect` returns null for any value that is not exactly one of
  the two, leaving the free-text field rather than silently rewriting an
  authored value the layout depends on. **Flag BOTH twins of a light/dark
  pair.** Pairing requires the two mj-images to be attribute-identical apart
  from `css-class`/`data-style-dark-mode`; flagging only one splits them into
  `image_1_*`/`image_2_*` and the shared `image_dark_url` field disappears
  (measured 2026-08-20). Flagged on both, one Select drives both twins —
  verified by rendering: Square → both imgs `border-radius:0`, Circle → both
  `50%`. Note Outlook desktop's Word engine ignores `border-radius`, so
  Circle degrades to a square there; the catalog already accepts that for its
  `18px` photos. A pre-rounded PNG is the alternative when Outlook must show
  a true circle. In use on the unified catalog's Signature Card
  (photo), authored `border-radius="50%"` — the photo ships as a circle by
  default (user decision 2026-08-20) and an editor picks Square to square it
  off. The image must stay a SQUARE source file: a pre-rounded PNG would
  render round under both options and make the control look broken.

  **A radius candidate must never claim a `border`** (fixed 2026-08-20).
  `contextMatches` accepts a loose substring match between the candidate's
  property and the occurrence's context, which reads `border` as a shorthand
  of `border-radius` — `'border-radius'.includes('border')`. It is not one.
  The radius field therefore claimed THREE carriers instead of one: the
  presentation table's `border="0"` attribute and the image's `border:0`
  declaration alongside the real `border-radius:0`. Choosing Circle wrote
  `border="50%"` and `border:50%` as well — invalid as an HTML attribute and
  as a CSS shorthand, and visibly wrong. The two are unrelated properties
  (unlike `padding`/`padding-top`, where the loose match is wanted), so they
  now match only each other exactly. Regression-tested against the compiled
  shape, and the test is verified to fail without the guard.

  **A Font Size field over `<p>` copy is inert** (2026-08-20). The size MJML
  stamps on an mj-text lands on the wrapper `<div>`, and the stylesheet's bare
  `p` rule beats inheritance — measured in a browser: forcing that div to 30px
  left the paragraph at 16px. A Font Size field there edits nothing an editor
  can see, so the attribute is dropped upstream rather than shipped as a dead
  control. It stays live wherever the paragraph pins its OWN size, which is
  immune to the sheet's rule (the same property that makes `preWrapRteValue`
  work). One instance in each catalog, on the Signature Card.

- **`data-heading-level-toggle`** (valueless, on mj-text, 2026-08-19;
  **superseded 2026-08-20, zero live uses**): mints the "Heading Level"
  H1–H4 Select and narrows the Content field to the heading's inner text
  (see Other generated controls). Requires the mj-text's entire content to
  be one lone heading (inner markup allowed, 2026-08-19); siblings or a
  second heading void the flag with an import note.

  **Superseded by the WYSIWYG itself** (user decision 2026-08-20): EN's
  rich-text editor already offers H1–H4, so a heading needs no second
  field to change its level. Dropping the flag leaves the whole
  `<h2>…</h2>` inside the Content value, which makes that value markup and
  therefore an RTE — the editor changes the level in place. Two fields
  collapse into one, and the narrowing constraint disappears with them:
  the flag needed the heading alone, plain-text, on one line so its
  narrowed value survived the compiled-HTML text search, and a full
  WYSIWYG has no such requirement. Removed from all four flagged elements
  in each catalog. The generator support is retained, unused, for
  templates that still want the level as a separate control.
- **`data-force-rte`** (valueless, on mj-text, 2026-08-19, user-decided):
  keeps a Content field on EN's rich-text editor when the importer would
  otherwise mint it as a plain `Text` field (see "Bare copy gets a Text
  field" below). For copy expected to grow a link or emphasis later.
- **`data-group-label="<words>"`** (valued; on any content element AND on
  raw `<a>` tags inside complex markup, 2026-08-19, user-decided): the
  authored group word, verbatim — it names the panel group, prefixes the
  labels, and (names-follow-labels) forms the merge-tag base
  (`data-group-label="Attribution"` → group `Attribution`, tags
  `attribution_content`, its Spacing Below and Display fields). Wins over every
  inferred role; numbers in its own ordinal ladder; in a multi-band block
  it stands alone under its band (`└─ Episode Title`, no Section tag).
  On a light/dark image pair, label BOTH twins identically. Stripped from
  compiled mj-* output like every data-* attribute; on raw anchors it
  ships in the HTML (the data-link-group precedent).
- **Universal Alt Text (2026-08-18) — and `data-style-alt` retired.** Every
  `mj-image` whose `alt` attribute is PRESENT mints an Alt Text field,
  `alt=""` included: the attribute scan admits the empty value for alt
  alone, and a positional pass (`mjmlProps.ts`, "Empty-alt Alt Text
  fields") inserts the tag between the quotes of every compiled `alt=""`
  carrier — value-search cannot find an empty string. Carriers are matched
  by the logical image's src set (the light img plus its merged dark twin)
  and taken in document order, so two same-src images keep separate
  fields; a logical image that cannot account for every expected carrier
  claims nothing (a partial bind would desync the twins). A MISSING alt
  attribute still mints nothing — authors write `alt` on every image,
  empty for decorative. `data-style-alt` was removed from all TPL sources
  the same day (262 instances): the importer never read it — the
  `data-style-*` vocabulary is authoring annotation, with zero generation
  consumers — and alt editability is now unconditional, so the token
  claims nothing the behavior doesn't already deliver.
- **`data-display-toggle`** (valueless, on content components): opts a SOLE
column member INTO the Include/Exclude Block Display Select it would otherwise
never get (`columnMembers` + the emit gate, `src/core/mjmlProps.ts`). The only
opt-in of the display family. Authored on the component's own tag — and on the
FIRST twin of a light/dark pair, never the second. `data-no-display-toggle` on
the same element wins. Used by the Headers/Heroes blocks so the logo, the CTA
button and the heading can each be hidden (user decision 2026-08-20).

**`data-no-display-toggle`** (valueless, on content components): opts
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
- **`data-alt-arrangement="<Option Label>"`** (on an `mj-section`): folds the
  section into the PRECEDING sibling section's arrangement Select as an extra
  option instead of rendering it, so one control offers Left / Right / the
  alternate. It exists because a Display toggle cannot collapse a row — its
  splice range is the member's `<tr>` (`memberSpan`), which leaves the column
  div, its MSO ghost `<td>` and the sibling's inline percent untouched, so
  hiding an image yields a hole rather than a full-width partner. The alternate
  is AUTHORED rather than generated: the collapsed column needs
  `mj-column-per-100` AND its head rules, and column widths are deliberately
  never generated. Pairing is by adjacency and by VALUE equality on every
  element plus the frame. That was once described here as "self-policing" —
  it is not, and the correction matters (measured 2026-08-22 by drifting one
  letter of one Feedback Poll answer). A divergent edit does NOT merely drop
  the option: the alternate stops being folded and renders as its OWN band, so
  the block ships the content twice, every band after it renumbers, and the
  fields go 1220 → 1226 with `row_3_image_*` becoming `row_5_*` — which
  silently rebinds any EN email already built on that block. The importer's
  only signal is an INFO note. The real guard is in the authoring repo:
  check-catalog's alternate-arrangement check compares each alternate's
  `mj-text` bodies against its partner's and warns on any that does not match,
  and separately rejects an alternate whose partner is itself an alternate
  (two in a row pair against each other and the importer accepts it silently).
  Both breach-tested 2026-08-22. The matched fields are folded like a
  light/dark twin's, so ONE field tags its copy in every arrangement and the
  copies cannot drift; the alternate's regions are unioned only at the
  occurrence search, never into `regionMap` (`memberSpan` takes min/max across
  an instance's regions, which across two sections would swallow everything
  between them). A primary whose columns sit directly in the section rather
  than in an `mj-group` is rejected — there is no single contiguous region to
  substitute. An element the alternate drops loses its Display toggle, which
  would only leave an empty column behind — but its OTHER fields stay: an
  image's URL, Dark URL, Alt Text and Width remain editable and simply have
  nothing to act on while the alternate is selected. That is deliberate (the
  editor can switch back), and it is why an alternate is not a way to delete
  content. Adding one also costs the row its viewport-scoped padding flag:
  the collapsed per-100 column follows the frame's side gutter at desktop, so
  `data-mobile-only-padding-right` stops being true (see that flag's entry). **`data-alt-arrangement` is
  STRUCTURAL**, so it is deliberately absent from the strip list in
  TPL's `normalize()`: a block carrying it renders one section where a block
  without it renders two, and stripping it would let a flagged block subsume
  its unflagged twin. `data-arrangement-label` IS annotation and is stripped.
- **`data-no-alignment-toggle`** (valueless, on the `.cta-group` div inside
  hand-authored pill markup): creates no Button Row Alignment control. A row
  whose pills carry fixed widths summing to the content width cannot be
  aligned — left, center and right render identically — so the Select is a
  dead control. Declared rather than inferred: the anchor scanner sees only
  the pill markup, not the frame it sits in, so the available width it would
  need to compare against is not in scope there. Found by the 2026-08-21
  inert-dropdown audit on four rows (CTA Buttons 2x1 fixed-width and
  two-line, both Quiz Block 2x2 button rows); the 3x1 fixed-width row kept
  its control on 1px of slack, live by measurement — until later that
  morning, when it took the flag by judgment (TPL 5cc378b, 2026-08-21):
  one pixel of travel is not worth a field.
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
  exists — `align`, `direction`, `width` — plus `spacing-below`,
  `spacing-above`, the four `padding-<side>`s, and `inset-right` /
  `inset-left` (2026-08-18). Put the flag on the frame for
  `width`/`direction`/`padding-<side>`, on the content component for
  `spacing-*`/`inset-*`/`align`. This is the channel for
  the cases no static rule can reach:
  - a **centered, content-sized child in a uniformly painted frame** — the
    gutter changes, nothing moves (CTA Button's pill is centered by the
    mobile CSS, so its Width is `data-desktop-only-width`; the single-color
    divider is a fixed 300px centered box at desktop and only stretches
    below the breakpoint, so it is `data-mobile-only-width`);
  - **trailing spacing absorbed by a taller sibling column**, live only
    once the columns stack (`data-mobile-only-spacing-below`);
  - **column order that the mobile stack flattens**
    (`data-desktop-only-direction`);
  - **per-side padding pinned by a fixed-px column** — a row whose group
    columns are authored in px keeps them at those widths above the
    breakpoint, so the frame's RIGHT gutter has nothing to move at 600px
    while the left one still shifts the whole left-packed block
    (`data-mobile-only-padding-right`, honored in the per-side Select
    path since 2026-08-18). Two rows carry it: Podcast Streaming Block and
    Signature Card (photo). Six more did until 2026-08-22 — see the
    arrangement rule below.

    **Structural inertness only — copy-dependent inertness does not earn
    the flag** (user-visible decision, 2026-08-21). A control that moves
    nothing merely because the AUTHORED copy is short is not inert: the
    copy is an RTE/Text field the editor owns, and the first long headline
    brings the control alive at desktop under a label that says "Mobile".
    The inert audit encodes this directly — it renders every block under
    three copy profiles (`as-authored`, `single-line`, `wrapped`; see
    `AUDIT_COPY_PROFILES` in `src/core/inertAudit.ts`) and calls a control
    live if ANY profile moves pixels, so a copy-dependent flag is reported
    as a stale label on every future sweep. Two flags were removed under
    this rule: the Feedback Poll question section, and Two-Line Banner
    (measured 2026-08-21 at 600px with the `wrapped` probe — block height
    105 / 131 / 157px across the presets). The distinguishing question is
    "does the LAYOUT pin this, or does the placeholder?"

    **An alternate arrangement unpins the layout, so a row that offers one
    cannot carry the flag either** (2026-08-22, extending the same rule).
    `data-alt-arrangement` collapses the row to a single `mj-column-per-100`,
    and a per-100 column DOES follow the frame's right gutter at desktop —
    measured on Icon Row at 600px with wrapping copy: box 64..600 at 0px
    versus 64..536 at 64px in "No Icon", against an unmoved 184..536 at both
    values in "Left". An arrangement Select is editor-owned exactly as copy
    is, so the first editor who picks "No Icon" brings the control alive
    under a label that says "Mobile". The six rows that offer an alternate
    lost the flag together — Icon Row, Podcast Episode Block, Steps Block and
    the three Feedback Poll answers — and their labels are now a plain
    "Padding Right". The two that keep it have no alternate, so nothing can
    unpin them. Note the audit will NOT catch a regression here: it renders
    each Select against the DEFAULT of every other field, so the arrangement
    is always "Left" while the padding is under test. The check is authorial —
    when you add an alternate, drop the row's viewport-scoped padding flag.
  - **an inset that only bites once the box shrinks** — a right-aligned
    line or a fixed-width image that clears its container at 600px and
    only meets it at 375px (`data-mobile-only-inset-right` on the
    signature cards' name text and the quiz credit line;
    `data-mobile-only-inset-left` on the Logo Hero state map). Inference
    can only ever say "Desktop" — a mobile-only verdict is rendered
    geometry no stylesheet states — so these must be declared. The
    reverse, a caption inside a flush-mobile section, needs no flag: the
    scope pin says it (see "Where the labels come from").

  A declaration is a CLAIM, not an escape hatch: the audit still measures
  every option, and a false claim comes back as a FAIL on the very next
  run.

  **Never write a scope flag straight off an audit report.** Measured
  2026-08-18: a sweep reported six controls inert at 375px that a browser
  proves live at 375px — the Quiz Block (2x2 photos) Row 4 caption's
  Text Color (renders red when changed), its Alignment (left edge 45→32)
  and Inset Right (right edge 343→279), and the Images 3x1 Column 3
  caption's Alignment (170→0). A second run hours later cleared all six
  with no change to those blocks — which is what a non-reproducible finding
  looks like. Had they been declared, the same rows would now be FAILing as
  false claims.

  **Rows err in BOTH directions.** The same session tried to shortcut this
  and was caught within the hour. A row reporting a FLAGGED control as live
  at both viewports was treated as trustworthy — reasoning that a
  false-inert bug cannot invent liveness, so a stale flag found that way
  could just be removed — and its `data-mobile-only-spacing-below` was
  deleted. The next run immediately asked for the flag back, and direct
  measurement sided with the flag: on Photo and Text Grid Block (2x2) Row 3
  Text 1, sweeping the field's own cell through every option (0 → 64px)
  grows its column 452 → 516px while its sibling holds at 522px, so the
  block height never moves. The control is genuinely desktop-inert and
  lives only once columns stack. The reasoning was fine; the row it rested
  on was simply wrong in the other direction.

  So confirm EVERY claim, whichever way it points, by changing the property
  on the real element in the real document and measuring what moves, THEN
  declare. Three things make that test faithful:
  - Measure the box the field actually splices into. Manipulating a
    wrapper's outer div when the field edits an inner td proves nothing —
    and neither does grabbing an inner td whose padding is 0, which is how
    the sweep above first read a phantom 10px of movement.
  - Sweep the ACTUAL option values, not an arbitrary delta. A control whose
    every option is absorbed is inert even though a large enough number
    would not be.
  - Suspect absorption by a taller sibling first — it is the most common
    honest reason a spacing or padding control is desktop-inert — and
    measure BOTH columns, not just the one you are editing.

  A finding can also be a real defect wearing an inert control's clothes.
  Both heroes reported as "Wrapper Padding Right, inert @600" were inert
  because a leftover 550px column overflowed the section (§6 of the
  authoring guide): nothing reflowed when the wrapper narrowed. Fixing the
  geometry made both controls live at desktop in exact 16/32/64 steps, with
  no declaration written. Before labelling a control as scoped, check
  whether something upstream is stopping it from working.

  Where the control is dead at BOTH viewports, use
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
2026-08-10 removal did not survive a catalog file rename, and on 2026-08-17
a fix re-added the flag to a dark twin after reading its absence as a gap —
against this very passage. The audit later that day re-found all five; they
are removed again, and the rule now lives where prose cannot lose it: TPL's
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

## Versioning (2026-08-18)

Every EN artifact and the app itself carry an integer version, anchored to
content hashes so increments are mechanical and can never be lost:

- **TPL `versions.json`** — one entry per entity: `email-template` (the
  `main.mjml` SHELL — every leaf `<!-- START/END -->` block region replaced
  by a name sentinel; **shell only**, see below), `autoresponder:<file>`,
  `partial:<file>`, and `block:<name>` (the block's leaf marker regions).
  `catalog-shell` was the SECOND catalog's shell and is deliberately gone
  since 2026-08-21, when `mjml_extra-blocks.mjml` was deleted and
  `tpl_unified-blocks.mjml` became `main.mjml` — there is one catalog now,
  so a block's regions come from one file rather than being concatenated
  across two. Markers nest ("Main Content" wraps a
  catalog), so blocks are the LEAF pairs.
- **App `app-version.json`** — one entity covering index.html plus
  everything under src/.

**"Directly changed" is the bump rule, made precise by the entity
definitions**: editing a block's markup bumps that block alone; editing the
template shell bumps `email-template` alone; editing `styles.css` bumps
`head-css` alone; editing app code bumps the app. A stylesheet change that
alters how every block RENDERS still bumps only `head-css` — versions track
what was edited, not what was affected downstream.

**The two head entities were mis-scoped until 2026-08-21 (user-raised), and
each contained the other's content.** `email-template` concatenated
`styles.css`, and `head-css` hashed every compiled `<style>` including the
`data-en-tools-band` chrome. So a stylesheet edit bumped both, and so did a
band edit: "Email Template vN" and "CSS Styles Block vN" moved in lockstep
for four consecutive commits (v46→v49 alongside v26→v29), which is the same
as neither label saying anything. They now hash disjoint content —
`email-template` the shell, `head-css` the compiled head MINUS the band —
so each number moves only when the thing it names does. Verified both ways:
a `styles.css` edit moves `head-css` and not `email-template`; a band edit
moves `email-template` and not `head-css`. Correcting the definitions
changed both hashes once, which is a real bump and recorded as one.

**Mechanics** (`scripts/version-sync.mjs` in each repo, first step of each
build): the baseline is the manifest AS COMMITTED (`git show
HEAD:versions.json` / `HEAD:app-version.json`); an entity whose current
hash differs from the committed one gets `committed version + 1`.
Consequences: rebuilding never double-bumps; local iteration cannot inflate
numbers (an entity sits exactly one ahead of HEAD until committed); the
committed history of the manifest IS the version ledger. TPL check-docs
assertion 14 warns when the manifest on disk is stale relative to the
sources. Never hand-edit a manifest, never reset a number. A renamed block
starts over at version 1 under its new name (git history carries the
lineage); entities that no longer exist drop from the manifest. The app
displays its version in the header (`__APP_VERSION__`, defined at build
from app-version.json).
