# Repo instructions — TPL EN Marketing Tools

Facts specific to THIS repo. The two governing documents are mirrors of a
private repo and cannot be corrected here, so anything TPL-specific that
contradicts or extends them lives in this file.

| Doc | Owns | Editable here |
| :-- | :-- | :-- |
| `MJML-AUTHORING-GUIDE.md` | **portable** rules: EN's measured CSS-inliner behavior, bottom-only pacing, the spacing scale, the `data-*` contract, the §8 QA checklist | **No — mirror** |
| `CONVENTIONS.md` | the importer's contract: how every editable field is generated, named, ordered, suppressed | **No — mirror** |
| `PLAYBOOK.md` | **repo-specific** detail: build pipeline, block system + naming grammar (§4), debug overlay, converter metadata as applied here | Yes |
| `CLAUDE.md` | catalog roles, asset root, and **anything the mirrors get wrong for this repo** | Yes |

**One rule, one owner.** If a rule is portable, the guide owns it and
PLAYBOOK points at it — see PLAYBOOK §7a for the model ("guide §2 is
canonical for the measured behavior"). Restating a portable rule locally is
how it drifts; four of the defects found on 2026-08-07 were exactly that.

**Correcting a mirror.** Both carry a `DO NOT EDIT HERE` header — they are
re-mirrored from `docs/` in the private `email-to-en-marketing-tools` repo
and edits here are overwritten on the next mirror. When one is wrong:

1. Record the correct rule in this file so work can continue.
2. Hand the user relay text naming the file, the line, and the replacement.
3. Do not edit the mirror, and do not silently work around it.

**Automated drift checking.** `scripts/check-docs.mjs` runs with every build
and asserts the things that actually rotted before: block names cited in docs
still resolve, the demo/example delta is exactly the documented subset, no
top-level `[data-ogsc]`, every dark-mode declaration carries `!important`, no
absolute asset root in source, every `§N` cross-reference resolves, and the
mirrors still carry their header. Run it alone with `npm run check-docs`.
**Prefer a check over a sentence** — a count written in prose rots; a command
that produces the count cannot.

## Catalogs

| File | Role |
| :--- | :--- |
| `src/demo.mjml` | full block catalog with `Category — X` dividers |
| `src/example.mjml` | **curated subset** of demo, see below |
| `src/main.mjml` | master template |
| `src/donation-thank-you.mjml`, `src/recurring-donation-thank-you.mjml` | standalone autoresponders |

**`example.mjml` is a curated subset, not a mirror of `demo.mjml`.**
CONVENTIONS.md's lead-in prompt says the two catalogs "carry the same block
set — KEEP THEM IN SYNC." That is true for every block they *share*: a change
to a shared block belongs in both. It is **not** an instruction to equalize
the block lists. `example.mjml` deliberately omits eight blocks:

    Story Card (orange-bordered)   Text w/ Background Image
    Photo Card (green CTA)         Photo Card (outline CTA)
    Progress Meter Block           Countdown Card
    Question Block                 Footer

They were removed on request to make a shorter demonstration page. Do not
"restore parity" by adding them back. Verify the delta is still exactly those
eight, and nothing else, with:

```bash
diff <(grep -oE '<!-- START: [^>]*-->' src/demo.mjml) \
     <(grep -oE '<!-- START: [^>]*-->' src/example.mjml)
```

## Two HTML outputs per page

Every `src/*.mjml` compiles to **two** files in `dist/`:

| Output | Asset URLs | Debugger | Use |
| :--- | :--- | :--- | :--- |
| `<name>.html` | relative (`assets/x.png`) | **kept** | working copy; what the preview server serves |
| `<name>.cdn.html` | absolute | **stripped** | paste-in ready for an EN send / autoresponder |

**Neither is what the importer reads.** It consumes `src/<name>.mjml` (the
build copies the raw sources into `dist/` alongside the HTML) and explicitly
*rejects* compiled HTML with a plain-English error — see CONVENTIONS.md.
The `.cdn.html` rewrite therefore duplicates the importer's own
`rewriteAssetPaths` on purpose: that one feeds block/template JSON from the
MJML, this one feeds a paste-in HTML send. Both assume EN's flat CDN folder.

`scripts/emit-cdn-variants.mjs` produces the second from the first as the last
build step. It rewrites all four carriers MJML emits for one background image
(guide §4) plus `<img src>`, and removes every `<script>` and the 🐞 toolbar.

**TPL's EN asset root** (flat folder — filenames must be unique repo-wide):

```
https://bd6ca9cefa6fb6e0adf1-c2f9aa1adb9f60a775f60074e4c86031.ssl.cf5.rackcdn.com/20002/
```

Override for another environment with `TPL_ASSET_ROOT=… npm run build`.

**Source MJML always keeps relative paths** (guide §7 — absolute URLs in
source defeat environment portability). The regression test is the asset-root
id specifically, which must return nothing:

```bash
grep bd6ca9cefa6fb6e0adf1 src/*.mjml
```

Do not grep for `rackcdn.com` — the footer social icons legitimately live on
a different TPL container (16 hits, all expected). That is the documented
"genuinely external asset" exception.

## Working rules

- Never commit or push unless asked. "Commit" means commit **and** push to
  `origin/main`.
- Run `npm run build` after any source change; it must print zero `WARN`
  lines. Then run the guide's §8 QA checklist and report what each check
  returned.
