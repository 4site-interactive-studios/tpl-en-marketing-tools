# Project retrospective: the TPL email system

**Published 2026-08-26 by Bryan Casler (4Site Studios).** A record of how this
system was built and what it taught us. It is not a contract: for the rules as
they stand today, read [CONVENTIONS.md](CONVENTIONS.md) and
[MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md) at this repo's root, which
are maintained, reviewed against every change, and machine-checked for drift.

> [!TIP]
> **See the whole system in one email.**
> [This live template in Engaging Networks](https://us2.engagingnetworks.app/page/email/message/view?templateId=582)
> stacks one of every block. Open it before you read a word of this document;
> everything below makes more sense once you have scrolled the real thing. You
> will need an Engaging Networks login, and the catalog has moved on since that
> template was imported, so block names and spacing there lag this document.

---

## The short version

Trust for Public Land (TPL) sends email through Engaging Networks. Building a
block library there meant configuring every block by hand (naming it, filing it,
defining each editable field one at a time), which does not scale past a
handful and cannot be kept consistent across a hundred.

We built three things: a **template library** of tested email blocks, a
**converter** that turns that library into exactly the data Engaging Networks
imports, and **two written contracts** that define how both behave. The manual
per-block setup became a single import of the whole library.

What it cost: about three months and 751 commits across two repositories.

What it bought: 56 blocks live in the platform, every editable field generated
rather than hand-configured, every dropdown option proven to change something
by comparing rendered pixels, and roughly 8,400 dead markup annotations removed
after proving they changed nothing. Email rendering is verified against what
actually arrives in an inbox, not against what the build produces. That
distinction killed more than one confident theory here.

What is unfinished: all 60 blocks still live in one file, so no block has a
history of its own; the render-testing service we rely on is being retired by
its vendor; the platform has no way to automate the work that still happens by
hand in its interface; the app runs on a laptop rather than as a hosted tool;
and its own interface has never been designed around how it is actually used.
Splitting the catalog into one file per block is the highest priority of those.
All of them are set out at the end.

---

## How to read this

| If you are… | Read |
| :-- | :-- |
| Anyone on the team | [The short version](#the-short-version) above, then [Part 1](#part-1-for-everyone). Plain language, no code, about 10 minutes |
| A developer or template author | Part 1, then [Part 2](#part-2-for-the-technical-reader). Part 2 is three quarters of the document, about 35 minutes |
| Deciding what happens next | [What is unfinished today](#what-is-unfinished-today) for the open items and the go-live blockers, then [What to do next](#what-to-do-next) for the directions. About 10 minutes together |
| About to change something | The router below |
| Looking a rule up | [Where the rules live now](#where-the-rules-live-now) and the [Glossary](#glossary), both in [Reference](#reference) at the back |

Part 2 states each rule first and then the story that produced it, including
the ones we got wrong on the way. Those are the parts most worth reading if you
are picking the work up.

## Before you change something

The document is organized by what we learned, not by what you are about to
touch. This is the other way in. Each row names the sections that bite, and the
maintained rule in [MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md), which is
where the contract actually lives.

| If you are changing… | Read first | The rule lives at |
| :-- | :-- | :-- |
| The shared stylesheet | [What we learned about the platform](#what-we-learned-about-the-platform), all of it | Guide §2d, §2b-bis, checklist 6b-bis |
| A block's layout or geometry | [What we learned about email clients](#what-we-learned-about-email-clients) | Guide §4 |
| A block's editable fields | [Designing the editor controls](#designing-the-editor-controls) | CONVENTIONS.md |
| A block's name | [Version by content, with git as the ledger](#version-by-content-with-git-as-the-ledger) | CONVENTIONS.md, "Versioning" |
| Anything, before you commit | [How we learned to work](#how-we-learned-to-work) | The repo's own working rules |

## Contents

**[Part 1: For everyone](#part-1-for-everyone)**
[The problem](#the-problem-we-set-out-to-solve) ·
[What got built](#what-got-built) · [The timeline](#the-timeline-in-seven-phases) ·
[The five things we'd tell another team](#the-five-things-wed-tell-another-team) ·
[By the numbers](#by-the-numbers)

**[Part 2: For the technical reader](#part-2-for-the-technical-reader)**
[What we learned about the platform](#what-we-learned-about-the-platform) ·
[What we learned about email clients](#what-we-learned-about-email-clients) ·
[Designing the editor controls](#designing-the-editor-controls) ·
[How we learned to work](#how-we-learned-to-work)

**[Part 3: Where it stands, and what to do next](#part-3-where-it-stands-and-what-to-do-next)**
[What is unfinished today](#what-is-unfinished-today) · [What to do next](#what-to-do-next)

**[Reference](#reference)**
[The hard limits](#the-hard-limits) ·
[The things you must never do](#the-things-you-must-never-do) ·
[Where the rules live now](#where-the-rules-live-now) · [Glossary](#glossary)

---

# Part 1: For everyone

## The problem we set out to solve

Engaging Networks lets an editor assemble an email from reusable **blocks** (a
hero, a story card, a footer) and customize each one through fields shown
beside it. Engaging Networks calls those fields Replacements, and this document
uses the plain word except where the platform's own label matters. Two things
make that harder than it sounds.

**Email is fragile.** Every mail client renders the same code differently, and
the differences are not cosmetic. Outlook on Windows uses Microsoft Word as its
rendering engine and ignores whole categories of modern styling. The Gmail app
rewrites colors on its own. Apple Mail, Outlook.com and Gmail's web client each
support a different subset of dark-mode techniques. A design that looks correct
in a browser can be unreadable in an inbox.

**Free-text fields break layouts.** The moment an editor can type any number
into any field, typography drifts, spacing goes off-grid and colors leave the
brand palette. Not through carelessness. Through the ordinary act of filling
in a box that accepts anything.

## What got built

**A template library.** Emails are authored in MJML (Mailjet Markup Language),
a shorthand that compiles into the nested tables email actually requires.
Rather than one-off emails we maintain a catalog of blocks, each a complete
design with mobile stacking, dark-mode behavior and Outlook workarounds already
built in. The catalog *is* the master template: one file, 60 blocks, 56 of them
shipping into the platform. Beside it sit two donation thank-you autoresponders
built on the same stylesheet, and a one-block holding pen for anything with an
unresolved defect.

**A converter.** A private, browser-only tool. Point it at the template on
GitHub and it compiles the MJML, splits it into blocks, reads the design intent
the template declares about itself, and writes exactly what the platform
imports: blocks named, filed into folders, with rendered thumbnails, and every
editable property already turned into a typed field.

**Two written contracts.** One defines exactly how the converter behaves; the
other carries everything we measured about the platform and about email
clients. Both are mirrored publicly so anyone (human or artificial) working in
a template repository can read them without access to the private code.

## The timeline, in seven phases

Two repositories, 751 commits, about 3 months.

**Phase 1: bootstrap and rebrand.** The template started life as another
client's design and got re-skinned. The early commits were terse and
hand-built: *"create more blocks"*, *"dark mode improvements"*.

**Phase 2: from a mockup to a library.** The catalog became a system. We added
a naming grammar, categories, and a debug overlay that let anyone run quality
assurance (QA) on the whole library in a browser without reading code. The
converter started here.

**Phase 3: the contract arrives.** The template began declaring its own
expectations in a machine-readable comment: its spacing scale, its width
options, later its brand palette. The converter read them. We wrote the
conventions document and mirrored it publicly. This is where the two projects
stopped being two projects.

**Phase 4: the measured-behavior era.** The tone changed completely. Commits
stopped asserting things about the platform and started measuring them. We
built **probes**, small emails whose only job is to test one set of claims
through a real send, and read the results in every email app the rendering
service covers. Most of the durable knowledge in this project came out of
these 10 days. Several confident beliefs did not survive them.

**Phase 5: industrialization.** We turned everything learned into something
automatic: build-time checks that scan for known mistakes, pixel-level audits,
content versioning, byte budgets. 127 converter commits landed in 4 days, and
the system went live in the client's account.

**Phase 6: one catalog, and the names editors read.** Two catalog files became
one master template. We pruned the duplicate to its unique leftovers and then
deleted it, and the master took on what was worth keeping while shedding demos
its own dropdowns already reproduced. Renames swept the catalog toward the
names a content editor actually reads. Every panel label that said "Section"
now says "Row", which is the word an editor is looking at, across 438 merge
tags. The client manual had drifted a whole catalog generation, so we
regenerated it from the import pipeline itself and it cannot drift again.

**Phase 7: governance, and the email that says what it is.** We merged 17 pull
requests in 4 days. On one afternoon two branches picked the same version
number and both were right, which is what forced the process work: a written
spec for every subsystem, a reviewer protocol, and the repo's first continuous
integration. Four gates, one of which refuses a change whose owning spec did
not move with it. Meanwhile the template took a single brand type scale, and
the content baseline made a full round trip, widened and then ruled back 4 days
later. Two features landed that the catalog had wanted from the start. One is a
dropdown that recolors every link in a block, its options read out of the
stylesheet rather than configured. The other is a hidden name-and-version band
on every block, invisible in the inbox and revealed inside the builder by
adding a debug block, so an editor can finally see which vintage of which block
they have.

## The five things we'd tell another team

1. **Measure the delivered email, never the build.** What your compiler
   produces is a hypothesis. The platform rewrites it on the way out, and
   clients rewrite it again on the way in. More than one "obvious" root cause
   in this project died the moment we looked at what actually arrived in an
   inbox.

2. **Give editors bounded choices, not blank boxes.** Nearly every generated
   field is a dropdown of vetted options. There is deliberately no free-text
   spacing field anywhere in the system. Editors can adjust breathing room;
   they cannot push the layout off its grid, because no field exists that
   could.

3. **The element above owns the gap below it.** All vertical space lives on
   bottom margins, on a closed named scale. If A owns the gap below it, then
   A+B and A+C both look right. If B owns the gap above it, every new pairing
   is a new bug.

4. **Never ship a control that does nothing.** A dropdown whose options change
   nothing teaches an editor that the controls are decorative. We render every
   option of every dropdown and compare the pixels, so "this control does
   nothing" is a measurement rather than an opinion.

5. **Write the rule down where a machine can check it.** A convention that
   lives only in someone's head, or in a chat log, is already lost. The same
   stale flag was found and removed, came back through a file rename and a
   well-meaning fix, and was found again, because the rule against it was
   prose. It stopped recurring the day it became a build check.

## By the numbers

Each figure names its owner: **TPL** (the template library, this repo), the
**converter** (the private app that turns one into the other), or **both**.

| | | Project |
| :-- | :-- | :-- |
| Project span | About three months | Both |
| Commits | 751 (387 template, 364 converter) | Both |
| The catalog | One master template, 60 blocks in 9 categories, plus a one-block holding pen for a block under repair | TPL |
| Blocks shipped into the platform | 56, carrying 1,340 generated editable fields | Both |
| Autoresponders | 2 donation thank-yous, 7 blocks each | TPL |
| The converter itself | ~25,800 lines of production code, 924 automated tests, **zero backend** | Converter |
| Published contracts | 2 documents, ~5,800 lines, mirrored publicly and byte-identical to their source | Both |
| Version ledger | 76 versioned template artifacts, each carrying an integer version derived from its own content | Both |
| Probe instruments built and archived | 26, each with its verdict recorded | Both |
| Email-client render rounds reviewed | 8 rounds in one QA session alone, 120 individual renders; a later round read 33 renders across 17 clients | TPL |
| Editor controls proven live or dead by pixel comparison | 1,003 dropdowns in the most recent full sweep: 999 pass, 4 fail, every failure since closed. Separately, all 434 spacing fields proven to change the layout | Both |
| Dead annotations stripped from the template source | 8,376, after proving that removing every one changed zero Replacements | Both |
| Delivered stylesheet against Gmail's limit | Inside the working target, with room measured in hundreds of bytes rather than thousands. Every figure is in [The hard limits](#the-hard-limits) | Both |
| Automated guards standing | 4 audit engines, a spacing checker, 3 linters, byte budgets at both ends, and four continuous-integration gates over 3 machine-checked contracts | Both |

---

# Part 2: For the technical reader

**How sure we are, and how to tell.** Findings here are stated flatly when a
controlled send settled them, and they say so in the words when they are not.
Three phrases carry weight and are used deliberately: **measured** means a real
send proved it, **modelled** means it follows from a measurement without having
been observed directly, and **unmeasured** means nobody has tested it and the
gap is being recorded rather than guessed at. Where a claim was later
corrected, the correction sits beside it instead of replacing it.

## What we learned about the platform

Marketing Tools is not documented at the level this work required, so
everything below came from controlled sends: a probe email carrying labeled
variants, sent through a real account, with the delivered code fetched and
compared byte-for-byte against what we shipped.

### The stylesheet inliner always runs, and you cannot turn it off

It rewrites your stylesheet onto individual elements as inline styles on every
send. An early version of our own conventions document told agents to disable
it; that was wrong, and the correction is preserved there rather than edited
away.

A fourteen-construct probe produced the verdict table the contracts now carry.
The headlines:

| Construct | What the platform does |
| :-- | :-- |
| A plain rule | Inlined onto the element, rule removed |
| `@media (prefers-color-scheme: dark)` | **Kept verbatim**, so dark mode survives |
| A mobile width media query | Kept, so mobile rules survive |
| The Outlook.com dark-mode hook at top level | **Dropped**. That branch is lost |
| The same hook nested inside a conditional media query | **Kept**. This is the rescue |
| A rule carrying `!important` | Inlined, and **the `!important` is stripped**. Only on this path: see the two-path warning in [Nine more platform behaviors](#nine-more-platform-behaviors-including-two-you-must-never-do) |
| A rule matching nothing | Pruned |
| An Outlook-only conditional comment | Kept intact |

**The operative rule: a media query, a rule that only applies under a stated
condition such as a screen width, is the platform's "do not touch" wrapper.**
Anything that must survive as a rule rather than an inline style goes inside
one. Two corollaries bit us later. A media-query rule that must beat a base
rule needs its own `!important`, and any `!important` you wrote on an inlinable
rule is gone by the time it lands.

Timing matters as much as behavior. This is a **send-time** transform: the
stored template keeps your source verbatim, so an export round-trips what you
wrote. **An export proves nothing about what a recipient gets.**

### The editor escapes one character, and half your dark mode dies

**Never author a child combinator, the `>` in a selector, in any stylesheet
that ships inside a block.** The editor escapes that character, the rule dies
silently, and because dark-mode rules come in pairs you lose half of every pair
and keep the other half. The maintained rule is guide §2d.

This was the flagship finding and the most damaging. A block that had been
through the editor shipped with `>` rewritten as its
escaped form inside a stylesheet. A stylesheet's contents are never decoded as
markup, so that escape is never turned back: it stays 4 literal characters, the
selector becomes invalid, and the client discards the rule silently.

What made it so hard to see is the damage pattern. Dark-mode rules come in
pairs. One sets the text color, and it matches anything inside the block, so it
survived. Its partner repaints the background, and it uses the `>` character to
match only a direct child, so it died. Half
of each pair lived. The result was **white text on a white panel**, and on iOS
Mail, entire blocks rendering blank.

**It took 4 wrong explanations to get there.** We thought Gmail was stripping
body stylesheets, and a probe disproved it. We thought the dark-mode pairs were
authoring bugs; they were correct as written. We thought the platform escaped
the character at send time; it only does it on an editor edit. We thought
Outlook for Mac was simply broken, and clean code renders there perfectly. Four
confident diagnoses, and we had not tested one of them against a real send.

Four controlled sends finally pinned it: **the trigger is an edit.** Import,
send, and an untouched open-and-save round trip are all clean and
byte-identical. The escape only persists for a field that was actually modified
and resubmitted.

Two measurement traps cost us a full send round each, and both apply to any
investigation like this. **The platform prunes rules that match nothing**, so a
canary rule, one planted purely so we can check whether it survived, vanishes
when it is aimed at a class that does not exist, and that reads as a pass. And
**a plain rule gets inlined**, which dissolves the very selector you were
trying to inspect.

Our fix shipped: the stylesheet was rewritten to contain zero child
combinators, with measured stand-ins. Theirs is written and not yet submitted:
a vendor bug report with an importable proof of concept.

### The stylesheet reprinter is string-blind

**No literal `;`, `{` or `}` may reach the platform inside a quoted string.**

Every stylesheet is reprinted at send, and the reprinter ends a declaration at
the next semicolon, including one sitting inside a quoted string. A debug
label reading *"…shows block versions; remove before send"* was split there,
the remainder discarded, and the stylesheet shipped with a quote that never
closes.

What each client does with that is where the damage diverges. A well-behaved
parser recovers at the newline and loses one declaration; iOS Mail did exactly
that. **Gmail discarded the entire stylesheet**, every media query with it, so
a button row that should stack on phones rendered as touching pills.

The delivered stylesheet was comfortably under every size limit, which is what
makes this the counterpart to
[Gmail drops the stylesheet by size](#gmail-drops-the-stylesheet-by-size-and-it-drops-it-whole):
the same symptom, a completely different cause. We had spent a month building a
mental model where a dropped Gmail stylesheet means *too many bytes*, and that model cannot see this failure at all. The symptom looked like
size. The cause was syntax.

We nearly blamed the wrong thing, too. The block-band rules shipping alongside
that label use a modern selector of exactly the kind Gmail's filter on incoming
mail might reject.
What cleared them was an earlier send carrying the same selector, with balanced
quotes, that Gmail had been perfectly happy with. **When two suspects both fit,
look for the send where the plausible one was present and nothing broke.**

Fixed in two layers: the label lost its semicolon, and the code that emits
every label now escapes those three characters so no future label can
re-trigger it. Colons and commas inside strings remain **unmeasured**. The
platform rewrites both elsewhere, nothing we ship uses them, and the record
says so rather than guessing.

### Documentation text gets read as markup

**Never put a tag-like sequence inside a stylesheet, comments included.** Twice
in 3 days, a comment written for humans was parsed as code, and both times it
took down the whole import.

The first killed every import, with a misleading *"malformed template"* error.
A comment in the stylesheet contained the literal token `<style>` inside the
sentence "Gmail app drops `<style>`". The importer inlines that stylesheet
before parsing, and the parser treats the opener as the start of a raw-text
element, swallowing the rest of the document, body included. It reached
production because the command-line build never takes that path.

The second was the same trap one level up. A comment documenting the
platform's container rule spelled the container placeholder out literally. The
importer splits the template shell on the first occurrence of that placeholder,
so the split landed *inside the comment*. The head was truncated mid-comment,
the comment lost its terminator, and it swallowed the entire stylesheet. Light
and dark image pairs both rendered; previews carried no styling at all.

Both are now build assertions: no tag-like sequence anywhere in a stylesheet,
comments included, and a dedicated guard on the container placeholder.

### The rich-text editor rewrites your markup on the first keystroke

The Content field is a rich-text editor, and it normalizes whatever you give
it. Measured with paired blocks from a single import: one copy got a null edit
in every field (click in, type a character, delete it, save) and its
never-opened twin was left alone, so any difference could only have come from
the editor.

| What you author | What the editor leaves |
| :-- | :-- |
| Bare copy, or a lone span | Wrapped in one paragraph; spans and classes survive |
| A span styling weight and color | Re-expressed as its own markup, color rewritten |
| An inline element with a property the editor has no equivalent for | **That property is dropped** |
| A paragraph that is already there | **Unchanged. Running the editor over it again changes nothing** |
| A link with several attributes | **Address and target kept; everything else discarded** |
| An Outlook-only conditional comment | **Destroyed** |

Three things follow. The injected paragraph carries no inline style, so the
stylesheet's paragraph rule wins and a caption authored at 10px ships at 16.
Because running the editor over its own output changes nothing, the fix is to
apply that output ourselves up front. The converter now wraps values at
generation time so the editor's first edit
changes nothing, verified pixel-identical to the unwrapped rendering. And the
predictive model is **node versus mark**: the editor rebuilds a link from a
fixed attribute set but leaves paragraphs and spans alone, so a link inside
rich-text content can only be styled from an ancestor class. The catalog now
holds zero styled links, down from 54.

### Template edits do not reach emails that already exist

A template code change does not propagate into drafts built from it. Any email
using that template must be rebuilt from scratch. There is no way to update it
in place like you can with page templates and the pages that use them.

This one limitation is the entire reason the **Template Styles block** exists.
Styling is the part of a template that most often needs a fix after the fact,
so we ship the stylesheet as a *block* instead. A styling fix becomes a block
swap rather than an email rebuild.

### Nine more platform behaviors, including two you must never do

- **One value, several carriers.** A single authored background image compiles
  into 4 separate places in the output. Miss any one and some clients show
  the new photo while the rest show the old one. This cost a full QA round.
- **The platform rebuilds a table's background shorthand** and drops the image
  from it. The leftover shorthand then *resets* the background, overriding the
  fallback attributes too. A full-width section has no other carrier, so it
  renders blank in Gmail, Apple Mail and iOS. **Never author a full-width
  section with a background image here.**
- **Media queries with identical conditions merge into the first one's
  position**, so any cascade depending on source order is silently inverted.
  Matching is textual, so two conditions that differ by a space do not merge.
  The fold also reaches **across documents**, and its order is the reverse of
  what we assumed: a stylesheet arriving in the message body merges *ahead of*
  the template's own. Our viewport fork had been designed on the opposite
  belief, so its reveal folded up past its own hide and lost everywhere below
  the breakpoint, latent only, because no shipped block used it. Two lessons
  rode along: an order-dependent condition must be unique across *every*
  stylesheet in the email, and **a probe that blesses such an arrangement has
  to include the body stylesheet in the send.** The probe that blessed the old
  arrangement did not, which is the one case the fold cannot reach.
- **Comma-separated selector groups are split into individual rules**, so one
  authored group can end up half-alive.
- **The inliner has two paths, and only one strips `!important`.** This is the
  exception to the table in [The stylesheet inliner always runs](#the-stylesheet-inliner-always-runs-and-you-cannot-turn-it-off),
  and it is the easiest thing here to get wrong. A rule
  arriving through the template head is inlined with its `!important` removed;
  a stylesheet carried in the message body is inlined with `!important` intact.
  Word rejects any inline declaration carrying it, so those declarations vanish
  there while every other client honors them, and honors them so hard they
  outrank dark-mode forcing. An inlined `!important` is a **Word-only outage
  switch that looks correct in every preview you are likely to check**: in the
  probe that found it, Outlook reverted the text and dropped every link to
  default blue, because their only color was in the dropped declaration.
- **Stylesheets are reprinted at send at about 1.3× their compacted size**, so
  the number to budget is the delivered size, never the authored one.
- **A stylesheet is ingested once per wrapper.** A doubled wrapper delivered
  two full copies, pushing a send over Gmail's cliff; removing it halved the
  delivered size.
- **A save is rejected once the rendered message passes about 300,000 bytes**,
  and the builder paints "Invalid or missing authentication token" over it
  while the real response says the message is too long. We budget to a working
  ceiling below that and meter every template against it as an advisory rather
  than an error, since a catalog template is expected to exceed a sending
  budget. Two caveats belong with the number. **Which sending surface it was
  measured through is not in the record.** The bisection ran against one
  endpoint, prompted by an automation email refusing to save at a size a
  broadcast accepted, and was never re-run per surface. And an email using
  every block no longer fits one message at all; the catalog now goes to the
  rendering service as a **two-part paste**. A real email built from a handful
  of blocks is nowhere near any of this.
- **Authoring comments in the template head never ship**, because the importer
  strips them at import. Head documentation is therefore free, and should be as
  thorough as it deserves.
- **The platform injects its own preheader**, the preview snippet an inbox
  shows under the subject line, from each email's preview-text setting, so a
  template-baked one doubles up in inbox snippets. We built and shipped a
  preheader field before testing that assumption, and reverted it the same day
  a send disproved it.
- **Sends read block content live**, not from a build-time snapshot, which
  means a storage-versus-delivery comparison needs no rebuild to be valid.
- **Field nesting resolves recursively**, measured 3 levels deep in a real
  send, and the same block added twice keeps independent selections per copy.

## What we learned about email clients

### Gmail drops the stylesheet by size, and it drops it whole

**The cliff sits at 16,384 bytes, and it is all-or-nothing.** A real send
delivering about 28,000 bytes of stylesheet had the entire thing ignored,
including mobile rules sitting well before any truncation point. A 715-byte
probe kept everything. It is not mobile-only: Gmail's desktop webmail showed
the identical pair, because every Gmail surface shares the same filter.

Two consequences are permanent. We **budget the delivered stylesheet, not the
authored one**, with a build check that holds every page under both a working
target and the cliff. And the deeper armor is an inline-first doctrine: the
no-stylesheet rendering of every element should already be the correct *mobile*
rendering, so a dropped stylesheet degrades rather than breaks.

The working target under that cliff is a number I picked rather than derived,
and it says so. The advisory band under a hard limit is arbitrary anyway, and a
figure somebody chose is more honest than a round one that looks calculated.
The guard carries a comment saying exactly that, so no later tidying pass
"normalizes" it away.

Two caveats belong with the whole budget, and the numbers behind them are in
[The hard limits](#the-hard-limits) rather than repeated here. The largest
delivered stylesheet we have ever **measured** green is under the target, so
everything between there and the cliff is modelled, not observed. And **size is
not the only way to lose the stylesheet** (see
[The stylesheet reprinter is string-blind](#the-stylesheet-reprinter-is-string-blind)).
Gmail discarded one at roughly
three-quarters of the budget for a stray semicolon inside a quoted string,
which no byte budget could ever catch. These budgets are necessary and they are
not sufficient.

### Dark mode reaches most clients, and two important ones not at all

**Only two dark-mode hooks survive the platform:** the standard preference
query, and the Outlook.com hook nested inside a conditional media query. Every
other technique is stripped before the email is delivered.

What each client does with what arrives:

| Client | Honors a dark hook | What it does on its own | What that means for you |
| :-- | :-- | :-- | :-- |
| Apple Mail | Yes, preference query | Nothing uninvited | Your dark styling is obeyed as written, including your mistakes |
| Outlook.com | Yes, via the nested hook | Nothing uninvited | Same, and the hook must be nested or it is dropped |
| iOS Mail | Yes, preference query | Nothing uninvited | Same |
| **Gmail app, Android** | **No** | **Darkens light designs** | You cannot reach it. Design so its automatic transform lands somewhere legible |
| **Outlook on Windows** | **No** | **Darkens light designs and inverts dark ones** | A black footer flips to white while its light logo and white icons stay put |

The two that expose no hook transform in opposite directions, which is why a
design that survives one can fail the other. Background-color attributes buy no
protection: a panel colored with an attribute inverts identically to one
colored with a stylesheet.

**Images are never recolored by either client. That is both the failure mode
and the defense.** The accepted end state for Outlook desktop is to let it
invert and make the artwork survive the inversion, which produced a scripted
treatment adding an opposite-polarity rim to every transparent image whose ink
depends on its background.

Two measured surprises belong together. First, **a mercy**: an authored light
ground with no dark hook at all rendered dark and legible in all five
dark-capable clients we tested. The white-on-white failure predicted from the
local build never reached an inbox. Dark-mode claims must be measured on
delivered code, never on the compiled build. Second, **the mercy's hard
limit**: our own dark rule painted an opaque black lid over every
background-photo hero in Apple Mail and Outlook.com. Clients rescue what the
platform delivers, but they honor *your* dark styling as intent.

Dark mode is also a second lighting condition that exposes defects nothing else
will, and two of ours were invisible until we looked at a dark render.

A hero heading grew a black slab behind it on every client that swaps. The
heading still carried the class of a panel deleted days earlier, and of
everything that class once did, exactly one declaration survived: a dark-mode
repaint to black. **Deleting a component is not deleting its class**, and a
class with one surviving declaration is a component that exists in only one
lighting condition.

The other was a white lowercase "s" floating beside an arrow icon on four
clients. It is in the pixels. The asset had been cropped out of a design
composite and carried a letter of the neighbouring text with it, and had been
invisible for 7 weeks because the catalog is light and white on white shows
nothing. The delivered code greps perfectly clean. **Some defects are not in
any text you can search.**

### Outlook's Word engine, and what we chose to accept

Outlook on Windows renders with Microsoft Word, which ignores whole categories
of modern styling. Everything below is measured, and most of it we accepted
rather than fought.

| If you author this | Word does this | So we |
| :-- | :-- | :-- |
| Rounded corners on a button | Ignores them. Every button renders square | Accept it as graceful degradation. The legacy drawing-format workaround breaks the converter's field bindings and bloats every block |
| Width, height or inline-block on an inline element | Ignores all three | Never carry box geometry on an inline element |
| A zero line-height | Honors it literally. The button becomes a thin bar with invisible label text | Never set it. Correct in every browser, fatal here |
| A background color and a background image on the same section | Paints the color and drops the photo. Correct on Outlook for *Mac*, which is why it looked inconsistent for so long | Move the fallback color to a wrapper *behind* the section. This relocates the fallback; dropping it would trade a flat slab for text on nothing. Guarded by a build check |
| Horizontal padding inside the shape Word uses for background sections | Ignores it, at every size we tested | Use fixed-width spacer columns instead |
| A stale frozen width on the hidden table Outlook draws per column | Squeezes it down to fit its cell | Nothing. It is not a defect, and we shipped a fix for it anyway (below) |
| That hidden table rewritten to full width | Shrinks it to fit its text | Never do this. It was our fix, and it was the regression |
| White copy with no explicit background behind it, in dark mode | Flips it to near-black, which over a dark photo is near-invisible | Accept it. No scrims, no panels, no slabs behind text over photography |
| A bare email address | Auto-links it and paints it default blue | Author the link yourself. On a dark footer the default is near-illegible |

Two of those cost us something worth recording.

**The padding one is easy to ship because nothing looks wrong anywhere you
preview.** Four blocks had quietly drifted to the padding shape and were
rendering flush in Outlook; one of them carried a comment saying not to, while
the markup under it had drifted anyway. The fix cost 8 editor fields, all of
them controls Outlook was ignoring.

**The width one we got backwards in both halves.** A geometry audit concluded
that widening a gutter would overflow Outlook wherever the compiler had frozen
a stale pixel width into that hidden table, so a fix shipped: rewrite the table
to full width. A probe built and sent the same morning refuted both halves,
with two Outlooks agreeing to the pixel. Word squeezes a stale width down to
its cell, so the defect did not exist, and full width makes Word shrink the
table to its text, so the fix was the regression. Reverted 7 hours after it
shipped. Both geometry scanners now clamp the way Word does; without that they
would report an overflow Outlook never has and strip padding options from 57
frames for nothing.

**The dark-mode ruling is a decision, not a limitation we failed to solve.**
Text over an image is a contrast risk the client decides to take, image by
image. The template ships the raw layout and documents the risk rather than
making that choice silently. Pinning white inline is not a fix either: inline
white is precisely what Word's dark mode flips.

### Diagnose gutters before restructuring columns

**Before you conclude a mobile client is breaking your columns, add up the
gutters.** Ours accounted for the entire apparent defect, and the fix that
would have followed from the other theory was a catalog-wide restructure.

A QA round read the Gmail Android app as shrinking two-column story cards, and
the proposed fix was exactly that restructure. Four probe rounds disproved it:
**there is no column-shrink bug.**

The phone reports 1080 device pixels at a 3× ratio, so Gmail lays out at
roughly 333 layout pixels, and a card loses 80 of them, a quarter of its
width, to the built-in side padding between content and the edge of its
container. The gutter model predicted the measured width to within 2 pixels;
the competing restructure theory missed by nearly 18. The shipped fix took
mobile imagery flush to the edge and left the desktop rendering byte-identical.

The expensive fix was the wrong one, and only measurement separated them.

The same geometry bit again from the other side. A block that *groups* its
columns never stacks them on mobile: every column becomes a percentage, so a
narrow fixed-pixel icon column shrinks with the screen while the fixed padding
inside it does not. Two identically authored badges had been rendering at 45
and 29 pixels wide on phones for 7 weeks, and the rows carrying a single
icon never looked broken because there was no sibling to compare against. The
fix is a mobile width pin on every such column, and the rule is a build guard
rather than a guideline, with two carve-outs measured in so it stays quiet: a
wide column that *is* the row is supposed to shrink, and a spacer column holds
nothing that can.

## Designing the editor controls

Every opinion below was an explicit decision rather than an implementation
accident.

### What kind of control to offer

- **Free numbers are the exception.** Editors pick named options. The
  sanctioned free-number fields are a short list: image and divider width,
  font size, line height, letter spacing, corner radius. Spacing, padding and
  height never appear as free text.

- **A closed spacing scale.** None / Half / Single / Double / Triple, with the
  pixel value in the label. Off-grid authored values snap to the nearest step,
  ties rounding up, with the original preserved so deleting the field restores
  the source exactly. There is deliberately no per-field "Original" escape
  hatch, because an escape hatch is how a scale stops being a scale.

- **Bottom-only pacing.** Columns never carry bottom padding. One exception
  proves the rule: a caption owns the gap *above* itself, so hiding the caption
  removes the gap with it instead of stranding white space under the photo.

- **A geometry guard.** Padding above a declared threshold is design geometry,
  not pacing, and gets no field at all, never a free-text fallback. Exceptions
  stay bounded: a class-scoped scale can raise its own threshold, which is how
  a locked hero-photo reserve became a curated dropdown on its own ladder.

- **Colors are always dropdowns.** Every color the template authors is
  collected into a brand palette, grouped by role, ordered perceptually and
  named. Editors do not type color codes, so off-brand colors cannot creep in
  through everyday edits. One documented exception: compound border values stay
  plain text, because a compound value cannot be a dropdown.

- **Alt text is always editable** on every image, empty alt included. Real
  copy for meaningful images, empty for decorative art, never a label that
  narrates chrome to a screen reader.

### When to offer no control at all

- **Growing a gutter can never break the layout.** The compiler freezes a
  block's geometry: fixed-pixel columns, images sized to their columns, widths
  derived from a section's padding. Widen a gutter past the point where that
  frozen geometry still fits and the row wraps in every client. The converter
  re-checks the whole geometry once per candidate value and never offers an
  option the layout cannot take; where only the authored value survives, no
  field is created. The build counts the cost rather than describing it: 44 of
  170 padding-owning frames cannot take the full scale. An author can also
  *declare* a ceiling the scan cannot see. A row of fixed-width buttons
  written inside a text block is frozen exactly like a fixed column, and
  nothing measuring the compiled output will ever know it.

- **Inert controls are suppressed, and the suppression explains itself.** Where
  a field would do nothing, none is generated and a note records why. These are
  informational rather than warnings, because the source is correct as written.

- **Only structure earns an inertness label.** A control that moves nothing
  because the placeholder copy is short is not inert. The first long headline
  an editor types brings it alive. The audit renders three copy states per
  control (as authored, one line, wrapped onto several lines) and calls it live if
  any of them moves pixels. This was learned the hard way: four of five
  controls an early sweep called dead were live the moment copy got longer than
  the placeholder. A centered heading's padding cannot move short copy at all,
  because shrinking a box equally from both sides leaves its centre exactly
  where it was. With a full sentence it re-wraps and everything moves.

- **Inert also means inert under every arrangement the block offers.** The
  sweep tests each control against every *other* field's default, so a control
  that the default layout pins reads dead even when an alternate layout revives
  it. That mis-called five rows as dead controls. The engine now re-sweeps a
  would-be-inert control under each value of its row's arrangement dropdown and
  names the layout that revives it. The tempting alternative was a fifth
  standing exemption; measuring it was the better answer, and the exemption
  list stayed at four.

- **A guard that cannot be sure fails closed.** The image-alignment guard
  computed a mobile width that is only sound under some layouts, and where it
  was unsound it had been guessing, and labelling a live control as
  desktop-only. It now detects its own unsoundness and stops: it either keeps
  the control with a plain, unqualified label or suppresses it, but never ships
  a qualifier it cannot justify. **A wrong label is worse than a missing one,
  because an editor believes it.**

- **"Failed" has to mean every failure.** The audit's failures-only export
  originally meant *dead at both viewports*, which quietly excluded a control
  that works but is mislabelled, and one whose verdict could not be
  established. Both are failures an operator needs to see. One rule now backs
  the badge, the filter and the export, so the three cannot disagree.

- **Prune to a control that exists, not one that ought to.** Two demo blocks
  were deleted as redundant on the premise that alignment was already a
  dropdown. It was not. That row's alignment lived in hand-authored markup the
  converter never read, which is precisely why the demos existed. Restored 25
  minutes later, and re-pruned deliberately the next day once the dropdown
  actually existed.

### Naming and ordering

- **Labels lead; machine names follow.** A reversal. The original contract kept
  machine names stable while labels moved, and the two vocabularies drifted
  apart. Names now follow labels through one shared resolver, at the cost of a
  catalog-wide rename, so the panel and the tags can no longer disagree.

- **The panel speaks the editor's language.** What the markup language calls a
  section, an editor sees as a row of the block, so every label and tag that
  said "Section" now says "Row", across 438 merge tags.

  The same rule reaches the option level, and getting it wrong shipped. A story
  card offered an image-position field where picking "Left" put the image on
  the right. The row lays its columns out right-to-left, so the first authored
  column renders on the *right*. Option labels now derive from where the image
  actually lands. The build's geometry guard turned out to share the identical
  blind spot. It only matched left-to-right rows, so both reversed cards were
  structurally invisible to it. **A belief travels further than the code it was
  written in.**

- **Display is always first** in its group, because it decides whether the rest
  of the group matters at all. Field order runs Visibility → Primary content →
  Appearance → Dimensions → Position → Spacing.

### The dropdowns that carry a whole layout

- **One dropdown can hold whole layouts.** Hiding an image can never widen its
  partner: the column, the hidden cell Outlook draws for it, and the sibling's
  width all stay
  behind, leaving a hole rather than a full-width heading. So a row that wants
  a "no image, text full width" state authors that arrangement as a hidden
  sibling, and the converter folds it into the row's dropdown as one more
  option.

  The contracts claimed in four places that letting the two copies drift apart
  "fails loudly." It did not. One changed letter unpairs them, the alternate
  renders as its own row, the block ships its content twice, and every field
  after it renumbers, silently rebinding any email already built on that
  block. The response was an informational note. **A claim repeated in five
  places is not five pieces of evidence**; it is one unverified sentence with
  four copies. A real build check replaced it.

- **A control can be discovered rather than configured.** Link Color gives
  every block one dropdown that recolors all of its links at once, and nothing
  lists its options: the converter reads the stylesheet, and any rule of the
  right shape becomes an option. Adding a color to the palette adds it to fifty
  dropdowns and nobody edits a list. Two rules came out of building it: a link
  with no text in it is not eligible, because recoloring glyphless content
  moves no pixels; and there is deliberately no hook for the default color,
  because a render-identical duplicate option is exactly what the inert audit
  exists to flag.

- **An annotation only the importer reads is invisible to everything else.**
  Alternate layouts are marked with an attribute the compiler drops, so the
  build rendered every alternate as an ordinary extra section, six of them,
  and every preview page had been showing rows twice. Alternates are now
  dropped before compiling, deliberately *after* the raw source is captured for
  the debug overlay, which needs both.

- **When you must fail, fail into the mode something already watches.** A
  light/dark image pair folds to a single key, so one pinned region reached the
  edit list twice, and applying the same edit twice to one range is not the
  same as applying it once.
  The second re-sliced what the first had already grown, leaving fragments of
  markup visible as ordinary text beside the copy in the inbox. Two things went
  wrong beyond the bug. A verification pass argued the leak was invisible
  because it sat inside a conditional Outlook never parses. Half right, wrong
  conclusion, since that region is exactly what every *non*-Outlook client
  reads. And the reported scope was wrong: "exactly these two blocks" was the
  scope of the visible *symptom*, found by grepping for a rendering artifact.
  Counting tags found five more. The fix now **drops** an overlapping edit
  rather than applying it, because a dropped edit orphans a tag that two
  existing instruments already report, where applying one produces malformed
  markup that reaches the inbox in silence.

### How the template tells the converter what it means

The template annotates itself. A small vocabulary of custom attributes, the
kind browsers and email clients ignore, lets an author tell the converter
things the markup alone cannot say: this block is a deliberate duplicate, this
width is design geometry rather than a choice, these three links are really one
link, this control is dead at both screen sizes so do not offer it.

Three rules govern the vocabulary. Most flags are **valueless**, detected by
presence rather than by reading a value. Getting that backwards is how one
flag sat silently ignored for about a week. Every flag must **earn its place**:
an audit strips each one, regenerates, and compares, so a flag that changes
nothing gets deleted rather than left as folklore. And the vocabulary is a
contract rather than a catalog: a few flags have no live use today and stay
because the contract defines them.

The full table of every attribute, what it does and why, lives in
[MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md) §5, which is the copy that
is maintained.

## How we learned to work

This is the part that generalizes beyond email.

### Write the rule where a machine can check it

**Documents as contracts, checked by a machine.** Two documents are treated as
published contracts rather than internal notes: re-read against the full change
before every commit, and mirrored into a public repository so agents working
elsewhere can fetch them. A linter checks them for drift: dead citations, a
documented default that no longer matches the code, stale "pending" language,
and whether each mirror still matches its source. Its own header says it
plainly: *each assertion below encodes a defect this repo actually shipped.*

**The moment a rule recurs, it becomes a lint.** The same stale annotation was
found and removed, came back through a file rename and a later well-meaning fix
that read its absence as a gap, and was found again, because the rule against
it lived only in prose. It stopped recurring the day it became a build check.
*The rule now lives where prose cannot lose it.*

The same failure showed up three ways, and each one looked like coverage. **A
check can outlive its subject**: one assertion's body died when a file it
compared was deleted, while two documents went on listing it as enforced. **A
check can never have reached its subject**: the naming-grammar lint had never
read the text it existed to check, because that text writes every block name in
backticks and the harvester did not read backticks. Even its two suppression
entries were dead, which made the guard look like it was working. And **a check
can report instead of stopping**: when a block's alternate layout could no
longer be folded, the converter noticed and emitted an *informational note*,
and that block shipped broken for 3 days because an info note is a line in a
panel nobody reads. **An importer note is not a guard.** A check nobody runs
still reads as coverage, which is worse than not having it. One was retired in
place, one repaired, one promoted to a build failure, and the repaired one
caught real drift within the hour.

**If a document must match the code, generate it from the code.** The client
manual is the one document a content editor actually reads, and nothing checked
it: it claimed 64 blocks in 11 folders against a real 51 in 9, kept sections for
23 blocks that no longer existed, and still walked the editor through
configuring the one block known to render broken. Its block reference is now
generated from the real import pipeline, with the hand-written field
descriptions harvested so the editor's vocabulary survives, and a hard stop when
a description is missing, because a blank cell is how a document starts lying
quietly. The generator's first run also caught a blind rename sitting in the
hand-edited part.

The sequel shows exactly how far a generator reaches. The generated reference
has stayed true through a catalog rewrite. Two sentences of hand-written prose
wrapped around it still disagree with it. **The boundary of a generated document
is where the drift moves to.**

**Land a new check after the cleanup, not before.** The rich-text validator was
deliberately built last, after the catalog was migrated. Landing it first would
have put 45 warnings in the export panel on day one, which is how a check gets
ignored rather than acted on. Severity was chosen by whether a workaround
exists, not by how alarming the construct looks.

**Conventions written for AI agents, not only for people.** The authoring
guide's last section is a copy-paste prompt that points an agent in any
template repository at both public mirrors. That is why re-publishing them is a
hard gate: a half-pushed mirror silently hands every downstream agent a stale
contract.

### Measure it, do not argue about it

Where a claim could be measured, we
built something to measure it rather than debate it: an audit that renders
every block, dropdown and option at two screen sizes and compares the pixels; a
check that strips an annotation, regenerates, and compares byte for byte; and a
checker that proves every generated spacing field actually changes the layout,
with a distinct verdict for an option that would *break* the layout rather than
merely change nothing.

The determinism rules matter more than the engines. Caching keys on the exact
input and never on a digest, because a weaker key could collide. A baseline
re-verify bypasses every cache, because a cached witness is not a witness. The
audit self-tests at startup and **refuses to run** if rendering determinism
fails, because a lying matrix is worse than no matrix. Parallelism is a timing
knob and never a verdict knob.

**Probes as instruments, with a lifecycle.** A probe is a small email built to
test one set of claims against a real send. The rule: a probe whose every claim
is measured and recorded is archived **in the session that records its last
verdict**; one still carrying an unverified claim stays put. Archive, never
delete. An annotated probe is the reusable instrument for re-measuring the
platform when its behavior is suspected to have changed. Twenty-six are on the
shelf. One lived a single morning: built, sent, and archived after refuting
both halves of the theory it was built to test.

Two habits made them trustworthy. **Paired never-opened twins**: send the same
block twice, edit one, leave the other alone, so any difference can only have
come from the thing you are testing. And **generate the probe's import file
with the real exporter**; hand-writing it is how an earlier probe imported
silently and produced nothing.

**Suspect the instrument before the subject.** Four times the finding came from
our own tooling rather than from the thing we were measuring.

The rendering service's "view source" page reported about 71 bytes of
stylesheet and no dark-mode rules for a send that had shipped a full one, a
catastrophic, send-blocking finding. That URL returns the service's own
application shell, not the email. Every test reports identical bytes; the tell
was that a known-good send had "lost" exactly the same stylesheet. Separately,
background-image blocks appeared to generate no editable address field, which
read as a generator bug, until we noticed the evidence had been read from the
build variant whose asset paths are already rewritten, so the search matched
nothing. Against the right variant it was eight of eight, and the finding was
retracted in its own commit rather than quietly edited away.

Then there was a speedup that was not one: running the pixel audit eight frames
wide measured over six times faster than one frame, so the default was changed.
The measurement had been taken in a **background tab**, which browsers
throttle. Re-measured on a real foreground tab, eight was marginally *slower*
than one. And a local harness assembled from the platform's own builder markup
showed every block label stacking at the same spot, which looked like a missing
rule we needed to ship; the live builder renders them correctly, and the
harness simply could not load the platform's stylesheet. The rule that came out
of it: **live behavior is authoritative, and a harness that cannot load the
platform's own styling can suggest, never settle.**

**Findings err in both directions.** Six controls a sweep called inert were
live in a browser; a row reporting a control as live was wrong the other way.
The rule became: confirm every claim, whichever way it points, *then* declare.
A checker you only trust in one direction is a checker you have stopped
testing. And a
finding can be a real defect wearing an inert control's clothes. A matched
pair of "dead" controls turned out to be a leftover oversized column
overflowing its section.

**Treat the symptom last.** Space under a footer that an editor could not
remove looked like the footer's bottom padding. Two commits removed it. The
second applied the same change to the second footer "for parity", which
propagated the wrong theory rather than testing it. Both were wrong and both
were reverted. A reading gap had been authored *between* two blocks' comment
markers, and the step that cuts the template into blocks attaches anything
between markers to the block *before* it, so the gap shipped as a white strip
under the first footer and its exclusion flag removed that whole footer from
every export. For 3 days the footer had not been exporting at all, and nobody
noticed because the visible symptom was a strip of white.

### A test that cannot fail is not a test

**A fixture is only real until the shape changes.** A test built from a real
compiled block is the strongest fixture available, and the only kind that
reproduces bugs synthetic fixtures cannot reach. It is also the kind that rots
silently. A row was ungrouped so it would stack on mobile, and the fixture
captured from its grouped shape went on passing, asserting that a layout fold
worked on a structure the catalog no longer had. Meanwhile the real block
shipped its copy twice into the platform for 3 days. **A stale fixture is
worse than no test: it does not merely fail to catch the regression, it stands
in front of it**, because green now means "the shape you no longer ship still
works." Fixtures captured from a block are regenerated in the session that
block changes.

**A green test only counts if it was red on the broken code.** Twice in one
push: a stray character shipped inside a dropdown option and the unit test
written for the fix passed with and without it, and a regression test for a
field-generation bug passed against the unfixed code. Both had synthetic
fixtures that never exercised the failing path. One fix keeps its edit regions
strictly disjoint; the test that proved nothing was deleted rather than banked,
with the coverage gap recorded outright.

**Assert structure, not substrings.** Stripping comments out of one stylesheet
looked like a local change. The code measured its cut points against a
shortened copy of the document while slicing the original, so the last stretch
of the head survived twice, carrying a second closing tag that ended the next
stylesheet early and dumped its tail into the body of every preview as visible
text. Fifteen minutes to fix. The regression test now asserts document
*structure* (one closing head tag, balanced style tags, one copy of the rule),
which is exactly what a substring check let through.

### Version by content, with git as the ledger

**Versioning anchored to content, with git as the ledger.** Every block,
partial, template and the app carries an integer version derived from a content
fingerprint, with the baseline being the manifest as last committed, so
rebuilding never double-bumps and local iteration cannot inflate a number.
Versions track what was edited, not what was affected: a stylesheet change that
alters how every block renders bumps only the template. Renames carry a stated
cost, since a renamed block is a new block in the platform and restarts at
version one.

That scheme had a quiet bug in it. Two version labels, one for the template and
one for the stylesheet, exist so an editor can see *which* of the two
changed. They could not: each entity's fingerprint included the
other's content, so across four consecutive commits they moved in lockstep.
**A signal that never disagrees with another signal is not two signals.**

### What breaks when several people work at once

**Governance, once there were too many hands.** When the work started running
in parallel (several sessions a day, landing in both repositories) the
informal model started to cost. Two branches minted the same version number on
one afternoon, each of them correctly, from a shared baseline. So the converter
took on a spec layer: a written spec for every subsystem, reverse-engineered
from the code it already had, an independent reviewer protocol, and the
repository's first continuous integration. Four things it enforces are worth
naming, because each encodes a specific way this project had gone wrong:

- A change to a governed source file must move its owning spec, or say in the
  commit why not. That gate fired correctly within a day, on a change that had
  altered what a control *means* without touching the document defining it.
- A change to source must move a test, or say why not.
- Every machine-checked contract re-runs on each push, not only on review.
- **Existing contracts are absorbed by reference and never paraphrased**,
  because a paraphrase is a second source of truth and no linter polices the
  copy.

Two lanes, not one: anything that changes behavior goes through a branch, a
review and an explicit merge, while chores like re-publishing a mirror go
direct. The standing instruction is that when in doubt it is not a chore. And
the version script stopped being a victim of the parallelism and became its
referee. It now derives its baseline from every reachable parent, so two
branches that both bumped honestly get reconciled by the tool rather than by
hand.

**Git discipline, written down after it bit us.** Parallel sessions land commits
in both repositories many times a day, so: fetch and fast-forward both before
starting, never run a branch-switching command inside a script, and verify after
every push that the shared repository's latest commit equals your local one.
That last clause exists because a commit that had been "pushed" returned a 404.
A stray checkout inside a scripted command had detached the branch pointer; the
next commit landed off-branch, and the push exited with a success code while
doing nothing, because it pushed the stale local copy. **A push that prints
nothing and exits zero is not proof.**

**A local pass proves nothing about a clean install.** Every command-line
instrument ran fine locally and crashed on a fresh checkout, because a package
absent from the lockfile happened to be sitting in a parent directory that the
working copy resolves upward into. It took the brand-new continuous integration
to see it, and the first fix was the wrong theory, aimed at a layer that never
read the setting, and "verified" against the same contaminated local resolution
that had hidden the problem in the first place. **An environment that hides a
bug will also validate the wrong fix for it.**

**An undo is not a revert.** The content baseline was widened across the whole
catalog and then ruled back four days later. What made the reversal safe was
re-deriving every measurement from the *current* tree rather than restoring the
previous numbers. Several had changed in between for unrelated reasons, and
restoring them would have quietly reinstated decisions nobody had revisited.

# Part 3: Where it stands, and what to do next

## What is unfinished today

Shipped and in use: the block catalog, the converter, the two contracts, four
audit engines, three linters, content-fingerprint versioning, a client-facing
manual whose block reference is generated from the import pipeline, and a spec
layer with four continuous-integration gates standing over it.

Open threads, recorded rather than resolved. **Three of them block go-live and
are marked BLOCKER**; the rest are research the work can proceed without.

- **BLOCKER. The platform account is behind this repository**, and further
  behind than it was. The library needs a re-import and every renamed block
  needs its thumbnail re-uploaded.
- **BLOCKER. The asset service still serves the wrong arrow icon**, the one
  with the stray letter baked into its pixels. The source is fixed, the served
  file is not, and it must be replaced before anything ships.
- **BLOCKER, and the decision is not ours.** A palette contrast issue in one
  block family falls below the AA level of the Web Content Accessibility
  Guidelines: white on green at 2.66:1 against a 4.5:1 floor. My call is that
  it is held as a client-facing recommendation rather than a silent change,
  with the exact remedy documented, because the remedy changes brand colors and
  that decision belongs to the client.
- **The stylesheet budget is tight by design**, and two things about it stay
  open rather than solved: everything between the largest size we have measured
  green and Gmail's cliff is modelled rather than observed, and a stylesheet
  can be lost for reasons no byte budget can see. Figures in
  [The hard limits](#the-hard-limits).
- **Colons and commas inside quoted stylesheet strings are unmeasured.**
  Semicolons and braces are now escaped and proven; the platform rewrites
  colons and commas elsewhere, nothing we ship puts one inside a string, and no
  probe has settled whether it would survive.
- **One hero sits in the holding pen** with its Outlook fallback unverified.
  Its photo spans two sections, so the fallback color lives in a stylesheet
  class that every other client honors and Word has not been proven to. A send
  settles it, and its fate decides whether the two remaining photo heroes
  consolidate into one.
- **The vendor bug report on the escaped character is written and not
  submitted**, with an importable proof of concept.
- **Four footer social icons missed the contrast-outline pass** and can vanish
  into an inverted footer in Outlook desktop dark mode. Detection of
  dark-mode-fragile assets shipped; automatic generation of the outlined
  variant is designed but not built.
- **One delivered email lost styling its stored version still had.** Every
  candidate explanation, including the last one standing, has since been
  measured dead. It stays closed as **unexplained, not as solved**, with the
  diagnostic shortcut on file in case it recurs.
- **The client manual disagrees with itself**. Its generated block reference
  and the hand-written prose around it give different block counts.
- **The template repository's version script is not yet merge-aware**; the
  converter's is, and this one still resolves merges by regenerating.
- **The final quality-control report's last section is unwritten**, and its
  block-import spot check is still pending.

## What to do next

Directions named after this document's last revision, recorded so they do not
live only in a chat log. **None of it is committed, scoped or scheduled**, and
it is deliberately not a plan. Where a direction rested on a factual premise,
the premise was checked, and the finding sits beside it, including the two
places the finding contradicts the premise. The first item is the one Bryan
ranks highest.

### Split the catalog into one file per block

Today all 60 blocks live in a
single master template of roughly 190 KB. That one file is the reason a
block's history is hard to read: a change to one block is a diff in a file
everything else also lives in, so git blame answers "who touched the catalog"
rather than "who touched the Story Card". Each block becoming its own file
would give every block a real history, make one reusable on its own, and let
two people work on two blocks without touching the same file.

The useful finding is that the plumbing already exists on both sides. The
template build already compiles with includes enabled, and `src/partials/`
already holds three components that are pulled in that way. On the converter
side, the fetch step already resolves includes recursively, relative to each
file that contains them, and hands the importer one inlined document. So the
importer would see exactly what it sees today, which means block segmentation,
the annotation reading and the field generation are all unaffected by the
split.

That leaves the real work in two places. **Byte-exactness is the constraint**,
because segmentation tiles the document exactly and every block's version is a
fingerprint of its own content. If the split changes so much as the whitespace
between markers, every block mints a new version, every renamed block restarts
at 1, and drafts already built in the platform are the ones that pay. The test
is a catalog dump before and after showing zero field drift. **And the marker
pairs should move into the block files**, because then a file boundary is a
block boundary. That kills a whole class of defect outright: the reading gap
that attached itself to the preceding block and quietly pulled a footer out of
every export for 3 days could not happen if the block were its own file.

What does not change: the head. One stylesheet, one set of version bands, one
shared set of rules, all still assembled at the top of the master. Splitting
bodies does not split the head, and it should not.

### Close the testing loop

Today a render round is hand-driven: paste into the
platform, send, open the rendering service, read. The direction is that the app
(or an agent driving it) submits the email and reads the results back with no
human in the middle.

Two facts landed on this. **The rendering service we use is being retired**,
confirmed on three vendor surfaces, in favour of a successor whose interface
covers submit, poll and per-client screenshots and keeps the same client
vocabulary, so much of what this project already has would survive. But **the
premise that it was recently acquired is wrong**. The current owner has held
it for years; what is new is the product consolidation, not the ownership. The
timing is worth knowing precisely, because it is quieter than a deprecation
usually is: **no shutoff date is published, the existing interface carries no
deprecation notice, and the status page says nothing.** The trigger is the
account's own contract renewal. An integration built today keeps working until
the account migrates and then stops, with no warning, so the date that matters
comes from the account team, not from a vendor page.

### Automate the platform

The ambition is that the app creates the template,
creates the blocks, assembles a broadcast and sends it for testing, so nobody
logs in for routine work at all.

The constraint is harder than expected and should be recorded before anyone
scopes it: **the platform's public interface does no content authoring of any
kind.** Enumerated across all three of its published specifications, there is
nothing that creates or updates a template, creates or updates a block, creates
a broadcast, or sends one. What is covered is supporter data, pages, reporting
and bulk import. Block and template import is a screen where a human pastes or
uploads a file. Sending a test message to arbitrary addresses is also a screen,
and the platform's own documentation recommends third-party rendering services
on it.

So this is browser automation, not an interface integration, which is what "or
another means" already anticipated. Two things follow. The internal endpoint
this project measured while finding the message ceiling is, as far as the
public record goes, **documented nowhere but in this project's own authoring
guide**, usable and completely unsupported at the same time, with no release
note due when it changes. And the platform's service-account type reaches only
the data interface, so anything driving the admin screens runs as a real human
account, with that account's credentials and second factor to manage.

### Extract a brand and dress the catalog in it

Point the tool at a website or
a set of materials, derive the palette, type and voice, apply them to the base
blocks, load the result into an account and test it. This is the item that
turns the project from *one client's block library* into *a way to stand up
anybody's*, and it is downstream of the two above: without those loops it
produces a catalog somebody still has to place and check by hand.

### Rethink the interaction model before polishing it

The report is direct:
the field-editing sidebar went unused. Changes were made by talking to the AI
upstream, and the changes worth making were the ones that only became visible
after looking at a block inside the email. That is not a complaint about the
sidebar's design. It is a claim that the app's centre of gravity is in the
wrong place, and that editing is something you want *at* the block, not beside
it. It lands against a planned redesign that assumes otherwise, scheduling the
design system first and the information architecture last.

### Join up with the upstream work

Michael Thomas's work should connect to
this so the path is start-to-finish rather than a good middle with manual ends.
The specifics are not in this repository's record, so this is a placeholder for
a conversation rather than a description of one.

### Move it off a laptop

The app runs locally today. The direction is a
managed, hosted tool behind a company login, perhaps only ever for the team.

This is the fork the other items hang from, so it is worth stating plainly:
**"zero backend" is not an accident of this project, it is a rule it has been
enforcing.** Static build, no server, no telemetry, every piece of state in the
browser. Closing the testing loop, automating the platform, extracting brands
and hosting for a team all need somewhere to keep a credential and something
that runs while nobody is watching. Any one of them retires that rule. Better
to retire it deliberately, once, than to discover it four times.

### Revise the audit suite

It has grown long, and the worry is that length is
not the same as coverage. The specific ask was that anything carrying text be
tested at the extremes: the placeholder copy, a single word, and copy long
enough to wrap onto a second line, across desktop and mobile.

Half of that already exists, which changes what is worth building. The sweep
has rendered every cell under exactly those 3 copy states at both screen
sizes for some time, with the long probe sized to wrap even at caption type.
**What is missing is not the renders. It is the assertion.** Those images are
compared only to answer *did any pixel move*, which decides whether a control
is live; nothing asks whether the block still looks right at the extreme. A
button row that wraps into its neighbour, a column that collapses, copy that
collides. All of it renders, gets compared for difference, and passes. The
expensive half is already paid for; a second verdict over the same images,
asking about layout integrity rather than control liveness, is the cheap part.
One coverage gap sits behind it: the sweep is organized per control, so a text
region with no control attached to it is never swept at all.

---

# Reference

## The hard limits

Every number the work is budgeted against, in one place. The document rounds
these in prose; this is the one place they are exact, and each says whether it
was measured or chosen.

| Limit | Value | How we know it |
| :-- | :-- | :-- |
| Gmail's stylesheet cliff | 16,384 bytes | **Measured.** Past it, every Gmail surface discards the whole stylesheet |
| Our working target under it | 14,141 bytes | **Chosen, not derived.** The advisory band under a hard limit is arbitrary, so the figure is one I picked and the guard says so |
| Send-time reprint multiplier | about 1.3× compacted size | **Measured.** Budget the delivered size, never the authored one |
| Largest stylesheet measured green | 13,325 bytes | **Measured.** Everything between here and the cliff is modelled, not observed |
| Current headroom | about 120 bytes under target, 2,400 under the cliff | **Modelled** from the multiplier above |
| Message save ceiling | about 300,000 bytes | **Measured on one sending surface only.** Whether every surface enforces it is untested |

**Size is not the only way to lose a stylesheet.** Gmail discarded one at
roughly three-quarters of this budget because of a single character. See
[The stylesheet reprinter is string-blind](#the-stylesheet-reprinter-is-string-blind).

## The things you must never do

The prohibitions this project paid for, gathered. **The maintained rule is the
guide's**, not this table: each row points at the section here that tells the
story and at the guide section that is the contract. Nothing here is the
authority, deliberately, because a second copy of a rule is a copy that can rot.

| Never | Because | Story | Rule |
| :-- | :-- | :-- | :-- |
| Author a child combinator in shipped CSS | The editor escapes the character, half of every dark-mode pair dies silently | [The editor escapes one character](#the-editor-escapes-one-character-and-half-your-dark-mode-dies) | Guide §2d |
| Put a literal `;`, `{` or `}` inside a quoted CSS string | The reprinter splits there and ships an unterminated string; Gmail drops the whole sheet | [The stylesheet reprinter is string-blind](#the-stylesheet-reprinter-is-string-blind) | Guide checklist 6b-bis |
| Author a full-width section with a background image | The platform rebuilds the shorthand and the section renders blank in Gmail, Apple Mail and iOS | [Nine more platform behaviors](#nine-more-platform-behaviors-including-two-you-must-never-do) | Guide §4 |
| Put horizontal padding inside the shape Outlook uses for background sections | Word ignores it at every size; use fixed-width spacer columns | [Outlook's Word engine](#outlooks-word-engine-and-what-we-chose-to-accept) | Guide §4 |
| Let `!important` reach the platform inside a body stylesheet | It survives inlining there, and Word drops any inline declaration carrying it | [Nine more platform behaviors](#nine-more-platform-behaviors-including-two-you-must-never-do) | Guide §2b |
| Set a zero line-height on a button | Word honours it and renders the button as a thin bar with invisible text | [Outlook's Word engine](#outlooks-word-engine-and-what-we-chose-to-accept) | Guide §4 |
| Expect a template edit to reach emails that already exist | It does not propagate, and there is no update in place | [Template edits do not reach emails that already exist](#template-edits-do-not-reach-emails-that-already-exist) | CONVENTIONS.md |
| Put a tag-like sequence in a stylesheet comment | The parser reads it as markup and swallows the document | [Documentation text gets read as markup](#documentation-text-gets-read-as-markup) | A build assertion |

## Where the rules live now

| Where | What it holds | Enforced by |
| :-- | :-- | :-- |
| [CONVENTIONS.md](CONVENTIONS.md) | The importer's full contract: how every field is generated, named, ordered, suppressed, versioned | Pre-commit review; a drift linter including mirror comparison |
| [MJML-AUTHORING-GUIDE.md](MJML-AUTHORING-GUIDE.md) | Portable authoring rules, the measured inliner table, the QA checklist, the annotation vocabulary, and a copy-paste prompt for AI agents | Same |
| [PLAYBOOK.md](PLAYBOOK.md) | This repo's build pipeline, block system, naming grammar and debug overlay; its last section is the porting checklist for the next client | A drift linter |
| The probe archives, in both repos | 26 annotated instruments, each with its verdict recorded | The probe lifecycle rule |
| The converter's deferred-work document | Deferred work, rejected approaches with the reason for rejection, and unexplained anomalies | Cited by the doc linter |
| The converter's spec layer | Specs per subsystem, the delivery workflow, the reviewer protocol, durable technical learnings | Four continuous-integration gates over three machine-checked contracts |
| The client manual | The template, every block and its fields, how the system is maintained | Regenerated from the import pipeline; its claims linted against the catalog |
| The audit engines | Inert dropdowns, dead flags, dark-mode image ink, annotation usage | Startup self-tests |
| [versions.json](versions.json) here, the app's own manifest there | The integer version of every block, partial, template and the app | Build-time sync; git history is the ledger |

## Glossary

| Term | Means |
| :-- | :-- |
| **MJML** | A shorthand language for writing emails. It compiles into the markup that renders correctly across mail clients |
| **Engaging Networks** | The platform this client uses for email, fundraising and advocacy. **Marketing Tools** is its email builder, where editors assemble emails from blocks |
| **Block** | One reusable email section, such as a hero, a story card or a footer |
| **Row** | One horizontal section of a block, numbered top to bottom. The editor-facing word for what the markup language calls a section |
| **Field** | An editable control attached to a block in the editor. The platform calls these Replacements |
| **Rail** | A narrow fixed-width column beside the content, holding an icon or a badge. In a grouped row it shrinks on phones while the fixed padding inside it does not |
| **Frame** | The element that owns a block's outer geometry and carries its padding: a section, a wrapper or a column |
| **Gutter** | The built-in side padding between content and the edge of its container |
| **Viewport** | The screen width an email is viewed at. Desktop and phone are the two that matter here |
| **Alternate arrangement** | A whole second layout of a row, authored as a hidden sibling and offered as one more option in that row's dropdown |
| **Holding pen** | A one-block page for anything with an unresolved defect. It keeps every build check running over the block while dropping it from exports |
| **Probe** | A small email built to test a specific set of claims through a real send |
| **Inliner** | The transform the platform applies at send, moving stylesheet rules onto individual elements. The **reserializer** is the separate pass that reprints the stylesheet itself |
| **Merge tag** | A placeholder the platform substitutes when it assembles an email |
| **Version band** | A strip naming a block and its version, hidden inside each block and revealed by adding a debug block whose only content is the rule that unhides them. Never visible in a delivered email |
| **Broadcast / Marketing Automations** | Two platform surfaces that send email. A broadcast is a one-off send an editor builds and schedules; automations send in response to an action. The distinction matters because the message-size ceiling was measured through only one of them |
| **Linter / gate / contract** | A linter scans files for known mistakes and ours run with every build, where a clean build prints zero warnings. A **gate** can refuse a change outright. A **contract** here means a rule with a script that verifies it, as opposed to one that exists only as prose |
| **Autoresponder** | An email the platform sends automatically in response to an action; here, the two donation thank-yous |
