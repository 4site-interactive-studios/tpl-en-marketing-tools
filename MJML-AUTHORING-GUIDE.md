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
| `vertical-align` in a td's style | **moved to a `valign` ATTRIBUTE** | `td[style*=vertical-align]` selectors die in the inbox (measured 2026-08-18, EoA aafUJU…: 0 of 107 delivered tds kept it inline; `direction` survives in style) |
| CSS comments | **STRIPPED** at send | comment weight never reaches recipients — it costs the CSS Editor box, not the payload |
| `<a>` wrapping a `<table>` | **anchor AUTO-CLOSED before the table** | the delivered link arrives EMPTY with the table expelled after it — the row is unclickable in every client (measured 2026-08-18, probe 0Mgmjr…: 167 delivered chars to `</a>` where the build wraps 1,160). Anchor per CELL around inline content, never around a table — share one URL across the cells with `data-link-group` (§5) |

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
  trigger is now pinned down (2026-08-13, four sends): **editing** the
  field persists the escape; opening and saving it untouched does not.
  §2d carries the full reconciled account and the authoring rule (**no
  child combinators in CSS that ships to EN**).
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

**The wrap defends against the inliner — which is also its cost, so a
defensive always-true wrap ships as a PAIR (learning 2026-08-18).** A
handful of clients still read NO stylesheet at all — the Gmail app on
non-Google/IMAP accounts strips `<style>` wholesale, and forwarding drops
head styles in most clients — and for them the inliner is the delivery
mechanism: a rule that only exists inside a media query never reaches
those recipients. So when you wrap an unconditional rule in an always-true
condition purely to keep it OUT of the inliner (the `.mobile-only` hide),
author the SAME rule twice: the plain top-level twin, which EN inlines
onto the element (the layer for style-stripping clients), and the wrapped
copy, which survives as a stylesheet rule where the inline was lost. Any
rule meant to OVERRIDE the pair later must beat both layers — `!important`
outranks the inlined twin (EN strips its `!important` when inlining, §2b)
and later source order wins against the wrapped copy. The `.dark-only`
swap has run this exact cascade in production since the beginning; TPL's
build asserts the pairing so the plain twin cannot silently go missing.
The rule does NOT apply to wraps that exist for RETENTION of
conditional-context selectors — `[data-ogsc]` matches nothing at send
time, so it has no meaningful inline form.

