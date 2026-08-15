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

EN runs its own CSS inliner on everything it sends, and **it cannot be
turned off**. This is the single most surprising part of the platform, so
know it cold. Measured 2026-08-07 with a 14-probe file through the template
pipeline. Timing refinement (measured 2026-08-11, escape-probe round 2t):
the inliner is a SEND/RENDER-TIME transform — the STORED template keeps
your source verbatim (a top-level rule was still raw in the exported
template while the sent copy arrived inlined), so exports round-trip your
source and every verdict below describes what reaches the client, not
what EN stores.

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
first child of `<body>` — filled from each email's per-send **Preview
Text** setting, and prepended to the text/plain part too (measured
2026-08-10 on a blank-template send). **Therefore do NOT author
`<mj-preview>` in a broadcast template**: its compiled preheader div
would sit right after EN's injected one and inbox snippets would show
both lines. (Autoresponder sources that don't send through Marketing
Tools broadcasts may still need their own.)

The same reasoning covers the TITLE. `<mj-title>` compiles to two carriers
— the head `<title>` and an `aria-label` MJML mirrors onto the body
wrapper — and the importer STRIPS both, creating no field for either. The
sender types the title in EN when they build the send, so a template copy
would only ask for it twice and go stale immediately. Authoring
`<mj-title>` is harmless (your own previews use it); just don't expect it
to reach the EN template. The aria-label removal is also an accessibility
gain: that wrapper spans the whole email, so a screen reader would
announce the entire body as one string repeating the title.

EN also converts
`background-color` in a style
attribute into a `bgcolor` **attribute** on `<body>` and `<td>`. The
BLOCK pipeline applies the same rewrites to custom block markup, and
returns MSO conditional comments inside a block verbatim (both measured
2026-08-09). A `<style>` element inside block markup goes through the
SAME inliner (measured 2026-08-09): plain rules are inlined and the
element is removed from the body, a bare `@media screen` is flattened
and inlined, and conditional media queries — nested `[data-ogsc]`
included — are retained verbatim but HOISTED into the email's head
stylesheet, with same-condition queries merged into one block. Hoisting
makes block CSS global to the WHOLE email, so scope class names (e.g. a
block-specific prefix) to avoid cross-block collisions. Ordinary HTML
comments in block markup survive untouched. The bgcolor rewrite also
REBUILDS a table's `background:` shorthand (measured 2026-08-09): the
color moves to `bgcolor`, any `url()` is DROPPED, and the leftover
shorthand (e.g. `background: repeat center top / auto`) still counts as
author CSS — it RESETS the background in CSS clients, overriding both
the `bgcolor` and legacy `background=` attributes. See §4 for the
carrier consequences.

Three more findings, first measured 2026-08-11 with import/edit/send
round-trips of a two-rule probe block and an A/B logo probe through a
real account:

- **`>` in CSS text gets HTML-escaped somewhere in EN's editing
  surfaces** (`&gt;`; tag delimiters stay intact). Since `style` is a
  raw-text element, entities are never decoded there: every
  child-combinator selector becomes invalid CSS and is silently dropped
  by the client. The classic casualty is a paired dark-mode rule —
  `.block p { color: #fff }` survives while `.block > table {
  background: #000 }` dies, leaving white text on a white panel. The
  block editor DISPLAYS HTML-Replacement CSS escaped, but the
  2026-08-12 surface-matrix rounds cleared open/save as
  non-destructive; §2d carries the full reconciled account and the
  authoring rule (**no child combinators in CSS that ships to EN**).
- **EN splits comma-separated selector groups into individual rules**
  (`.a, .b, .c { … }` → three rules). Harmless alone, but it means one
  authored group can end up half-alive after the escaping above, and
  sent CSS never diffs cleanly against authored CSS.
- **The `bgcolor` ATTRIBUTE does not resist Outlook's dark-mode
  inversion.** A panel colored via `bgcolor="#362229"` inverts to the
  same pale pink as one colored via CSS `background-color` (measured
  A/B, Outlook 2021 + M365 on Windows, dark mode). Attributes buy no
  protection — light-ink transparent PNGs on dark panels need per-mode
  asset variants or a baked-in background instead.

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

