# Project retrospective: the TPL email system

> [!TIP]
> **See the whole system in one email.**
> [This live template in Engaging Networks](https://us2.engagingnetworks.app/page/email/message/view?templateId=582)
> stacks one of every block. Open it before you read a word of this
> document; everything below will make more sense once you have scrolled
> the real thing. You will need an Engaging Networks login. One caveat:
> the catalog has been renamed, rebased and extended repeatedly since that
> template was imported, so its block names, its content baseline and its
> version bands all lag this document until the next re-import.

**A snapshot of the project as of 2026-08-25, written by Bryan Casler (4Site
Studios). It is refreshed when a push closes rather than maintained
continuously, and it is not a contract.** For the rules as they stand today,
read [CONVENTIONS.md](CONVENTIONS.md) and
[MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md), the mirrors at this repo's
root. Their canonical copies live in the private converter repo, get re-read
against every diff under that repo's pre-commit review gate, and carry a
drift linter that verifies the mirrors still match. What follows is a record
of how we got here, written down while the reasoning was still recoverable.

Findings carry the date they were measured wherever the record has one. Where
a finding was later corrected, the correction sits alongside it rather than in
place of it.

---

## How to read this

| If you are… | Read |
| :-- | :-- |
| Anyone on the team | **Part 1**: plain language, no code, ~10 minutes |
| A developer or template author | **Part 1 + Part 2** |
| Picking up the work, or curious how we got things wrong | **Appendix A**, the post-mortems |
| Looking for where a specific rule lives now | **Appendix B**, the pointer map |

A glossary sits at the end. For what the system *is* today rather than how it
was built, the companion tour is `docs/overview-for-colleagues-detailed.md` in
the converter repo.

---

# Part 1: For everyone

## The problem we set out to solve

Trust for Public Land (TPL) sends email through Engaging Networks (EN). EN's
Marketing Tools lets an editor assemble an email from reusable **blocks** (a
hero, a story card, a footer) and customize each one through fields shown
beside it.

Two things make that harder than it sounds.

**Email is fragile.** Every mail client renders the same HTML (HyperText
Markup Language, the code an email is built from) differently, and the
differences are not cosmetic. Outlook on Windows uses Microsoft Word as its
rendering engine and ignores whole categories of modern CSS (Cascading Style
Sheets, the language that controls how that code looks). The Gmail app
rewrites colors on its own. Apple Mail, Outlook.com, and Gmail's web client
each honor a different subset of dark-mode techniques. A design that looks
correct in a browser can be unreadable in an inbox.

**Free-text fields break layouts.** The moment an editor can type any number
into any field, typography drifts, spacing goes off-grid, and colors leave the
brand palette. Not through carelessness. Through the ordinary act of filling
in a box that accepts anything.

Before this project, getting a block library into EN meant configuring each
block by hand in the EN interface: naming it, filing it, defining every
editable field one at a time, uploading a thumbnail. Slow, and impossible to
keep consistent across a hundred-odd blocks.

## What got built

Three things, in two repositories.

**A template library.** Emails are authored in MJML (Mailjet Markup Language),
a shorthand that compiles into the nested tables email actually requires.
Rather than one-off emails, we maintain a catalog of blocks, each one a
complete, tested design with mobile stacking, dark-mode behavior, and Outlook
workarounds already built in. Since 2026-08-21 the catalog IS the master
template: one file, 60 blocks, 56 of them shipping into EN. Beside it sit
two donation thank-you autoresponders (automatic emails EN sends after a
donation) built on the same stylesheet and components, and a one-block
holding pen for anything carrying an unresolved defect.

**A converter app.** A private, browser-only tool. Point it at the template on
GitHub and it compiles the MJML, splits it into blocks, reads the design
intent the template declares about itself, and writes the exact JSON
(JavaScript Object Notation, a structured data format) that EN imports: named,
filed into folders, with real rendered thumbnails, and with
every editable property already turned into a typed field. The manual
per-block configuration became a single import of the whole library.

**Two written contracts.** A conventions document that defines exactly how the
converter behaves, and a portable authoring guide that carries everything we
measured about EN and email clients. Both are mirrored publicly so that
anyone, human or AI agent, working in a template repo can read them without
access to the private code.

## The timeline, in seven phases

The two repositories together carry **751 commits between 2026-05-25 and
2026-08-25**.

**Phase 1: bootstrap and rebrand (late May → mid June).** The template started
life as another client's design and was re-skinned for TPL on 2026-06-11.
Early commits are terse and hand-built: *"create more blocks"*, *"dark mode
improvements"*. The fossils of the original are still in the repo.

**Phase 2: from a mockup to a library (July).** The catalog becomes a system.
A naming grammar, categories, and a built-in debug overlay that lets anyone
run quality assurance (QA) on the whole library in a browser without reading
code. The converter app itself starts on 2026-07-15.

**Phase 3: the contract arrives (late July → early August).** The template
begins declaring its own expectations (its spacing scale, its width options)
in a machine-readable comment, and the converter reads them. The brand palette
joined the same comment later, on 2026-08-17. The conventions document is
written and mirrored publicly. This is the point where the two projects stop
being two projects.

**Phase 4: the measured-behavior era (2026-08-06 → 08-15).** The tone changes
completely here. Commits stop asserting things about Engaging Networks and
start measuring them. We build **probes**, small emails whose only job is to
test one set of claims through a real send, and read the results in every
email app Email on Acid renders. Most of the durable knowledge in this
project came out of these ten days, and several confident beliefs did not
survive them.

**Phase 5: industrialization (2026-08-17 → 08-20).** Everything learned gets
turned into something automatic: build-time lints (automated checks that scan
the files for known mistakes), pixel-level audits, content versioning, byte
budgets. 127 converter commits land in these four days, and the system goes
live in TPL's account on 2026-08-18.

**Phase 6: one catalog, and the names editors read (2026-08-20 → 08-21).**
The 61 project commits since this document's last snapshot, most of them
inside one twenty-one-hour stretch. The two
remaining catalog files become one master template: the duplicate catalog is
pruned to its unique leftovers and then deleted outright, and the master
absorbs the blocks worth keeping while shedding the demos its own dropdowns
already reproduce. Renames sweep the catalog (thirteen blocks in a single
commit, more before and after it) toward the names a content editor actually
reads, and every panel label that said "Section" now says "Row", the word an
EN editor is looking at (438 merge tags across 15 blocks). The client
manual, which had drifted a whole catalog generation, is regenerated from
the import pipeline itself so it cannot drift again. Along the way: a fresh
audit sweep, two label-truth fixes, and a probe that killed its own premise
the same day it was built. The push ends the way the project taught us to
end, with a final commit that adds no block: it pins three icon rails and
adds the guard that keeps them pinned.

**Phase 7: governance, and the email that says what it is (2026-08-22 →
08-25).** The 184 commits since this document's last snapshot, and the stretch
where parallel work stopped being occasional and became the way the project
runs: seventeen pull requests merge into the converter in four days, and on
one afternoon two branches mint the same version number, each of them
honestly. The answer is process.
On 2026-08-24 the converter adopts a spec-driven layer — a reverse-engineered
spec for every subsystem, a reviewer protocol, a two-lane delivery model, and
the repository's first continuous integration: four gates, one of which
refuses a change whose owning spec did not move with it. Meanwhile the
template takes the brand type scale in a single table, and the content
baseline makes a full round trip, 32px in to 64 and back to 32 four days
later by ruling. Two features land that the catalog had wanted from the
start: one dropdown that recolors every link in a block, its options read out
of the stylesheet rather than configured; and a hidden name-and-version band
on every block, invisible in the inbox and revealed inside EN's builder by
adding a Debug Helper block, so an editor can finally see which vintage of
which block they are looking at. The debug overlay moves out of the template
and into the converter, where a click copies the exact selector for anything
on the page. A sixteen-agent render audit reads thirty-three renders and
produces seventy-four findings, three of them real defects in the payload —
including a stray letter baked into an image's pixels since July. And the
push ends on the finding that reframes the whole Gmail budget: an entire
stylesheet dropped, comfortably under every size limit, because one label
contained a semicolon.

## The five things we'd tell another team

1. **Measure the delivered email, never the build.** What your compiler
   produces is a hypothesis. The platform rewrites it on the way out, and
   clients rewrite it again on the way in. More than one "obvious" root cause
   in this project died the moment we looked at what actually arrived in an
   inbox.

2. **Give editors bounded choices, not blank boxes.** Nearly every field the
   converter generates is a dropdown of vetted options. There is deliberately
   no free-text spacing field anywhere in the system. Editors can adjust
   breathing room; they cannot push the layout off its grid, because no
   free-text spacing field exists that could.

3. **The element above owns the gap below it.** All vertical space lives on
   bottom margins, on a closed named scale. If A owns the gap below it, then
   A+B and A+C both look right. If B owns the gap above it, every new pairing
   is a new bug.

4. **Never ship a control that does nothing.** A dropdown whose options change
   nothing teaches an editor that the controls are decorative. We built a
   system that renders every option of every dropdown and compares the pixels,
   so "this control does nothing" is a measurement rather than an opinion.

5. **Write the rule down where a machine can check it.** A convention that
   lives only in someone's head, or in a chat log, is already lost. The same
   stale flag was found and removed, came back through a file rename and a
   well-meaning fix, and was found again, because the rule against it was
   prose. It stopped recurring the day it became a build check.

## By the numbers

Each figure names its owner: **TPL** (the template library, this repo), the
**Marketing Tools app** (the private Email → EN Marketing Tools converter), or
**both** where one project's work ran on the other's material. Every figure
is measured at this document's snapshot commits (TPL `7a4b0c3` · converter
`8fb54e8`, 2026-08-25); work that landed afterward is not reflected.

| | | Project |
| :-- | :-- | :-- |
| Project span | 2026-05-25 → 2026-08-25 (93 days, counting both ends) | Both |
| Commits | 751 (387 TPL · 364 Marketing Tools app), merges and this document's own commits counted. 184 of them since the last snapshot, in four days | Both |
| The catalog | One master template: 60 blocks under 9 category dividers, plus a one-block holding pen for a block under repair | TPL |
| Blocks shipped into EN | 56 canonical blocks in 9 folders, carrying 1,340 generated fields (1,403 counting the category bands, which render in the catalog and never import) | Both |
| Autoresponders | 2 donation thank-yous of 7 blocks each | TPL |
| The converter itself | ~25,800 lines of production code, 924 automated tests across 38 files, **zero backend**, at version 104 | Marketing Tools app |
| Published contracts | 2 documents, 5,785 lines in the canonical copies, written beside the converter and mirrored into this repo, byte-identical beneath a two-line banner | Both |
| Version ledger | 76 versioned template artifacts (the master template, shell plus stylesheet, at v61; the compiled Template Styles block at v50), 44 of them now carrying the publish date their version band prints, plus the app itself at v104 | Both |
| Probe instruments built and archived | 26: 12 platform probes archived with the app, 14 rendering probes archived here | Both |
| Email-client render rounds reviewed | 8 rounds in one QA session alone, 120 individual renders of the TPL catalog; the 2026-08-24 round read 33 renders across 17 clients, split between 16 agents | TPL |
| Editor controls proven live or dead by pixel comparison | 1,003 dropdowns re-swept on the current catalog (2026-08-25): 999 pass, 4 fail, 0 unproven, and all four failures closed the same day. The earlier 1,027-dropdown, 11,108-render sweep (2026-08-18) measured the since-retired full catalog and is not comparable. The padding oracle separately re-proved 434 of 434 spacing fields live, zero inert, zero overflow | Both |
| Stale markup annotations removed after proving they changed nothing | 8,376. TPL's markup, proven inert by the app's strip-and-regenerate audit | Both |
| Delivered head CSS against Gmail's cliff | The master estimates 14,021 delivered bytes: 120 under the 14,141-byte working target, 2,363 under the 16,384-byte cliff. The shared stylesheet sits at 7,904 of its 8,850-byte share | Both |
| Automated guards now standing | 4 audit engines plus a padding oracle and a growth cap (app), 3 linters (2 here, 1 with the app), byte budgets at both ends, and since 2026-08-24 four continuous-integration gates over 3 machine-checked contracts | Both |
| Pull requests merged since the last snapshot | 17 in the converter, 2 here — the window in which the work went parallel | Both |

---

# Part 2: For the technical reader

## What we learned about Engaging Networks

EN's Marketing Tools is not documented at the level this work required, so the
findings below were produced by controlled sends: a probe email carrying
labeled variants, sent through a real EN account, with the delivered HTML
fetched and compared byte-for-byte against what we shipped.

### The CSS inliner always runs, and it cannot be turned off

The inliner is EN's pass that rewrites your stylesheet onto individual
elements as inline styles. We pinned down on 2026-08-05 that it always runs
and cannot be disabled. An earlier version of the conventions
document wrongly told agents to disable it; that correction is preserved in
the doc rather than edited away.

A 14-construct probe (2026-08-07, two rounds) produced the verdict table now
in the conventions document. The headlines:

| Construct | What EN does |
| :-- | :-- |
| A plain rule | Inlined onto the element, rule removed |
| `@media (prefers-color-scheme: dark)` | **Kept verbatim**, so dark mode survives |
| `@media only screen and (max-width: 480px)` | Kept, so mobile rules survive |
| `[data-ogsc] .x` at top level | **Dropped**. The Outlook.com dark branch is lost |
| `[data-ogsc]` nested inside a conditional media query | **Kept**. This is the rescue |
| `div[class="x"] { … !important }` | Inlined, and **`!important` is stripped** |
| A rule matching nothing | Pruned |
| An MSO (Microsoft Office) conditional comment, the markup only Outlook reads | Kept intact |
| Any rule nested in a conditional media query | Kept, not inlined (a bare, unconditional `@media screen` is flattened and inlined) |

The operative consequence: **a conditional media query (a CSS rule that only
applies under a stated condition, like a screen width) is EN's "do not touch"
wrapper.** Anything that must survive as a rule rather than an inline style
goes inside one. Two corollaries bit us later. A media-query rule that must
beat a base rule needs `!important` of its own, and any `!important` you wrote
on an inlinable rule is gone by the time it lands.

Timing matters as much as behavior. The inliner is a **send-time transform**:
the stored template keeps your source verbatim, so exports round-trip your
source, and every verdict describes what reaches the client, not what EN
stores. An export proves nothing about what a recipient gets.

MJML adds a transit hazard of its own. A single authored background image
compiles into four separate HTML carriers, so every editable field binds all
four and the build rewrites all four. Miss any one and some clients show the
old photo while the rest show the new one.

### The block editor HTML-escapes `>` inside an HTML-type Replacement

The flagship finding, and the most damaging.

An HTML-type Replacement was holding a block's `<style>` element. Import was
clean. Send was clean. But a block that had been through EN's editor shipped
with `>` rewritten as `&gt;`. Because `<style>` is a raw-text element in the
HTML standard, `&gt;` is never decoded back. It stays four literal characters,
the selector (the part of a CSS rule naming what it applies to) becomes
invalid, and the client's parser discards the rule silently.

The damage pattern is what made it hard to see. Dark-mode rules come in pairs:
`.block p` sets the text color and uses a descendant selector (a space,
matching anything inside), so it survived; `.block > table` repaints the
background and uses a child combinator (the `>`, matching only a direct
child), so it died. Half of each pair lived. The result was **white text on a white panel**,
and on iOS Mail, entire content blocks rendering blank.

Pinned by four controlled sends (2026-08-13): the trigger is an **edit**.
Import, send, and an untouched open-and-save round trip are all clean and
byte-identical. The escape persists only for a field that was actually
modified and resubmitted. Scope is narrow. In the same sends, six child
combinators living in ordinary block markup came through raw every time, and
EN's separate CSS Editor surface was cleared on 2026-08-18.

Two measurement traps cost a full send round each, and they are worth knowing
about for any similar investigation. **EN prunes rules that match nothing**,
so a canary selector (one planted just so its survival can be checked) aimed
at a non-existent class vanishes and reads as a pass. And **a plain rule is
inlined**, which dissolves the very selector you were trying to inspect.

Two fixes came of it. Ours shipped: `styles.css` was rewritten to contain
**zero child combinators**, with measured attribute-selector stand-ins
documented in the guide. Theirs is written and ready to submit: a bug report
with an importable proof-of-concept block.

### EN's CSS reserializer is string-blind, and Gmail pays for it

Measured 2026-08-25, and the most expensive single character in the project.

EN reprints every stylesheet at send. That reprinter reads a declaration by
scanning for the next `;` — **including one sitting inside a quoted string**.
A debug label reading `"… shows block versions; remove before send"` was split
at that semicolon, the remainder discarded, and the stylesheet shipped with a
string whose quote never closes.

What each client does with an unterminated string is where the damage
diverges. A spec-compliant parser recovers at the newline and loses one
declaration; iOS Mail did exactly that. **Gmail's sanitizer discarded the
entire merged head stylesheet** — every media query with it, so a button row
that should stack on phones rendered as touching pills. The delivered head was
about 12.4K, comfortably under both the working target and the 16,384-byte
cliff.

That is the part worth carrying somewhere else. We had spent a month building
a mental model in which a dropped Gmail stylesheet means *too many bytes*, and
that model cannot see this failure at all. The symptom was a size symptom; the
cause was a syntax one.

The suspect was almost the wrong one, too. The block-band rules that shipped
alongside the label use `:has()`, which is exactly the kind of modern selector
a sanitizer might reject, and it took a control test from four days earlier —
same `:has()` rules, balanced quotes, Gmail perfectly happy — to exonerate the
gate and leave the label as the only difference.

The fix is layered on purpose: the label lost its semicolon, and the escaper
that emits every band label now hex-escapes `;`, `{` and `}` so no future
label can re-trigger it. The invariant went into both contracts — **no
literal `;`, `{` or `}` may reach EN inside a CSS string** — with a QA step
that greps the delivered head for a `content: "` line whose quote never
closes. Colons and commas inside strings remain **unmeasured**; EN rewrites
both elsewhere, nothing we ship uses them, and the record says so rather than
guessing.

### EN's Content editor is ProseMirror, and the first keystroke rewrites your markup

ProseMirror is an open-source rich-text editing engine, and EN's Content
field turns out to be one. Measured 2026-08-19 with paired blocks from a
single import. One copy got a
null edit in every field (click in, type a character, delete it, save) and its
never-opened twin was left alone, so any difference could only have come from
the editor.

| What you author | What the editor leaves |
| :-- | :-- |
| Bare copy, or a lone `<span>` | Wrapped in one `<p>`; spans and classes survive |
| `<span style="font-weight:700; color:#362229">` | Re-expressed as marks: `<strong>`, color as `rgb()` |
| An inline element with a property that has no mark (`font-family`, `background-color`, `display`, `border-radius`) | **That property is dropped** |
| A `<p>` that is already there | **Unchanged. The transform is idempotent (re-running it changes nothing)** |
| `<a href target rel style>` | **`href` and `target` kept; everything else goes** (`rel`, `style`, `class`, `id`, `title`, `data-*`) |
| An MSO conditional comment | **Destroyed** |

Three things follow.

The injected paragraph carries no inline style, so the stylesheet's `p` rule
wins and a 10px (pixel) caption ships at 16px. EN's inliner then bakes that winning
rule onto the element as an inline style, `inherit` included, and inline
`inherit` is exactly the construct Outlook's Word engine cannot be relied on
for.

Because the transform is **idempotent**, the fix is to pre-apply it. The
converter now wraps values at generation time so the editor's first edit
changes nothing. Verified end to end (23 values wrapped, 132 already
block-level, 2 failed open) and proven pixel-identical to the unwrapped
rendering.

**Node versus mark** turned out to be the predictive model. ProseMirror treats
a link as a mark, rebuilt from a fixed attribute set, while `span` and `p` are
nodes that keep their attributes. So a link embedded in rich-text editor
(RTE) content can only be styled from an ancestor class, which is now the
sanctioned pattern, verified to survive both storage and delivery. The
catalog's rich-text values now hold zero styled anchors (anchor is HTML's
name for a link tag), down from 54; link color moved to ancestor classes
(2026-08-19).

### Template edits do not reach emails that already exist

An EN template change does not propagate into drafts built from it. Any email
using that template must be rebuilt from scratch.

This one platform limitation is the entire reason the **Template Styles
block** exists. CSS is the part of a template that most often needs a post-hoc
fix, so we ship the head stylesheet as a *block* instead. A CSS fix becomes a
block swap rather than an email rebuild.

### Smaller platform behaviors, each measured

- **One value, several carriers.** A single `mj-section background-url`
  compiles into four places: an inline `background:`, a table `background=`
  attribute, a second `url()` inside that table's style, and `v:fill src` in
  the MSO conditional. Miss the CSS ones and Outlook shows the new photo while
  everything else shows the old one. This cost a full QA round.
- **EN rebuilds a table's `background` shorthand** and drops the `url()`. The
  leftover shorthand then *resets* the background in CSS clients, overriding
  both the `bgcolor` and legacy `background=` attributes. A full-width section
  has no div carrier at all, so after EN it renders blank in Gmail, Apple
  Mail, and iOS. **Never author a full-width section with a background image
  for EN.**
- **Same-condition `@media` blocks merge into the first occurrence's position**
  (2026-08-19). Any cascade depending on source order is silently inverted.
  Matching is textual: `only screen and (max-width:599px)` and
  `(max-width: 599px)` are different strings and do not merge. So each
  condition is authored in exactly one place, and order-dependent blocks get
  deliberately distinct conditions (TPL's 9998px hide vs the 9999px
  Outlook.com block). The fold reaches **across documents**, and its order is
  the reverse of what we assumed: a stylesheet arriving in the email BODY
  merges *ahead of* the template head's own (measured 2026-08-24). TPL's
  viewport fork had been designed on the opposite belief, so its reveal folded
  up past its own hide and lost everywhere below the breakpoint — latent only,
  because no shipped block carried the class. Two lessons rode with it: an
  order-dependent condition string must be unique across *every* CSS source in
  the email, and **a probe that blesses such an arrangement has to include the
  body stylesheet in the send.** The probe that blessed the old one did not,
  which is the single case the fold cannot reach.
- **EN splits comma-separated selector groups into individual rules**, so one
  authored group can end up half-alive.
- **The inliner has two paths, and only one of them strips `!important`**
  (measured 2026-08-24). A rule reaching EN through the head is inlined with
  its `!important` removed; a `<style>` carried in the message *body* is
  consumed whole and inlined with `!important` intact. Word rejects any inline
  declaration carrying it, so those declarations simply vanish there while
  every other client honors them — and honors them so hard they outrank
  dark-mode forcing. An inlined `!important` is a **Word-only outage switch
  that looks correct in every preview you are likely to check**: in the probe
  that found it, Outlook reverted the text and dropped the links to default
  blue, because their only color was in the dropped declaration.
- **EN re-prints head CSS at send: a compact field arrives at 1.30× its
  bytes** (measured: 9,713 compacted → 12,644 delivered).
- **EN ingests a stylesheet once per `<style>` wrapper.** A doubled wrapper
  delivered two full copies (24,952 bytes, over the Gmail cliff). Removing it
  took the same send to 13,325.
- **EN rejects a save whose rendered message exceeds 299,760 bytes**, and
  the builder paints "Invalid or missing authentication token" over it while
  the real response says "Message contentHtml too long" (bisected
  2026-08-20). We budget to a 285,000-byte working ceiling, roughly three
  average blocks of headroom, and the app meters every template against it
  as an advisory, never an error (my call: a catalog template is expected
  to exceed a sending budget). The meter is a rough ceiling, not a
  projection: it counts the authored text with merge tags still in it, so
  it under-reports what EN counts. **Which sending surface that ceiling was
  measured through is not in the record**: the bisection ran against one
  endpoint, and the behavior that prompted it was a Marketing Automations
  email refusing to save when a Broadcast of comparable size did not. Whether
  every EN surface enforces the same number is untested, and this line says so
  rather than generalizing from one instrument. Measured directly, an email
  using every block stopped fitting one message somewhere in the last four
  days: it was 252,607 bytes on 2026-08-21 (84% of the cap) and is 409,046
  today, 109,286 over — the trailing gap sections, the version bands and the
  Link Color tokens each cost every block a little. That is a catalog
  measurement, not a sending one; a real email is far under. The consequence
  is practical rather than alarming: the catalog page now goes to Email on
  Acid as a **two-part paste**, split at a category boundary, because a single
  paste of it cannot be saved.
- **Authoring comments in the template head never ship.** The importer
  strips them at import (2026-08-20), keeping conditional comments and,
  with one narrow exception for the builder band's own sheet, anything
  inside a style or script tag. Head documentation is therefore free: the
  strips removed 3,590 bytes from the delivered head of the catalog as it
  then stood, body byte-identical.
- **EN injects its own preheader** (the preview snippet an inbox shows under
  the subject line) from each email's Preview Text setting, so a
  template-baked one doubles up in inbox snippets. An earlier `preview_text`
  field was shipped and reverted the same day once a send test disproved the
  assumption.
- **Our importer strips `<title>` and the `aria-label` (the text a screen
  reader announces) that MJML mirrors onto the body wrapper.** This is the
  one item in this list that is a converter
  decision rather than a measured EN behavior; it lives here because it pairs
  with the preheader finding. Removing the aria-label is an accessibility gain,
  not a loss. A screen reader was otherwise announcing the entire body as one
  string that only repeated the title.
- **Sends read block content live**, not from a build-time snapshot
  (2026-08-19). Methodologically important: a storage-versus-delivery
  comparison needs no rebuild to be valid.
- **Replacement nesting resolves recursively**, measured to three levels in a
  real send (2026-08-09) with zero literal tags leaking through, and the same
  block added twice keeps independent field selections per instance.

## What we learned about email clients

### Gmail drops head CSS by size, and it drops it whole

Measured 2026-08-18 as a controlled pair. A real send delivering **28,331
bytes** of head CSS had its entire `<style>` ignored. The mobile rules sitting
at byte offset 12.4K did not apply, well before any truncation point, because
the drop is all-or-nothing. A 715-byte probe kept everything.