**EN merges same-condition `@media` blocks into the FIRST occurrence's
position (measured 2026-08-19, EoA delivered heads).** Two blocks with the
byte-identical condition string anywhere in the document come back as ONE
block sitting where the EARLIER one stood — every rule from the later
block moves forward with it. Any cascade that depends on source order
(a hide block that a later same-specificity reveal must beat) is silently
inverted if the reveal's condition also appears in an earlier block. Two
defenses, use both: give order-dependent blocks conditions that are
deliberately distinct from every other block's (TPL's 9998px hide vs the
9999px OWA block), and keep each condition string authored in exactly ONE
place — a second `(max-width: 599px)` block in an `<mj-style>` head
dragged the stylesheet's entire mobile block ahead of the hide it had to
follow. Note the merge matches conditions textually:
`only screen and (max-width:599px)` (MJML's own emission) and
`(max-width: 599px)` are different strings and do not merge.

**And never write tag-like text inside CSS — comments included (outage
2026-08-18).** Any consumer that inlines the stylesheet into an
`<mj-style>` before parsing (the importer does) tokenizes the CSS as HTML:
a literal `style`/`script`/`title`/`textarea` opener in a comment flips
the tokenizer into raw-text mode and silently swallows the rest of the
document — every import fails with MJML's misleading "Malformed MJML"
error. An unterminated comment marker does the same via the comment
state. Name tags in prose ("drops style blocks", "the revealed
`[if !mso]` conditional"); the importer now raises a precise error on a
hazardous sheet, and TPL's build warns before one can ship.

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

### 2b-bis. Gmail's CSS size cliff — every Gmail surface (measured 2026-08-18)

The Gmail app does not categorically drop head styles — it drops them by
SIZE, and it drops them WHOLE. Measured as a controlled pair on the same
day, same account, same client matrix:

- A real 3-block send carrying the full template head CSS (28,331 bytes
  delivered) rendered in the Gmail app with the ENTIRE `<style>` ignored:
  the mobile rules at byte offset 12.4K did not apply (well before any
  16K clip point — the drop is all-or-nothing, not a truncation), the
  dark rules did not apply (the background painted Gmail's own #121212
  auto-dark, not the template's #000000), while inline-style behavior
  (column stacking) was intact (EoA 3ZeoECY…).
- A standalone probe whose delivered head CSS was 715 bytes rendered with
  every media query honoured — including `mj-full-width-mobile` image
  scaling and the min-width:600 column classes (EoA fHTqInbC…).
- Confirmed under full production conditions with the head-CSS canary
  block riding a real EN-built email (EoA 5BTkRd…, 27,126 delivered CSS
  bytes): the Gmail app showed the always-on canary RED and both
  viewport canaries inert (stylesheet dropped whole), while iPhone
  showed green + the mobile canary firing. The controlled pair closed
  the same day: the identical canary block in a BLANK EN template (487
  delivered CSS bytes, EoA XK3793…) showed GREEN + firing mobile canary
  in the very same Gmail app — stylesheet size is the only variable, and
  the drop is whole. The canary block (Utility — Probe Block (head CSS
  canary)) is ARCHIVED with every verdict recorded (user decision
  2026-08-18, closing the round after its acceptance test — a
  full-template send showing GREEN — passed; verdict bullet below;
  supersedes the same-day permanent-instrument call). The annotated
  instrument lives in the TPL repo at
  `archive/probes/probe_head-css-canary.mjml` — paste it back into both
  catalogs, re-import, and send whenever Gmail's budget behavior needs
  re-measuring.
- The cliff is NOT mobile-only: Gmail DESKTOP webmail (Chrome) showed
  the identical pair — full template RED with every canary inert, blank
  template GREEN with the desktop canary firing purple (same EoA pair).
  Every Gmail surface shares the sanitizer, so an oversized stylesheet
  costs hover states, dark rules, and desktop refinements for Gmail
  users on every device — not just Android phones.
- The importer's answer (2026-08-18): the Template Styles block ships a
  COMPACT form of the extracted stylesheet (comments stripped, one rule
  per line — the app would otherwise beautify ~12KB of pretty-printing
  into the payload) hard-coded in the block's own single content
  `<style>` — per-email CSS edits are disabled by design, and the
  builder band's label shows the CSS revision ("CSS Styles Block vN",
  from the repo's versions.json head-css entity).
  The block carries a live Gmail budget meter (16,384 hard / 14,000
  target) that itemizes EN-hoisted block styles. Budget the DELIVERED
  size, not the authored size — authored comments and formatting are
  free.
- **EN ingests a stylesheet once per `<style>` wrapper — carry exactly
  one** (measured 2026-08-18, during the 2026-08-15→18 era when the
  head CSS rode a CSS-type field). EN wraps a CSS-type replacement
  value in its own bare `<style>` at render; a block html that ALSO
  wrapped the `{replacement~head_styles}` tag nested two `<style>`
  tags, and EN's send pipeline ingested the stylesheet ONCE PER
  WRAPPER: every delivered head carried two full copies (24,952 bytes —
  over the cliff with a compact field that measured 9,713 bytes in the
  editor). Removing the extra wrapper took the very same email to
  13,325 delivered bytes. The doubling was invisible in EN's editor —
  it showed only in the DELIVERED payload, as every distinctive
  selector appearing twice. The current inline shape carries the CSS in
  exactly one content `<style>` with no merge tag, so there is nothing
  for EN to wrap.
- **EN re-prints all head CSS at send**: comments stripped, plain
  top-level rules inlined away and removed, same-condition `@media`
  blocks merged, comma selector groups split, colon-space formatting
  restored. Net on a compact field: **×1.30 delivered vs authored**
  (measured: 9,713 → 12,644). Budget against the re-printed size — the
  importer's meter and TPL's check-catalog §8 both apply the factor.
- **Acceptance verdict (2026-08-18, EoA TlHVjaQ…, 13,325 delivered
  bytes): PASS.** Canary bar 1 GREEN on the Gmail Android app and Gmail
  desktop webmail, light and dark; mobile bar firing blue on phones,
  desktop bar firing purple on webmail; dark bar firing white-on-black
  in the Android dark render (Gmail webmail keeps email content light —
  expected client behavior, not a failure). The cliff round is closed:
  a full-template EN send now delivers its entire head stylesheet on
  every Gmail surface.

Consequences: (1) every responsive or dark behavior that lives ONLY in
head CSS silently dies in the Gmail app once the delivered stylesheet
crosses the cliff — budget the DELIVERED CSS size, not the authored size;
(2) the §2a inline-first doctrine is the armor: the no-CSS rendering of
every element should already be the correct MOBILE rendering, with
desktop pinned by min-width rules and MSO cells. The same probe measured
the inline-first image pattern (attribute width for Word + inline
`width:100%` for everyone else + desktop capped by column classes and MSO
cells) rendering correctly in the Gmail app, Apple Mail, Gmail webmail,
and Outlook desktop — and EN's inliner leaves inline `width:` on img and
table untouched (11/11 carriers delivered verbatim; the
`vertical-align`→`valign` rewrite does NOT extend to width).

The pattern ships as the **`inline-fluid` css-class token** on grid
mj-images (both twins of a swap pair): the build rewrites the compiled
image's constraining td to `width:100%` (bordered images also gain
`box-sizing:border-box`), and the importer deliberately mints no Width
field for flagged images — the width attribute would edit Outlook alone.
Author it on any side-by-side image whose stacked mobile rendering
should be full-bleed.

### 2c. Where dark mode can and cannot reach

**First, a measured mercy (2026-08-18, EoA aafUJU…, all five dark-capable
renders):** an authored light ground with NO dark hook at all — an
mj-column carrying `background-color="#ffffff"` and no css-class — rendered
dark and legible in Apple Mail, the Gmail app, Outlook.com, and both Word
engines. EN rewrites the inline colour to a `bgcolor` attribute at send,
and every dark-capable client in the matrix transformed that ground itself; the white-on-white
failure predicted from the LOCAL build (1.00:1 with the dark branch forced
on) never reached an inbox. Two consequences: dark-mode claims must be
measured on the DELIVERED html, never the compiled build — the artifact
the prediction was made against does not survive the inliner — and an
explicit dark rule is a belt over the clients' own braces, worth writing
when you need a SPECIFIC colour rather than "not broken". This is one
email and one round: strong evidence, not a licence to delete hooks that
already ship.

**The mercy has a hard limit, convicted by controlled A/B (2026-08-18,
probe 0Mgmjr…): clients rescue what EN delivers, but they honour YOUR dark
CSS as intent.** The authored dark rule `.block table[align=center] {
background-color: #000000 !important }` painted an opaque black lid over
every background-photo hero in Apple Mail dark AND Outlook.com dark — EN's
shorthand rebuild strips the `url()` from the hero's outer table (§4), the
photo survives only on the div BEHIND that table, and the repaint then
filled the table black on top of it. The identical hero minus the `block`
class showed the photo. So the clients' own transforms are a safety net
under missing hooks, never under wrong ones: a kept-media-query rule you
author fires exactly as written, on delivered geometry you may not have
pictured. The catalog's fix is an equal-specificity exemption placed AFTER
the repaint group in BOTH dark branches — `.image-block
table[align=center], .overlay-image-block table[align=center] {
background-color: transparent !important }` — and a rule that every
`background-url` section must carry one of those classes so the exemption
can reach it. The exemption is CONFIRMED on the wire and in renders
(2026-08-18, probe MeKGcu…): all five catalog hero shapes — section,
wrapper-carried, and ancestor-nested — show their photos in Apple Mail
dark and Outlook.com dark, with the as-shipped hero pixel-identical to
its no-`block` control.

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
docs/archive/en-bg-tile-probe.html in the canonical repo): the VML fill itself
does resist Outlook's dark inversion, but the HTML `bgcolor` layers
MJML must interleave above it invert to white and cover the content
area, and Outlook flips the white text dark regardless — two
independent kills. Asset contrast remains the only defense here.

**Re-tested 2026-08-13 (EoA VJBgKzaU) and the rejection stands**, with
one refinement worth having. Using the wrapper shape from §4 — the
section carries `background-url` only, the fallback colour sits on an
`mj-wrapper` — removes the first kill: the ground DID stay black in both
Word engines, where the older bgcolor-layered attempt went white. But the
second kill is untouched and decisive: Outlook still inverts the live
text independently, so white copy lands dark-on-black and becomes less
readable than the plain colour ground it replaced. **An image ground is
never a dark-mode technique for anything containing live text** — it
desynchronises the ground from an inversion it cannot prevent.

The same run confirmed the defense positively. A footer left as a plain
colour ground still inverts plum to pink in Word-engine dark mode, but
with the contrast-outline treatment every asset stayed legible on it —
the rim carries the mark, and the copy inverts to dark on the now-light
ground. Off-brand colour, intact legibility, no code change. That is the
accepted end state for Outlook desktop dark: **let it invert, and make
the artwork survive the inversion.**

### 2d. EN escapes `>` in shipped CSS — never author a child combinator

In EN's editing surfaces, `>` in CSS text gets HTML-escaped to `&gt;`
(tag syntax keeps its own `>`; only text content is encoded). An escaped
selector is invalid CSS, and clients silently drop the rule.

**Reproduced and scoped (2026-08-13, four structured sends against one
account).** The trigger is an **edit**, not an open and not a save: an
untouched open+save round-trip delivered a byte-identical payload, while
editing the CSS held in an **HTML-type Replacement** corrupted the child
combinator in the very next send. Import is clean, send is clean, and
EN's **inliner handles `>` correctly** on its own. Scope is narrow and
worth knowing: in those same sends, six child combinators living in
ordinary **block markup** came through raw every time — only the
Replacement VALUE is affected. That explains the field evidence exactly
(freshly imported blocks send clean; long-lived blocks with edit history
shipped escaped selectors). Full report and a one-block PoC:
`docs/en-bug-html-replacement-escapes-css.md` in the canonical repo.

Two traps cost us a send each, so budget for them when you verify this
yourself:

- **A canary rule that matches nothing is pruned.** EN's inliner drops
  rules with no matching element, so a throwaway `.abcd { color:
  initial }` vanishes and the send comes back byte-identical —
  indistinguishable from "no bug".
- **A plain rule is inlined**, which dissolves the selector and destroys
  the evidence. Keep canaries inside a conditional media query, where
  EN returns them verbatim.

**EN offers two code fields, and they are not interchangeable.** The
**HTML Editor** (`"type": "HTML"`) holds markup — a whole `<style>`
element, tags included. The **CSS Editor** (`"type": "CSS"`) holds
stylesheet text only; the `<style>` wrapper belongs to the block's own
content around the merge tag. The CSS Editor is measured CLEAN
(2026-08-18, EoA Hd4yy…): the canary pair, added to the Head CSS Styles
field and EDITED-and-resubmitted — the exact trigger that corrupts the
HTML surface — delivered its `>` byte-intact and fired in Apple Mail
and Outlook.com. The escape is an HTML-surface defect only. The
authoring rule below still stands: template CSS can pass through
HTML-type fields and edit histories you don't control, and the
escape-safe idioms cost nothing.

The split has a real authoring consequence: the styles block's content
`<style>` holds rules and nothing else (as the CSS field did before it),
so **anything conditional cannot travel into the styles block and has
to stay in the email template**
— MSO conditional comments (`<!--[if lte mso 11]><style>…`), stylesheet
`<link>`s, and any `<style>` inside a downlevel-revealed wrapper (either
spelling: `<!--[if !mso]><!-->…<!--<![endif]-->` or the bare
`<![if !mso]>…<![endif]>`). A `<style>` containing `@import` also stays,
because merging sheets would move the `@import` out of first position
and CSS discards it there. In practice that means the rules you most
want to fix post-hoc should be authored as PLAIN CSS in `<mj-style>` or
an `<mj-include type="css">`.
A `<style media="…">` is fine — the condition survives by being
rewritten as `@media … { … }` — but a conditional COMMENT is markup and
stays put.

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
   border / background). PAIR BOTH FORMS: EN's inliner moves
   vertical-align out of the style attribute into a valign attribute at
   send, so the style form matches only previews and the valign form
   matches only the inbox (measured 2026-08-18, EoA aafUJU… — 0 of 107
   delivered tds kept it inline): */
