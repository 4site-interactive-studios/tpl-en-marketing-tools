# Project retrospective — the TPL email system

**A snapshot of the project as of 2026-08-20, prepared by 4Site Studios. This
document is not maintained and it is not a contract.** For the rules as they
stand today, read [CONVENTIONS.md](CONVENTIONS.md) and
[MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md) — the mirrors at this
repo's root, whose canonical copies live in the private converter repo and are
enforced before every commit. What follows is a record of how we got there —
written down while the reasoning was still recoverable.

Findings carry the date they were measured wherever the record has one. Where a
finding was later corrected, the correction is shown alongside it rather than in
place of it.

---

## How to read this

| If you are… | Read |
| :-- | :-- |
| Anyone on the team | **Part 1** — plain language, no code, ~10 minutes |
| A developer or template author | **Part 1 + Part 2** |
| Picking up the work, or curious how we got things wrong | **Appendix A**, the post-mortems |
| Looking for where a specific rule lives now | **Appendix B**, the pointer map |

A glossary sits at the end. For what the system *is* today rather than how it
was built, the companion tour is `docs/overview-for-colleagues-detailed.md` in
the converter repo.

---

# Part 1 — For everyone

## The problem we set out to solve

Trust for Public Land sends email through Engaging Networks. EN's Marketing
Tools lets an editor assemble an email from reusable **blocks** — a hero, a
story card, a footer — and customize each one through fields shown beside it.

Two things make that harder than it sounds.

**Email is genuinely fragile.** Every mail client renders the same HTML
differently, and the differences are not cosmetic. Outlook on Windows uses
Microsoft Word as its rendering engine and ignores whole categories of modern
CSS. The Gmail app rewrites colors on its own. Apple Mail, Outlook.com, and
Gmail's web client each honor a different subset of dark-mode techniques. A
design that looks correct in a browser can be unreadable in an inbox.

**Free-text fields break layouts.** The moment an editor can type any number
into any field, typography drifts, spacing goes off-grid, and colors leave the
brand palette. Not through carelessness — through the ordinary act of filling
in a box that accepts anything.

Before this project, getting a block library into EN meant configuring each
block by hand in the EN interface: naming it, filing it, defining every
editable field one at a time, uploading a thumbnail. Slow, and impossible to
keep consistent across a hundred-odd blocks.

## What got built

Three things, in two repositories.

**A template library.** Emails are authored in MJML, a shorthand that compiles
into the nested tables email actually requires. Rather than one-off emails, we
maintain a catalog of blocks — each one a complete, tested design with mobile
stacking, dark-mode behavior, and Outlook workarounds already built in.
Alongside the catalog: a 56-block master template, and two donation thank-you
autoresponders assembled from the same blocks.

**A converter app.** A private, browser-only tool. Point it at the template on
GitHub and it compiles the MJML, splits it into blocks, reads the design intent
the template declares about itself, and writes the exact JSON that EN imports —
named, filed into folders, with real rendered thumbnails, and with every
editable property already turned into a typed field. The manual per-block
configuration became a single import of the whole library.

**Two written contracts.** A conventions document that defines exactly how the
converter behaves, and a portable authoring guide that carries everything we
measured about EN and email clients. Both are mirrored publicly so that anyone —
or any AI agent — working in a template repo can read them without access to the
private code.

## The timeline, in five phases

The two repositories together carry **495 commits between 2026-05-25 and
2026-08-20**.

**Phase 1 — Bootstrap and rebrand (late May → mid June).** The template started
life as another client's design and was re-skinned for TPL on 2026-06-11. Early
commits are terse and hand-built: *"create more blocks"*, *"dark mode
improvements"*. The fossils of the original are still in the repo.

**Phase 2 — From a mockup to a library (July).** The catalog becomes a system:
a naming grammar, categories, and a built-in debug overlay that lets anyone QA
the whole library in a browser without reading code. The converter app itself
starts on 2026-07-15.

**Phase 3 — The contract arrives (late July → early August).** The template
begins declaring its own expectations — its spacing scale, its width options,
its brand palette — in a machine-readable comment, and the converter reads them.
The conventions document is written and mirrored publicly. This is the point
where the two projects stop being two projects.

**Phase 4 — The measured-behavior era (2026-08-06 → 08-15).** The tone changes
completely. Commits stop asserting things about Engaging Networks and start
measuring them. We build **probes** — small emails whose only job is to test one
claim through a real send — and read the results across 15 email clients. Most
of the durable knowledge in this project was produced in these ten days, and
several confident beliefs were disproved.

**Phase 5 — Industrialization (2026-08-17 → 08-20).** Everything learned gets
turned into something automatic: build-time lints, pixel-level audits, content
versioning, byte budgets. Nearly half the converter's commits — 111 of 228 —
land in these four days, and the system goes live in TPL's account on
2026-08-18.

## The five things we'd tell another team

1. **Measure the delivered email, never the build.** What your compiler produces
   is a hypothesis. The platform rewrites it on the way out, and clients rewrite
   it again on the way in. More than one "obvious" root cause in this project
   died the moment we looked at what actually arrived in an inbox.

2. **Give editors bounded choices, not blank boxes.** Nearly every field the
   converter generates is a dropdown of vetted options. There is deliberately no
   free-text spacing field anywhere in the system. Editors can adjust breathing
   room; they cannot break the typography, because no field exists that could.

