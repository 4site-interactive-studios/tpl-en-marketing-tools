<!-- MIRROR — DO NOT EDIT HERE. Canonical source: email-to-en-marketing-tools (private repo), docs/mjml-authoring-guide.md. Re-mirrored on every change. -->

# MJML Authoring Guide for Engaging Networks Marketing Tools

Portable best practices for any MJML repo whose output ends up in
Engaging Networks (EN) Marketing Tools as blocks and templates.

Everything here is measured or decided, not theorized. Findings about EN's
behavior come from round-tripping instrumented probe files through a real
account; findings about MJML come from reading its compiled output. Where a
rule exists because something broke in QA, the guide says so.

**Audience**: developers and AI agents working in an MJML template repo.
**Companion documents**:

- The importer's full contract, block by block:
  https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/CONVENTIONS.md
- A reference implementation of every rule below:
  https://github.com/4site-interactive-studios/tpl-en-marketing-tools

---

## 1. The pipeline you are authoring for

```
your .mjml  →  mjml compile  →  compiled HTML  →  importer  →  EN block/template JSON
                                                      ↑
                                      reads your data-* attributes and
                                      generates editable "Replacements"
```

Two consequences shape everything else:

1. **The compiled HTML is what EN sees**, not your MJML. One MJML attribute
   often becomes several HTML carriers (see §4), and a rule that looks
   clean in source can compile into something the importer cannot bind.
2. **Editable fields are generated, not hand-written.** Your job is to
   author MJML whose compiled shape makes the right fields obvious. You do
   not create Replacements by hand; you create the conditions for good ones.

---

## 2. EN's CSS inliner: measured behavior

EN runs its own CSS inliner on every template save, and **it cannot be
turned off**. This is the single most surprising part of the platform, so
know it cold. Measured 2026-08-07 with a 14-probe file through the template
pipeline.

| Construct | What EN does | Consequence |
| :---- | :---- | :---- |
| Plain rule | **INLINED** onto the element | expected |
| `:root { color-scheme }` | **INLINED onto `<html>`** | survives, semantics intact |
| `@media (prefers-color-scheme: dark)` | **KEPT verbatim** | dark mode is safe |
| `@media only screen and (max-width: …)` | **KEPT verbatim** | mobile overrides are safe |
| `:hover` | **KEPT** | safe |
| `<!--[if mso]-->` | **KEPT** intact | Outlook scaffolding is safe |
| `[data-ogsc] …` (top level) | **DROPPED** | Outlook.com dark branch silently deleted |
| Rule with `!important`, when inlined | inlined, **`!important` stripped** | priority does not survive inlining |
| `@media screen` (no condition) | **flattened and INLINED** | not a safe hiding place |
| Rule matching nothing | pruned | harmless |

Plus two structural rewrites: EN injects a hidden preheader `<p>` as the
first child of `<body>`, and converts `background-color` in a style
attribute into a `bgcolor` **attribute** on `<body>` and `<td>`. The
BLOCK pipeline applies the same rewrites to custom block markup, and
returns MSO conditional comments inside a block verbatim (both measured
2026-08-09). What it does to a `<style>` element inside block markup is
not yet measured — keep block styling inline until it is.

### 2a. The escape hatch

**A conditional media query is EN's "do not touch" wrapper.** Anything
nested inside one comes back verbatim, including selectors that are deleted
at top level and including plain rules that would otherwise be inlined.

```css
/* Survives EN untouched. Use for anything that must reach the send as-is. */
@media only screen and (max-width: 9999px) {
  [data-ogsc] .dark-only { display: block !important; }
}
```

Two caveats:

- **The condition must be un-evaluable.** Bare `@media screen` gets
  flattened and inlined; `max-width`/`min-width`/`prefers-color-scheme` are
  retained.
- **The wrapper also hides the rule from Outlook desktop's Word engine**,
  which ignores media queries entirely. Use it for dark mode, mobile, and
  `[data-ogsc]`. Do not park base layout CSS there.

### 2b. The `!important` rule that bites people

Any rule inside a retained media query that must beat a base rule **needs
`!important`**, because the base rule gets inlined onto the element and an
inline style outranks any stylesheet rule without it.

The classic failure is the light/dark image swap. This works:

```css
.dark-only { display: none; }                      /* gets INLINED */
@media (prefers-color-scheme: dark) {
  .dark-only { display: block !important; }        /* needs !important to win */
  .light-only { display: none !important; }
}
```

Drop that one keyword and the swap silently stops working, while looking
perfectly correct in your source, in your local preview, and in the EN
editor. **Diagnostic symptom**: images do not double up, but text stays
dark-on-dark and no asset swap happens.

---

## 3. Vertical pacing: bottom-only, on a closed scale

The single highest-leverage authoring convention.

- **Inter-element space is the upper element's bottom padding.** Never the
  lower element's top padding. The last element in a column supplies the
  column's bottom space.
- **Columns never carry bottom padding.**
- **Spacing lives on a closed named scale.** The importer's built-in
  default is five steps, None / Half / Regular / Double / Triple =
  0 / 8 / 16 / 32 / 48px (`src/core/templateConfig.ts`,
  `DEFAULT_TEMPLATE_CONFIG`). Templates routinely declare their own: TPL
  adds a sixth step, Quadruple = 64px. No free-text spacing fields
  anywhere, so editors can adjust rhythm but cannot break typography.
- **Off-scale values snap** to the nearest step at import (ties round up),
  and the snap is reported as a warning. Do not leave authored values
  silently off-grid: fix the value, or change the declared scale.

Declare the scale in one JSON comment inside `<mj-head>` so the importer
follows your template rather than its defaults. This is **TPL's actual
declaration**, not the built-in default — every `src/*.mjml` in that repo
carries it:

```html
<!-- en-tools-config {
  "spacingScale": { "None": 0, "Half": 8, "Regular": 16, "Double": 32, "Triple": 48, "Quadruple": 64 },
  "widthPresets": { "Full Bleed": 0, "Regular": 16, "Double": 32, "Triple": 48, "Quadruple": 64 },
  "geometryReachPx": 64
} -->
```

**Why bottom-only matters**: it is what lets blocks stack in any order and
still pace correctly. If element A owns the gap below it, A + B and A + C
both look right. If B owns the gap above it, every pairing is a new bug.

**Geometry is not spacing.** Values ABOVE `geometryReachPx` (hero photo
reserves, video band heights) are design geometry and stay hard-coded with
no editable field. Same for sub-8px spacers, which are decorative color
bars, not pacing.

The boundary is inclusive on the spacing side: the importer tests
`n <= geometryReachPx`, so a value equal to the reach is still spacing.
That is why `geometryReachPx: 64` coexists correctly with a
`Quadruple: 64` step — 64 is the largest spacing value, and only >64 is
geometry. The parser enforces the relationship, rejecting any
`geometryReachPx` smaller than the largest declared step.

---

## 4. One value, several carriers

MJML frequently expands one attribute into multiple HTML carriers. If a
value is meant to be editable, **every carrier must be bound together** or
an editor's change lands in some clients and not others.

The worst offender is `mj-section background-url`, which compiles to **four**:

1. the div's inline `background:` shorthand
2. the wrapper table's `background=` attribute
3. a second `url()` inside that table's `style`
4. a `v:fill src` inside the `[if mso | IE]` conditional

Miss the CSS ones and Outlook shows the new photo while Apple Mail and
Gmail show the old one. This cost a full QA round; check compiled output
rather than trusting the source.

The same principle applies to light/dark image pairs (two `<img>` tags, one
logical image) and to any value duplicated into an MSO conditional.

Two companion rules for background sections, both Outlook:

- **Always author a real `background-color` alongside `background-url`.**
  Without one, MJML omits `color=` on the `v:fill` and Outlook shows black
  or transparent whenever the image fails to load.
- **Outlook cannot honor horizontal section padding inside a `v:rect`.**
  Give background sections vertical-only padding and fake the gutters with
  an `mj-group` of narrow spacer columns around the content column.

---

## 5. Authoring for good Replacements

### Make dropdowns possible, not free text

Anything that can be a bounded choice should be. Free-form numbers break
emails. Colors, spacing, widths, alignment, and direction should all resolve
to enumerable options. In practice this means authoring from a consistent
palette and scale so the importer can infer the option list.

### Nested Replacements: measured behavior