.two-col-column td[style*=vertical-align],
.two-col-column td[valign] { padding: 0 !important; }

/* the section's own main td carries direction inline, and direction
   SURVIVES the inliner (20 of 20 delivered) — no pairing needed: */
.inset-gutter td[style*=direction] { padding-left: 32px !important; }
```

Caveat one: attribute selectors are inert in Gmail. That is acceptable
for dark-mode branches (Gmail exposes no dark hook anyway, §2c) and for
cosmetic mobile insets; anything Gmail-critical must stay class-based or
become a plain descendant selector.

Caveat two, and it cost this repo a dead rule for five days: **check any
`[style*=…]` selector against the DELIVERED html, not the compiled
build.** The inliner rewrites style attributes (bgcolor, valign, the
background shorthand), so a selector that matches every td in dist/ can
match zero in the inbox. `td[style*=vertical-align]` shipped as a
single-surface form on 2026-08-13 and was only caught when the delivered
payload was inspected directly. The paired idiom above is verified in the
other direction too: the 2026-08-18 composite probe (0Mgmjr…) delivered
0 of 80 real tds with `vertical-align` still inline, so the `[valign]`
form is the only one firing in the inbox.

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
component whose only table is its own (the `.two-col-image table` rule
served as that precedent until 2026-08-19, when captions moved under the
images and made it redundant — the FORM remains the house pattern), or
to change the structure upstream so a class lands where the rule needs
it. Verify by render either way.

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
| caption with the PHOTO (flush) | 14 CSS | **yes** — matches the flush caption form (today `padding="4px 0 0"`; measured at 8px) |
| caption with the COPY (inset) | 30 CSS | add `.flush-mobile-capflush .caption` to the override rule |

Body copy holds its 29 CSS inset either way. Applied to the seven blocks
that pair a `fluid-on-mobile` image with two or more columns.

The importer warns on any child combinator in a block's shipped CSS —
both in a `<style>` element and in the whole value of a CSS-type field,
so head styles are covered wherever they ride — and
an EN-side bug report with a minimal PoC block lives at
`docs/en-bug-html-replacement-escapes-css.md` in the canonical repo;
until EN fixes the escaping, treat this as a permanent authoring rule.
The most consistent reading of all measurements so far: the editor
escapes the DISPLAYED value, an untouched save writes the original back,
and the escape persists only when the field content is actually edited
and resubmitted (or re-serialized by a visual mode) — which is why
freshly imported blocks send clean and long-lived production blocks with
edit history shipped `.block&gt;table`.

### 2f. EN's `contentHtml` ceiling — 299,760 bytes (measured 2026-08-20)

EN caps the rendered email it will store. Exceed it and the save fails
with an HTTP 400 from
`PUT /messaging/api/campaign/<id>/messageandsend/<id>`:

```json
{"message":"Message contentHtml too long","messageId":-1194261769}
```

**Do not trust the error the builder shows you.** EN's `api.js` paints
"Invalid or missing authentication token" over any non-2xx from that
endpoint. That string appears nowhere in the actual response; the token is
fine. Read the response body in the network tab before diagnosing.

**The measurement.** Bisected against the DEV blank template (a 219-byte
shell, pure ASCII) with a single Raw HTML block padded to an exact length:

| `contentHtml` | Result |
| --- | --- |
| 299,760 bytes | saves |
| 299,761 bytes | 400, "too long" |

Two caveats that belong with the number:

- **It is 240 short of a round 300,000**, which strongly suggests EN's real
  limit IS 300,000 with ~240 bytes of server-side overhead wrapped around
  what the PUT carries. That overhead was measured through the blank
  template; a heavier production shell may carry a different amount, so
  treat 299,760 as measured-with-this-instrument, not as a universal
  constant.
- **The instrument was pure ASCII**, so characters and bytes were identical
  and the test CANNOT tell us which unit EN counts. Budget in UTF-8 BYTES,
  which is the conservative reading since bytes ≥ characters. (In practice
  the gap is tiny: the TPL all-blocks catalog is 365,219 characters and
  365,254 bytes — 35 bytes, from 13 em-dashes and 3 emoji.)

The importer flags this for you: it projects shell + every block and reports
`info` past 285,000, `warning` past 299,760, and never an error — a catalog
library is expected to exceed a budget no single email spends (conventions.md,
"Message size is advisory, never enforced").

**Working ceiling: 285,000 bytes.** About 5% of headroom, or roughly two
average blocks (the TPL catalog averages 7,394 bytes per block) — enough
that a couple of edits cannot walk a passing template into a failing one,
and enough to absorb the unexplained 240.

**A single message cannot hold a full block catalog.** One of every TPL
block, with no duplicates at all, is 289,999 bytes — 97% of the hard cap,
and already over the working ceiling. Catalog and permutation templates
ship SPLIT across messages; there is no trimming strategy that makes one
message hold everything.

**What actually costs bytes**, measured on that catalog:

- duplicate permutation blocks — 13 copies cost 75,220 bytes;
- MSO conditional scaffolding, which is per-block and unavoidable;
- head authoring prose — 3,590 bytes, now stripped at import
  (`stripHeadComments`; conventions.md, "Head authoring comments never
  ship"), so **head comments are free** and you should document the head
  as thoroughly as it deserves.

Worth knowing but not the same limit: Gmail clips a message at ~102 KB.
Anything near this ceiling is far past the clip point, which is fine for a
reference catalog and fatal for a real send.


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
  "classSpacingScales": { "caption": { "None": 0, "Quarter": 4, "Half": 8, "Single": 16, "Double": 32, "Triple": 48, "Quadruple": 64 } },
  "widthPresets": { "Full Bleed": 0, "Single": 16, "Double": 32, "Triple": 48, "Quadruple": 64 },
  "geometryReachPx": 64,
  "brandColors": { "Snow": "#F5FAF1", "Moss": "#CEE4C5", "Earth": "#362229", "Evergreen": "#006837", "Fern": "#39B54A", "Grass": "#8CC63F", "Sky": "#5DD8D8", "Sun": "#F7931E", "Light Grey": "#FAFAFA" }
} -->
```

