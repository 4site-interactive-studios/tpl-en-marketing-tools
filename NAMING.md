# Block Naming Convention

Every block is wrapped in `<!-- START: Name -->` / `<!-- END: Name -->` comments
(names must match exactly, including case). These comments survive MJML
compilation and drive the debug overlay (`assets/debug.js`): outlines, labels,
grouping, side-by-side stacking, click-to-copy, and duplicate hiding.

## Grammar

    Family (qualifier, qualifier, w/ feature)

- **Family** — the structural identity ("Logo Header", "Heading Banner",
  "Dual CTA Buttons"). Stripping every parenthetical yields the *group key*:
  blocks sharing a key are variants of one family and group/stack together.
- **Qualifiers** — comma-separated inside one parenthetical, lowercase (proper
  nouns like GivingTuesday exempt), ordered:
  1. surface/color: `(dark)`, `(off-white bordered)`, `(light green)`
  2. layout/alignment: `(centered)`, `(image left)`, `(full width)`
  3. features, prefixed `w/`: `(w/ photo)`, `(w/ arrow heading)`, `(w/ dark-mode swap)`
- An **unqualified name** is the family baseline and may coexist with
  qualified variants ("Comment Steps Block" + "Comment Steps Block (w/ arrow heading)").

## Combinators

- `x` pairs two different things: "Logo Header x CTA", "Logo Header x State".
- `Dual` / `Triple` denote repetition of the same thing: "Dual CTA Buttons".
- Avoid baking qualifiers into the family name ("… Left Aligned" — wrong;
  `(left)` — right), and avoid "and"/"with" chains.

## Rules the tooling depends on

- **Identical full names are reserved for byte-identical repeats** — the
  "Hide duplicates" toggle keeps the first occurrence and hides the rest by
  exact name, so two different blocks must never share a name.
- Names are **case-sensitive** ("Signature card" ≠ "Signature Card").
- Adjacent same-family blocks merge into one comparison run when grouped;
  non-adjacent instances are indexed (· 1/n).
- `(dev only — remove for production)` marks non-shipping chrome (Debug
  Toolbar); such blocks are excluded from the overlay entirely.
- `Category — <Label>` blocks are navigation chrome for the demo catalog, not
  content blocks; use `&` rather than "and" in their labels.