3. **The element above owns the gap below it.** All vertical space lives on
   bottom margins, on a closed named scale. If A owns the gap below it, then
   A+B and A+C both look right. If B owns the gap above it, every new pairing
   is a new bug.

4. **Never ship a control that does nothing.** A dropdown whose options change
   nothing teaches an editor that the controls are decorative. We built a system
   that renders every option of every dropdown and compares the pixels, so
   "this control does nothing" is a measurement rather than an opinion.

5. **Write the rule down where a machine can check it.** A convention that lives
   only in someone's head — or in a chat log — is already lost. Three separate
   times, the same stale flag was found, removed, and found again, because the
   rule against it was prose. It stopped recurring the day it became a build
   check.

## By the numbers

Each figure is attributed to the project that owns it: **TPL** (the template
library, this repo), the **Marketing Tools app** (the private Email → EN
Marketing Tools converter), or **both** where one project's work ran on the
other's material.

| | | Project |
| :-- | :-- | :-- |
| Project span | 2026-05-25 → 2026-08-20 (88 days) | Both |
| Commits | 495 (267 TPL · 228 Marketing Tools app) | Both |
| Blocks in the source catalog | 144 named block entities (134 content blocks, plus the page wrapper and 9 category dividers) | TPL |
| Blocks shipped into EN | 67 canonical blocks in 9 folders — TPL's blocks, imported through the app, with variants collapsing into dropdowns | Both |
| Master template | 56 blocks; plus 2 autoresponders of 7 blocks each | TPL |
| The converter itself | ~22,700 lines of production code, 772 automated tests, **zero backend**, at version 59 | Marketing Tools app |
| Published contracts | 2 documents, 4,052 lines, written beside the converter and mirrored byte-for-byte into this repo | Both |
| Version ledger | 152 versioned template artifacts (the template shell at v32, the shared stylesheet at v16) plus the app itself at v59 | Both |
| Probe instruments built and archived | 22 — 12 platform probes archived with the app, 10 rendering probes archived here | Both |
| Email-client render rounds reviewed | 8 rounds in one QA session alone, 120 individual renders of the TPL catalog | TPL |
| Editor controls proven live or dead by pixel comparison | 1,027 dropdowns, 11,108 renders (2026-08-18) — the app's audit engine run over TPL's generated controls | Both |
| Stale markup annotations removed after proving they changed nothing | 8,376 — TPL's markup, proven inert by the app's strip-and-regenerate audit | Both |
| Automated guards now standing | 4 audit engines (app), 3 linters (2 here, 1 with the app), 1 byte budget (here) | Both |

---

# Part 2 — For the technical reader

## What we learned about Engaging Networks

EN's Marketing Tools is not documented at the level this work required, so the
findings below were produced by controlled sends: a probe email carrying labeled
variants, sent through a real EN account, with the delivered HTML fetched and
compared byte-for-byte against what we shipped.

### The CSS inliner always runs, and it cannot be turned off

Confirmed with Bryan 2026-08-05. *An earlier version of the conventions document
wrongly told agents to disable it* — that correction is preserved in the doc
because the wrong version had already been read.

A 14-construct probe (2026-08-07, two rounds) produced the verdict table now in
the conventions document. The headlines:

| Construct | What EN does |
| :-- | :-- |
| A plain rule | Inlined onto the element, rule removed |
| `@media (prefers-color-scheme: dark)` | **Kept verbatim** — dark mode survives |
| `@media only screen and (max-width: 480px)` | Kept — mobile rules survive |
| `[data-ogsc] .x` at top level | **Dropped** — the Outlook.com dark branch is lost |
| `[data-ogsc]` nested inside a conditional media query | **Kept** — this is the rescue |
| `div[class="x"] { … !important }` | Inlined, and **`!important` is stripped** |
| A rule matching nothing | Pruned |
| An MSO conditional comment | Kept intact |
| Any rule nested in a media query | Kept, not inlined |

The operative consequence: **a conditional media query is EN's "do not touch"
wrapper.** Anything that must survive as a rule rather than an inline style goes
inside one. Two corollaries bit us later — a media-query rule that must beat a
base rule needs `!important` of its own, and any `!important` you wrote on an
inlinable rule is gone by the time it lands.

Timing matters as much as behavior: the inliner is a **send-time transform**. The
stored template keeps your source verbatim, so exports round-trip your source —
and every verdict describes what reaches the client, not what EN stores. An
export proves nothing about what a recipient gets.

### The block editor HTML-escapes `>` inside an HTML-type Replacement

The flagship finding, and the most damaging.

An HTML-type Replacement was holding a block's `<style>` element. Import was
clean. Send was clean. But a block that had been through EN's editor shipped with
`>` rewritten as `&gt;`. Because `<style>` is a raw-text element in the HTML
standard, `&gt;` is never decoded back — it stays five literal characters, the
selector becomes invalid CSS, and the client's parser discards the rule silently.

The damage pattern is what made it hard to see. Dark-mode rules come in pairs:
`.block p` sets the text color and uses a descendant selector, so it survived;
`.block > table` repaints the background and uses a child combinator, so it died.
Half of each pair lived. The result was **white text on a white panel** — and on
iOS Mail, entire content blocks rendering blank.