EN resolves `{replacement~…}` tags inside Select option values
**recursively**, measured to three levels in a real send (2026-08-09,
probe: block content → Display option value → Link option value →
Link URL): every combination of a two-toggle chain rendered its exact
expected state with zero literal tags. Structuring controls as
fragments-within-fragments (a link toggle nested inside a show/hide
toggle) is therefore safe. The probe block that measured this is
reusable: `docs/en-nesting-probe.json` in the canonical repo.

### Show/hide

A component sharing its column with at least one other non-spacer member
gets an Include/Exclude toggle automatically. Mark the exceptions:

- `data-no-display-toggle` on content that must never be hidden (sender
  identification, unsubscribe text, required logos, interdependent figures)
- A column's only member never gets one, so do not add filler to force it

Selections are per instance: the same block added to a broadcast several
times keeps independent Replacement choices for each copy (measured
2026-08-09), so repeated-block patterns like poll options are safe.

### Horizontal insets

A content component's non-zero right/left padding becomes an "Inset Right"
/ "Inset Left" dropdown on the same closed scale — but only when the side
is authored ON the scale (8/16/32/48…). Off-scale sides read as geometry
and stay pinned, exactly like off-scale bottoms. Author insets on the
scale when you want editors to adjust them; author them off-scale to pin
them. Remember the offsets add: total left offset = the block's gutter
plus the content inset.

### Sole-member consolidation

When a column holds a single element, that element gets no spacing field of
its own; the frame's padding is the one control. Authoring a single-element
column with its own padding creates two knobs for one gap.

### Signal intent with `data-style-*`

Flag the properties meant to be editable, one flag per property:
`data-style-color`, `data-style-background-color`, `data-style-src`,
`data-style-href`, `data-style-padding-top` … `-left`,
`data-style-dark-mode`. Padding always expands to all four sides. These are
declared intent; keep them accurate for every property you touch.

### The rest of the `data-*` contract

| Attribute | Meaning |
| :---- | :---- |
| `data-import-exclude` | dev-only chrome: renders in preview, never imports |
| `data-fully-exclude` | a redundant variant of another block; dropped entirely |
| `data-folder="1234"` | EN folder routing (on a category divider or a block) |
| `data-category-short="Text"` | short category name prefixed onto block names |
| `data-no-display-toggle` | opt out of the show/hide Select |
| `data-no-link-toggle` | opt out of the image link Select |

**Two rules for all of them.** They are valueless flags, so write
`data-no-display-toggle`, not `="true"`. And never remove, rename, or "fix"
one; they are the only channel your design intent has into the importer.

---

## 6. Structure, widths, and Outlook

- **Column widths are editable only for a section's LONE fixed-px column**
  (the inset-box shape), via an enumerated dropdown over the 50px-step
  widths seeded in the stylesheet — never as free text. Author such
  columns with integer widths on the 50px ladder where possible; pin one
  with `data-no-width-toggle` when its width is load-bearing. Side-by-side
  siblings, groups, and group members stay fixed — a deliberate,
  permanent decision, not a gap: members compile with computed inline
  percent widths no edit can reach, and sibling edits break the
  sum-to-600 math.
- **Curating the width ladder.** When 50px steps are the wrong menu,
  declare the exact options: per column with
  `data-width-options="150,250,350"` on the mj-column, or template-wide
  with `"columnWidthsPx": [150, 250, 350]` in en-tools-config (the
  attribute wins). Whole px numbers ≥ 50 only. EVERY offered width —
  curated or not — must have a live `.mj-column-px-N` rule in the
  stylesheet's min-width media query; seed the class for each width you
  curate, or the importer drops that option (it would render in Outlook
  alone) and says so in an info note.
- **Horizontal gutters belong to the frame**, expressed as width presets
  (full bleed / indented / double indent), not as ad-hoc padding.
- **A lone fixed-px column centers in its section's slack**, so that
  section's left/right padding does nothing. Do not author controls for it.
- **Outlook-only values are invisible everywhere else.** A padding that
  exists only inside an MSO conditional or an `mso-*` property would edit
  Outlook alone; it should not become a field.
- **Outlook renders every button square.** It ignores `border-radius` on
  table cells, for both `mj-button` and raw pill hybrids. Accept the
  degradation rather than reaching for VML roundrect wrappers: those break
  the importer's label/color Replacement bindings and bloat every block.
- **Keep fixed-width buttons at 300px or less.** A 400px `mj-button` plus
  32px section padding renders 464px wide and overflows a 375px phone into
  horizontal scroll. Element width and block width are independent
  Replacements in EN, so an editor can combine two legal values into an
  overflow; there is no build-time guard for choices made in EN.