### 2c. Where dark mode can and cannot reach

The dark-mode strategy has exactly two hooks, and both survive EN:
`@media (prefers-color-scheme: dark)` (Apple Mail, iOS Mail, and
friends) and `[data-ogsc]` inside a conditional media query
(Outlook.com / OWA). Two mainstream clients expose NEITHER hook
(measured 2026-08-09, real TPL send viewed across clients):

- **Gmail app (Android, dark theme)** ignores `prefers-color-scheme`
  and force-applies its own auto-darkening. The `dark-only` swap cannot
  fire; the light variant renders and Gmail recolors it.
- **Outlook 2021 Windows (Word engine, dark mode)** supports no media
  queries at all, and `[data-ogsc]` is Outlook.com-only. TPL
  additionally excludes `dark-only` images from Outlook with
  `<!--[if !mso]><!-->` — deliberate, since Word cannot reliably
  `display:none` them — so desktop Outlook can only ever receive the
  light asset, which its dark mode then recolors around.

This is client design, not an EN or importer limitation, and no CSS
reaches it. Worse, the two clients transform in OPPOSITE directions
(both measured 2026-08-09 on real TPL sends): the Gmail app darkens
light designs, while Outlook desktop dark mode also INVERTS dark ones —
it flipped the Footer's #000000 to a white background while leaving its
light-green logo and white social icons untouched, stranding light
artwork on a light surface. Images are never recolored by either
client; that is both the failure mode and the defense. Every swap
asset — light-only AND dark-only — must stay legible on EITHER a light
or a dark surface, because a client that cannot run the swap may hand
it the opposite background: prefer wordmarks and icons that carry
their own contrast (knockout/outline), or serve Outlook a hand-picked
single asset via `<!--[if mso]>`. The solid-color background-tile
pin was probed and REJECTED (2026-08-09, 15-client EoA matrix,
docs/en-bg-tile-probe.html in the canonical repo): the VML fill itself
does resist Outlook's dark inversion, but the HTML `bgcolor` layers
MJML must interleave above it invert to white and cover the content
area, and Outlook flips the white text dark regardless — two
independent kills. Asset contrast remains the only defense here.

### 2d. EN escapes `>` in shipped CSS — never author a child combinator

Somewhere in EN's editing surfaces, `>` in CSS text gets HTML-escaped to
`&gt;` (tag syntax keeps its own `>`; only text content is encoded). An
escaped selector is invalid CSS, and clients silently drop the rule. The
corruption is real and measured — a production send carried
`.block&gt;table` while the block's export was clean — but the exact
surface is still being isolated (2026-08-11 surface-matrix probe,
`docs/en-editor-escape-probe.html` in the canonical repo): import is
clean, send is clean, EN's **inliner handles `>` correctly** (it inlined
a top-level child-combinator rule properly at send time), and open/save
round-trips through the **block-library editor, the template editor, and
the email builder's replacement raw-code box are all non-destructive**
(stored artifacts byte-identical afterward — the block editor merely
DISPLAYS text HTML-encoded). Remaining suspects: WYSIWYG/visual edit
modes that re-serialize the DOM, and legacy EN artifacts with unknown
edit history. Until the surface is pinned down, treat every editing
surface as hostile to `>`.

The failure signature is nasty because paired rules decouple: in a dark
scheme authored as `.block p { color:#fff }` + `.block > table {
background:#000 }`, the text rule survives and the background rule dies —
white-on-white text. Per-rule recovery also is not guaranteed
everywhere: treat one invalid selector as potentially poisoning the whole
sheet in stricter engines.

**Therefore: no child combinators anywhere in CSS that ships to EN** —
head styles, `<mj-style>`, or `<style>` inside block markup. For MJML's
unclassable structural elements, two measured stand-ins cover the usual
targets, quote-free so nothing in them can be escaped:

```css
/* the section/column OUTER table (the one carrying the authored
   background inline) — only outer tables carry align=center in the
   non-MSO DOM: */
.block table[align=center] { background-color: #000000 !important; }

/* the column WRAPPER td (exists only when a column authors padding /
   border / background; widget tds never carry vertical-align inline): */
.two-col-column td[style*=vertical-align] { padding: 0 !important; }

/* the section's own main td carries direction inline: */
.inset-gutter td[style*=direction] { padding-left: 32px !important; }
```

Caveat: attribute selectors are inert in Gmail. That is acceptable for
dark-mode branches (Gmail exposes no dark hook anyway, §2c) and for
cosmetic mobile insets; anything Gmail-critical must stay class-based or
become a plain descendant selector.

**These two constraints together rule out the obvious fix for a
Gmail-only layout bug**, so expect to work harder there. A worked example
(2026-08-12): an external reviewer proposed changing
`.first-column, .second-column { margin-bottom: 20px !important }` to
`.first-column > table, …` on the grounds that some clients ignore margin
on a `div` — correct diagnosis, unusable form. The child combinator is
exactly what EN escapes; the attribute-selector stand-in is inert in
Gmail, which is the failing client; and a bare `.first-column table`
descendant would also hit every nested image and button table in that
column. The escape-safe options are to scope the descendant to a LEAF
component whose only table is its own (the `.two-col-image table`
precedent above), or to change the structure upstream so a class lands
where the rule needs it. Verify by render either way.

**`.class element` IS the house pattern — it reaches everything**
(measured 2026-08-13 across four EoA rounds). It is the one selector form
that survives the whole chain: EN escapes child combinators, Gmail ignores
attribute selectors, and a plain `.class td` is honoured by both. That
unblocks a category of fixes previously treated as impossible, because
MJML's structural `<td>`s carry no class of their own and were considered
unreachable. Pair it with a two-class override to put exceptions back:

```css
@media (max-width: 599px) {
  .flush-mobile-capflush td { padding-left: 0 !important; }        /* 0,1,1 */
  .flush-mobile-capflush .wysiwyg { padding-left: 16px !important; } /* 0,2,0 wins */
}
```

Two classes outrank one class plus an element, so the second rule wins
exactly where its class lands and the first governs everything else. This
is how the catalog takes imagery flush to the screen edge on mobile while
copy keeps a readable inset. Verified: image 262.7 -> 326.0 CSS px, copy
held at 29, desktop byte-identical to the control. It also cleanly
outranks an incumbent single-class rule, so an older `.caption
{ padding-left: 16px }` does not have to be removed to be overridden.

And a descendant selector reaches
INTO wrappers, so pacing rules like `.wysiwyg div *:first-child
{ margin-top: 0 }` require that authored content never nest a block
element inside an inline wrapper — write `<h1><a>…</a></h1>`, never
`<a><h1>…</h1></a>`.

### 2e. Mobile gutters — the "images aren't full bleed" finding

**There is no column-shrink bug.** A QA round read Gmail Android as
shrinking two-column cards; four probe rounds disproved it. Pixel 10 is
1080 device px at DPR 3, so Gmail lays the email out at **~333 CSS px**,
and on that screen a card loses 80 CSS px — a quarter of the width — to
section (32×2) and column (8×2) gutters. The image always filled its
column exactly: predicted 252.7 vs measured 251.0, while the competing
"column padding removed" model predicted 268.7 and was off by 17.7.
Cross-checked against background bands in the same render, which carry no
side padding and do span the full container. The ratio is not
client-specific either — 0.755 on Gmail Android, 0.746 on iPhone.

That is why percent columns, `mj-group` and inlined `min-width` all
measured identically to the control: there was nothing for them to fix.
**Diagnose gutters before restructuring columns.**

Measured options, same card, Gmail Android (EoA pTdFUx7a / dnYN8bje):

| treatment | image | desktop |
| :---- | :---- | :---- |
| control — section 32, column 8 | 262.7 CSS | — |
| tighter — section 16 | 290.7 | changes |
| authored flush — section 0, column 0 | 332.7 | changes |
| **`.flush-mobile-capflush` (shipped)** | **326.0** | **untouched** |