Pinned by four controlled sends (2026-08-13): the trigger is an **edit**. Import,
send, and an untouched open-and-save round trip are all clean and byte-identical.
The escape persists only for a field that was actually modified and resubmitted.
Scope is narrow — in the same sends, six child combinators living in ordinary
block markup came through raw every time. EN's separate CSS Editor surface was
cleared on 2026-08-18.

Two measurement traps cost a full send round each, and are worth knowing about
for any similar investigation: **EN prunes rules that match nothing**, so a canary
selector aimed at a non-existent class vanishes and reads as a pass; and **a plain
rule is inlined**, which dissolves the very selector you were trying to inspect.

Two fixes shipped. Ours: `styles.css` was rewritten to contain **zero child
combinators**, with measured attribute-selector stand-ins documented in the guide.
Theirs: a bug report with an importable proof-of-concept block, written and ready
to submit.

### EN's Content editor is ProseMirror, and the first keystroke rewrites your markup

Measured 2026-08-19 with paired blocks from a single import — one copy given a
null edit in every field (click in, type a character, delete it, save) and its
never-opened twin left alone. Any difference could only have been introduced by
the editor.

| What you author | What the editor leaves |
| :-- | :-- |
| Bare copy, or a lone `<span>` | Wrapped in one `<p>`; spans and classes survive |
| `<span style="font-weight:700; color:#362229">` | Re-expressed as marks — `<strong>`, color as `rgb()` |
| An inline element with a property that has no mark (`font-family`, `background-color`, `display`, `border-radius`) | **That property is dropped** |
| A `<p>` that is already there | **Unchanged — the transform is idempotent** |
| `<a href target rel style>` | **`rel` and `style` stripped**; `href` and `target` kept |
| An MSO conditional comment | **Destroyed** |

Three things follow.

The injected paragraph carries no inline style, so the stylesheet's `p` rule wins
and a 10px caption ships at 16px. EN's inliner then bakes that winning rule onto
the element as an inline style — `inherit` included — and inline `inherit` is
exactly the construct Outlook's Word engine cannot be relied on for.

Because the transform is **idempotent**, the fix is to pre-apply it. The converter
now wraps values at generation time so the editor's first edit changes nothing.
Verified end to end (23 values wrapped, 132 already block-level, 2 failed open) and
proven pixel-identical to the unwrapped rendering.

**Node versus mark** turned out to be the predictive model. ProseMirror treats a
link as a mark, rebuilt from a fixed attribute set, while `span` and `p` are nodes
that keep their attributes. So an RTE-embedded link can only be styled from an
ancestor class — which is now the sanctioned pattern, verified to survive both
storage and delivery. The catalog's rich-text values now hold zero styled
anchors; link color moved to ancestor classes (2026-08-19).

### Template edits do not reach emails that already exist

An EN template change — including its fields — does not propagate into drafts
built from it. Any email using that template must be rebuilt from scratch.

This one platform limitation is the entire reason the **Template Styles block**
exists. CSS is the part of a template that most often needs a post-hoc fix, so we
ship the head stylesheet as a *block* instead. A CSS fix becomes a block swap
rather than an email rebuild.

### Smaller platform behaviors, each measured

- **One value, several carriers.** A single `mj-section background-url` compiles
  into four places: an inline `background:`, a table `background=` attribute, a
  second `url()` inside that table's style, and `v:fill src` in the MSO
  conditional. Miss the CSS ones and Outlook shows the new photo while everything
  else shows the old one. This cost a full QA round.
- **EN rebuilds a table's `background` shorthand** and drops the `url()`. The
  leftover shorthand then *resets* the background in CSS clients, overriding both
  the `bgcolor` and legacy `background=` attributes. A full-width section has no
  div carrier at all, so after EN it renders blank in Gmail, Apple Mail, and iOS.
  **Never author a full-width section with a background image for EN.**
- **Same-condition `@media` blocks merge into the first occurrence's position**
  (2026-08-19). Any cascade depending on source order is silently inverted.
  Matching is textual, so `(max-width:599px)` and `(max-width: 599px)` are
  different conditions — which is now used deliberately to keep two blocks apart.
- **EN splits comma-separated selector groups into individual rules**, so one
  authored group can end up half-alive.
- **EN re-prints head CSS at send: 1.30× the authored bytes.**
- **EN ingests a stylesheet once per `<style>` wrapper.** A doubled wrapper
  delivered two full copies — 24,952 bytes, over the Gmail cliff. Removing it took
  the same send to 13,325.
- **EN injects its own preheader** from each email's Preview Text setting, so a
  template-baked one doubles up in inbox snippets. An earlier `preview_text` field
  was shipped and reverted the same day once a send test disproved the assumption.
- **EN strips `<title>` and the `aria-label` MJML mirrors onto the body wrapper.**
  Removing it is an accessibility gain, not a loss — a screen reader was otherwise
  announcing the entire body as one string that only repeated the title.
- **Sends read block content live**, not from a build-time snapshot (2026-08-19).
  Methodologically important: a storage-versus-delivery comparison needs no
  rebuild to be valid.
- **Replacement nesting resolves recursively**, measured to three levels in a
  real send (2026-08-09) with zero literal tags leaking through, and the same
  block added twice keeps independent field selections per instance.

## What we learned about email clients

### Gmail drops head CSS by size, and it drops it whole