The cliff sits at **16,384 bytes**. It is not mobile-only: Gmail desktop
webmail in Chrome showed the identical pair. Every Gmail surface shares the
sanitizer (the filter Gmail runs over incoming email code).

Two consequences are now permanent. We **budget the delivered CSS, not the
authored CSS**, with EN's 1.30× re-print factor, a working target of 14,141
delivered bytes, and a build-time lint that holds every page under both the
target and the cliff. The one page that ran over target by design, the full
block catalog, went away in the consolidation (pruned to its leftovers on
2026-08-20, the leftover file deleted the next day), and its exemption went
with it. (The linters warn rather than fail by contract; the
working rule is that a clean build prints zero warnings.) And the deeper
armor is an inline-first doctrine: the no-CSS
rendering of every element should already be the correct *mobile* rendering,
so a dropped stylesheet degrades rather than breaks.

The budget is a real ceiling with a ledger. The page the cliff actually
gated, the full catalog, sat roughly 50 bytes clear until 2026-08-20, when
deleting a retired width ladder returned about 1,325 delivered bytes; that
page then stopped existing, which removed the alarm without replacing it.
So since 2026-08-21 the build states its budgets outright rather than as
one prose figure that kept rotting: every page's delivered head against the
working target, the shared stylesheet against its own slice of that, and a
cap of 20 distinct fixed column widths, each of which costs about 174
delivered bytes of head CSS (17 are in use).

The target itself moved on 2026-08-25, from 14,000 to **14,141**. There is no
measurement behind that number and it does not pretend there is: it is a
lucky number, mine, chosen because the advisory band under a hard cliff is
arbitrary anyway and a figure somebody picked is more honest than a round one
that looks derived. The guard carries a comment saying exactly that, so no
later tidying pass "normalizes" it back. At this snapshot the master's
estimated delivered head is 14,021 — 120 bytes under target, 2,363 under the
cliff before the guard's 250-byte hoist allowance — and the stylesheet is at
7,904 of its 8,850, having handed four rule groups to the template head where
an email built without the styles block can still reach them.

Two caveats belong with the whole budget. The largest delivered head we have
ever **measured** green is 13,325; everything between there and the cliff is
modelled, not observed. And size is not the only way to lose the stylesheet:
on 2026-08-25 Gmail dropped a 12.4K head whole, for a stray semicolon inside a
quoted string, which no byte budget could ever have caught. The budget
sections above are necessary and they are not sufficient.

### Dark mode reaches most clients, and two important ones not at all

Only two hooks survive EN: `@media (prefers-color-scheme: dark)`, and
`[data-ogsc]` nested inside a conditional media query.

**The Gmail app on Android and Outlook 2021 on Windows expose neither**, and
they transform in opposite directions. Gmail darkens light designs. Outlook
desktop also *inverts* dark ones, flipping a `#000000` footer to a white
background while leaving its light-green logo and white icons untouched.
`bgcolor` attributes buy no protection; a panel colored with the attribute
inverts identically to one colored with CSS.

**Images are never recolored by either client. That is both the failure mode
and the defense.** The accepted end state for Outlook desktop dark mode is to
let it invert and make the artwork survive the inversion, which produced a
scripted contrast-outline treatment that adds an opposite-polarity rim to
every transparent PNG (Portable Network Graphics, an image format that
supports transparency) whose ink depends on its background, applied across
14 assets.

Two measured surprises are worth recording together. First, **a mercy**: an
authored light ground with no dark hook at all rendered dark and legible in
all five dark-capable clients of the test matrix. The white-on-white failure
predicted from the local build never reached an inbox. Dark-mode claims must
be measured on delivered HTML, never on the compiled build. (One email, one
round: strong evidence, not a license to delete hooks.) Second, **the mercy's
hard limit**: our own dark rule painted an opaque black lid over every
background-photo hero in Apple Mail dark and Outlook.com dark. Clients rescue
what EN delivers, but they honor *your* dark CSS as intent. Fixed with an
exemption for image blocks written at equal specificity (the weight CSS uses
to decide which of two competing rules wins), confirmed across all five hero
shapes.

### Outlook's Word engine, and things we chose to accept

- **A section carrying both a background color and a background image renders
  as a flat slab** in Outlook 2021 and Microsoft 365 on Windows. MJML copies
  the color onto the Outlook `v:fill` as `color=`, and Word paints that
  instead of the photo. It renders correctly on Outlook for *Mac* and
  everywhere else, which is why the failure looked inconsistent for so long.
  Fixed by moving the fallback color onto a wrapper behind the section, across
  25 sections, and now guarded by a build lint.
