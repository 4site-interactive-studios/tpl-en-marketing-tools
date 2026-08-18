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
| `probe_reassess-composite.mjml` | Composite re-assessment round P1–P10 (2026-08-18, EoA 0Mgmjr…): hero-lid conviction, Word rescale fixes, pill cure, tinted-panel hooks, anchor auto-close | guide §2c/§4/§2d, check-catalog §5 |
| `probe_hero-exemption-gmail-css.mjml` | E1–E5: dark-hero exemption CONFIRMED across all five hero shapes; G0–G3: Gmail applies the merged conditional block on production-shaped emails — Send B's zero was the minimal email (2026-08-18, EoA MeKGcu…) | guide §2c/§4, future-enhancements §3, styles.css |
| probe_fullbleed-grid-images.mjml | The Gmail app drops head CSS by SIZE, whole (28KB real send: all media/dark rules dead; 715B probe: all honoured) — and the inline-first image pattern (attr width + inline width:100%) renders correctly in Gmail app, Apple Mail, Gmail web, and Outlook, with EN leaving inline width untouched (F1–F5, EoA 3ZeoECY + fHTqInbC, 2026-08-18) | MJML-AUTHORING-GUIDE.md §2b-bis |