Measured 2026-08-18 as a controlled pair. A real send delivering **28,331 bytes**
of head CSS had its entire `<style>` ignored — the mobile rules sitting at byte
offset 12.4K did not apply, well before any truncation point, because the drop is
all-or-nothing. A 715-byte probe kept everything.

The cliff sits at **16,384 bytes**. It is not mobile-only: Gmail desktop webmail
in Chrome showed the identical pair. Every Gmail surface shares the sanitizer.

Two consequences are now permanent. We **budget the delivered CSS, not the
authored CSS** — with EN's 1.30× re-print factor, a working target of 14,000
delivered bytes, and a build-time lint that flags the catalog when the estimate
crosses it (the linters warn rather than fail by contract; the working rule is
that a clean build prints zero warnings). And the deeper armor is an
inline-first doctrine: the no-CSS rendering of every element should already be
the correct *mobile* rendering, so a dropped stylesheet degrades rather than
breaks.

The budget is a real ceiling with a ledger. The stylesheet sat roughly 50 bytes
clear until 2026-08-20, when deleting a retired width ladder returned about
1,325 delivered bytes — the estimate now stands at 14,997 against the 16,384
cliff, about 1,387 bytes of headroom for whatever comes next.

### Dark mode reaches most clients, and two important ones not at all

Only two hooks survive EN: `@media (prefers-color-scheme: dark)`, and
`[data-ogsc]` nested inside a conditional media query.

**The Gmail app on Android and Outlook 2021 on Windows expose neither** — and they
transform in opposite directions. Gmail darkens light designs; Outlook desktop
also *inverts* dark ones, flipping a `#000000` footer to a white background while
leaving its light-green logo and white icons untouched. `bgcolor` attributes buy
no protection; a panel colored with the attribute inverts identically to one
colored with CSS.

**Images are never recolored by either client. That is both the failure mode and
the defense.** The accepted end state for Outlook desktop dark mode is to let it
invert and make the artwork survive the inversion — which produced a scripted
contrast-outline treatment that adds an opposite-polarity rim to every transparent
PNG whose ink depends on its background, applied across 14 assets.

Two measured surprises are worth recording together. First, **a mercy**: an
authored light ground with no dark hook at all rendered dark and legible in all
five dark-capable clients of the test matrix. The white-on-white failure predicted
from the local build never reached an inbox — dark-mode claims must be measured on
delivered HTML, never on the compiled build. (One email, one round: strong
evidence, not a license to delete hooks.) Second, **the mercy's hard limit**: our
own dark rule painted an opaque black lid over every background-photo hero in
Apple Mail dark and Outlook.com dark. Clients rescue what EN delivers, but they
honor *your* dark CSS as intent. Fixed with an equal-specificity exemption for
image blocks, confirmed across all five hero shapes.

### Outlook's Word engine, and things we chose to accept

- **A section carrying both a background color and a background image renders as a
  flat slab** in Outlook 2021 and Microsoft 365 on Windows. MJML copies the color
  onto the Outlook `v:fill` as `color=`, and Word paints that instead of the photo.
  It renders correctly on Outlook for *Mac* and everywhere else — which is why the
  failure looked inconsistent for so long. Fixed by moving the fallback color onto
  a wrapper behind the section, across 25 sections, and now guarded by a build
  lint.
- **Outlook renders every button square.** It ignores `border-radius` on table
  cells. Accepted as graceful degradation; VML roundrect wrappers were explicitly
  rejected because they break the converter's label and color bindings and bloat
  every block.
- **Word ignores CSS box geometry on spans** — `display:inline-block`, `width`, and
  `height` all die.
- **`line-height: 0` is a trap.** Correct in every browser and byte-identical
  across desktop and mobile — and Word honors it, rendering every hand-rolled pill
  as a thin bar with invisible label text. Reported and reverted the same day.

### The gutter finding

A QA round read Gmail on Android as shrinking two-column story cards. Four probe
rounds disproved it: **there is no column-shrink bug.** A Pixel 10 reports 1080
device pixels at a 3× ratio, so Gmail lays out at roughly 333 CSS pixels; a card
loses 80 of them — a quarter of the width — to section and column gutters. The
model predicted 252.7px against a measured 251.0px, while the competing
"shrink" model was off by 17.7px.

The shipped fix took mobile imagery flush to the edge, moving an image from 262.7
to 326.0 CSS pixels with the desktop rendering byte-identical. The lesson
generalized into the guide: **diagnose gutters before restructuring columns.**

## What we learned about designing editor controls

The converter is opinionated, and every opinion below was an explicit decision
rather than an implementation accident.

- **Free numbers are the exception, not the rule** (dev call, 2026-07-20). Editors
  pick named options. The sanctioned free-number fields are a short list — image
  width, font size, line height, letter spacing, border radius. Spacing, padding,
  and height never appear as free text.
- **A closed spacing scale.** None / Half / Single / Double / Triple = 0 / 8 / 16 /
  32 / 48px, with the pixel value in the label — and TPL's template extends it
  with Quadruple (64px) through the contract comment. Off-grid authored values
  snap to the nearest step, ties rounding up, with the original preserved so
  deleting the field restores the source byte-exact. There is no per-field
  "Original" escape hatch, because an escape hatch is how a scale stops being a
  scale.
