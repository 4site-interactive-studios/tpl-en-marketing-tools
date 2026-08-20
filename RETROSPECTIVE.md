# Project Retrospective: TPL Email Templates and Email → EN Marketing Tools

**Client:** Trust for Public Land (TPL)  
**Period:** May 25 to August 20, 2026  
**Prepared:** August 20, 2026, by 4Site Studios, from the project's own documentation, commit history, and audit ledgers  
**Audience:** the whole team

This is a point-in-time snapshot, not a governing document. The counts below
were true on August 20, 2026 and will drift as the catalog evolves; the live
numbers come from the build, not from this file.

The work spans two repositories: this one, which holds the TPL templates,
and a private one holding the converter app and the canonical
documentation. Everything through "How the SOPs got codified" is written
for everyone. "What we measured about Engaging Networks" onward is
technical, and the appendix is for whoever runs the next project like this
one.

### Terms used here

| Term | Meaning |
| :--- | :--- |
| MJML | Mailjet Markup Language, the source format our emails are written in; it compiles to the tangled HTML email clients need |
| Engaging Networks (EN) | the platform TPL uses to send email; Marketing Tools is its drag-and-drop email builder |
| Block | one reusable piece of an email (a hero, a button row, a footer) that editors stack to build a message |
| Replacement | EN's term for an editable field on a block (a headline, a color choice, a spacing menu) |
| Autoresponder | an email EN sends automatically in response to an action (here, donation thank-yous) |
| Probe | a temporary test email built to measure one specific platform behavior on a real send |
| Email on Acid | a service that renders one email across dozens of real email apps and returns screenshots |
| Linter | an automated check that scans files for known mistakes |
| Build | the automated process that turns MJML source into finished email files, running every check along the way |
| Mirror | an auto-generated copy of a document kept in a second repository, never edited directly |

---

## The short version

Email design is fragile. The same message renders differently in Outlook,
Gmail, and Apple Mail, in light mode and dark mode, on desktop and phone,
and the platform that sends it rewrites the code in transit. Our answer was
a system where the hard problems are solved once, in the template, and
editors work inside guardrails that make the safe choice the only choice.

Over three months we built two products and, along the way, a third thing
nobody scoped.

**A complete email design system for TPL.** 134 authored block variations,
delivered as 67 building blocks in Engaging Networks across 9 categories
(heroes, text, buttons, images, engagement, signatures, footers, and
more). Related variations of the same block fold into a single block's
dropdown choices, so editors see fewer, more capable blocks. Alongside the
catalog: a 56-block master template and two donation thank-you
autoresponders. Where this project started, the previous export held 18
blocks in a single folder.