The CSS route wins because it costs no desktop change. Caption alignment
is the only open choice, and both forms are proven — switching is a
one-selector edit:

| | caption | shipped |
| :---- | :---- | :---- |
| caption with the PHOTO (flush) | 14 CSS | **yes** — matches `padding="8px 0 0"` |
| caption with the COPY (inset) | 30 CSS | add `.flush-mobile-capflush .caption` to the override rule |

Body copy holds its 29 CSS inset either way. Applied to the seven blocks
that pair a `fluid-on-mobile` image with two or more columns.

The importer warns on any child combinator in a block's shipped CSS, and
an EN-side bug report with a minimal PoC block lives at
`docs/en-bug-html-replacement-escapes-css.md` in the canonical repo;
until EN fixes the escaping, treat this as a permanent authoring rule.
The most consistent reading of all measurements so far: the editor
escapes the DISPLAYED value, an untouched save writes the original back,
and the escape persists only when the field content is actually edited
and resubmitted (or re-serialized by a visual mode) — which is why
freshly imported blocks send clean and long-lived production blocks with
edit history shipped `.block&gt;table`.

## 3. Vertical pacing: bottom-only, on a closed scale

The single highest-leverage authoring convention.

- **Inter-element space is the upper element's bottom padding.** Never the
  lower element's top padding. The last element in a column supplies the
  column's bottom space.
- **Columns never carry bottom padding.**
- **Spacing lives on a closed named scale.** The importer's built-in
  default is five steps, None / Half / Single / Double / Triple =
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
  "spacingScale": { "None": 0, "Half": 8, "Single": 16, "Double": 32, "Triple": 48, "Quadruple": 64 },
  "widthPresets": { "Full Bleed": 0, "Single": 16, "Double": 32, "Triple": 48, "Quadruple": 64 },
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

**EN kills carrier 3 and weaponizes its remains** (measured 2026-08-09,
15-client EoA matrix): the inliner rebuilds the table's shorthand —
color to `bgcolor`, `url()` dropped — and the leftover shorthand resets
the background in every CSS client, beating carriers 2 and the bgcolor
fallback. Constrained sections still paint because carrier 1 (the
wrapper div) survives untouched. **A FULL-WIDTH section has no div
carrier, so after EN it renders BLANK in Gmail, Apple Mail, and iOS —
never author `full-width` + `background-url` for EN.** TPL's
check-docs enforces this; every current TPL background block is
constrained, which is why the bug never fired in production.

The same principle applies to light/dark image pairs (two `<img>` tags, one
logical image) and to any value duplicated into an MSO conditional.

Two companion rules for background sections, both Outlook:

- **Never put `background-color` on a section that also has
  `background-url` — put it on an `mj-wrapper` behind it instead.**
  MJML copies a section's background colour onto the Outlook `v:fill` as
  `color=`, and the Word engine paints that colour INSTEAD of the photo, so
  every background hero renders as a flat slab. Measured 2026-08-13 (EoA test
  aBPD6k1l, three variants of the same band):

  | shape | Outlook 2021 Win | M365 Win | M365 **Mac** | Apple/iOS/Gmail |
  | :---- | :---- | :---- | :---- | :---- |
  | colour + url on the section | **slab** | **slab** | photo | photo |
  | url only | photo | photo | photo | photo |
  | url on section, colour on a wrapper | photo | photo | photo | photo |

  So this is Word-engine-specific, not "Outlook" — M365 on Mac renders the
  old shape fine, which is why the failure looked inconsistent. In dark
  mode the slab is worse than useless: Outlook inverts the maroon to pink.
  Dropping the colour outright would fix the photo but leave an
  image-blocked client with no brand fallback, hence the wrapper — it
  paints BEHIND the section, so it never reaches the VML rect:

```xml
<mj-wrapper background-color="#362229" padding="0" data-style-background-color>
  <mj-section background-url="assets/photo.jpg" background-size="cover"
              background-repeat="no-repeat" background-position="center center"
              padding="16px 0">
    …
  </mj-section>
</mj-wrapper>
```

  Two importer consequences to expect, both harmless but visible: the
  colour field is now named **Wrapper** Background Color (merge tag
  `wrapper_background_color`, not `block_background_color`), and the
  wrapper contributes its own four padding fields. Re-import rather than
  hand-editing blocks already in EN.

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