- **Bottom-only pacing**, for the reason in Part 1. Columns never carry bottom
  padding. A later exception proves the rule: a caption owns the gap *above*
  itself, so hiding the caption removes the gap with it instead of stranding white
  space under the photo.
- **A geometry guard.** Padding above a declared reach (64px by default) is design
  geometry, not pacing, and gets no field at all — never a free-text fallback. The
  350px reserve behind a hero photo stays locked.
- **Inert controls are suppressed, and the suppression explains itself.** Where a
  field would do nothing — padding a fixed layout ignores, or a value whose only
  occurrences sit inside an Outlook conditional and would silently desync every
  other client — no field is generated, and an informational note records why.
  These are *info*, not warnings, because the source is correct as written.
- **Labels lead; merge tags follow.** This was a reversal. The original contract
  kept machine names byte-stable while labels moved, and the two vocabularies
  drifted apart. The 2026-08-19 rework made names follow labels through a single
  shared resolver, at the cost of a catalog-wide rename and one version bump per
  block, so the panel and the tags can no longer disagree.
- **Display is always first** in its group — it decides whether the rest of the
  group even matters. Field order within a section runs Visibility → Primary
  content → Appearance → Dimensions → Position → Spacing.
- **Colors are always dropdowns.** Every color in the template is collected into a
  brand palette, grouped by role, ordered perceptually, and vanity-named. Editors
  do not type hex codes and off-brand colors cannot creep in through everyday
  edits (the one documented exception: compound border values stay plain text,
  because a compound value cannot be a dropdown).
- **Alt text is universal.** Every image mints an editable alt-text field — real
  copy for meaningful images, empty allowed for decorative art, never a label
  that narrates chrome to a screen reader. The per-image opt-in annotation this
  replaced was retired across 262 instances.

## What we learned about how to work

This is the part that generalizes beyond email.

**Documents as contracts, checked by a machine.** Two documents are treated as
published contracts rather than internal notes, re-read against the full diff
before every commit, and mirrored byte-for-byte into a public repo so agents
working elsewhere can fetch them. A linter checks them for drift — dead file
citations, a documented default that no longer matches the code, stale "pending"
language, and whether each mirror still matches its source. Its docblock says it
plainly: *every assertion encodes drift this repo actually shipped.*

**Probes as instruments, with a lifecycle.** A probe is a small email built to
test one set of claims against a real send. The rule: a probe whose every claim is
measured and recorded is archived **in the same session that records its last
verdict**; a probe still carrying any unverified claim stays put. Archive, never
delete — an annotated probe is the reusable instrument for re-measuring EN when
its behavior is suspected to have changed. Twenty-two are on the shelf.

Two habits made the probes trustworthy. **Paired never-opened twins**: send the
same block twice, edit one, leave the other alone, so any difference can only have
been introduced by the thing you are testing. And **generate the probe's import
file through the app's own exporter** — hand-writing that JSON is how an earlier
probe imported silently and produced nothing.

**Empirical oracles instead of reasoning.** Where a claim could be measured, we
built something to measure it rather than argue about it:

- the **Inert Dropdown Audit** renders every block × dropdown × option at two
  viewports and compares canvas pixel hashes; a control is inert only if every
  option rasters byte-identical to the baseline. The engine now also tests three
  copy lengths per cell, because the go-live sweep proved short placeholder copy
  makes live controls look dead
- the **dead-flag check** strips a markup annotation, regenerates with identical
  inputs, and byte-compares — if removing it changes nothing, the source should
  not have it
- the **dark-mode image audit** classifies each asset's ink from its actual pixels
- the **`data-*` audit** cross-references every annotation against both repos'
  code *and* an empirical strip-and-regenerate test

The determinism rules around these matter more than the engines. Caching keys on
the exact input and never on a digest, because a weaker key could collide. A
baseline re-verify bypasses every cache, because a cached witness is not a
witness. The audit self-tests at startup and **refuses to run** if raster
determinism fails — a lying matrix is worse than no matrix. Parallelism is a
timing knob and never a verdict knob.

**Findings err in both directions.** Six controls the sweep called inert were live
in a browser; a row reporting a control as live was wrong the other way. The rule
became: confirm every claim, whichever way it points, *then* declare. And a
finding can be a real defect wearing an inert control's clothes — one "dead"
dropdown was a leftover oversized column.

**The moment a rule recurs, it becomes a lint.** The same stale annotation was
found and removed on three separate occasions before the rule moved out of prose
and into a build check. The commit note is the lesson: *the rule now lives where
prose cannot lose it.* Each assertion in the template repo's linters is annotated
in the source with the specific incident that caused it — so nobody deletes a
check without seeing what it cost.

**Land a new check after the cleanup, not before.** The rich-text validator was
deliberately built last, after the catalog was migrated. Landing it first would
have put 45 warnings in the export panel on day one — which is how a check gets
ignored rather than acted on. Severity was chosen by whether a workaround exists,
not by how alarming the construct looks.

**Versioning anchored to content, with git as the ledger.** Every block, partial,
template and the app itself carry an integer version derived from a content hash,
where the baseline is the manifest *as last committed*. Rebuilding never
double-bumps and local iteration cannot inflate a number. Versions track what was
edited, not what was affected downstream — a stylesheet change that alters how
every block renders bumps only the template. The ledger now holds 152 entities;
the template shell is at version 32, the shared stylesheet at 16, and the busiest
single block at 12 — the churn concentrated in the shared layer, which is exactly
where you want iteration to concentrate.