- **Outlook renders every button square.** It ignores `border-radius` on table
  cells. We accepted that as graceful degradation; VML (Vector Markup
  Language, Outlook's legacy drawing format) rounded-corner wrappers were
  rejected outright because they break the converter's label and color
  bindings and bloat every block.
- **Word ignores CSS box geometry on spans.** `display:inline-block`, `width`,
  and `height` all die.
- **Word clamps a stale ghost width to its cell, and shrink-wraps a
  `width:100%` one** (measured 2026-08-21, two Outlooks agreeing to the
  pixel). MJML freezes a computed pixel width into the Outlook-only ghost
  table it wraps around each column group; both geometry scanners now clamp
  those widths the way Word does, after a probe refuted a shipped fix built
  on the opposite belief (Appendix A, entry 19).
- **`line-height: 0` is a trap.** Correct in every browser and byte-identical
  across desktop and mobile, and Word honors it, rendering every hand-rolled
  pill as a thin bar with invisible label text. Reported and reverted the same
  day.
- **Word cannot pad a `v:rect`**, confirmed 2026-08-24 at 32px and at 64px,
  so the failure is not magnitude-dependent and the only remedy is the rail
  pattern (fixed-width spacer columns) it was tempting to replace padding
  with. Four shipped blocks had quietly drifted to the padding shape and were
  rendering flush in Outlook desktop; one of them carried a comment saying so
  while the markup under it had drifted anyway. The cost of the fix was
  stated up front — eight editor fields disappear, all of them controls
  Outlook was ignoring. What makes this defect easy to ship is that **nothing
  looks wrong anywhere you preview**.
- **Outlook's dark mode flips white copy that has no explicit background
  behind it**, near-black, which over a dark photograph is near-invisible
  (measured 2026-08-24 across every white-over-photo text in the catalog).
  Copy sitting on an explicit background transformed legibly. The standing
  ruling is to **accept it and not defend it**: no scrims, no panels, no
  slabs behind text over photography — the 08-24 QC round removed the one
  that had crept in. Text over an image is a contrast risk the client decides
  to take, image by image, and the template ships the raw layout and
  documents the risk rather than making that choice silently. Pinning white
  inline is not a fix either; inline white is precisely what Word's dark mode
  flips.
- **Word auto-links a bare email address and paints it default blue**, which
  on a brown footer is near-illegible. Both footers now author their own
  `mailto:` anchor rather than leaving a merge tag bare.

### The gutter finding

A QA round read Gmail on Android as shrinking two-column story cards. Four
probe rounds disproved it: **there is no column-shrink bug.** A Pixel 10
reports 1080 device pixels at a 3× ratio, so Gmail lays out at roughly 333 CSS
pixels, and a card loses 80 of them (a quarter of the width) to section and
column gutters, the built-in side padding between content and the edge of
its container. The model predicted 252.7px against a measured 251.0px; the
closest competing model missed by 17.7px.

The shipped fix took mobile imagery flush to the edge, moving an image from
262.7 to 326.0 CSS pixels with the desktop rendering byte-identical. The
lesson generalized into the guide: **diagnose gutters before restructuring
columns.**

The same geometry bit again from the other side on 2026-08-21. A block that
groups its columns (MJML's `mj-group`) never stacks them on mobile: every
column becomes a percentage, so a narrow fixed-pixel icon column (a rail)
shrinks with the screen while the fixed padding inside it does not. The
Podcast Streaming Block's two identically authored 62px badges had rendered
45 and 29 pixels wide on phones for seven weeks, and the rows with a single
icon
never looked broken because there was no sibling to compare against. The
fix is a mobile width pin on every such rail, and the rule is now a build
guard rather than a guideline, with two carve-outs measured in so it stays
quiet: a wide column that IS the row is supposed to shrink, and a spacer
rail holds nothing that can.

## What we learned about designing editor controls

The converter is opinionated, and every opinion below was an explicit decision
rather than an implementation accident.

- **Free numbers are the exception, not the rule.** A dev call on 2026-07-20
  settled it: editors pick named options. The sanctioned free-number fields
  are a short list (image and divider width, font size, line height, letter
  spacing, border radius). Spacing, padding, and height never appear as free
  text.
- **A closed spacing scale.** None / Half / Single / Double / Triple = 0 / 8 /
  16 / 32 / 48px, with the pixel value in the label, and TPL's template
  extends it with Quadruple (64px) through the contract comment. Off-grid
  authored values snap to the nearest step, ties rounding up, with the
  original preserved so deleting the field restores the source byte-exact.
  There is no per-field "Original" escape hatch, because an escape hatch is
  how a scale stops being a scale.
- **Bottom-only pacing**, for the reason in Part 1. Columns never carry bottom
  padding. A later exception proves the rule: a caption owns the gap *above*
  itself, so hiding the caption removes the gap with it instead of stranding
  white space under the photo.
- **A geometry guard.** Padding above a declared reach (64px by default) is
  design geometry, not pacing, and gets no field at all. Never a free-text
  fallback. Exceptions are deliberate and stay bounded: a class-scoped scale
  can raise its own reach, which is how the 350px hero-photo reserve went from
  locked to a curated dropdown on its own 15-step ladder (my call,
  2026-08-19). Still never free text.
- **Growing a gutter can never break the layout.** MJML freezes a block's
  geometry at compile time: authored fixed-pixel columns, images sized to
  their columns, and widths derived from a section's padding. Widening a
  gutter past the point where that frozen geometry still fits wraps the row
  in every CSS client. Since 2026-08-21 the app re-checks the whole
  geometry once per candidate padding value and never offers an option the
  layout cannot take; where only the authored value survives, no field is
  created at all. The build counts the cost by command rather than prose:
  44 of 170 frames (the padding-owning sections, wrappers and columns)
  cannot take the full declared spacing scale at this snapshot. Since
  2026-08-25 an author can also *declare* a ceiling the scan cannot see, for
  geometry that is content rather than structure — a row of fixed-width pills
  written inside a text block is frozen exactly like a fixed column, and
  nothing measuring the compiled HTML will ever know it.
- **Inert controls are suppressed, and the suppression explains itself.**
  Where a field would do nothing (padding a fixed layout ignores, or a value
  whose only occurrences sit inside an Outlook conditional and would silently
  desync every other client), no field is generated, and an informational note
  records why. These are *info*, not warnings, because the source is correct
  as written.
- **Only structure earns an inertness label.** A control that moves nothing
  because the placeholder copy is short is not inert; the first long
  headline an editor types brings it alive. The audit renders three copy
  states per control (as-authored, single-line, wrapped) and calls it live
  if any of them moves pixels, and a viewport-scoped label is allowed only
  when the layout, not the copy, pins the control. The rule was settled on
  2026-08-21, after its per-block escape clause had fired twice.
- **Inert means inert under every arrangement the block offers.** The audit
  sweeps each control against every *other* field's default, so a control that
  a default layout pins reads dead even when an alternate layout revives it —
  which mis-called five rows "dead controls" on 2026-08-25. The engine now
  re-sweeps a would-be-inert control under each value of its row's arrangement
  dropdown and names the layout that revives it. The tempting alternative was
  a fifth entry on the audit's exemption register; my call was to measure it
  instead, and the register stays at four. **Arrangement-dependent deadness is
  measured, never exempted.**
- **A guard that cannot be sure fails closed.** The image-alignment guard
  computed a mobile width that is only sound under some layouts, and where it
  was unsound it had been guessing — and labelling a live control
  "Desktop Alignment". It now detects its own unsoundness and stops: it either
  keeps the control with a plain, unqualified label, or suppresses it, but it
  never ships a viewport qualifier it cannot justify. A wrong label is worse
  than a missing one, because an editor believes it.
- **"Failed" has to mean every failure.** The audit's Failed Only export
  originally meant *dead at both viewports*, which quietly excluded a control
  that works but is mislabelled, and one whose verdict could not be
  established. Both are failures an operator needs in the export. One
  predicate now backs the badge, the filter and the export, so the three can
  no longer disagree about what failed.
- **Labels lead; merge tags follow.** This was a reversal. The original
  contract kept machine names byte-stable while labels moved, and the two
  vocabularies drifted apart. The 2026-08-19 rework made names follow labels
  through a single shared resolver, at the cost of a catalog-wide rename and
  one version bump per block, so the panel and the tags can no longer
  disagree.
- **The panel speaks the editor's language, not MJML's.** What MJML calls a
  section, an EN editor sees as a row of the block, so every panel label and
  merge tag that said "Section" now says "Row" (my call, 2026-08-21; the
  rename moved 438 merge tags across 15 blocks). The same rule reaches the
  option level: Image Position labels follow the side the image actually
  renders on, which a right-to-left row reverses, and a control that moves
  a whole row says "Alignment", never "Text Alignment".
- **One dropdown can hold whole layouts.** Hiding an image can never widen
  its partner: the column, its Outlook ghost cell, and the sibling's width
  all stay behind, leaving a hole rather than a full-width heading. So a row
  that wants a "no image, text full width" state authors that arrangement
  as a hidden sibling section, and the app folds it into the row's existing
  arrangement dropdown as one more option (2026-08-21). Pairing is by value
  equality — and the contracts claimed for a while that diverging the two
  copies "fails loudly", which was not true (Appendix A, entry 33). It shipped
  the block's content twice and renumbered every field after it. A build check
  now compares the two copies and names the closest match when they drift,
  which is what the sentence had been promising all along.
- **Display is always first** in its group, because it decides whether the
  rest of the group even matters. Field order within a section runs Visibility
  → Primary content → Appearance → Dimensions → Position → Spacing.
- **Colors are always dropdowns.** Every color the template itself authors in
  an importable block is collected into a brand palette, grouped by role,
  ordered perceptually, and vanity-named; stylesheet-only colors never reach
  a dropdown. Editors do not type hex codes (the #-prefixed color codes
  designers use) and off-brand colors cannot creep in through everyday
  edits. The one documented exception: compound border values stay plain
  text, because a compound value cannot be a dropdown.
- **A control can be discovered rather than configured.** Link Color, added
  2026-08-24, gives every block one dropdown that recolors all of its links at
  once. Nothing lists its options: the converter reads the stylesheet, and any
  top-level single-declaration rule of the shape `.link-<name> a { color: X }`
  becomes an option, with the bare `a` rule naming the default. Adding a
  colour to the palette therefore adds it to fifty-odd dropdowns and nobody
  edits a list. The value ships as a class token spliced identically into
  every text carrier in the block, so one field drives all of them and an
  empty default restores the original bytes exactly. Two rules came out of
  building it: a link with no text in it is not eligible, because recolouring
  glyphless content moves no pixels; and there is deliberately no hook for the
  default colour, because a render-identical duplicate option is precisely
  what the inert audit exists to flag.
- **Alt text is always editable.** Every image carrying an alt attribute mints
  an editable alt-text field, `alt=""` included. Real copy for meaningful
  images, empty for decorative art, never a label that narrates chrome to a
  screen reader. The authoring rule is that every image carries one. The
  per-image opt-in annotation this replaced was retired across 262 instances.

## The data-* vocabulary: every annotation, what it does, and why

The MJML source carries a small vocabulary of `data-*` attributes: HTML
annotations that browsers and email clients ignore, and that our tooling
reads as instructions. They are how an author tells the converter "this
block is a duplicate," "this width is design geometry, leave it alone," or
"these three links are really one link." MJML itself rejects `data-*` on
its own tags, so the converter reads them from the raw MJML source; only the
exclusion flags are carried through the build's annotate-compile-restore
round trip, flags on raw HTML elements ship as authored, and the converter
whitelists the validator noise they cause. (EN's editor also stamps platform
`data-*` of its own onto raw anchors, like the campaign id on a Manage
Subscription link, and other platform hooks ride the stylesheet, like
Outlook.com's dark-mode attribute; none of those are ours, and this census
leaves them alone.)

Three rules govern the whole vocabulary. Most flags are **valueless**
(`data-no-display-toggle`, never `="true"`), and detection is by presence;
reading them the other way is how one flag got silently ignored for about a
week, until 2026-07-31 (Appendix A, entry 10). Every flag must **earn its
place**: the dead-flag audit strips each flag the converter reads and
regenerates the output, and one that changes nothing gets deleted rather
than left as folklore (that audit's scope is the flags the generator reads;
routing flags are covered by the data-* audit's consumer registry instead).
And these tables are the **2026-08-25 census** of the vocabulary, not the
contract and not the catalog: a few flags have no live instance today — the
probe flag, with every probe archived; the Link Color opt-out, which nothing
has yet needed; and `data-mobile-only-padding-right`, which went from ten uses
to none as its rows gained alternate arrangements and the last two converted
to the sharper per-side opt-out below — and they stay because the contract
defines them. The living rules are the guide's §5 table, the conventions
document's "data-* contract" reference, and PLAYBOOK §6.

### Block lifecycle and routing

| Attribute | Where it goes | What it does | Why |
| :-- | :-- | :-- | :-- |
| `data-fully-exclude` | a whole block | Drops the block at import as a redundant variant | Variants that differ only in editable values fold into one importable block's dropdowns. A family normally keeps one un-flagged canonical (default content is a block's value). Four blocks carry it today: three CTA Button variants that their canonical's dropdowns already reproduce, and the reading gap between the two footers, which became a block of its own once it turned out to be import-excluding the footer above it (entry 30) |
| `data-import-exclude` | dev-only blocks (the category header bars) | Renders in previews but starts unchecked in exports, with a warning on direct export | Catalog chrome should never land in EN as a block |
| `data-probe` | probe instrument blocks | Imports and sends like any block, but the brand-color census and the color-usage audit skip it | A probe's colors are measurement signals, and a probe-only hex must never surface as a palette dropdown option (2026-08-18) |
| `data-visible-duplicate` | a block that duplicates its group's anchor on purpose | Exempts it from the "duplicates X but is not flagged" build warning while keeping it importable | Some duplicates are product decisions. Image 1x1 is the full-bleed shape under the name an editor actually looks for. The flag always carries a dated comment naming the anchor and the decision, and it warns as misuse on a group anchor or next to `data-fully-exclude` (2026-08-18) |
| `data-folder="<id>"` | category dividers and blocks | Routes the block into an EN folder. A block's own value beats the import form, which beats the divider, which beats the account default | The library files itself; nobody assigns folders by hand at import time. Divider values prefill the import form, and a block whose only content is an include can carry the attribute on a comment |
| `data-en-tools-band` | one `<style>` in the template head | Tells the converter to leave that stylesheet in the template shell instead of moving it into the swappable Template Styles block, and keeps the band's colors out of the brand-palette census | The builder's version band must paint from the shell EN always renders, not from a block an editor could remove. Its greys are the Marketing Tools app's own interface colors (2026-08-20), chrome rather than palette, and censusing them had been putting one grey into every text dropdown and another into every background dropdown |
| `data-en-tools-template-css` | a second `<style>` in the template head | Keeps that stylesheet in the shell too, exactly like the band marker — but its bytes stay inside the Gmail budget and the head-CSS hash | Deliberately not the band marker (2026-08-22). Rules an email cannot afford to lose if someone builds without the Template Styles block — the viewport fork, the light/dark swap mechanism, the rich-text margin containment — live here. Band bytes are subtracted by two instruments because the band is chrome; this CSS reaches the inbox and must keep counting |
| `data-band="<slug>"` | **injected by the importer, never authored** | Labels each block's hidden name-and-version band | Listed only so nobody adopts the name: an authored copy would collide with the generated one. Content blocks repeat in an email, so the hook is an attribute rather than an id (2026-08-25) |
| `data-category-short="<name>"` | category dividers | Replaces the full category name in block-name prefixes ("Text" instead of "Text Blocks") | Block names carry their category so EN's library sorts by group, without the prefix eating the visible name |

### Creating and shaping fields

| Attribute | Where it goes | What it does | Why |
| :-- | :-- | :-- | :-- |
| `data-style-dark-mode` | the dark twin of a light/dark image pair | Marks which image is the dark variant so the build pairs it with its light twin | The lone survivor of the retired `data-style-*` vocabulary (below); the TPL build consumes it, not the converter |
| `data-width-options="150,250,350"` | a column or a divider | Curates the width dropdown's ladder, overriding the config defaults. On a divider it ships Width as a Select, with an Original escape for an off-ladder authored value | A width menu should offer authored choices, not whatever ladder the compiled CSS happens to contain (dividers added 2026-08-19) |
| `data-image-shape-toggle` | an image that authors a border-radius | Ships the radius as a two-option Square/Circle Select instead of a free-text field | Opt-in because a radius is not always a shape choice; the Quiz photos' 18px soft corner is neither. Flag both twins of a pair or the shared dark-image field disappears (measured 2026-08-20) |
| `data-inset-toggle` | a spacing component | Mints Inset Selects even when a side is 0, and unlocks Spacing Above | The caption pacing exception, my call on 2026-08-18: a caption owns its gap above itself, so hiding the caption removes the gap with it instead of stranding white space under the photo |
| `data-display-toggle` | a column's sole member | Opts the member into the Include/Exclude Display Select it would otherwise never get | The one opt-in of the display family (2026-08-20). A Display Select is normally minted only for a component sharing its column, and header logos, headings and lone CTA (call to action) buttons are sole members, so eight of them could not be hidden until this existed; a streaming badge took the flag a day later. On a light/dark pair the flag sits on the first twin |
| `data-alt-arrangement="<Option Label>"` | an mj-section that is an alternate layout of the section before it | Folds that section into the preceding row's arrangement Select as an extra option instead of rendering it | How a two-column row offers "no image, text full width": a Display toggle cannot do it, because hiding a member leaves its column and Outlook ghost cell behind (2026-08-21). Structural rather than annotation, so it is deliberately absent from the build's annotation-strip list |
| `data-arrangement-label="<Option Label>"` | the primary section of such a pair | Names the primary arrangement's option in the Select | For a row whose alternate exists but whose reversed order does not, so the Select reads Layout rather than Image Position (2026-08-21) |
| `data-force-rte` | an mj-text carrying bare copy | Keeps the Content field on the rich-text editor when it would otherwise ship as a plain Text field | For copy expected to grow a link or emphasis later (2026-08-19) |
| `data-group-label="<words>"` | any content element, or a raw anchor | Names the field group verbatim: the panel group, the label prefix, and the merge-tag base | Wins over every inferred role, so the panel says what the author meant (2026-08-19). On a light/dark pair, label both twins identically |
| `data-link-group="<name>"` | sibling raw anchors sharing one destination | One web-address (URL) field drives every anchor in the group; the value splices into all carriers | EN auto-closes an anchor wrapping a table, so the Question Block row is per-cell anchors that must never fall out of sync (2026-08-18). Differing destinations fall back to separate fields; a member that cannot be resolved drops the whole field rather than half-binding |
| `data-text-anchor` | a raw anchor that is prose, not a button | Groups its fields under the Text family instead of "Button N" | A linked sentence is copy, and its panel home should say so (2026-08-19) |

### Opt-outs and viewport declarations

| Attribute | Where it goes | What it does | Why |
| :-- | :-- | :-- | :-- |
| `data-no-display-toggle` | content components | No Include/Exclude Display toggle | Some content must never be hideable: sender identification, unsubscribe text, required logos, the thermometer's interdependent figures. It beats `data-display-toggle` on the same element, because the opt-out check runs first |
| `data-no-width-toggle` | a lone fixed-px column, or a frame | No Column Width Select on the column; on a frame, pins the gutter out of the Block Padding Left/Right preset | Some widths are load-bearing design geometry, like an inset box; a frame flag also covers a gutter control proven dead at both viewports |
| `data-no-link-toggle` | an image | No Include/Exclude Link toggle | For links that must never be removable, like a legally required logo link |
| `data-no-direction-toggle` | the section (or group) that owns a column flip | No Image Position / Column Order control | Since 2026-08-11 the control mirrors alignment itself, so this is a taste judgment: some mirrored layouts should ship as their own block, not as a toggle |
| `data-no-alignment-toggle` | a hand-authored button row | No Alignment Select for that row | For pills whose fixed widths already sum to the content width: left, center and right then render identically, measured dead on four rows, with a fifth flagged by judgment for its single pixel of travel (2026-08-21). The scanner sees only the pill markup, never the frame it sits in, so the author has to say it |
| `data-max-gutter="<px>"` | a section or wrapper | Declares the largest side gutter the frame's content can take; the converter min-composes it with the cap it measured and clamps the padding ladder to whichever is smaller | The channel for geometry a scan of the compiled HTML cannot see (2026-08-25). A run of fixed-width pills authored inside a text block is frozen exactly like a fixed column, but it is *content*, so the geometry guard never sees it. Distinct from suppression: these frames hold the quiz question as well as the pills, so their controls stay live at the lower steps. 2 live uses, both the Quiz pill rows |
| `data-no-padding-<side>` | the frame authoring the padding shorthand | Suppresses exactly that side's Select; the side stays a literal value and the other three are untouched | The dead-at-both-viewports remedy narrowed to one side, for a padding that no arrangement can revive (2026-08-25). Replaced the blunter viewport-label flag on the two rows that had it. 2 live uses, both `-right` |
| `data-no-link-color` | an `mj-text` | Opts that text out of its block's Link Color Select | Defined with the feature and not yet needed: no text in today's catalog wants to sit out. Kept because the contract defines the vocabulary, not because the catalog uses it |
| `data-no-background-color` | any element with an authored background color | Keeps the color in the output but creates no field | For a background that provably cannot show (the tri-color divider's section, audited 2026-08-10; the green rule divider joined it after the 2026-08-18 sweep); the value stays as a client fallback. A background merely covered by an image stays editable, because Outlook desktop does not load background images and the color is what shows there |
| `data-desktop-only-<token>` / `data-mobile-only-<token>` | the element that owns the control | Prefixes the control's label with the viewport (the screen width the email is viewed at) where it actually works ("Desktop Block Padding Left/Right"); the merge-tag name never changes | The channel for truths no static rule can reach: a centered pill whose width only matters at desktop, or trailing spacing a taller sibling absorbs until the columns stack. Tokens reuse the property vocabulary (align, direction, width, the four paddings, spacing-above/below, the insets); width, direction and padding flags ride the frame, while spacing, inset and align flags ride the content component. Structural inertness only: the layout has to pin the control, not the placeholder copy, because the first long headline an editor types brings a copy-pinned control alive (narrowed 2026-08-21; two flags came out under the new rule). Labels only, names never |

### Retired, and why

- **`data-style-*`** (the property-exposure family): valueless flags
  declaring which of an element's properties should become editable fields.
  The converter never read them; it scans the MJML itself. The
  strip-and-regenerate audit proved removal changed zero generated fields,
  so all 8,376 instances came out of the TPL sources on 2026-08-18.
  `data-style-dark-mode` is the one survivor, because the build (not the
  converter) consumes it. The contract still defines the vocabulary for
  templates that want declared intent.
- **`data-style-alt`**: superseded the same day by universal alt text.
  Every image whose `alt` attribute is present mints an editable field,
  `alt=""` included, so a per-image opt-in claimed nothing the behavior did
  not already deliver. Removed across 262 instances.
- **`data-heading-level-toggle`**: minted an H1-H4 "Heading Level" Select
  (2026-08-19), superseded 2026-08-20 with zero live uses. EN's rich-text
  editor already offers H1-H4, so the heading rides inside the Content
  value and the editor changes the level in place; two fields collapsed
  into one. The generator support is retained, unused, for templates that
  still want the level as a separate control.

## What we learned about how to work

This is the part that generalizes beyond email.

**Documents as contracts, checked by a machine.** Two documents are treated as
published contracts rather than internal notes, re-read against the full diff
before every commit, and mirrored into a public repo (byte-identical beneath a
two-line banner) so agents working elsewhere can fetch them. A linter checks
them for drift: dead file citations, a documented default that no longer
matches the code, stale "pending" language, and whether each mirror still
matches its source. Its docblock says it plainly: *each assertion below
encodes a defect this repo actually shipped.*

**Probes as instruments, with a lifecycle.** A probe is a small email built to
test one set of claims against a real send. The rule: a probe whose every
claim is measured and recorded is archived **in the same session that records
its last verdict**; a probe still carrying any unverified claim stays put.
Archive, never delete. An annotated probe is the reusable instrument for
re-measuring EN when its behavior is suspected to have changed. Twenty-six
are on the shelf. One lived a single morning — built, sent, and archived on
2026-08-21 after refuting both halves of the theory it was built to test —
and three more flew in the days after it, one of which killed a proposed
feature outright by proving that the mechanism it needed cannot survive
Outlook.

Two habits made the probes trustworthy. **Paired never-opened twins**: send
the same block twice, edit one, leave the other alone, so any difference can
only have been introduced by the thing you are testing. And **generate the
probe's import file through the app's own exporter**. Hand-writing that JSON
is how an earlier probe imported silently and produced nothing.

**Empirical oracles instead of reasoning.** Where a claim could be measured,
we built something to measure it rather than argue about it:

- the **Inert Dropdown Audit** renders every block × dropdown × option at two
  viewports and compares pixel fingerprints (hashes) of the results; a control
  is inert only if every option renders byte-for-byte identical to the
  baseline. The engine now also tests
  three copy lengths per cell, because the go-live sweep proved short
  placeholder copy makes live controls look dead
- the **dead-flag check** strips a markup annotation, regenerates with
  identical inputs, and byte-compares. If removing it changes nothing, the
  source should not have it
- the **dark-mode image audit** classifies each asset's ink from its actual
  pixels
- the **`data-*` audit** cross-references every annotation against both repos'
  code *and* an empirical strip-and-regenerate test
- the **padding oracle** (`window.__auditPadding()`) proves every generated
  spacing field changes the rendered layout: 434 of 434 fields live, zero
  inert, zero overflow (2026-08-25; it read 338 of 338 on 2026-08-21, before
  the content baseline moved and every block gained a trailing gap), with a
  fourth verdict, *overflow*, for an option that would break the layout
  rather than merely change nothing

One rule about the fixtures those engines run on had to be learned the
expensive way. A test built from a real compiled block is the strongest
fixture available — it is the only kind that reproduces the bugs synthetic
fixtures cannot reach — and it is **only real until that block changes
shape**. A row was ungrouped for mobile stacking, and the fixture captured
from its grouped shape went on passing, asserting that a fold worked on a
structure the catalog no longer had. A stale fixture is worse than no test:
it does not merely fail to catch the regression, it stands in front of it. So
a fixture captured from a block is regenerated in the same session that block
changes.

The determinism rules around these matter more than the engines. Caching keys
on the exact input and never on a digest, because a weaker key could collide.
A baseline re-verify bypasses every cache, because a cached witness is not a
witness. The audit self-tests at startup and **refuses to run** if raster
determinism fails; a lying matrix is worse than no matrix. Parallelism is a
timing knob and never a verdict knob.

**Findings err in both directions.** Six controls the sweep called inert were
live in a browser; a row reporting a control as live was wrong the other way.
The rule became: confirm every claim, whichever way it points, *then* declare.
And a finding can be a real defect wearing an inert control's clothes. A
matched pair of "dead" controls turned out to be a leftover oversized column
overflowing its section.

**The moment a rule recurs, it becomes a lint.** The same stale annotation was
removed, came back through a file rename and a later fix, and was found again
before the rule moved out of prose and into a build check. The documentation
states the lesson: *the rule now lives where prose cannot lose it.* The
linters' own docblocks make the policy explicit (each assertion encodes a
defect or pattern that actually shipped), so nobody deletes a check without
seeing what it cost.

The failure has a mirror image, found on 2026-08-21: a check can outlive its
subject. One assertion's body died when the second catalog was deleted while
two documents went on listing it as enforced, and the naming-grammar lint
had never reached the text it existed to check, because that text writes
every block name in backticks and the lint never harvested them. **A check
nobody runs still reads as coverage, which is worse than not having it.**
One was retired in place, the other repaired, and the repaired one caught
its first real drift within the hour.

There is a third shape of the same failure, found on 2026-08-25: a check that
reports rather than stops. When a block's alternate layout could no longer be
folded into its dropdown, the converter noticed and emitted an *informational
note* — and that block shipped its copy twice into EN for three days, because
an info note is a line in a panel nobody reads. **An importer note is not a
guard.** A condition that makes a block ship broken has to fail a build
somewhere, and the fix moved it there.

**If a document must match the code, generate it from the code.** The
client manual is the one document a TPL content editor actually reads, and
nothing checked it: by 2026-08-21 it claimed 64 blocks in 11 folders
against a real 51 in 9, kept sections for 23 blocks that no longer existed,
and still walked the editor through configuring a block that renders
broken. Its block reference, most of the document by volume, is now
generated from the app's real import pipeline, with the hand-written field
descriptions harvested so the editor's vocabulary survives, a hard stop
when a description is missing (a blank cell is how a document starts lying
quietly), and a lint that compares its claims against the catalog's own
markers.

The sequel is worth recording, because it shows exactly how far a generator
reaches. The generated reference has stayed true through four days of catalog
churn and says 56 blocks today. Two sentences of hand-written prose wrapped
around it still say 53. The generator fixed the part it owns and drew a line
the linter has not yet been taught to cross, which is the same lesson one
layer out: **the boundary of a generated document is where the drift moves
to.**

**Land a new check after the cleanup, not before.** The rich-text validator
was deliberately built last, after the catalog was migrated. Landing it first
would have put 45 warnings in the export panel on day one, which is how a
check gets ignored rather than acted on. Severity was chosen by whether a
workaround exists, not by how alarming the construct looks.

**Versioning anchored to content, with git as the ledger.** Every block,
partial, template and the app itself carry an integer version derived from a
content hash (a fingerprint computed from the content itself), where the
baseline is the manifest *as last committed*.
Rebuilding never double-bumps and local iteration cannot inflate a number.
Versions track what was edited, not what was affected downstream: a stylesheet
change that alters how every block renders bumps only the template. The ledger
now holds 76 entities, down from 152 when the catalog consolidated; the
master template (shell plus stylesheet) is at version 61, the compiled
Template Styles block at 50, and the busiest single blocks — the Steps Block
and the Quiz Block (2x2 photos) — at 25 and 24. Since 2026-08-24 a bumped
entity also carries the date it was published, which is what the version
bands print. The churn concentrated in the shared layer, which is
exactly where you want iteration to concentrate. Renames carry a stated
cost in this scheme: a renamed block is a new block in EN, whose name
carries the version, so it restarts at version 1 and its thumbnail needs
re-uploading. The 2026-08-21 rename wave restarted thirteen in a single
commit, with more before and after it.

**Git discipline written down after it bit us.** Parallel sessions land
commits in both repos many times a day, so: fetch and fast-forward both
before starting (pull the latest so your copy matches the shared one), never
run a `git checkout` variant inside a scripted command, and verify after
every push that the shared repo's latest commit equals your local one. Each of those clauses
exists because of a specific incident (see Appendix A).

**Governance, once there were too many hands.** By 2026-08-22 the work was
running in parallel — several sessions a day, landing in both repos — and the
informal model started to cost. Two branches minted the same version number on
one afternoon, each of them correctly, from a shared baseline. So on
2026-08-24 the converter took on a spec layer: a written spec for every
subsystem, reverse-engineered from the code it already had, an independent
reviewer protocol, and the repository's first continuous integration. Four
things it enforces are worth naming, because each one encodes a specific way
this project had gone wrong:

- A change to a governed source file must move its owning spec, or say in the
  commit why not. That gate fired correctly within a day, on a change that had
  altered what a control *means* without touching the document that defines it.
- A change to source must move a test, or say why not.
- Every machine-checked contract re-runs on each push, not only on review.
- **Existing contracts are absorbed by reference and never paraphrased.** The
  specs point at the conventions document rather than restating it, because a
  paraphrase is a second source of truth and no linter polices the copy.

Two lanes, not one: anything that changes behavior goes through a branch, a
review and an explicit merge; chores like re-mirroring a document go direct.
The standing instruction is that when in doubt it is not a chore. And the
version script stopped being a victim of the parallelism and became its
referee: it now derives its baseline from every reachable parent, so two
branches that both bumped honestly can be reconciled by the tool rather than
by hand.

**A local pass proves nothing about a clean install.** Every instrument in
the converter ran fine locally and crashed on a fresh checkout, because a
package absent from the lockfile happened to be sitting in a parent
directory's modules, and a worktree resolves upward. It took the brand-new CI
to see it — and the first fix was the wrong theory, verified against the same
contaminated local resolution that had hidden the problem. An
install-dependent fix has to be verified in an isolated clone.

**Conventions written for AI agents, not only for people.** The authoring
guide's §9 is a copy-paste prompt that points an agent in any MJML repo at
both raw mirror URLs. That is why the mirror ritual is a hard gate: a
half-pushed mirror silently gives every downstream agent a stale contract.

## Where it stands today

Shipped and in use since 2026-08-18: the block catalog, the converter, the two
contracts, four audit engines, three linters, content-hash versioning, a
client-facing manual (1,858 lines, its block reference generated from the
import pipeline since 2026-08-21) covering the template, every block and its
fields, and how the system is maintained — and, since 2026-08-24, a spec layer
with four continuous-integration gates standing over it.

Closed since the last snapshot:

- This repo's `README`, called out last time as the one stale document in an
  otherwise careful set: rewritten 2026-08-24, with its block list generated
  from the catalog rather than hand-kept.
- The full-catalog control sweep re-run on 2026-08-25 found four failures out
  of 1,003 controls; three were template defects fixed the same day and the
  fourth was a mislabel, closed by teaching the alignment guard to recognize
  when its own arithmetic is unsound.
- Four blocks had drifted into putting horizontal padding inside an Outlook
  `v:rect`, which Word ignores, and had been rendering flush there. Rails
  restored; the cost, eight editor fields, was controls Outlook was discarding
  anyway.
- Three real payload defects from the 2026-08-24 render round: a stray letter
  baked into an icon's pixels, an auto-linked email address rendering blue on
  a brown footer, and a stale class repainting a black slab behind a heading
  in every dark client.
- The contracts had claimed in four places that an unpaired alternate layout
  "fails loudly". It did not — it shipped the block's content twice and
  silently rebound the merge tags of every email already built on it. The
  claim is gone and a real build guard is in its place.

Open threads, recorded rather than resolved:

- The delivered-CSS budget is tight by design: the master sits 120 bytes under
  its 14,141-byte working target, 2,363 under the Gmail cliff, and the shared
  stylesheet 946 under its own share. Two caveats ride with it — everything
  between the largest size measured green (13,325) and the cliff is modelled
  rather than observed, and a stylesheet can be lost for reasons a byte budget
  cannot see at all.
- Colons and commas inside quoted CSS strings are **unmeasured** against EN's
  reserializer. Semicolons and braces are now escaped and proven; EN rewrites
  colons and commas elsewhere, nothing we ship puts one inside a string, and
  no probe has settled whether it would survive.
- Which EN sending surface the 299,760-byte message ceiling belongs to is not
  in the record. It was bisected through one endpoint, prompted by a Marketing
  Automations email that would not save, and never re-run against the other
  surfaces.
- The EN account is further behind this repo than it was at the last snapshot,
  not closer. Beyond the re-import and the thumbnail re-uploads already
  recorded, EN's asset CDN still serves the old copy of the arrow icon with
  the stray letter in its pixels: the source is fixed, the served file is not,
  and it has to be replaced before go-live.
- `CTA Hero (w/ Large Background Image)` is still in the holding pen with its
  Outlook fallback unverified: the photo spans two sections, so its fallback
  color lives in a stylesheet class that every CSS client honors and Word has
  not been proven to. A send settles it, and its fate decides whether the two
  remaining photo heroes consolidate into one (that proposal is on file with a
  written precondition).
- The EN bug report on `>`-escaping is written, with an importable proof of
  concept, and not yet submitted.
- The four footer social icons render through a different component and missed
  the contrast-outline pass; Outlook desktop dark inverts the black footer and
  they can vanish into it.
- Detection of dark-mode-fragile assets shipped; automatic generation of the
  outlined variant is designed (the rim recipe is proven) but not built.
- One delivered email lost styling that its stored version still had. Every
  candidate explanation, including the build-time snapshot theory that was
  the last one standing, has since been measured dead; it stays closed as
  **unexplained, not as solved**, with the diagnostic shortcut on file in
  case it recurs.
- A palette contrast issue in the Steps Block family falls below the AA
  accessibility threshold of the Web Content Accessibility Guidelines (WCAG):
  white on green at 2.66:1 against a 4.5:1 floor. My call: it is
  held as a client-facing accessibility recommendation rather than a silent
  change, with the exact remedy documented, because the remedy changes brand
  colors and that decision belongs to TPL.
- The client manual now disagrees with itself, and the shape of the
  disagreement is instructive: its generated block reference says 56 blocks,
  while two sentences of hand-written prose around it still say 53. The
  generator fixed the part it owns and drew a line the linter does not yet
  cross. Same lesson as entry 27, one layer out.
- The version script learned to reconcile parallel bumps in the converter;
  this repo's own has not, and its merges are still resolved by regenerating.
- The final QC report's last section is unwritten, and its EN block-import
  spot check is still pending.

---

# Appendix A: What went wrong

Technical, and deliberately unflattering. Each entry follows the same shape:
what we saw, what we believed, what was actually true, and what now stops it
happening again. These are the entries that taught the most.

## Wrong root causes

### 1. The dark-mode failure that had four wrong explanations

**Symptom.** Eight Email on Acid rounds (2026-08-11, 120 renders read) showed
iOS Mail rendering entire content blocks as white text on white panels.

**What we believed, in order.** *Gmail strips body `<style>`*: disproven by
probe. *The dark-mode failures are authoring bugs*: wrong as stated; the
authored pairs were correct. *EN escapes `>` at send time*: wrong; only on an
editor edit. *Outlook 365 for Mac is broken as a client*: wrong; clean HTML
renders there perfectly.

**What was actually true.** EN's block editor escaped `>` in CSS held in an
HTML-type Replacement, killing the background half of every paired dark-mode
rule while the text half survived.

**Fix.** Zero child combinators in the shipped stylesheet, with measured
attribute-selector stand-ins.

**Guard.** `validateEditorSafeCss` warns at import on any child combinator in
a block's shipped CSS; the template repo's linter bans them at build time.

**The transferable part.** Four confident diagnoses in a row, each plausible,
each wrong, and each cheap to hold because none had been tested against a real
send. The written "corrections to carry forward" list exists so the next
session does not re-derive them.

### 2. "Gmail shrinks our columns"

**Symptom.** Two-column story cards looked stacked and undersized in the Gmail
Android app.

**What we believed.** A column-layout bug requiring the two-column technique
to be restructured.

**What was actually true.** Gutters. At Gmail Android's ~333 CSS pixel layout
width, section and column padding consumes 80px, a quarter of the card. Four
probe rounds were needed to disprove the restructuring theory; the gutter
model predicted the measured width to within 1.7px, the competing model to
within 17.7px.

**Fix.** A two-rule flush-mobile treatment. Desktop output byte-identical.

**The transferable part.** The expensive fix was the wrong one, and only
measurement separated them. *Diagnose gutters before restructuring columns* is
now in the guide.

### 3. The QA tool that reported the same catastrophe for every test

**Symptom.** Email on Acid's "view source" page showed roughly 71 bytes of CSS
and no dark-mode rules, for a test that had shipped a full stylesheet
(2026-08-12).

**What we believed.** Total stylesheet loss in transit: a catastrophic,
send-blocking finding.

**What was actually true.** That URL returns Email on Acid's own application
shell, not the email. Every test reports the identical bytes; the tell was that a
known-good test had "lost" exactly the same stylesheet.

**Guard.** The delivered-HTML URL is documented as the only diagnostic source,
and a checklist rule now says a payload without EN's inliner fingerprints
proves nothing, because such a payload means the test bypassed EN entirely.

### 4. A retraction: a finding that was an artifact of our own build

**Symptom.** Background-image heroes appeared to mint no editable URL field
(zero of thirteen), which read as a field-generation bug in the converter.

**What was actually true.** The evidence had been read from the `_live.html`
build variant, whose asset addresses are already rewritten to absolute CDN
(content delivery network) paths, so the generator's needle matched nothing.
Against the correct fixture, the relative-path `_local-debug.html`, the
count was 8 of 8. The finding was
retracted in its own commit rather than quietly edited away.

**The transferable part.** The build has two variants for good reasons, and
either can be mistaken for evidence. Retraction commits are cheap; a wrong
finding sitting in a contract is not.

### 5. A concurrency speedup that was a throttled browser tab

**Symptom.** Running the pixel audit with eight parallel iframes (embedded
browser frames) measured 6.37× faster than one. The default was changed to
eight.

**What was actually true.** The measurement had been taken in a **background
tab**, which the browser throttles. Re-measured on a real foreground tab:
1-wide 20.73s, 2-wide 19.21s, 4-wide 20.62s, 8-wide 21.31s. Eight is *slower*
than one. All four passes returned the same verdict digest.

**Fix.** Default reverted to one, in a commit titled *"Default back to 1: on a
real tab, concurrency buys nothing."*

### 6. Audit findings that were wrong in both directions

**Symptom.** Six controls the sweep reported as inert at the phone viewport
were demonstrably live in a browser, and cleared on a re-run hours later.
Separately, a row reporting a flagged control as live was wrong the other way.

**Fix.** The report rule was corrected to say findings err in both directions:
confirm every claim, whichever way it points, then declare.

**The transferable part.** An oracle you trust asymmetrically is an oracle you
have stopped testing.

## Bugs that were invisible by construction

### 7. A prose comment killed every import

**Symptom.** Every TPL import failed with MJML's misleading *"Malformed
MJML"*.

**What was actually true.** A comment in `styles.css` contained the literal
token `<style>`, inside the sentence "Gmail app drops `<style>`". The importer
inlines that stylesheet into an `<mj-style>` before parsing, and MJML's
HTML-mode tokenizer treats the opener as the start of a raw-text element. The
rest of the document, `mj-body` included, was swallowed as text.

**Why it reached production.** The command-line build never sees that path.

**Guard.** A build assertion bans any tag-like sequence anywhere in CSS,
comments included.

### 8. The same trap, one level up

**Symptom.** Light/dark image pairs rendered *both* halves; a block preview
carried zero CSS rules where dozens should have been.

**What was actually true.** A comment documenting EN's container rule spelled
the container merge tag out literally. The importer splits the template shell
on the first occurrence of that tag, so the split landed inside the comment.
The head was truncated mid-comment, the comment lost its terminator, and it
swallowed the entire stylesheet.

**Guard.** A dedicated importer guard on the container placeholder. Two
outages from the same class of bug, documentation text being read as markup,
in three days.

### 9. The debug toolbar ate the version band

**Symptom.** A version stamp that should appear inside Marketing Tools was
missing, and only from the documented import path. The `_live` build variant
always looked correct.

**What was actually true.** The splitter has no special knowledge of which
block is which. The debug toolbar partial carries its own marker pair, so it
segmented as a block of its own, and the version band sat 714 bytes inside
that toolbar segment. Toolbar blocks never export, so the band was carried
off with the toolbar: 0 of the 77 exported blocks had a copy.

**Guard.** The span approach was abandoned the same day. The band now hangs
off EN's own container through a stylesheet rule, so nothing rides in the body
at all, and the "band span leads the body" build tripwire remains as a
zero-instance guard for the next body-authored band.

**The transferable part.** The failure was quiet and asymmetric. The artifacts
that were easiest to check were the ones that looked fine, and the path that
actually mattered was the broken one.

### 10. A markup flag that was silently ignored for a week

**Symptom.** A `data-no-display-toggle` annotation had no effect.

**What was actually true.** The flags are valueless, and the attribute reader
returns undefined for a bare flag, so detection had to use a presence check
rather than a value read. Until it did (2026-07-31), the flag was ignored
entirely.

**Guard.** The reading rule is spelled out in the contract, and the dead-flag
audit now proves per annotation that the converter actually honors it.

### 11. Labels that lied about the viewport

**Symptom.** Generated field labels made claims about desktop-versus-mobile
behavior that were not true.

**What was actually true.** Two separate parsing bugs in how the template's
own mobile rules were read. A rule sitting immediately after a CSS comment
failed to register as a mobile pin at all (caught 2026-08-18, now pinned by a
regression test). And a self-form rule, one that styles the element carrying
the class, was read as if it scoped the boxes inside it, stamping a false
"Desktop Padding Right" onto the Video Blocks: `.caption` indents the caption
section's own div and cannot pin an inner padding control. The self-form and
scope-form reading rules are not interchangeable.

**The transferable part.** Some bugs are only findable once the reporting is
good enough to make them stand out. Both surfaced once a failures-only report
put every label claim in one place.

### 12. A fix that was correct everywhere except where it mattered

**Symptom.** Hand-rolled button pills rendered as thin bars with invisible
label text in Outlook's Word engine (2026-08-11).

**What was actually true.** A `line-height: 0` declaration. Correct in every
browser, byte-identical across desktop and mobile output, and honored
literally by Word. Reported and reverted the same day.

**Guard.** Line-height is banned on the button-group classes, and any future
attempt at that spacing must be invisible to Word and proven in Outlook before
it ships.

## Process failures

### 13. A push that reported success and did not happen

**Symptom.** A commit that had been "pushed" returned a 404 on GitHub.

**What was actually true.** A stray `git checkout HEAD~0` inside a scripted
command detached `HEAD` (git lost track of which branch was active). The next
commit landed off-branch, and `git push origin main` exited 0 (the success
code) while doing nothing: it pushed the stale local copy of `main`.

**Guard, now written into both repos' working instructions.** Never run a
`git checkout` variant inside a compound or scripted command; confirm the
branch before committing; and after every push, verify the shared repo's
latest commit equals your local one. **A push that prints nothing and exits 0
is not proof.**

### 14. Two rounds, one build

**Symptom.** A before-and-after pair of Email on Acid rounds appeared to
verify a fix (2026-08-11).

**What was actually true.** The two rounds were the same build sent 34 minutes
apart. The "fix" was in neither.

**Guard.** Never read an A-to-B diff as fix verification without a source
commit between the sends. Recorded in the QA handoff's corrections list.

### 15. A type check that checked nothing

**Symptom.** A real type error reached `main` (caught 2026-08-19).

**What was actually true.** The root TypeScript config is a references-only
shell with an empty file list, so `tsc --noEmit` type-checked *zero* files
while appearing to pass. The correct invocation builds the referenced
projects.

**Guard.** The canonical check command is documented, with the reason attached
so nobody "simplifies" it back.

### 16. The finding that kept coming back

**Symptom.** A dead-annotation audit found five stale flags on 2026-08-10 and
removed them. The removal did not survive a catalog file rename; on 08-17 a
fix re-added one of the flags after reading its absence as a gap, against the
prose explaining the removal, and the audit later that day re-found all five.

**What was actually true.** The underlying rule (the second half of a merged
light/dark image pair never gets its own toggle) existed only as prose, so the
cleanup had to be re-derived and the authoring passes kept re-breaking it.

**Fix.** The rule became a build-time lint. *The rule now lives where prose
cannot lose it.*

### 17. A near-duplicate catalog that charged rent

**Symptom.** Two catalog files, one a strict subset of the other: 135 of 143
blocks, differing by exactly one line.

**What was actually true.** It required a matching edit on 14 of the 15
catalog commits in its final 90 days. *That sync tax was its whole cost and
its whole risk.* Deleted 2026-08-17, with the instruction that any future
short demonstration page gets derived at build time from the full catalog.

### 18. Shipping ahead of the evidence

**Symptom.** A `preview_text` field was designed, built, and shipped, then
reverted the same day (2026-08-10) when a send test showed EN injects its own
preheader.

**The transferable part.** The reversal was fast and cheap because a send test
was already routine by then. Earlier in the project the same mistake would
have lived for weeks. Several other reversals share the shape: a stylesheet
`inherit` rule tried and reverted once the inliner settled the question, and a
naming change appended and then prepended 26 minutes later.

## The consolidation push (2026-08-20 → 08-21)

Nine entries from the push this snapshot closes on (2026-08-20 → 08-21),
added when the document moved its snapshot forward. The numbering continues
so earlier citations stay valid, which is also why these sit in their own
section rather than being filed into the three above.

### 19. The theory that was wrong in both halves

**Symptom.** A geometry audit concluded that widening a gutter overflows
Outlook wherever MJML froze a stale pixel width into the Outlook-only ghost
table it wraps around a column. A fix shipped: rewrite the ghost to
`width:100%` wherever it stands for a lone full-width column.

**What we believed.** The stale ghost overflows, and the rewrite is safe.

**What was actually true.** A probe built and sent the same morning refuted
both halves, with two Outlooks agreeing to the pixel. Word **clamps** a stale
ghost to the cell it sits in (a 536px ghost in a 64px-padded cell rendered
472px), so the defect did not exist. And `width:100%` on a nested ghost makes
Word **shrink-wrap it to its text** (the same band rendered 244px), so the
fix was the regression.

**Fix.** Reverted the same day, seven hours after it shipped. The measurement
replaced the theory in the conventions document.

**Guard.** Both geometry scanners now clamp ghost widths the way Word does.
Without that, they would report an overflow Outlook never has and strip
padding options from 57 frames for nothing.

**The transferable part.** Seven hours from shipped code to refuted premise,
because building a probe was routine by now. Compare entry 18: the same
mistake, and the same cheap recovery, at opposite ends of the project.

### 20. A fifteen-minute-old transform corrupted every preview

**Symptom.** The tail of the builder-band stylesheet dumped into the body as
visible text at the top of every template preview.

**What we believed.** Stripping CSS comments out of one stylesheet was a
local, narrow change.

**What was actually true.** The code measured its cut points against a
shortened copy of the head while slicing the original document, so the head's
last N characters survived twice, N being the removed comment's length. The
duplicate carried a second `</style>` and `</head>`, and the stray closer
ended the band sheet early.

**Fix.** Fifteen minutes later: measure against the text exactly as matched,
and keep the transformed copy in its own variable.

**Guard.** The regression test asserts document *structure* (one `</head>`,
balanced `<style>` tags, one copy of the rule) rather than substring
presence, which is what let the first version through.

### 21. The hero with two photos, and the holding pen

**Symptom.** One hero block rendered two copies of its background photo with
a visible seam between them. Every other photo block in the catalog carries
its image on exactly one section; this was the only exception, and it was
self-inflicted, introduced while fixing an earlier rejected version.

**What was actually true.** The block's photo spans two sections, so a single
continuous image has to sit on the wrapper, and the wrapper is the one tag
that cannot also carry the fallback color (the measured 2026-08-13 finding:
MJML copies that color onto the Outlook fill and Word paints the slab instead
of the photo). Moving the fallback to a stylesheet class fixed the seam and
opened a new question: a class-based color is not the attribute Word reads
most reliably, so the fallback is correct in every CSS client and unproven in
Outlook with images blocked.

**Fix and guard.** Rather than ship the unknown or delete the block, it moved
into a new holding pen, `broken-blocks.mjml` (my call). The pen carries the
master's head verbatim so a block behaves there exactly as it did at home,
every build lint keeps running over the patient, and the block stops
exporting until a send settles the question.

**The transferable part.** The holding pen turns "ship it or delete it" into
a third option that keeps the evidence.

### 22. The harness that measured the wrong builder

**Symptom.** In a local harness assembled from EN's own builder markup, every
block label stacked at the same spot, three labels overprinting one line.

**What we believed.** The builder gives the labels no positioned ancestor, so
a positioning rule of ours must ship to fix it.

**What was actually true.** The live builder renders the labels correctly
with no such rule. The harness could not load EN's own stylesheet, so it was
missing whatever establishes the positioning context in the real page.

**Fix.** The rule was dropped 47 minutes after it shipped, with the working
rule written down: **live behavior is authoritative.** A harness that cannot
load the platform's own CSS can suggest, never settle. Same family as
entries 3 and 5: the instrument, not the subject, produced the finding.

### 23. Pruned on a premise that was not yet true

**Symptom.** Two alignment demo blocks were deleted as redundant, on the
premise that alignment was already a dropdown.

**What was actually true.** It was not. That row's alignment lives in
hand-authored markup the app never read, which is exactly why the demo
variants existed in the first place.

**Fix.** Restored 25 minutes later, once the app had grown an Alignment
dropdown bound to both of the row's carriers, the CSS one and the Outlook
one. With the premise now actually true, the demos were re-pruned
deliberately the next day.

**The transferable part.** Prune to a control that exists, not to one that
ought to.

### 24. The labels that were exactly inverted

**Symptom.** Story Card (image on the side) offered an Image Position field.
Picking "Left" rendered the image on the right. It shipped that way.

**What we believed.** The first authored column renders on the left.

**What was actually true.** That row lays its columns out right-to-left
(`direction:rtl`), so the first authored column renders on the *right*.

**Guard.** Option labels now derive from where the image actually lands
(authored-first, flipped by right-to-left). And the build's geometry guard
turned out to share the exact blind spot: it only matched left-to-right rows,
so both reversed Story Cards, sitting at zero pixels of headroom, were
structurally invisible to it. It reads both directions now.

**The transferable part.** Two independent tools inherited the same wrong
assumption. A belief travels further than the code it was written in.

### 25. Tests that proved nothing

**Symptom.** Twice inside the same push. A literal `>` shipped to EN inside
one dropdown option, and the unit test written for the fix passed with and
without it. Separately, a regression test for a field-generation bug passed
against the unfixed code.

**What was actually true.** The synthetic fixtures never exercised the
failing path. The leak came from two overlapping text edits whose containment
was checked in only one direction, and no fixture ever fired the
length-changing edit that shifts the later offset; the field bug needed the
real block's whole-document regions, where the tie breaks on scan order, and
a convenient tight-region fixture cannot reproduce it at all.

**Fix and guard.** The leak's fix keeps edit regions strictly disjoint, and
the test that proved nothing was deleted rather than banked: the conventions
document records the coverage gap outright. The other test was rebuilt from
the real block's shape, the only fixture that reproduces the bug at all.

**The transferable part.** A green test only counts if it was red on the
broken code.

### 26. Two checks that read as coverage

**Symptom.** The documentation lint ran green for weeks while the documents
drifted.

**What was actually true.** One assertion's body had died when the second
catalog was deleted (nothing left to compare), while two documents went on
listing it as enforced. And the naming-grammar assertion had never reached
the text it existed to check: that text writes every block name in backticks,
and the harvester did not read backticks. Even its two suppression entries
were dead, entries that made the guard look like it was working.

**Fix.** The dead check was retired in place so the numbering keeps
resolving; the blind one learned to read backticks, plus an empty-catalog
tripwire so the assertion can never again degrade to vacuously true
unnoticed.

**The transferable part.** A check nobody runs still reads as coverage, which
is worse than not having it. The repaired lint caught its first real stale
citation within the hour.

### 27. The document nobody checked

**Symptom.** The client manual, the one document a TPL content editor
actually reads, claimed 64 blocks in 11 folders. The catalog had 51 in 9.

**What we believed.** Hand-maintenance was keeping up.

**What was actually true.** Nothing checked it. It kept 23 sections for
blocks that no longer existed, omitted 10 that ship, listed two folders
removed on 2026-08-03, and walked the editor through configuring the one
block known to render broken.

**Fix.** A generator now emits the whole block reference from the app's real
import pipeline. Hand-written field descriptions are harvested so the
editor's vocabulary survives, and a label with no description aborts the run,
because a blank cell is how a document starts lying quietly.

**Guard.** The doc linter asserts three things against the catalog's own
markers (a documented block that does not exist, a shipping block with no
section, and the claimed count), self-tested by breaching all three.

**The transferable part.** The generator's first run also caught a blind
rename substitution sitting in the hand-edited part of the doc. Nothing
hand-maintained stays true on its own; see entry 16 for the same lesson
wearing different clothes.

## The parallel-sessions push (2026-08-22 → 08-25)

Twelve entries from the push this snapshot closes on, added when the document
moved its snapshot forward. The numbering continues so earlier citations stay
valid, which is again why these sit in their own section.

### 28. The semicolon that dropped a whole stylesheet

**Symptom.** A render round reported buttons touching each other on Android:
a row of pills that should have stacked with a gap between them rendered with
none.

**What we believed.** A spacing bug in the button block, or the head CSS
finally running past its budget — the two explanations a month of Gmail work
had trained us to reach for.

**What was actually true.** Neither. A debug label read `"… shows block
versions; remove before send"`. EN's send-time CSS reserializer scans for the
next `;` to end a declaration and does not know it is inside a quoted string,
so it split there, discarded the remainder, and shipped a string whose quote
never closes. iOS Mail recovered at the newline and lost one declaration.
**Gmail's sanitizer discarded the entire merged head stylesheet**, every media
query with it, including the rule that stacks those pills. The delivered head
was about 12.4K — comfortably under the working target and 4K under the cliff.

**Fix.** The label lost its semicolon, and the escaper that emits every band
label now hex-escapes `;`, `{` and `}`, so no future label can re-trigger it.

**Guard.** A new invariant in both contracts — no literal `;`, `{` or `}` may
reach EN inside a CSS string — and a QA step that greps the delivered head for
a `content: "` line whose quote never closes.

**The transferable part.** Two things. The mental model could not see this
failure: "Gmail dropped the stylesheet" had meant "too many bytes" for a
month, and no byte budget can catch a syntax error. And the obvious suspect
was innocent — the block-band rules shipping alongside use `:has()`, exactly
the kind of selector a sanitizer might reject. What cleared them was a control
send from four days earlier carrying the same `:has()` rules with balanced
quotes and no complaint. **When two suspects both fit, look for the send where
the plausible one was present and nothing broke.**

### 29. The fixture that stood in front of the regression

**Symptom.** A block rendering its copy twice in EN. Reported by Bryan, not by
any check.

**What we believed.** The layout-folding code worked. Its tests were green,
and they ran against a fixture captured from the real compiled block rather
than a synthetic one — the strongest kind of fixture we have.

**What was actually true.** The block had been ungrouped three days earlier so
its columns would stack on phones. The fold's precondition then quietly
declined to fold that block's alternate layout, emitted an *informational
note*, and let the alternate section ship raw — which EN rendered as a second
copy of the copy. The fixture had been captured from the grouped shape, so
every test went on asserting that folding worked on a structure the catalog no
longer had.

**Fix and guard.** The fold now swaps the whole section, the fixture was
regenerated, and two rules were written down: regenerate a captured fixture in
the same session its block changes shape, and **an importer info note is not a
guard** — a condition that makes a block ship broken has to fail a build.

**The transferable part.** A stale fixture is worse than a missing test. It
does not merely fail to catch the regression; it stands in front of it, because
green now means "the shape you no longer ship still works."

### 30. Three commits to fix the wrong footer

**Symptom.** Space under the footer in EN that an editor could not remove.

**What we believed.** The footer's bottom padding. The first fix zeroed it on
the brown footer; the second applied the same change to the snow footer for
parity.

**What was actually true.** Both were wrong, and the second one propagated the
wrong theory to a second block. A 16px reading gap had been authored *between*
the two footers' comment pairs. Segmentation tiles the document byte-exactly,
so anything sitting between two pairs attaches to the **preceding** block: the
gap shipped as a white strip under the brown footer's ground, and the
exclusion flag on it import-excluded the entire footer. For three days the
brown footer had not been exporting at all, and nobody noticed, because the
visible symptom was a strip of white.

**Fix.** Both aprons restored, and the gap given its own block with its own
comment pair.

**Guard.** A contract rule that an excluded wrapper must live inside its own
START/END pair, explanatory comments included.

**The transferable part.** Two rounds of treating the symptom made the system
worse while the real defect was silently deleting a block from every export.
The tell was available the whole time: nobody checked whether the footer was
still in the export.

### 31. Two version labels that always agreed

**Symptom.** Across four consecutive commits the template version went 46 → 49
and the stylesheet version went 26 → 29. Every time.

**What we believed.** Two independent numbers.

**What was actually true.** Each hashed the other's content — the template's
hash concatenated the stylesheet, and the stylesheet's hash swept in the
compiled builder chrome. The two labels exist precisely so an editor can see
*which* of the two things changed, and they could not answer that question at
all.

**Fix.** Disjoint scopes, verified in both directions against scratch copies.

**The transferable part.** A signal that never disagrees with another signal
is not two signals. This one had been lying since both labels existed, and the
next edit to the chrome would have made it lie in the other direction.

### 32. The pinned twin mirrored twice

**Symptom.** Fragments of markup — `X body>` and `X tbody>` — sitting beside
the copy as ordinary text in the inbox.

**What we believed.** First that a specific reversal helper was at fault (it
was not), and then, after a verification pass, that the leak was invisible:
it sits inside a conditional that Outlook never parses, and a parse-tree walk
found no text node. Half right and the conclusion wrong — rendered in a
browser at 600px it reads out as text, and that conditional region is exactly
what every non-Outlook client reads.

**What was actually true.** A light/dark image pair folds to a single key, so
one pinned region reached the edit list from two different keys. Two identical
splices over one range are **not** idempotent: the second re-slices a fragment
the first had already grown, re-inserting the tail. Where the tail resumed
decided whether anyone could see it — mid-tag on two blocks, on whitespace for
the other five.

**And the reported scope was wrong.** "Exactly those two" was the scope of the
*symptom*, found by grepping for a rendering artifact. Counting tags found
five more: seven blocks, not two.

**Fix and guard.** Pinned regions dedupe by range, and an overlapping edit is
now **dropped** rather than applied. Dropping is the recoverable failure — it
orphans a tag, which two existing instruments already report — where applying
produces malformed HTML that reaches the inbox in silence. The test is built
from the real compiled row, and asserts an invariant (a reversal is a
permutation, so the tag multiset is unchanged) rather than a byte string.

**The transferable part.** When you must fail, fail into the mode something
already watches. And a scope discovered by grepping for a symptom is the scope
of the symptom.

### 33. A contract that promised the opposite of the truth

**Symptom.** Four source comments and both published documents stated that
drift between an alternate layout and its primary "fails loudly."

**What was actually true.** One changed letter unpairs them. The alternate
then renders as its own band, so the block ships its content twice, and every
band after it renumbers — silently rebinding the fields of any email already
built on that block. The importer's response is an informational note. Nothing
about that is loud.

**How it got worse.** The commit that added a fifth copy of the sentence
propagated the claim rather than noticing it was false.

**Fix and guard.** The claim is gone, and a build check compares every
alternate's text against its partner's, names the closest match when they
diverge, and separately rejects an alternate whose partner is itself an
alternate. Both breach-tested.

**The transferable part.** A claim repeated in five places is not five pieces
of evidence. It is one unverified sentence with four copies.

### 34. The dependency that made every clean install lie

**Symptom.** On a fresh checkout every command-line instrument died on a
missing module. Locally, everything was green.

**What we believed.** A bundler setting would keep the package inlined. That
fix shipped, and failed again in CI.

**What was actually true.** The runner takes that option from its own flags,
not from the config file, so the first fix was aimed at a layer that never
read it. And the reason any of it had ever worked was that a package absent
from the lockfile happened to be sitting in a parent directory's modules —
which a worktree resolves upward into. The same contamination that hid the
bug also made the wrong fix look verified.

**Fix.** A real local package under the name the module system actually looks
for, verified in an isolated clone, with the wrong fix reverted once it was
proven inert.

**Guard.** The continuous integration that caught this was two days old. It
paid for itself immediately, because it is the only environment in the project
that installs from the lockfile alone.

**The transferable part.** A local pass proves nothing about a clean install
when a parent directory can satisfy the resolution — and an environment that
hides a bug will also validate the wrong fix for it.

### 35. The panel that came back after it was deleted

**Symptom.** A black slab behind a hero heading, on every dark client that
supports the swap.

**What was actually true.** The heading still carried the class of a panel
removed four days earlier. Of everything that class once did, one declaration
survived: a dark-mode repaint to black. So the deleted panel existed in
exactly one rendering mode.

**The transferable part.** Deleting a component is not deleting its class, and
a class with one surviving declaration is a component that only exists under
one lighting condition. Invisible in light mode, invisible in source review,
findable only on a dark render.

### 36. A letter baked into an image

**Symptom.** A white lowercase "s" floating beside an arrow icon on four
clients, dark mode only.

**What we believed.** A stray character in the markup, or a font artifact.

**What was actually true.** It is in the pixels. The asset had been cropped
out of a design composite and carried a letter of the neighbouring text along
with it, dated early July. It had been invisible for seven weeks because the
catalog is light and white on white shows nothing.

**Fix.** Pixels erased in place, dimensions preserved. Still open: EN's asset
CDN serves the old file, so the fix is not delivered until it is re-uploaded.

**The transferable part.** The delivered payload greps clean. Some defects are
not in any text you can search, and dark mode is a second lighting condition
that exposes an entire class of them at once.

### 37. Every preview rendered the alternates too

**Symptom.** Rows appearing twice, stacked, in the built catalog pages.
Reported by Bryan.

**What was actually true.** The compiler drops the annotation that marks a
section as an alternate layout, so the build rendered every alternate as an
ordinary extra section — six of them, the complete census, in a feature that
had shipped days earlier.

**Fix.** Alternates are dropped in the annotation step, deliberately *before*
the raw source is embedded for the debug overlay, which has to keep both
layouts. A trade-off recorded rather than hidden: a pasted test send no longer
exercises alternate layouts in real clients.

**The transferable part.** An annotation only the importer reads is invisible
to every other consumer of the same file — including your own preview, which
is the one place you would have expected to notice.

### 38. A mobile fix that traded one defect for another

**Symptom.** A block still paying the desktop gutter on phones.

**Fix, and the regression.** Its fixed-width spacer rails were converted to
section padding so the mobile flush rule could reach them. That put horizontal
padding inside an Outlook `v:rect` — which the authoring guide already
recorded, as a measurement, that Word cannot honor, and whose stated remedy is
the exact rail pattern the conversion had just removed. Reverted the same day,
with the mobile inset re-done as a width pin instead.

The same push produced two more of its own: the new flush rule let a 24px icon
bleed to the screen edge on five blocks while their copy sat properly inset,
and six blocks were never added to the list at all.

**The transferable part.** The change that reaches for a mechanism you have
already measured as broken is the one to check first — the measurement was
written down, in a document we maintain, and it still got traded away. All
three regressions were self-reported in the commits that fixed them, which is
the part of this entry worth keeping.

### 39. A baseline that went 32 → 64 → 32

**Symptom.** None. A deliberate design change, twice, in four days.

**What happened.** On 08-22 the whole catalog rebased to a 64px gutter and a
472px content column: 36 blocks, every rail re-cut, the column ladder
re-derived. On 08-24 it was ruled back to 32px and 536px wide: 53 frames plus
both autoresponders, every rail re-cut again.

**What made the second pass safe.** The rails were re-derived from the *current
tree* rather than from the pre-64px ledger. Restoring the old numbers would
have been the obvious move and would have restored several that had already
been superseded on their own merits — one rail had changed for an unrelated
reason in between, and one image dimension is deliberately not what the old
ledger says.

**The transferable part.** An undo is not a revert. Re-derive from what is
there now, not from what was there before, or a reversal quietly reinstates
every unrelated decision that was made in the meantime.

---

# Appendix B: Where the knowledge lives now

| Where | What it holds | Enforced by |
| :-- | :-- | :-- |
| [CONVENTIONS.md](CONVENTIONS.md) (mirror; canonical copy in the converter repo) | The importer's full contract: how every field is generated, named, ordered, suppressed, versioned | Pre-commit review gate; `npm run check-docs` in the converter repo, including mirror-parity comparison |
| [MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md) (mirror; canonical copy in the converter repo) | Portable MJML + EN authoring rules, the measured inliner table, the QA checklist, and the copy-paste prompt for AI agents (§9) | Same |
| [PLAYBOOK.md](PLAYBOOK.md) | This repo's build pipeline, block system and naming grammar, debug overlay; §10 is the porting checklist for the next client | `npm run check-docs` here |
| [archive/probes/](archive/probes/) here, `docs/archive/` in the converter repo | 26 annotated probe instruments, each with its verdict recorded | Probe lifecycle rule |
| `docs/future-enhancements.md` (converter repo) | Deferred work, rejected approaches with the reason for rejection, and unexplained anomalies | Cited by the doc linter |
| `docs/qa-handoff-2026-08-11.md` (converter repo) | One QA session in full, including its "corrections to carry forward" list | None |
| `docs/en-bug-html-replacement-escapes-css.md` (converter repo) | The vendor bug report, with an importable proof of concept | None |
| `docs/TPL EN Marketing Tools Documentation.md` (converter repo) | The client manual: the template, every block and its fields, how the system is maintained | Regenerated from the import pipeline (`npm run gen-block-reference`); its claims linted against the catalog |
| The converter's audit engines | Inert dropdowns, dead flags, dark-mode image ink, `data-*` usage | Startup self-tests; `npm run audit-data-attrs -- --self-test` |
| This repo's check scripts | Catalog-defect and documentation-drift assertions, each annotated with the incident that caused it, plus the two delivered-CSS budgets | Every build |
| `.agentic/` (converter repo) | The spec layer since 2026-08-24: a spec per subsystem, the delivery loop and its two lanes, the reviewer protocol, durable technical learnings, and the architecture-decision record | Four CI gates in `.github/workflows/sdd-gates.yml`, over the 3 contracts in `.agentic/contracts/registry.json` |
| `docs/qc-final-2026-08-24.md` (converter repo) | The final pre-handover QC round, phase by phase, with each verdict and what it was measured on | None; its own last section is unwritten |
| `docs/type-scale-audit.md` (converter repo) | Every text style in the catalog against the brand table, and the rulings that settled the ones that disagreed | None |
| [README.MD](README.MD) | This repo's front door, including the block list | Generated from the catalog |
| [versions.json](versions.json) here, `app-version.json` in the converter repo | The integer version of every block, partial, template and the app | Build-time sync; git history is the ledger |

---

# Glossary

**MJML**: a shorthand language for writing emails; it compiles into markup
that renders correctly across mail clients.

**Engaging Networks (EN)**: the platform TPL uses for email, fundraising, and
advocacy.

**Marketing Tools**: EN's email builder, where editors assemble emails from
blocks.

**Block**: one reusable email section: a hero, a story card, a footer.

**Row / band**: one horizontal section of a block, numbered top to bottom.
Row is the editor-facing word; band survives as the authoring term, and the
*builder band* (the version band, in Appendix A entry 9) is the label strip
the EN builder paints over the email, which is app chrome rather than email
content.

**Rail**: a narrow fixed-width column beside the content, holding an icon or
a badge. In a grouped row, an unpinned rail shrinks on phones while the
fixed padding inside it does not.

**Alternate arrangement**: a whole second layout of a row, authored as a
hidden sibling and offered as one more option in that row's arrangement
dropdown.

**Holding pen**: `broken-blocks.mjml`, a one-block page for anything with an
unresolved defect. It keeps every build check running over the block while
dropping it from exports.

**Replacement**: an editable field attached to a block in the EN editor. What
this project calls a "field" or a "control".

**Autoresponder**: an email EN sends automatically in response to an action;
here, the two donation thank-yous.

**Probe**: a small email built to test a specific set of claims through a
real send.

**Inliner**: the transform EN applies at send time, moving stylesheet rules
onto individual elements.

**RTE / WYSIWYG**: EN's rich-text editing surface, built on ProseMirror. RTE
is rich-text editor; WYSIWYG is "what you see is what you get".

**Email on Acid (EoA)**: the service used to render one sent email across
dozens of real email clients for comparison.

**Child combinator**: the `>` in a CSS selector like `.block > table`,
meaning "a direct child of". The character EN's editor escapes.

**Gutter**: the built-in side padding between content and the edge of its
container.

**Frame**: the element that owns a block's outer geometry and carries its
padding: a section, a wrapper, or a column.

**Linter / lint**: an automated check that scans files for known mistakes and
reports them; ours run with every build, and a clean build prints zero
warnings.

**Viewport**: the screen width an email is viewed at. Desktop and phone are
the two that matter here.

**Merge tag**: a placeholder token EN substitutes when it assembles an email;
the container merge tag marks where block content lands in the template shell.

**`data-*` attribute**: an HTML annotation authors write in the MJML source.
Browsers and email clients ignore it; our build and converter read it as an
instruction. The full vocabulary is in Part 2.

**Reserializer**: the transform EN applies to a stylesheet at send, reprinting
every rule. Distinct from the inliner, and the subject of Appendix A entry 28.

**Version band**: a strip naming a block and its version. The *builder band*
is chrome the EN builder paints over the email; the *block bands* added on
2026-08-25 live inside each block, hidden by default, and are revealed by
adding the **Debug Helper** block — a block whose only content is the rule
that unhides them. Neither is ever visible in a delivered email.

**Link Color**: the dropdown that recolors every link in a block at once. Its
options are read out of the stylesheet rather than configured anywhere.

**Broadcast / Marketing Automations**: two EN surfaces that send email. A
broadcast is a one-off send an editor builds and schedules; automations send
in response to an action. The distinction matters here only because the
message-size ceiling was measured through one of them.

**Spec layer (`.agentic/`)**: the converter's governance directory, adopted
2026-08-24 — the specs, the delivery workflow, the reviewer protocol and the
learnings file. A **gate** is an automated check that can refuse a change; a
**contract** here means a rule with a script that verifies it, as opposed to
one that only exists as prose.

**Repository / commit**: a repository is the versioned home of a project's
files; a commit is one saved, described, reversible change to it. Commit
counts are used here as a rough measure of activity over time.