### Viewport-scoped controls (measured 2026-08-09)

The importer pixel-audits every generated dropdown at 600px and 375px and
codifies what it proves, so expect:

- **An image sized to its column's content width gets no Alignment field**
  — alignment has nothing to move. An image that fills the column only at
  ONE viewport (`fluid-on-mobile`, or an mj-group member whose percent
  width shrinks below the image at 375px) keeps the field, labeled
  "Desktop Alignment" / "Mobile Alignment" for where it works. Leave a few
  px of slack at both viewports if you want a plain, always-live control.
- **A symmetric spacer-column section gets no Column Order control** — the
  Outlook-safe `25px spacer | content | 25px spacer` pattern reads the
  same reversed, so the swap would be the identity. Only asymmetric column
  layouts get the control.
- **Column Width dropdowns are labeled "Desktop Column Width"** — the
  `.mj-column-px-*` classes are min-width:600px-gated, so the control acts
  at desktop only; below 600px columns stack full-width regardless.
- More generally: labels prefixed "Desktop " / "Mobile " mean the control
  moves pixels at that viewport only. The merge-tag names never carry the
  prefix.
- **When the stylesheet cannot say it, declare it.** A centered,
  content-sized child makes symmetric gutters invisible; a short column's
  trailing spacing is absorbed by its taller sibling until the columns
  stack. Neither is derivable from CSS, so mark the owning element
  `data-desktop-only-width`, `data-mobile-only-spacing-below`,
  `data-desktop-only-direction` (tokens: `align`, `direction`, `width`,
  `spacing-below`). It is a claim the audit re-checks, not an escape
  hatch — and where a control is dead at BOTH viewports use
  `data-no-width-toggle` instead, since no label makes it honest.
- **A mobile pin must cover every carrier of the value.** MJML writes a
  button's `align` onto two cells; pinning only the outer one centers the
  pill but leaves a WRAPPED label following the desktop setting — so the
  control measures inert for short copy and comes alive for long copy.
  Pin both (`td.button`, `td.button table td`) or claim nothing.

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
| `data-no-background-color` | keep an authored `background-color` as a fallback but generate no field, for a background that provably cannot show |
| `data-no-direction-toggle` | no column-order control on this row, for columns whose content is pinned to the block's outer edge (see §6) |
| `data-no-width-toggle` | no width dropdown on this frame or column — the width provably changes nothing |
| `data-desktop-only-<token>` / `data-mobile-only-<token>` | this control only works at that viewport; the importer prefixes the LABEL ("Desktop Block Padding Left/Right"). Tokens: `align`, `direction`, `width`, `spacing-below` |

**Three rules for all of them.** They are valueless flags, so write
`data-no-display-toggle`, not `="true"`. Never remove, rename, or "fix" one
on a hunch — they are the only channel your design intent has into the
importer, and a flag you don't understand is one you haven't traced yet.

But a flag must EARN its place. The importer checks every one of these on
import: it strips the attribute, regenerates the block, and compares. If the
output is byte-identical the flag does nothing, and the block reports it —
"changes nothing … Remove it from the MJML". Act on that. A flag the importer
ignores still reads as a deliberate decision to the next person, and it ships
in the compiled HTML of every block that carries it.