**Git discipline written down after it bit us.** Parallel sessions land commits in
both repos many times a day, so: fetch and fast-forward both before starting, never
run a `git checkout` variant inside a scripted command, and verify the remote
matches local `HEAD` after every push. Each of those clauses exists because of a
specific incident (see Appendix A).

**Conventions written for AI agents, not only for people.** The authoring guide
ends with a copy-paste prompt that points an agent in any MJML repo at both raw
mirror URLs. That is why the mirror ritual is a hard gate — a half-pushed mirror
silently gives every downstream agent a stale contract.

## Where it stands today

Shipped and in use since 2026-08-18: the block catalog, the converter, the two
contracts, four audit engines, three linters, content-hash versioning, and a
client-facing manual (~1,850 lines) covering the template, every block and its
fields, and how the system is maintained.

Open threads, recorded rather than resolved:

- The Gmail head-CSS budget has roughly 1,387 bytes of headroom against the
  16,384-byte cliff. It constrains any future stylesheet work.
- The EN bug report on `>`-escaping is written, with an importable proof of
  concept, and not yet submitted.
- The four footer social icons render through a different component and missed
  the contrast-outline pass; Outlook desktop dark inverts the black footer and
  they can vanish into it.
- The go-live control audit's 64-finding backlog is deliberately unapplied
  (none affect a sent email): roughly 30 label fixes and roughly 30
  apparently-dead controls — with the recorded instruction to re-derive the
  dead-control list rather than trust its count.
- Detection of dark-mode-fragile assets shipped; automatic generation of the
  outlined variant is designed — the rim recipe is proven — but not built.
- One delivered email lost styling that its stored version still had. Logged as
  **unexplained** rather than closed.
- A palette contrast issue in the Steps Block family falls below the AA
  threshold (white on green at 2.66:1 against a 4.5:1 floor); by user decision
  it is held as a client-facing accessibility recommendation rather than a
  silent change, with the exact remedy documented.
- This repo's `README` is the one stale document in an otherwise meticulous
  set — three months old, with live TODO placeholders, describing files that
  have since been renamed. It is the front door for anyone arriving cold.

---

# Appendix A — What went wrong

Technical, and deliberately unflattering. Each entry follows the same shape:
what we saw, what we believed, what was actually true, and what now stops it
happening again. These are the entries that taught the most.

## Wrong root causes

### 1. The dark-mode failure that had four wrong explanations

**Symptom.** Eight Email on Acid rounds (2026-08-11, 120 renders read) showed
iOS Mail rendering entire content blocks as white text on white panels.

**What we believed, in order.** *Gmail strips body `<style>`* — disproven by
probe. *The dark-mode failures are authoring bugs* — wrong as stated; the
authored pairs were correct. *EN escapes `>` at send time* — wrong; only on an
editor edit. *Outlook 365 for Mac is broken as a client* — wrong; clean HTML
renders there perfectly.

**What was actually true.** EN's block editor escaped `>` in CSS held in an
HTML-type Replacement, killing the background half of every paired dark-mode
rule while the text half survived.

**Fix.** Zero child combinators in the shipped stylesheet, with measured
attribute-selector stand-ins.

**Guard.** `validateEditorSafeCss` warns at import on any child combinator in a
block's shipped CSS; the template repo's linter bans them at build time.

**The transferable part.** Four confident diagnoses in a row, each plausible,
each wrong, and each cheap to hold because none had been tested against a real
send. The written "corrections to carry forward" list exists so the next session
does not re-derive them.

### 2. "Gmail shrinks our columns"

**Symptom.** Two-column story cards looked stacked and undersized in the Gmail
Android app.

**What we believed.** A column-layout bug requiring the two-column technique to
be restructured.

**What was actually true.** Gutters. At Gmail Android's ~333 CSS pixel layout
width, section and column padding consumes 80px — a quarter of the card. Four
probe rounds were needed to disprove the restructuring theory; the gutter model
predicted the measured width to within 1.7px, the competing model to within
17.7px.

**Fix.** A two-rule flush-mobile treatment. Desktop output byte-identical.

**The transferable part.** The expensive fix was the wrong one, and only
measurement separated them. *Diagnose gutters before restructuring columns* is
now in the guide.

### 3. The QA tool that reported the same catastrophe for every test

**Symptom.** Email on Acid's "view source" page showed roughly 71 bytes of CSS
and no dark-mode rules — for a test that had shipped a full stylesheet
(2026-08-12).

**What we believed.** Total stylesheet loss in transit: a catastrophic,
send-blocking finding.

**What was actually true.** That URL returns EoA's own application shell, not
the email. Every test reports the identical bytes; the tell was that a
known-good test had "lost" exactly the same stylesheet.

**Guard.** The delivered-HTML URL is documented as the only diagnostic source,
and a checklist rule now says a payload without EN's inliner fingerprints
proves nothing — the test bypassed EN entirely.

### 4. A retraction: a finding that was an artifact of our own build

**Symptom.** A background-image behavior appeared broken in the delivered HTML.