- **Column-order swaps need text shielding.** Reversing a section with
  `direction: rtl` only reorders columns safely when MJML has pinned
  `direction: ltr` on each column div. Verify the pins exist before relying
  on the swap, or text renders reversed.

---

## 7. Assets

- **EN's CDN folders are flat.** Every asset resolves to
  `<asset-root>/<filename>`, so filenames must be unique across the whole
  template. `assets/img/logo.png` and `assets/icons/logo.png` collide.
- **Keep relative paths in source.** The importer rewrites them at export;
  authoring absolute CDN URLs defeats environment portability. The
  exceptions are genuinely external assets.
- **Use 2x resolution** for retina, and never set a display width greater
  than the email width (600px).
- **Staleness is unknowable from a browser.** If a file already exists at
  the asset root, no tool can tell you whether it matches your source: a
  cross-origin image taints the canvas, `crossOrigin` requests fail, and
  resource timing is zeroed. Re-upload when art changes rather than hoping
  a checker will catch it.

---

## 8. QA checklist before you call a template done

1. Grep every `src/*.mjml` for content elements with non-zero
   **top** padding. Only documented overlay/inset exemptions should remain.
2. Grep for columns with bottom padding. There should be none.
3. Grep for spacing values off the declared scale.
4. Confirm every editable background image binds **all four** carriers in
   the compiled HTML.
5. Confirm every dark-mode rule that must override an inlined base rule
   carries `!important`.
6. Confirm no `[data-ogsc]` rule sits at top level; wrap them per §2a.
7. Send a real test: dark mode on, and a ≤480px viewport. The inliner
   failures are invisible in source and in the editor.

---

## 9. Prompt for AI agents working in an MJML repo

Copy-paste this at the start of a session in any MJML repo that feeds EN
Marketing Tools. It pulls this guide and the full importer contract into
context and keeps them there.

```text
You are working on the MJML source of an email template whose compiled
output is imported into Engaging Networks (EN) Marketing Tools as blocks
and a template. Two documents govern this work. Fetch and read BOTH in
full before making any change, and treat them as binding:

1. MJML Authoring Guide for EN Marketing Tools (best practices, EN's CSS
   inliner behavior, the data-* contract, the QA checklist):
   https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/MJML-AUTHORING-GUIDE.md

2. Conventions & Business Logic (the importer's full contract: how every
   editable field is generated, named, ordered, and suppressed):
   https://raw.githubusercontent.com/4site-interactive-studios/tpl-en-marketing-tools/main/CONVENTIONS.md

A reference implementation of every rule lives at
https://github.com/4site-interactive-studios/tpl-en-marketing-tools

Non-negotiables while you work:
- Vertical spacing is BOTTOM-ONLY and on the template's declared scale.
  When you move padding, keep the total inter-element gap identical
  (upper.bottom + lower.top must not change).
- Never remove, rename, or "fix" any data-* attribute. They are valueless
  flags, and they are the only channel design intent has into the importer.
  Keep data-style-* accurate for every property you touch.
- If a design needs values outside the declared defaults, do not silently
  ignore the grid. Change the en-tools-config declaration deliberately, in
  every src/*.mjml that declares one, in the same commit.
- Any CSS that must survive EN's inliner untouched has to be nested inside
  a conditional media query. Bare @media screen does not work.
- Any dark-mode rule that must beat an inlined base rule needs !important.
- An editable background image must bind ALL FOUR compiled carriers.

When you finish, run the QA checklist in section 8 of the guide and report
which checks you ran and what they returned. If you added or changed a
convention, say so explicitly so the canonical documents can be updated.

Task: [describe the change]
```

---

## 10. Keeping this document alive

This guide is a **mirror**. The canonical source is `docs/mjml-authoring-guide.md`
in the (private) `email-to-en-marketing-tools` repo, alongside
`docs/conventions.md`. Both are re-mirrored to the public TPL repo on every
change, because agents in other repos cannot read a private one.

If you are working in the canonical repo: the pre-commit review in
`CLAUDE.md` covers this file too. A rule that only lives in a chat
transcript is considered lost.

If you are working in another MJML repo and discover something this guide
gets wrong or does not cover, say so rather than working around it. The
guide is only useful while it stays true.