Two things that check has already taught us: a `dark-only` image twin never
gets its own Display toggle (the importer folds it into its light pair), so
`data-no-display-toggle` on one is always inert; and a component in a block
that generates no Display fields at all does not need opting out of them.
Note the check removes one attribute at a time, so when a block reports
several, remove them one at a time and re-import between — flags can prop
each other up, and the report says so when they do.

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
- **The column-order control ships BOTH arrangements, so alignment moves
  with the columns.** `align` is physical: a logo `align="left"` beside a
  button `align="right"` points outward as authored, and a naive flip leaves
  both facing inward, collapsing the content into the middle (measured
  2026-08-10: 238px of span lost). Since 2026-08-11 the importer stores the
  whole row twice — one fragment per order, with box-level alignment already
  mirrored and the Outlook cells reordered — so the flip is correct
  everywhere, Outlook included. Two consequences for authoring:
  a pinned member's **Alignment field disappears** (it is baked into each
  order; one field cannot hold two values), and a pinned image that is ALSO
  link-wrapped keeps a shared alignment across both orders, because anything
  behind another fragment resolves to one value — align such an image
  outside the link, or expect to set its alignment by hand after a flip.
  `mj-text` is never affected: it fills its column, so its align moves
  glyphs, not layout. Where the mirrored arrangement is really a different
  design, declare `data-no-direction-toggle` and ship it as its own block,
  the way `Story Card (image left…)` and `(image right…)` already are.
- **Buttons side by side are hand-rolled, and the row needs a declared
  height.** `mj-button` compiles to its own table and cannot sit next to
  another in one column, so a row of buttons is inline-block pills inside a
  single `mj-text` (`.cta-group` wrapping `.cta-item`), with MSO
  conditional cells so Outlook gets a real table row. Two consequences:
  - The row wraps on a phone whenever the pills are wider than the screen —
    which fixed-width variants guarantee, since their widths are sized to
    exactly fill the 600px content box. A `@media` rule
    (`.cta-item { display:block; margin:0 0 16px }`) turns the wrap into a
    clean stack, but a client that strips `<style>` never sees it and falls
    back to inline-block wrapping.
  - In that fallback the row's height comes from the line box, and a
    renderer that sizes line boxes from `line-height` instead of growing
    them to fit inline-blocks will **overlap** the wrapped rows (measured
    2026-08-10, Gmail app on Android). This is a known, UNFIXED cosmetic
    issue — and the obvious fix is a trap worth recording.

    Declaring the row height inline (`line-height: <pill height>px` on
    `.cta-group`, `line-height: 0` on each `.cta-item`) reasons correctly in
    every browser and was verified byte-identical on desktop and mobile.
    It still shipped a **severe** regression: Outlook's Word engine honours
    `line-height: 0` on the item, collapses the line box, and renders every
    hand-rolled pill as a thin bar with **invisible label text** (reported
    2026-08-11, reverted the same day). A real `mj-button` is unaffected —
    only these inline-block rows.

    So: do NOT put `line-height` on `.cta-group` / `.cta-item`. Any future
    attempt at the wrap spacing must be invisible to Word — a media-query
    rule rather than an inline style — and must be proven in Outlook before
    it ships, not just in a browser.

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
6a. Confirm no `<mj-preview>` in broadcast sources — EN injects its own
   preheader from the per-email Preview Text setting (§2), and a
   template-baked one doubles the inbox snippet.
6b. Confirm no child combinator in ANY CSS that ships to EN — head
   styles, `<mj-style>`, or `<style>` inside block markup. EN escapes
   `>` to `&gt;` somewhere in its editing surfaces and the rule silently
   dies (§2d). Selectors extracted from the compiled `<style>` blocks
   must contain zero `>`.
7. In dark-mode passes, check Gmail app and Outlook desktop
   SPECIFICALLY: the swap cannot fire there (§2c), so judge whether the
   light-only assets survive the client's own auto-darkening.
8. Send a real test: dark mode on, and a ≤480px viewport. The inliner
   failures are invisible in source and in the editor.
9. After import, open the Inert Dropdown Audit, run it, and read the Check
   column: **every row should say PASS**. PASS means the field behaves the
   way its label and kind promise — including the intended-inert ones (link
   toggles, Outlook fallback colors). Any FAIL means the template pins a
   control the importer generated, or a label does not say where the control
   works; either the source or the importer needs a decision
   (§5 "Viewport-scoped controls").

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
- No CSS child combinator anywhere that ships to EN: EN escapes `>` to
  `&gt;` somewhere in its editing surfaces and the rule silently dies.
  Use classes, plain descendants, or the guide §2d attribute-selector
  idioms.
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