**What was actually true.** The evidence had been read from the `_live.html`
build variant, not from a delivered send. The finding was retracted in its own
commit rather than quietly edited away.

**The transferable part.** The build has two variants for good reasons, and
either can be mistaken for evidence. Retraction commits are cheap; a wrong
finding sitting in a contract is not.

### 5. A concurrency speedup that was a throttled browser tab

**Symptom.** Running the pixel audit with eight parallel iframes measured 6.37×
faster than one. The default was changed to eight.

**What was actually true.** The measurement had been taken in a **background
tab**, which the browser throttles. Re-measured on a real foreground tab:
1-wide 20.73s, 2-wide 19.21s, 4-wide 20.62s, 8-wide 21.31s — eight is *slower*
than one. All four passes returned the same verdict digest.

**Fix.** Default reverted to one, in a commit titled *"Default back to 1: on a
real tab, concurrency buys nothing."*

### 6. Audit findings that were wrong in both directions

**Symptom.** Six controls the sweep reported as inert at the phone viewport were
demonstrably live in a browser, and cleared on a re-run hours later. Separately,
a row reporting a flagged control as live was wrong the other way.

**Fix.** The report rule was corrected to say findings err in both directions:
confirm every claim, whichever way it points, then declare.

**The transferable part.** An oracle you trust asymmetrically is an oracle you
have stopped testing.

## Bugs that were invisible by construction

### 7. A prose comment killed every import

**Symptom.** Every TPL import failed with MJML's misleading *"Malformed MJML"*.

**What was actually true.** A comment in `styles.css` contained the literal token
`<style>` — inside the sentence "Gmail app drops `<style>`". The importer inlines
that stylesheet into an `<mj-style>` before parsing, and MJML's HTML-mode
tokenizer treats the opener as the start of a raw-text element. The rest of the
document, `mj-body` included, was swallowed as text.

**Why it reached production.** The command-line build never sees that path.

**Guard.** A build assertion bans any tag-like sequence anywhere in CSS,
comments included.

### 8. The same trap, one level up

**Symptom.** Light/dark image pairs rendered *both* halves; a block preview
carried zero CSS rules where dozens should have been.

**What was actually true.** A comment documenting EN's container rule spelled the
container merge tag out literally. The importer splits the template shell on the
first occurrence of that tag, so the split landed inside the comment. The head was
truncated mid-comment, the comment lost its terminator, and it swallowed the
entire stylesheet.

**Guard.** A dedicated importer guard on the container placeholder. Two outages
from the same class of bug — documentation text being read as markup — in three
days.

### 9. The debug toolbar ate the version band

**Symptom.** A version stamp that should appear inside Marketing Tools was
missing, and only from the documented import path. The `_live` build variant
always looked correct.

**What was actually true.** The segmenter has no special knowledge of which block
is the container; it takes the offset of the *first* `START` marker of any name.
The debug toolbar partial carries its own marker pair, so it segmented as block
number one and the content ahead of it — 714 bytes that reached none of the 77
exported blocks — was dropped wholesale.

**Guard.** The band now leads the body, and a build tripwire asserts it stays
there.

**The transferable part.** The failure was quiet and asymmetric — the artifacts
that were easiest to check were the ones that looked fine, and the path that
actually mattered was the broken one.

### 10. A markup flag that was silently ignored for weeks

**Symptom.** A `data-no-display-toggle` annotation had no effect.

**What was actually true.** The flags are valueless, and the attribute reader
returns undefined for a bare flag — so detection had to use a presence check
rather than a value read. Until it did (2026-07-31), the flag was ignored
entirely.

**Guard.** The reading rule is spelled out in the contract, and the dead-flag
audit now proves per annotation that the converter actually honors it.

### 11. Labels that lied about the viewport

**Symptom.** Generated field labels made claims about desktop-versus-mobile
behavior that were not true.

**What was actually true.** Two separate parsing bugs in how the template's own
mobile rules were read. A rule sitting immediately after a CSS comment failed to
register as a mobile pin at all (caught 2026-08-18, now pinned by a regression
test). And a rule whose scope covers descendants was read as if it pinned the
element itself, stamping a false "Desktop Padding Right" onto the Video Blocks —
the self-form and scope-form reading rules are not interchangeable.

**The transferable part.** Some bugs are only findable once the reporting is good
enough to make them stand out — both surfaced once a failures-only report put
every label claim in one place.

### 12. A fix that was correct everywhere except where it mattered

**Symptom.** Hand-rolled button pills rendered as thin bars with invisible label
text in Outlook's Word engine (2026-08-11).

**What was actually true.** A `line-height: 0` declaration — correct in every
browser, byte-identical across desktop and mobile output, and honored literally
by Word. Reported and reverted the same day.

**Guard.** Line-height is banned on the button-group classes, and any future
attempt at that spacing must be invisible to Word and proven in Outlook before
it ships.

## Process failures

### 13. A push that reported success and did not happen

**Symptom.** A commit that had been "pushed" returned a 404 on GitHub.

**What was actually true.** A stray `git checkout HEAD~0` inside a scripted
command detached `HEAD`. The next commit landed off-branch, and `git push origin
main` exited 0 as a no-op — it pushed the stale local `main` ref.

**Guard, now written into both repos' working instructions.** Never run a
`git checkout` variant inside a compound or scripted command; confirm the branch
before committing; and after every push, verify the remote ref equals local
`HEAD`. **A push that prints nothing and exits 0 is not proof.**