`classSpacingScales` (optional, class name → scale) scopes an override
scale to elements whose `mj-class` OR `css-class` names the key: that
element's spacing dropdowns — Spacing Above/Below and Insets on content
components, AND the per-side frame padding Selects on
sections/wrappers/columns — offer, snap to, and label THAT scale
instead of the main one. (Spacer heights and the Block Padding
Left/Right preset stay on the main vocabulary.) TPL uses it to give
captions a **Quarter - 4px** step: inline captions
(`mj-class="caption"`) author `padding="4px 0 0"`, and the standalone
caption sections (`css-class="block caption"`) author the same 4px as
their section top padding — both default to Quarter without the 4px
option widening every other spacing dropdown in the catalog. Each class
scale follows the same rules as `spacingScale` (0 step, ≥2 entries),
and the effective geometry reach must cover its largest step (checked
even when `geometryReachPx` is omitted). Caption-LIKE texts without a
declared class (signature name texts) stay on the main scale at
Half - 8px.

`brandColors` (optional, name → hex) declares the brand palette by its
real names. Declared colors lead every color dropdown in all three
groups — text, background, and border — in declaration order, labeled
"Snow - #f5faf1",
and they are offered **even before any block uses them**, so editors
always pick from the full brand sheet. Colors found in the source but
not declared still appear after them, auto-named by nearest CSS color.
Without the key, the palette is derived purely from the colors the
template actually uses.

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

**The same url()-drop makes background heroes vulnerable to your own dark
CSS.** After EN, the photo exists ONLY on the wrapper div; the outer table
above it is a colourable void. Any dark-branch rule that repaints outer
tables (`.block table[align=center]`) paints an opaque lid OVER the photo
— convicted by controlled A/B 2026-08-18 (probe 0Mgmjr…, Apple Mail dark
and Outlook.com dark: as-shipped hero = black slab, identical hero minus
the `block` class = photo). The catalog's cure: every `background-url`
section carries `image-block` or `overlay-image-block`, and both dark
branches end the repaint group with an equal-specificity exemption
`.image-block table[align=center], .overlay-image-block
table[align=center] { background-color: transparent !important }`. If you
add a new hero class, extend the exemption or inherit one of these.
Confirmed across all five hero shapes 2026-08-18 (probe MeKGcu…, Apple
Mail dark and Outlook.com dark all photo, no lid).

The same principle applies to light/dark image pairs (two `<img>` tags, one
logical image) and to any value duplicated into an MSO conditional.

Two companion rules for background sections, both Outlook:

- **Never put `background-color` on any `mj-section` OR `mj-wrapper` that
  also has `background-url` — put it on a wrapper BEHIND that tag instead.**
  MJML copies the background colour onto the Outlook `v:fill` as
  `color=`, and the Word engine paints that colour INSTEAD of the photo, so
  every background hero renders as a flat slab. It applies to both tags
  because `mj-wrapper` emits the identical VML — a 2026-08-14 sweep that
  fixed 25 sections read this rule as section-only and left one wrapper
  slabbing for a day (caught 2026-08-15; TPL's `check-catalog` now asserts
  it for both tag names). Measured 2026-08-13 (EoA test
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

### Author copy color on the element, never inline on a dark ground (2026-08-19, user-decided)

EN's rich-text editor edits every Content field on a WHITE ground, with
none of the block's section chrome. Copy whose color is authored INLINE
in the content (`<h3 style="color:#ffffff;">` on a dark section) is
therefore white-on-white while being edited — invisible — and, because
the color lives inside the RTE value rather than on an `mj-*` attribute,
the importer mints no Text Color control an editor could reach for
(measured on Photo and Text Grid, 2026-08-19). The fix depends on the
element, because the two routes to a rendered color are not equal:

- **`<p>`/`<span>`/`<a>` copy**: author the color on the `mj-text`
  element (`color="#ffffff"`). The content inherits it from the wrapper
  div, the editor shows default-black editable copy, and a palette
  Select mints.
- **Headings (`h1`–`h6`)**: the attribute route FAILS. The head sheet
  pins `h1,…,h6 { color:#000000 }`, and a direct element rule always
  beats a color merely inherited from the wrapper div — the heading
  ships black on the dark ground (measured on Photo and Text Grid and
  Quiz Block 2x2 photos, 2026-08-19). Instead author
  `css-class="wysiwyg overlay"` on the heading's `mj-text`: the sheet's
  `.overlay h1…h6 { color:#ffffff }` out-specifies the pin and EN
  inlines it. Two cautions: an authored `css-class` REPLACES the
  template-wide `wysiwyg` default from `mj-attributes`, so restate it
  (dropping it loses the `.wysiwyg div` margin trims and dark-mode
  repaints); and do NOT also keep `color="#ffffff"` on the element —
  the Select it mints would be inert, since the class rule overrides
  the inherited div color it edits.

The general principle stands: styling an editor should own belongs on
`mj-*` attributes, not frozen inside content — but only where the
attribute actually reaches the rendered element.

### EN's Content editor is ProseMirror — it wraps bare copy in `<p>` (2026-08-19, measured)

Click into a Content field, type one character, and EN rewrites the stored
value. ProseMirror's schema requires BLOCK content at the document root, so an
inline-only value is wrapped in a paragraph, permanently:

```html
<!-- authored -->
<div style="font-size:10px;line-height:16px;…"><span>Photograph by Name, AGENCY</span></div>
<!-- after one edit, stored -->
<div style="font-size:10px;line-height:16px;…"><p><span>Photograph by Name, AGENCY</span></p></div>
```

The `<p>` itself is harmless; what it *matches* is not. An injected paragraph
carries no inline style, so the stylesheet's `p` rule wins over the wrapper's
declared size — a 10px credit line ships at 16px. Two authoring consequences:

- **Do not rely on an unstyled `<p>` inheriting its element's size.** A
  paragraph that must hold a size should pin it inline
  (`<p style="font-size:12px;line-height:14px;margin:0;">`), which no
  stylesheet rule can override. 147 of the catalog's 170 in-content paragraphs
  already do this; it is the established pattern.
- **Inline-only copy now ships pre-wrapped.** The importer emits
  `<p style="margin:0;font-size:…;line-height:…;">` around it, which is the
  one shape the editor leaves alone, so the first edit changes nothing. You do
  not need to author this yourself — but if you do author a paragraph, pin its
  size inline, because that is what survives both the editor and EN's inliner.
- **Bare copy should not be on a rich-text field at all.** The importer types a
  Content field as plain `Text` when its inner carries no markup whatsoever,
  which removes the rewrite rather than defending against it. Copy wrapped in
  even a bare `<span>` stays on RTE for now: a Text field holding HTML is a
  shape neither this template nor EN has been shown to handle, and if EN
  escapes it the way it escapes CSS (§2d) the tags would render as visible
  text. Author `data-force-rte` on the `mj-text` when copy is expected to grow
  a link or emphasis later.

**Measured on EN template 546, 2026-08-19** — two results are hard authoring
rules rather than trivia:

- **Never put an MSO conditional inside an RTE value.** One edit deletes the
  entire conditional, silently. Conditionals belong in block markup, outside
  every replacement.
- **An anchor inside an RTE value keeps its `href` and nothing else.**
  Measured 2026-08-19: `class`, `style`, `id`, `title` and `data-*` are all
  stripped on the first edit (`target` survives). There is no hook you can put
  ON the link. Style it from an ANCESTOR class instead — put `css-class` on the
  `mj-text` and write a descendant rule (`.cta-link a { … }`), because the
  ancestor lives in block markup outside the replacement where the editor can
  never reach it. EN's inliner applies such rules normally.

  The reason is structural, and it predicts the rest: EN's editor is
  ProseMirror, where a link is a **mark** and everything else here is a
  **node**. Nodes keep their attributes — a `class` survives on a `<span>` and
  on a `<p>` — and marks are rebuilt from a fixed attribute set, so anything
  you hang on an `<a>` is discarded.

Also measured: an already-wrapped paragraph carrying an inline style comes
back **unchanged**, so the transform is idempotent — authoring the paragraph
yourself makes the first edit a no-op. Headings survive untouched. A list gets
a paragraph injected inside each item. A `<span>`'s `font-weight` is
re-expressed as `<strong>` and its hex colour as `rgb()`.

This is the same underlying mechanism as §2d's `>` escape — EN parses a
replacement value as HTML and re-serializes it on edit. Neither fires on an
untouched save; both fire on the first keystroke.

### One idea per mj-text (2026-08-19, user-decided)

The importer's unit of editability is the `mj-text` ELEMENT: one element
mints exactly one Content field, and only elements sharing a column with
another member get a Display toggle. A heading and its body copy authored
in ONE `mj-text` therefore freeze into a single field the editor cannot
show/hide or restyle independently — the pattern the 2026-08-19 usability
pass unwound across CTA Text, Quote, WYSIWYG Text, and Podcast Episode.
Author each idea as its own element: the heading `mj-text`, the body
`mj-text`, the attribution `mj-text`. Each gets its own Content field and
Display toggle for free, and the inter-element gap moves to the upper
element's bottom padding per §3. **Leave the heading tag inside its
Content value** — EN's rich-text editor offers H1–H4, so the level is
changed in the WYSIWYG rather than through a second field, and the value
being markup is exactly what keeps it on the RTE instead of collapsing to
a plain Text field. (`data-heading-level-toggle` still exists for a
template that wants the level as its own Select; it narrows Content to the
heading's inner text, which then requires the heading to be alone,
plain-text and on one line.) Inline links inside prose stay in the
prose (they are RTE-editable); a linked heading keeps its link inside its
own element's RTE.

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
reusable: `docs/archive/en-nesting-probe.json` in the canonical repo.

### Show/hide

A component sharing its column with at least one other non-spacer member
gets an Include/Exclude toggle automatically. Mark the exceptions:

- `data-no-display-toggle` on content that must never be hidden (sender
  identification, unsubscribe text, required logos, interdependent figures)
- A column's only member never gets one, so do not add filler to force it —
  add `data-display-toggle` to that member instead (2026-08-20). It is the one
  opt-IN in the display family, and it exists for exactly this shape: a header
  whose logo sits alone in one column and whose CTA button sits alone in the
  other. Put it on the FIRST of a light/dark pair; a flag on the second twin is
  inert. `data-no-display-toggle` on the same element still wins.

Selections are per instance: the same block added to a broadcast several
times keeps independent Replacement choices for each copy (measured
2026-08-09), so repeated-block patterns like poll options are safe.

**Viewport-forked content — the sanctioned `.mobile-only` / `.desktop-only`
pair (completed 2026-08-18; before that the reveal half had never been
written and the class hid content everywhere).** When one slot genuinely
needs different MARKUP per viewport — not just different visibility, which
the toggles above already cover — the pattern is four layers, each serving
a different slice of the client matrix (the `.dark-only` swap runs the
same cascade in production):

1. A PLAIN top-level hide, which EN inlines onto the element at send
   (`!important` stripped). This is the layer for clients that read no
   `<style>` at all — the Gmail app on non-Google/IMAP accounts strips
   head styles entirely, and forwarding drops them in most clients. There
   the inline hide is the only rule standing: the desktop fork shows, the
   mobile fork hides — one coherent fork instead of two.
2. The SAME hide again inside an always-true media query
   (`@media only screen and (max-width: 9998px)`), which EN keeps
   verbatim (§2a) — the stylesheet copy for any path where the inline
   was lost but styles are respected. The condition is deliberately
   DISTINCT from the OWA block's 9999px: EN merges same-condition
   queries into one block, which could move the hide after the reveal
   and invert the cascade.
3. The reveal (`display: block !important`) sits in the 599px mobile
   block, LATER in the sheet. It beats BOTH hide layers: the inlined
   copy is plain after EN's `!important` strip (an `!important`
   stylesheet rule outranks a plain inline style), and the wrapped copy
   loses the equal-specificity tie on source order.
4. The mobile variant's markup is wrapped in
   `<!--[if !mso]><!--> … <!--<![endif]-->`: the Word engines ignore
   `@media` wholesale AND ignore `display:none`, so without the wrapper
   Outlook desktop renders BOTH forks. TPL's `check-catalog` warns on
   any `mobile-only` element outside the wrapper.