**A converter app: Email → EN Marketing Tools.** A browser-based tool that
reads our email source code and generates everything Engaging Networks
needs automatically, including every editable field an editor sees (a
"Replacement," in EN's vocabulary). Colors become brand-palette dropdowns
for text, backgrounds, and borders, so off-brand colors cannot creep in
through everyday edits. Spacing comes from a named menu (None, Half,
Single, Double, Triple, Quadruple), so editors adjust breathing room but
cannot break the typography, because no free-type field exists that could.
The template itself declares its expectations (brand palette, spacing
scale, width presets) in one comment at the top of its source, so pointing
the converter at the next client's templates needs no converter changes.
What used to be hand-built and error-prone is now generated, verified
control by control, and repeatable.

**A measured knowledge base of how Engaging Networks actually behaves.**
This is the thing nobody scoped. The platform transforms email code
between "save" and "send" in ways its documentation does not describe. We
measured that behavior with purpose-built test files sent through a real
account, recorded every verdict, and turned the findings into rules the
tools now enforce. One finding is written up as a formal bug report for
Engaging Networks, with a reproducible proof of concept attached.

The lasting value is not just the templates. It is that the standard
operating procedures for moving MJML email into EN Marketing Tools now live
in documents, tests, and automated checks rather than in anyone's head.

The system went live in TPL's Engaging Networks account on August 18, and
editors are building emails with it now. A short list of known gaps
remains. None of them blocks daily use, but two are worth knowing before
client conversations: the footer's social icons can vanish in Outlook's
dark mode, and the Steps Block colors fall short of accessibility contrast
guidelines. Both are tracked under "What's still open."

---

## How it unfolded

The two repositories carry 495 commits between May 25 and August 20, 2026.
Five phases stand out.

**Late May to mid June: bootstrap.** The catalog began as a re-skin of
Engaging Networks' stock template and was rebranded for TPL on June 11.
The early commits are terse and hand-built ("create more blocks", "dark
mode improvements").

**July: from mockup to system.** The catalog gained its naming grammar,
its categories, and the in-page debug toolbar that lets anyone QA the
library in a browser. The converter app's first commit landed July 15.

**Late July to early August: the contract era.** The template began
declaring its own expectations (spacing scale, width options, brand
palette) in a machine-readable comment, and the converter learned to read
them. The conventions document was written and mirrored publicly. This is
the point where the two projects stopped being two projects.

**August 6 to 15: measurement.** The tone of the work changed here.
Instead of asserting how Engaging Networks behaves, we started measuring
it, with probe emails sent through the real account and read across 15
email apps. Most of the durable knowledge in this document was produced in
these ten days, and several confident beliefs did not survive them.

**August 17 to 20: industrialization.** Everything learned became
something automatic: linters, pixel audits, content versioning, byte
budgets. Nearly half the converter's commits (111 of 228) landed in these
four days, and the system went live on August 18.

---

## By the numbers

| Measure | Where it stands |
| :--- | :--- |
| Project span | May 25 to August 20, 2026 (88 days), with the converter built in the final five weeks |
| Commits | 495 across the two repos during the project (267 template, 228 converter) |
| Authored blocks | 134 variations, delivered as 67 importable EN blocks in 9 categories |
| Master template | 56 blocks, plus 2 autoresponders of 7 blocks each |
| Converter app | version 59 (59 shipped iterations in about a month); roughly 22,700 lines of application code |
| Automated tests | 772 tests across 35 files, roughly one line of test code for every line of core converter code |
| Iteration ledger | 152 versioned artifacts; the template shell at version 32, the shared stylesheet at version 16 |
| Written contracts | a 2,562-line converter contract and a 1,490-line portable authoring guide, mirrored into this repo |
| Probe instruments | 22 archived across the two repos, every claim measured on real EN sends |
| Heaviest QA day | 8 Email on Acid rounds and 120 screenshots across email apps (Outlook, Gmail, Apple Mail, and more), all read on August 11 |
| Go-live control audit | 1,027 dropdowns verified across 11,108 rendered screenshot comparisons |
| Automated guardrails | doc linters that verify every cited fact still matches the code, a catalog scan for known defect patterns, three in-app audit systems, and automatic version syncing |

---

## What we built

### The TPL template system (this repo)

The source of truth is MJML in this repository, not the code stored inside
Engaging Networks. Every block is fenced by START and END comment markers
that survive compilation. Each block's name follows a fixed grammar,
family first and qualifiers after, so tools can read every variant's
relationship to its family. The debug toolbar (described below), duplicate
detection, and the mapping between source and compiled output all run off
those names.

The catalog's highest-leverage authoring convention is bottom-only pacing:
all vertical space between elements belongs to the element above it, drawn
from the closed spacing scale. Any two blocks stacked in any order keep
the right rhythm, which is what makes a block library safe to hand to
editors in the first place.

The build compiles each source page twice: a local debug copy with the
inspection toolbar kept in, and a paste-ready live copy with absolute asset
URLs and every script stripped. Neither is what the converter reads; it
consumes the raw MJML, and rejects compiled HTML with a plain-English error
so nobody can feed it the wrong artifact.

The in-page debug toolbar deserves a mention because it changed how QA
worked: designers, reviewers, and the client can outline every block, view
all variants of a family side by side, hide everything that won't import,
and even draft copy edits that export as a structured change request.
Nobody reads code to check the work.

Dark mode got a three-part treatment, one technique per family of email
apps. Every transparent logo or lettering asset that renders as a regular
image also carries a contrast outline traced from the artwork's own
silhouette; the treatment is scripted and covers 14 assets. The rim is
invisible on the intended background and becomes the contrast border when
an email app inverts the surface without touching the image. That one technique is why the artwork survives dark mode in
apps we cannot reach with code at all. (The four footer social icons
render through a different component and missed the outline pass; they are
the known exception, tracked under "What's still open.")

### The converter app (private repo: email-to-en-marketing-tools)

A client-side web app with no backend: point it at the MJML on GitHub and
it fetches the source, detects the blocks, and generates the import files
Engaging Networks needs, with every editable field typed, named, grouped,
and ordered by convention. It also produces the thumbnails and image
archives EN wants, generates a RAW HTML utility block as a sanctioned
escape hatch for one-off embeds, and validates everything before export
(orphaned tags, off-scale spacing, editor-unsafe styles, oversized
stylesheets).

Its defining decision: everything is editable by default, with deliberate
exceptions. The email's title and preview text belong to each send, not
the template, so the converter strips them rather than minting fields that
would go stale. Accessibility is part of the defaults too: every image
exposes an editable alt-text field (empty is allowed for decorative art),
and the converter removes a compiler artifact that would otherwise make
screen readers announce the entire email as one long string.

The other half of that decision: every control must be real. A generated
field that does nothing when changed is treated as a defect. Three audit
systems enforce this empirically:

- an inert-dropdown audit that renders every block, every dropdown, every
  option at two viewport widths and compares the pixels; the go-live sweep
  covered 1,027 dropdowns across 11,108 renders, and the audit now also
  tests three copy lengths, because short placeholder text can make a live
  control look dead
- a dark-mode image audit that classifies every light/dark image pair from
  its actual pixels
- a dead-switch audit that removes each authoring marker from the source
  one at a time and regenerates the output, proving every marker still
  does something; any that do nothing get deleted instead of lingering as
  folklore (a retired annotation vocabulary went out this way, all 8,376
  instances stripped after the audit proved removal changed zero generated
  fields)

The conventions the generator follows are not folklore either: 772
automated tests encode them, and the contract document records the "why"
behind every one, dated, with the decision that produced it.

TPL also received a client-facing manual, roughly 1,850 lines, covering
the template, every block and its editable fields, and how the system is
maintained and extended.

---

## How the SOPs got codified

The templates are one client's deliverable. The procedures are the asset
that transfers. Four habits did most of the work.

### One rule, one owner

Four documents govern the system, each with a defined owner: the portable
authoring guide (rules true for any MJML-to-EN project), the converter
contract (how every field is generated), the playbook (this repo's build
and block system), and the repo instructions (whatever the others get
wrong locally). Both governing documents are written in the private
converter repo and mirrored here with a "do not edit" header, re-mirrored
on every change, because AI coding assistants and human teammates working
here cannot see the private repo. Restating a portable rule locally is how
it drifts; four of the defects a documentation review turned up on
August 7 were exactly that kind of restatement.

The standing rule: a convention that only lives in chat history is
considered lost. Decisions get written down the day they are made, with
the date and the reasoning attached.

### Prefer a check over a sentence

A count written in prose rots; a command that produces the count cannot.
Every recurring defect class ended up as an automated assertion rather
than a reminder:

- `check-docs` (both repos) verifies that every file, symbol, block name,
  and section reference a document cites still exists, that stated
  defaults match the code, that dark-mode rules carry their required
  override marker, and that each mirror byte-matches its source
- `check-catalog` scans the blocks for the exact patterns that shipped
  past defects: background color and image on the same tag, fixed-width
  columns overflowing their frame, lowercase button labels, and a
  stylesheet creeping toward the size at which Gmail discards all styling
- every assertion carries a comment naming the defect it exists to catch

Both linters warn rather than fail the build, by design, but the working
rule is that a clean build prints zero warnings.

### Probes are instruments, not scratch files

Every claim about platform behavior was tested with a purpose-built probe
sent through the real account, and every probe follows a lifecycle: it
stays with the active project files while any claim is unverified, gets
its verdicts recorded in the docs, and is archived (never deleted) in the
same session that records the last verdict. 22 annotated instruments now
sit in the two archives, ready to re-run the day EN's behavior is
suspected to have changed.

### Versions anchored to content

Every artifact (each block, the template shell, the shared stylesheet, each
autoresponder) carries a version number that increases automatically
whenever its content actually changes. Nobody edits version numbers by
hand; the project's saved change history is the ledger. The numbers double
as an iteration record: the template shell reached version 32, the shared
stylesheet version 16, and the busiest single block version 12.

### The QA checklist graduated from experience

The authoring guide closes with a 19-point pre-flight checklist. Its most
distinctive feature is that several checks cite their own history, in the
style of "third recurrence of this error class; it graduates to a rule."
The checklist is the distilled form of every QA round we paid for.

---

## What we measured about Engaging Networks

This is the technical heart of the knowledge base. Everything below was
measured on real sends, not theorized, and each finding now has a rule or
an automated check attached.

### The CSS inliner

EN rewrites every email's styles at send time, and it cannot be turned
off. Fourteen probe constructs pinned its core behavior: plain rules are
inlined onto elements (losing `!important` in the process), dark-mode and
mobile media queries pass through verbatim, rules that match nothing are
deleted, and media blocks sharing a condition string are merged into the
first one's position, so each condition is authored in exactly one place.
A later probe round added that a stray anchor wrapping a table gets
auto-closed, silently making the row unclickable. The inliner runs at send
time, not at import, so an export proves nothing about what a recipient
gets. Two working rules fell out: a conditional media query is the
sanctioned "do not touch" wrapper for anything EN must not rewrite, and
any dark-mode declaration that must beat an inlined base rule needs
`!important`, even though its absence looks correct in source, in preview,
and in EN's own editor.

MJML adds a transit hazard of its own: a single authored background image
compiles into four separate HTML carriers, so every editable field binds
all four and the build rewrites all four. Missing any one shows the old
photo in some apps and the new one in others.

### The block editor's silent escape

The finding that explained the worst of a failed QA round: editing CSS
held in an HTML-type editable field makes EN escape `>` characters, which
silently kills child-combinator selectors. The visible symptom was
white-on-white dark-mode text on iOS, which looked like an authoring bug
and was not. Other symptoms from the same round (a black slab in Outlook
on Mac, collapsed columns in Gmail) were never formally traced to the
escape; the Gmail collapse fits the size cliff measured a week later,
since that day's payload was 28,408 bytes. The shipped stylesheet now
contains zero child combinators, the converter warns on every one it
finds, and the bug is written up as a formal report for Engaging Networks
with an importable proof of concept. A related measurement: EN ingests a
stylesheet once per `<style>` wrapper, so an accidental double wrapper
shipped two full copies of the stylesheet, 24,952 delivered bytes against
13,325 once the extra wrapper was removed.

### The rich-text editor is ProseMirror

A five-probe series established what EN's content editor does to copy on
the first keystroke: bare text gets wrapped in a paragraph (harmlessly, if
it is already wrapped), Outlook-only conditional comments are destroyed,
links keep only their destination and target, and styling applied from the
template's stylesheet survives where inline styling does not. The
predictive model behind all of it: the editor rebuilds links from a fixed
attribute set, while paragraphs and spans keep their attributes, so
anything on a link that isn't in the set is gone. The fix was to pre-apply
the editor's own wrap at import time, so the first human edit changes
nothing.

### Gmail's size cliff

The Gmail app does not merely truncate oversized styles; it drops the
entire stylesheet, whole, past exactly 16,384 bytes, on every Gmail
surface including desktop webmail. EN re-prints head CSS at about 1.3
times its authored size on the way out, so the build budgets the delivered
size, a 14,000-byte working target against the 16,384-byte hard cliff, and
meters it automatically. The budget is a real ceiling with a ledger: the
stylesheet sat roughly 50 bytes clear until August 20, when deleting a
retired width ladder returned about 1,325 delivered bytes, leaving the
estimate at 14,997. Part of the defense is an inline-first image pattern,
measured so that images still render correctly even when Gmail drops the
stylesheet. Also measured: the famous "columns shrink on Android" bug does
not exist; it was gutter arithmetic (predicted 252.7 px, measured
251.0 px), and the fix cost two CSS rules instead of a restructure.

### Outlook's Word engine

Outlook on Windows renders email with Word, and Word has opinions: a tag
carrying both a background color and a background image paints the color
and discards the photo; buttons render square (we accept that rather than
ship the workaround that breaks editable fields); and CSS box geometry on
spans is ignored entirely, so inline chips are sized with text-level
tricks. Each of these is now either a build assertion or a documented
pattern.

### Dark mode's reach

Only two dark-mode hooks exist (`prefers-color-scheme` and Outlook.com's
`[data-ogsc]`), and the two apps that honor neither (Gmail's app and
Outlook desktop) transform colors in opposite directions. The strategy
that survived contact: let those apps invert, and make the artwork survive
the inversion, because the apps that transform colors leave images
untouched (measured on both). Hence the contrast outlines. We also
measured a mercy: a light background with no dark hook at all still
rendered legibly in all five dark-capable renders of the test matrix. That
is one email and one round, strong evidence but not a license to delete
hooks. An overreaching authored dark rule, by contrast, once painted a
black lid over every photo hero. Dark-mode claims are now only ever judged
on the delivered HTML.

### Template edits never reach existing drafts

EN cannot push a changed template into emails already built from it. The
part of a template that actually needs fixes after the fact is the
stylesheet, so it ships as a synthetic "Template Styles" block placed
first in every email: a CSS fix becomes a one-block swap instead of
rebuilding every draft from scratch. This one workaround shapes every
email built with the system.

### What EN preserves

Good news, also measured: editable fields nest three levels deep without
corruption, the same block added twice keeps independent selections, and
sends read block content live rather than from a stale snapshot. These
findings are what make the whole editable-template design trustworthy.

---

## Principles that carried the project

1. **Measure the delivered email, never the build.** EN's inliner, its
   editor, and Gmail's sanitizer all transform the payload in transit.
   This error class recurred three times before graduating to a
   checklist rule; the delivered HTML is the only honest witness.
2. **Never ship a control that does nothing.** A dead dropdown teaches
   editors to distrust every dropdown. The audits also proved the
   opposite trap: short placeholder copy makes live controls look dead,
   so verdicts are only trusted at three copy lengths.
3. **A rule in chat is lost; a rule in prose rots; a rule in a check
   survives.** The project's own dead-flag rule was re-broken twice while
   it lived in prose and has not been broken since it became a build
   assertion.
4. **Record retractions next to findings.** The documentation says
   "WRONG" about its own earlier conclusions in five places, and one
   anomaly is filed as "closed as unexplained, not as solved." That
   candor is why the docs can be trusted at face value.
5. **Spend measurement once, reuse it forever.** Probes are archived with
   their verdicts precisely so the next behavior question starts from an
   instrument, not from scratch.

---

## What's still open

- The four footer social icons render through a different component and
  missed the contrast-outline pass; Outlook dark mode can make them vanish
- The Steps Block palette fails WCAG AA contrast; the remedy changes brand
  colors, so it is documented as a client design decision with the exact
  fix attached
- The go-live control audit left its 64-finding backlog deliberately
  unapplied (none affect a sent email): about 30 label wording fixes and
  about 30 apparently dead controls, and the backlog itself says to
  re-derive the dead-control list rather than trust its count
- Automatic generation of contrast-outlined assets is designed (the rim
  recipe is proven) but not built; detection shipped
- The repo's README is the one document that rotted, precisely because no
  linter reads it; it still carries its original TO DO placeholders and
  describes files that have since been renamed, and it is the front door
  for anyone arriving cold

---

## Where everything lives

| Artifact | Location |
| :--- | :--- |
| Block catalog, master template, autoresponders | `src/` in this repo |
| Portable authoring guide (mirror) | `MJML-AUTHORING-GUIDE.md`, §9 carries the copy-paste prompt for AI agents |
| Converter contract (mirror) | `CONVENTIONS.md` |
| Build and block-system playbook | `PLAYBOOK.md`, §10 is the porting checklist for the next client |
| Archived probes and verdicts | `archive/probes/` here; `docs/archive/` in the converter repo |
| Converter app and canonical docs | the private `email-to-en-marketing-tools` repo |
| Client-facing documentation | `docs/TPL EN Marketing Tools Documentation.md` in the converter repo |
| EN bug report and proof of concept | `docs/en-bug-html-replacement-escapes-css.md` in the converter repo |
| Version ledgers | `versions.json` here; `app-version.json` in the converter repo |

---

## Appendix A: incidents, and the guardrail each one left behind

The body of this document is the wins. This appendix is the tuition we
paid for them. Each entry names what happened, what it nearly cost, and
what now prevents a repeat.

**The dark-mode crisis that wasn't (August 11-12).** Eight Email on Acid
rounds and 120 screenshots pointed at catastrophic dark-mode failures
across iOS, Outlook, and Gmail. The worst family of symptoms traced to one
cause nobody suspected: EN's editor escaping `>` inside edited CSS. Most
of the remaining findings turned out to be independent authoring fixes,
and a few were kept on a still-unexplained list rather than force-fit to
the theory. Five working conclusions were reversed in a single day, each
retraction recorded so no future session re-derives the wrong ones.
Guardrails: a stylesheet with zero child combinators, a converter
validation that warns on every one, and the formal bug report written for
Engaging Networks.

**The false root cause we almost shipped (August 12).** Email on Acid's
"view source" URL returns its own application shell, not the email, so
every test reports the same 71 or so bytes of CSS and no dark-mode rules,
which reads exactly like a total stylesheet loss. The tell: a known-good
test reported identical bytes. Guardrails: the delivered-HTML URL is
documented as the only diagnostic source, and a checklist rule says a
payload without EN's inliner fingerprints proves nothing.

**Two rounds, one build (August 11).** Two QA rounds compared as
before-and-after were the same build sent 34 minutes apart, so the "fix"
they appeared to verify was never tested. Guardrail: never read an A-to-B
diff as verification without a source commit between the sends.

**The vanished push (August 11).** A stray `git checkout HEAD~0` inside a
scripted command detached HEAD; the next commit landed off-branch, and
`git push` exited 0 while pushing nothing. The "pushed" commit did not
exist on GitHub. Guardrails, now in both repos' instructions: never run
checkout variants inside compound commands, confirm the branch before
committing, and verify the remote ref equals local HEAD after every push.

**The type check that checked nothing (August 19).** The repo's
`tsc --noEmit` ran against a references-only shell config with an empty
file list, so it type-checked zero files, and a real type error reached
main. Guardrail: the checks command is now `tsc -b`, with the reason
written next to it so nobody "simplifies" it back.

**The comments that ate the stylesheet (August 18 and 20).** Two separate
incidents, one lesson. On August 18, a literal `<style>` example written
inside a CSS comment flipped the HTML parser into raw-text mode and
silently swallowed the rest of the document; every import failed with a
misleading "malformed MJML" error. On August 20, EN's container merge tag
written literally in a source comment made the converter split the
template shell at that comment; the comment lost its closing marker, the
unterminated remainder swallowed the head stylesheet, and delivered emails
showed the light and dark version of every paired image at once.
Guardrails: validator checks for both cases in the converter, a catalog
assertion banning the literal merge tag, and a documented rule never to
write tag-like text inside CSS comments.

**The toolbar that ate the version band (August 20).** A version stamp
meant to show inside Marketing Tools vanished, but only on the documented
import path; the paste-in build looked fine. The block splitter takes the
first START marker it finds, the debug toolbar's own marker pair sat above
the band, and everything ahead of it was silently dropped: 714 bytes that
reached none of the 77 exported blocks. Guardrails: the band now leads the
body, and a build tripwire asserts it stays there. The transferable
lesson: the artifacts easiest to check were exactly the ones that looked
fine.

**The dead flag that came back twice (August 10, 16, 17).** An authoring
flag proven dead was removed, then re-added six days later by a session
that read its absence as a gap, despite prose explaining the removal. The
audit re-found it the next day. Guardrail: the rule moved out of prose
into the catalog linter, and the episode coined the project's motto,
"prefer a check over a sentence."

**The flag that was ignored for weeks (fixed July 31).** The authoring
markers are deliberately valueless, and the converter's attribute reader
returns nothing for a bare flag, so a plain do-not-hide marker was
silently ignored until detection switched to a presence check. Guardrail:
the reading rule is spelled out in the contract, and the dead-switch audit
now proves per marker that the converter actually honors it.

**The audit that called live controls dead.** An early inert-control sweep
flagged five fields as dead; four were live the moment the test copy was
longer than the catalog's own placeholder text. Short copy hides any
control whose job is to move an edge the text never reaches, and the
failure is silent. Guardrail: every control is now tested at three copy
lengths before any verdict is trusted.

**The speedup that wasn't (August 19).** An early benchmark showed a 6.37x
gain from running the audit eight iframes wide. The real ladder, measured
in a foreground tab, showed eight-wide slightly slower than one-wide; the
original reading came from a throttled background tab. Guardrails: the
default returned to one, the measured ladder is recorded, and the audit
enforces "parallelism is a timing knob, never a verdict knob" with
self-tests that refuse to run if determinism tripwires fail.

**The fix that was correct everywhere except Word (August 11).** A
line-height fix for button groups reasoned correctly in every browser and
still shipped a severe regression: Outlook's Word engine honors
`line-height: 0`, rendering pill buttons as thin bars with invisible
labels. Reverted the same day. Guardrail: line-height is banned on the
button-group classes, and any future attempt at that spacing must be
invisible to Word and proven in Outlook before it ships.

**The near-duplicate catalog that charged rent (deleted August 17).** A
second catalog file held a strict subset of the first: 135 of its 143
blocks, differing by exactly one line. It was never once edited
independently in its lifetime, and it demanded a matching edit on 14 of
the 15 catalog commits in its last 90 days. That sync tax was its whole
cost and its whole risk. Guardrail: the repo instructions say any future
short demonstration page gets derived at build time from the full catalog,
never maintained as a second copy.

**Shipping ahead of the evidence (August 10).** A preview-text field was
designed, built, and shipped, then reverted the same day when a send test
showed EN injects its own preview text, so the field would have doubled
every inbox snippet. The reversal was cheap because real send tests were
routine by then; earlier in the project the same mistake would have lived
for weeks. Guardrail: per-send strings (title, preview text) are stripped
from the template on principle, and the checklist bans authored preview
text in broadcast sources.

**The mirror that could truncate itself.** The doc-mirroring recipe once
risked piping a file into its own redirect, which truncates the target
before reading it. Guardrails: the mirror commands use literal banners
written to be safe, and the doc linter verifies every mirror byte-matches
its canonical source, which also catches a half-pushed mirror before a
downstream agent reads a stale contract.

**The one that stayed unexplained.** One delivered email lost styling its
stored blocks still had. Three hypotheses were formed and each was
measured dead, so the entry is filed as "closed as unexplained, not as
solved," with a diagnostic shortcut recorded in case it recurs. It never
did across four subsequent sends, and it gates nothing. Keeping an honest
"we don't know" in the ledger was judged more useful than a tidy story.