### 14. Two rounds, one build

**Symptom.** A before-and-after pair of Email on Acid rounds appeared to verify
a fix (2026-08-11).

**What was actually true.** The two rounds were the same build sent 34 minutes
apart. The "fix" was in neither.

**Guard.** Never read an A-to-B diff as fix verification without a source
commit between the sends. Recorded in the QA handoff's corrections list.

### 15. A type check that checked nothing

**Symptom.** A real type error reached `main` (caught 2026-08-19).

**What was actually true.** The root TypeScript config is a references-only shell
with an empty file list, so `tsc --noEmit` type-checked *zero* files while
appearing to pass. The correct invocation builds the referenced projects.

**Guard.** The canonical check command is documented, with the reason attached so
nobody "simplifies" it back.

### 16. The same finding, three times

**Symptom.** A dead-annotation audit found five stale flags on 2026-08-10. It
found them again on 08-16. And again on 08-17.

**What was actually true.** The underlying rule — that the second half of a
merged light/dark image pair never gets its own toggle — existed only as prose,
so each cleanup pass re-derived it and each subsequent authoring pass re-broke it.

**Fix.** The rule became a build-time lint. *The rule now lives where prose
cannot lose it.*

### 17. A near-duplicate catalog that charged rent

**Symptom.** Two catalog files, one a strict subset of the other — 135 of 143
blocks, differing by exactly one line.

**What was actually true.** It required a matching edit on 14 of the 15 catalog
commits in its final 90 days. *That sync tax was its whole cost and its whole
risk.* Deleted 2026-08-17, with the instruction that any future short
demonstration page gets derived at build time from the full catalog.

### 18. Shipping ahead of the evidence

**Symptom.** A `preview_text` field was designed, built, and shipped — then
reverted the same day (2026-08-10) when a send test showed EN injects its own
preheader.

**The transferable part.** The reversal was fast and cheap because a send test
was already routine by then. Earlier in the project the same mistake would have
lived for weeks. Several other reversals share the shape — a stylesheet `inherit`
rule tried and reverted once the inliner settled the question, and a naming
change appended and then prepended within hours.

---

# Appendix B — Where the knowledge lives now

| Where | What it holds | Enforced by |
| :-- | :-- | :-- |
| [CONVENTIONS.md](CONVENTIONS.md) (mirror; canonical copy in the converter repo) | The importer's full contract — how every field is generated, named, ordered, suppressed, versioned | Pre-commit review gate; `npm run check-docs` in the converter repo |
| [MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md) (mirror; canonical copy in the converter repo) | Portable MJML + EN authoring rules, the measured inliner table, the QA checklist, and the copy-paste prompt for AI agents (§9) | Same, plus byte-comparison of each mirror against its source |
| [PLAYBOOK.md](PLAYBOOK.md) | This repo's build pipeline, block system and naming grammar, debug overlay; §10 is the porting checklist for the next client | `npm run check-docs` here |
| [archive/probes/](archive/probes/) here, `docs/archive/` in the converter repo | 22 annotated probe instruments, each with its verdict recorded | Probe lifecycle rule |
| `docs/future-enhancements.md` (converter repo) | Deferred work, rejected approaches with the reason for rejection, and unexplained anomalies | Cited by the doc linter |
| `docs/qa-handoff-2026-08-11.md` (converter repo) | One QA session in full, including its "corrections to carry forward" list | — |
| `docs/en-bug-html-replacement-escapes-css.md` (converter repo) | The vendor bug report, with an importable proof of concept | — |
| The converter's audit engines | Inert dropdowns, dead flags, dark-mode image ink, `data-*` usage | Startup self-tests; `npm run audit-data-attrs -- --self-test` |
| This repo's check scripts | Catalog-defect and documentation-drift assertions, each annotated with the incident that caused it, plus the Gmail byte budget | Every build |
| [versions.json](versions.json) here, `app-version.json` in the converter repo | The integer version of every block, partial, template and the app | Build-time sync; git history is the ledger |

---

# Glossary

**MJML** — a shorthand language for writing emails that compiles into markup which
renders correctly across mail clients.

**Engaging Networks (EN)** — the platform TPL uses for email, fundraising, and
advocacy.

**Marketing Tools** — EN's email builder, where editors assemble emails from
blocks.

**Block** — one reusable email section: a hero, a story card, a footer.

**Replacement** — an editable field attached to a block in the EN editor. What
this project calls a "field" or a "control".

**Autoresponder** — an email EN sends automatically in response to an action;
here, the two donation thank-yous.

**Probe** — a small email built to test one specific claim through a real send.

**Inliner** — the transform EN applies at send time, moving stylesheet rules onto
individual elements.

**RTE / WYSIWYG** — EN's rich-text editing surface, built on ProseMirror.

**Email on Acid (EoA)** — the service used to render one sent email across dozens
of real email clients for comparison.

**Child combinator** — the `>` in a CSS selector like `.block > table`, meaning
"a direct child of". The character EN's editor escapes.

**Asset root** — the content-delivery folder where the account's images and
thumbnails live.

**Repository / commit** — a repository is the versioned home of a project's
files; a commit is one saved, described, reversible change to it. Commit counts
are used here as a rough measure of activity over time.