Use it sparingly: each fork mints its own Replacement fields, doubling the
editor surface for one logical slot and letting the variants drift. The
Display toggles above stay the first choice for anything they can express.

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
  `spacing-below`, `spacing-above`, the four `padding-<side>`s, and
  `inset-right` / `inset-left`). A third shape joins the list: an inset
  that only bites once the box shrinks — a right-aligned line or a
  fixed-width image that clears its container at 600px and meets it at
  375px — is `data-mobile-only-inset-right` / `-inset-left`, because CSS
  inference can only ever conclude "Desktop". It is a claim the audit
  re-checks, not an escape
  hatch — and where a control is dead at BOTH viewports use
  `data-no-width-toggle` instead, since no label makes it honest.
- **And pin the box the control actually edits.** An `mj-section` /
  `mj-wrapper` / `mj-column` `css-class` lands on the outer `<div>` while
  its `padding` lands on an inner `<td>`. So `.caption { padding-left:
  16px !important }` indents the caption block but does NOT pin the
  section's padding control — write `.scope td` when you mean to pin what
  is nested inside. The importer honors that distinction (a self-form rule
  never scopes a frame's inner cell), which is also how a caption inside a
  `.flush-mobile-capflush` section gets its Desktop-only insets with no
  flag at all.
- **A mobile pin must cover every carrier of the value.** MJML writes a
  button's `align` onto two cells; pinning only the outer one centers the
  pill but leaves a WRAPPED label following the desktop setting — so the
  control measures inert for short copy and comes alive for long copy.
  Pin both (`td.button`, `td.button table td`) or claim nothing.
- **The pins reach the inbox.** The `@media only screen and (max-width:…)`
  blocks the pins live in are kept verbatim by EN's inliner, and the pin
  rules themselves (`td.button` pair, `.flush-mobile-*`, `.inset-gutter`,
  `.two-col-column`) arrive byte-intact in delivered payloads (measured
  2026-08-18, EoA aafUJU…). A "Desktop …" label therefore describes inbox
  behaviour, not merely preview behaviour.

### The data-style vocabulary is RETIRED — one survivor

The per-property intent flags (data-style-color, data-style-href, the
padding quartet, and the rest of the family) were audited 2026-08-18 and
proven fully inert: the importer mints fields from the authored VALUES, and
stripping all 8,376 instances changed zero generated fields (strip test
through the real generator, both catalogs). They were pruned from every
source the same day. Do not author new ones — the audit
(`npm run audit-data-attrs`, or the Test Center's data-* tab) flags any
unclaimed annotation.

**The one survivor is `data-style-dark-mode`**, which is NOT an importer
flag: the TPL build's annotate pass reads it to fold a dark image twin
into its light partner when counting removable variants. Keep it on every
dark-only image twin. Real intent signalling is the `data-*` contract
below — opt-outs, viewport declarations, `data-link-group` — all of which
the importer actually reads.

Alt text is the exception, and needs no flag at all (decision 2026-08-18):
**every `mj-image` exposes an editable Alt Text field unconditionally,
`alt=""` included** — an authored empty alt is the correct value for a
decorative image (screen readers skip it), and the importer keeps the field
with an empty default so an editor can fill it without a source round-trip.
The old `data-style-alt` token is retired; write the `alt` attribute on
every image — real copy for meaningful images, `alt=""` for decoration —
and the field follows. A light/dark image pair binds BOTH compiled alts to
the one field (§4: one value, every carrier).

### The rest of the `data-*` contract

| Attribute | Meaning |
| :---- | :---- |
| `data-import-exclude` | dev-only chrome: renders in preview, never imports |
| `data-fully-exclude` | a redundant variant of another block; dropped entirely |
| `data-folder="1234"` | EN folder routing (on a category divider or a block) |
| `data-category-short="Text"` | short category name prefixed onto block names |
| `data-no-display-toggle` | opt out of the show/hide Select |
| `data-display-toggle` | opt a column's SOLE member IN to the show/hide Select |
| `data-no-link-toggle` | opt out of the image link Select |
| `data-no-background-color` | keep an authored `background-color` as a fallback but generate no field, for a background that provably cannot show |
| `data-no-direction-toggle` | no column-order control on this row, for columns whose content is pinned to the block's outer edge (see §6) |
| `data-no-width-toggle` | no width dropdown on this frame or column — the width provably changes nothing |
| `data-alt-arrangement="<Option Label>"` | on an `mj-section`: fold it into the PRECEDING sibling section's arrangement Select as an extra option instead of rendering it. This is how a two-column row offers "no image, text full width" — a Display toggle cannot do it, because it removes a member's `<tr>` and leaves the column, its Outlook ghost cell and the sibling's width behind. Author the alternate with the SAME copy: the pairing matches on value, so a drifted edit fails loudly and the option disappears rather than shipping stale text. The alternate's frame (padding, background, css-class) must match its partner's, and the two must be adjacent |
| `data-arrangement-label="<Option Label>"` | names the PRIMARY arrangement, for a row whose alternate exists but whose reversed order does not (the Select then reads Layout rather than Image Position) |
| `data-no-alignment-toggle` | on a `.cta-group` div in hand-authored pill markup: no Alignment control for that button row. For a row whose pills carry fixed widths that already sum to the content width — left, center and right then render identically, so the field is a dead control (measured 2026-08-21 on four rows) |
| `data-image-shape-toggle` | on an mj-image that authors a `border-radius`: ships it as a Square/Circle Select instead of free text. Flag BOTH twins of a light/dark pair, or the pair splits. Outlook desktop ignores border-radius, so Circle is square there |
| `data-desktop-only-<token>` / `data-mobile-only-<token>` | this control only works at that viewport; the importer prefixes the LABEL ("Desktop Block Padding Left/Right"). Tokens: `align`, `direction`, `width`, `spacing-below`, `spacing-above`, the four `padding-<side>`s, and `inset-right` / `inset-left` (per-side and per-inset scoping the stylesheet cannot express — a fixed-px column pinning a row's right gutter, the signature cards' name insets, 2026-08-18). **Flag STRUCTURAL inertness only:** a control that moves nothing merely because the authored copy is short is not inert — the copy is an editable field, and the first long headline brings the control alive under a label that says "Mobile" (2026-08-21). Ask whether the LAYOUT pins it or the placeholder does. |
| `data-link-group="<name>"` | on raw `<a>` tags inside hand-authored markup: sibling anchors sharing a group name AND a byte-identical href are ONE logical link — the importer mints a single URL field and splices its tag into every member, so the value can never desync. This is the shape for a clickable row: EN auto-closes an `<a>` that wraps a `<table>` (§2), so the row splits into per-cell anchors that share the group. Members with differing hrefs fall back to separate fields, and the TPL build warns; a lone member is an inert flag the dead-flag audit reports |
| `data-inset-toggle` | opt-in on a spacing component (mj-text/image/button/divider): mint the Inset Right/Left Selects AND Spacing Above even at 0, and allow an on-scale top padding. The caption pacing pattern: author the gap on the caption's TOP (`padding="4px 0 0"` on the caption class scale's Quarter step, image bottom 0) so hiding the caption removes its gap too; caption-LIKE texts without `mj-class="caption"` (signature names) author `8px 0 0` on the main scale. The closed scale still applies, and a flag on a column's only member is inert (sole-member consolidation) — the dead-flag audit reports it |
| `data-visible-duplicate` | on a block whose structure deliberately duplicates its dedup-group anchor but must stay importable (an obvious-name alias, a separately-shipped layout variant). Exempts the block from the build's unflagged-duplicate WARN; a build that dedup-groups blocks needs an equivalent escape hatch or every deliberate twin fights the gate. Misuse (on a group anchor, or combined with a full exclusion) should warn. Pair with a dated caveat comment |
| `data-probe` | on a probe-instrument block (a canary): its colors are measurement signals, not design — the importer excludes the flagged region from the brand-color census and the color-usage audit, so signal hexes never pollute color dropdowns. Probe bars should still use colors the template already carries (§ probe colors); the flag keeps even those from counting as design usage |

**Three rules for all of them.** Apart from the valued trio
(`data-folder`, `data-category-short`, `data-link-group`) they are
valueless flags, so write `data-no-display-toggle`, not `="true"`. Never remove, rename, or "fix" one
on a hunch — they are the only channel your design intent has into the
importer, and a flag you don't understand is one you haven't traced yet.

But a flag must EARN its place. The importer checks every one of these on
import: it strips the attribute, regenerates the block, and compares. If the
output is byte-identical the flag does nothing, and the block reports it —
"changes nothing … Remove it from the MJML". Act on that. A flag the importer
ignores still reads as a deliberate decision to the next person, and it ships
in the compiled HTML of every block that carries it.

Two things that check has already taught us — the first one twice, which is
why it is now also a build-time warning in the reference repo's
`check-catalog` lint rather than prose alone. The importer folds an adjacent
light/dark twin pair into ONE logical element, and it is the **second twin
by authoring order** (whichever colour that is — author light-first and it
is the dark one) that is dropped before any flag on it is read: so every
`data-no-*` opt-out flag on the second twin is always inert. Put the flag on
the FIRST twin; it governs the pair. And a component in a block that
generates no fields of the relevant kind at all does not need opting out of
them. Note the check removes one attribute at a time, so when a block
reports several, remove them one at a time and re-import between — flags
can prop each other up, and the report says so when they do.

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
- **Never write EN's block-container merge tag literally in your MJML** —
  not in markup, and not in a comment. The importer joins the template shell
  around that tag and splits it back on the FIRST occurrence, so a stray
  literal truncates the shell at your literal instead of at the real
  container. When that truncation lands inside an HTML comment, the comment
  loses its terminator and silently swallows every `<style>` after it: the
  head stylesheet is simply gone, with no error anywhere. Symptom to
  recognise — dark-mode/light-mode pairs both rendering, because the rule
  hiding one of them never parsed. Describe the placeholder in prose instead.
- **Builder-only chrome on the TEMPLATE should hang off EN's container, not
  off markup you author in the shell.** EN's builder renders blocks inside the
  container element and does not render the template's own surrounding markup,
  so a marker element authored in the template shell never enters the builder
  DOM — it will look right in your compiled HTML and do nothing in EN
  (measured 2026-08-20). Target `[data-container="main"]:before` instead. It
  self-gates: the stored template holds a container placeholder and a
  delivered email holds the blocks, so only the editor ever renders that
  attribute. Keep it as its OWN rule — one unsupported selector invalidates a
  whole selector list, so never group it with a `:has()`-gated selector.
- **Anything that must reach the TEMPLATE shell has to lead the body.** The
  importer treats every `<!-- START: X -->` … `<!-- END: X -->` pair as a
  block, and the template shell is everything before the FIRST such marker —
  of any name, not "Main Content" specifically. So a partial that carries its
  own START/END markers (a debug toolbar, a dev-only banner) segments as
  block #1, and template chrome authored after that include lands inside that
  block instead of the shell. If the importer then drops that block, the
  chrome disappears with it, silently. Author preheaders, builder-band spans
  and any other template-level markup directly under `<mj-body>`, above every
  include.
- **Never style an inline element inside rich-text copy.** EN's editor keeps
  only the style properties it has a mark for — `font-weight`, `color`,
  `font-style`, `text-decoration` — and silently drops everything else the
  first time anyone edits that field. A `font-family` on an `em`, or a
  `display`/`background-color`/`border-radius` on a `span`, is gone. Put the
  look in the stylesheet instead: a `span` may carry a CLASS (classes on
  spans survive), but a mark element cannot, so style marks from a class on
  an ANCESTOR (`.my-class em { … }`). The symptom is copy that changes
  appearance the moment someone clicks into it and types.
- **Removing the control is two steps, not one.** Deleting the
  `.mj-column-px-*` rules from your stylesheet does NOT remove the dropdown.
  MJML mints a `.mj-column-px-N` class for every real column width, so the
  importer still finds a small accidental option pool — the widths your
  catalog happens to use — and offers those. To retire the control, put
  `data-no-width-toggle` on every eligible column AND delete the ladder:
  the flag removes the field, deleting the CSS reclaims the head-CSS bytes
  (worth ~1,325 delivered bytes in TPL, under Gmail's 16,384 cliff).
- **Horizontal gutters belong to the frame**, expressed as width presets
  (full bleed / indented / double indent), not as ad-hoc padding.
- **A lone fixed-px column centers in its section's slack**, so that
  section's left/right padding does nothing. Do not author controls for it.
- **So a fixed-px child does not survive a change to its section's
  padding** — and it fails in whichever of two directions the arithmetic
  takes it, both silently. Measured 2026-08-18, from one padding change
  that left the children behind:
  - **Narrower than the box → it centers, and eats the inset.** A
    `mj-group width="480px"` in a 552px content box centers with 36px of
    slack per side, so a section padded `16px 16px 16px 32px` rendered its
    photo at 68px, not 32px. The padding was correct; the group hid it.
  - **Wider than the box → it overflows the body.** A `mj-column
    width="550px"` (the content width from a 25px-padding era) inside a
    section padded 32px forced the background table to 550+64 = **614px**
    — 14px past the 600px body, so the block read as "wider than the
    others" while its own outer box still measured exactly 600.
  Author children that FILL: omit `width` on a lone column or group so it
  takes 100%, and make group members sum to the content box exactly. The
  600px outer box is not evidence of correctness — measure an inner table.
  Do not reach for the exact pixel figure (`width="536px"` here) — it
  renders the same but mints a `.mj-column-px-536` head class, where 100%
  reuses the `.mj-column-per-100` that every catalog already carries.
  TPL's `check-catalog` geometry guard now catches the overflow half of
  this: it was summing SIBLING widths and skipping single-column frames
  outright, so a lone over-wide column was structurally invisible to it.
  Opened 2026-08-18 and self-tested both ways — silent on the corrected
  catalogs, and it names the block when the 550px column is put back. As of
  2026-08-21 it also sees `direction: rtl` sections, which it had been
  skipping entirely — its content-td pattern matched only `ltr`, so both
  reversed Story Cards were structurally invisible, and the Column Order
  control can flip an authored `ltr` section to `rtl` at edit time — and it
  measures fixed-width IMAGES against their column, not just columns
  against their frame.

  **The same arithmetic now runs at import, per offered value.** An
  editor cannot choose a gutter this block's frozen children cannot take,
  because that option is not in the Select. The practical consequence for
  authoring: a fixed-px child does not merely risk a later defect, it
  SHORTENS the editor's option list. Authoring children that fill is what
  buys a block the whole scale. Run `npm run check-catalog --
  --padding-census` to see which frames are currently bounded and by how
  much.
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
  overflow. Since 2026-08-21 the BLOCK-width half of that pair is bounded
  at import: a frame's Padding Left/Right Select no longer offers a value
  its own frozen geometry cannot survive (conventions "Unsafe growth"), and
  where only the authored value survives the field is not created at all.
  Element widths are still free, so the combination is still worth
  checking.
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

**Word ignores CSS box geometry on spans — size inline chips by their
text.** `display:inline-block`, `width`, and `height` on a `<span>` all die
in the Word engines, so a numeral chip built as a fixed-width span collapses
to the digit's own width — a sliver of background around cramped text
(measured 2026-08-18, probe 0Mgmjr… renders; the fix shipped the same day on
the Steps Block chips). The robust shape is character-driven geometry Word
cannot ignore: pad the content with `&nbsp;` INSIDE the span and set a
monospace stack so the width is predictable —
`<span style="…;font-family:Menlo,Consolas,'Courier New',monospace;">&nbsp;1&nbsp;</span>`.
Drop any fixed `width` when you do (the padding and the width fight), and
keep `line-height` for the modern-client chip height; Word renders the run
at its own line box, which is honest typography rather than a broken box.
This is the span-level twin of the MSO spacer-td rule above: when Word must
get geometry right, carry it in text or table attributes, never in span CSS.

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

**Alt text, every image, no exceptions**: meaningful images carry real
descriptive copy; decorative images (glyphs, ornaments, spacer art) carry
`alt=""` — never a label like "Quotation Symbol" that narrates chrome to a
screen reader, and never a MISSING alt attribute (clients read the filename
aloud). The Alt Text field survives either way (§5).

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
   `>` to `&gt;` when an HTML-type field is edited (the CSS Editor is
   measured clean, 2026-08-18) and the rule silently dies (§2d).
   Selectors extracted from the compiled `<style>` blocks must contain
   zero `>`.
6c. Verify every `[style*=…]` selector and every dark-mode legibility
   claim against the DELIVERED html
   (`/app/acidtest/display/email_html/<TEST_ID>`) and real client
   renders — never `dist/` and never a forced dark branch in a browser.
   EN rewrites style attributes at send (`vertical-align`→`valign`,
   colour→`bgcolor`, background shorthand rebuilt), so the local artifact
   lies in both directions. Third recurrence of this error class
   (2026-08-11, -12, -18); it graduates to a rule.
6d. After ANY change to a section's left/right padding, re-measure the
   blocks you touched — a fixed-px column or group left behind by that
   change either centers (eating the new inset) or overflows the body,
   and both are invisible in the block's own 600px outer box (§6).
   Two mechanical checks catch the whole class: no inner `<table>` may
   render wider than 600px, and a block's rendered content inset must
   equal the inset you authored. A catalog-wide inset census is the
   cheapest way to run this — 54 of the blocks here sit at exactly 32/32,
   so any block off that number is either deliberate or a bug, and the
   outliers name themselves (measured 2026-08-18: five did).
6d-i. Then check what the change did to the block's OPTION LIST, not just
   to its rendering: `npm run check-catalog -- --padding-census` reports
   every frame that can no longer take the whole declared scale, and by
   how much. A fixed-px child costs the editor real range — the block
   still renders correctly today and quietly offers fewer choices
   tomorrow. Silence there means every frame reaches Quadruple.
6e. Confirm no fixed-px column inside an `mj-group` relies on its px width
   surviving on mobile — `mj-group` never stacks and converts every child
   column to a PERCENTAGE, so a 56px icon column becomes ~10% and shrinks
   with the viewport, and any fixed inline padding inside it eats the
   shrunken width first (measured 2026-08-19: a 24px poll icon rendered
   0.5px at 375px). Pin such columns with the signature-block pattern —
   a mobile rule setting the icon column's `width: <px> !important` and
   the text column's `width: calc(100% - <px>) !important`.
6f. Confirm each `@media` condition string that ends up in the compiled
   head appears exactly ONCE, and that any order-dependent pair keeps
   deliberately distinct conditions — EN folds same-condition blocks into
   the first occurrence's position (§2a, measured 2026-08-19).
6g. If an EoA payload shows NO EN-inliner fingerprints — no
   `mso-table-lspace: 0pt` style fragments inlined onto tds, only the bare
   MJML `<style>` output — the test bypassed EN entirely and proves
   nothing about the template or the send path. Fetch the delivered HTML
   (`/app/acidtest/display/email_html/<TEST_ID>`) and check for inliner
   fingerprints BEFORE diagnosing a "regression" (2026-08-19: a styleless
   non-EN payload mimicked a catastrophic mobile-CSS regression).
7. In dark-mode passes, check Gmail app and Outlook desktop
   SPECIFICALLY: the swap cannot fire there (§2c), so judge whether the
   light-only assets survive the client's own auto-darkening.
7a. Confirm every image caption that sits flush with its photo carries
   `data-inset-toggle` (§5) — without it the caption's zero side padding
   is frozen and an editor cannot indent it. Never flag a caption that
   is its column's only member (the flag is inert there and the
   dead-flag audit reports it).
7b. Confirm every button label is authored ALL CAPS (2026-08-18,
   user-decided) — literal text, never `text-transform`, so the minted
   Text fields stay per-email re-caseable. BOTH carriers: mj-button
   content AND raw pill anchors (the `border-radius:100px` `<a>`s inside
   cta-groups, which are not mj-buttons). This rule escaped twice — once
   past a bulk transform (the first button after the `mj-attributes`
   defaults element), once as the pill-anchor family — so the TPL build
   guard now enforces it (check-catalog "ALL-CAPS button label check").
8. Send a real test: dark mode on, and a ≤480px viewport. The inliner
   failures are invisible in source and in the editor.
9. After import, open the Test Center's Inert Audit tab, run it, and read the Check
   column: **every row should say PASS**. PASS means the field behaves the
   way its label and kind promise — including the intended-inert ones (link
   toggles, Outlook fallback colors). Any FAIL means the template pins a
   control the importer generated, or a label does not say where the control
   works; either the source or the importer needs a decision
   (§5 "Viewport-scoped controls").
10. When a QA round closes — every claim its probe files were built to
   test measured and recorded — ARCHIVE those probe files (move them to
   the repo's archive directory, updating citations) in the same session
   that records the last verdict. The working tree should carry only
   live instruments; archived probes remain the reusable fixtures for
   re-measuring EN if its behavior is suspected to have changed.
11. Check the size budget before you hand a template over: the rendered
   `contentHtml` must stay under **285,000 bytes** (working ceiling; EN's
   measured hard cap is 299,760 — §2f). A catalog or permutation template
   will not fit in one message and ships split; a normal campaign email is
   nowhere near the limit, so a template that IS near it is telling you it
   has grown into a catalog.

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
  `&gt;` when an HTML-type field is edited and the rule silently dies.
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
