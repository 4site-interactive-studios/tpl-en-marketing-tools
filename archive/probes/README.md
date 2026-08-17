# Archived probes

Retired QA instruments — MJML sources whose every claim has been measured
on a real send and recorded. The lifecycle rule lives in
[CLAUDE.md](../../CLAUDE.md) (Working rules → Probe lifecycle): a probe is
archived in the same session that records its LAST verdict; a probe still
carrying any unverified claim stays in `src/`. This directory is invisible
to the build; each probe's three `dist/` artifacts were removed when it
moved here. To re-run a round, move the file back to `src/` and rebuild.

| Probe | What it settled | Verdicts recorded in |
| :---- | :---- | :---- |
| `probe_flush-mobile.mjml` | The two-rule `.flush-mobile` gutter fix (2026-08-13, EoA pTdFUx7a/dnYN8bje) — productized as the shipped `.flush-mobile-capflush` rules | `src/styles.css`, guide §2e |
| `probe_gmail-android-columns.mjml` | Gmail-Android two-column "shrink" was NOT a shrink (2026-08-12) — the look was gutter; resolved as non-bug over four rounds | guide §2e |
| `probe_mobile-gutters.mjml` | How much mobile gutter the design wants; captions can sit flush (2026-08-13) — superseded by the flush-mobile fix | guide §2e |
| `probe_outlook-background-image.mjml` | Word-engine colour-slab-beats-photo when a section carries both background attributes (2026-08-12/13, EoA aBPD6k1l) — productized as check-catalog §1 | guide §4, `scripts/check-catalog.mjs` |
| `probe_outlook-dark-footer.mjml` | Outlook desktop dark footer inversion; wordmark needs self-contrast (2026-08-13) — resolved by the contrast-outline asset pass | PLAYBOOK.md |
| `probe_v4-followups.mjml` | Combined re-send of the BG + COL series to spend one EoA run (2026-08-13); the two source probes above stay canonical | guide §4, §2e |

Still ACTIVE in `src/`: `probe_reassess-composite.mjml` — its 0Mgmjr…
round is read, but its rebuilt `_live.html` now carries the dark-hero
exemption and is the instrument for that fix's confirmation send. It
archives when that confirmation lands.
