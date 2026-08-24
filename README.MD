# Trust for Public Land EN Marketing Tools - Template Repository

This repository contains the MJML source code, assets, and JSON exports for the Trust for Public Land Engaging Networks Marketing Tools email templates.

Client Documentation can be found here: **TO DO: ADD LINK TO DOCUMENTATION**

## Project Structure

- **`src/`**: Contains the source MJML templates and assets.
  - `main.mjml`: The master email template file.
  - `style.css`: The CSS file for styling the email templates.
  - `assets/`: Contains images and other assets used in the templates,
    plus `debug.js` — the dev-only overlay (never shipped in a send).
    Toggling it on outlines every block and hatches every spacer in
    light-blue diagonal stripes, so the gaps between blocks are visible
    rather than inferred. See PLAYBOOK.md §5.
- **`dist/`**: Contains the compiled HTML files generated from the MJML templates
- **`exports/`**: Contains the JSON definitions for the email blocks and the master template, ready for import into Engaging Networks.
- **`documentation/`**: Contains detailed documentation for the templates and blocks **TO DO: ADD LINK TO DOCUMENTATION**

## Type scale (brand standard)

Adopted 2026-08-24 and reconciled across every block. This is the ONLY
approved set of font-size / line-height pairs; the full audit and per-block
mapping live in the importer repo's `docs/type-scale-audit.md`, and the
authoring rules (inherit-don't-restate, intent mapping, heading tiers) are
MJML-AUTHORING-GUIDE.md §5.

| Style | Where it lives | Size | Line-height |
|---|---|---|---|
| Email Heading XLG | `h1` (hero statements only) | 48px | 54px |
| Email Heading LG | `h2` | 36px | 45px |
| Email Heading | `h3` | 26px | 34px |
| Email Button | `mj-button` default / pill anchors | 22px | 28px |
| Email Button small | (reserved — no current use) | 18px | 22px |
| Email Paragraph large | `p` rule + `mj-text` default — the body default | 18px | 24px |
| Email Paragraph base | inline, for de-emphasized copy | 16px | 24px |
| Email Footer | `.footer-text` and footer link rows | 14px | 18px |
| Email caption | `mj-class="caption"` | 10px | 16px |

Notes that keep this honest:

- Line-heights are absolute per size — there is NO ratio. Do not derive or
  annotate one.
- Button labels are all caps everywhere, so the caps metrics above are the
  only button metrics; the source table's Bold/Italic/Underline variant rows
  were deliberately dropped in consolidation (user decision 2026-08-24).
- Body copy INHERITS the default — never restate 18px/24px inline in RTE
  content (guide §5, "Never restate a stylesheet default inline").
- Heading elements are size classes, not a document outline: no catalog
  block ships an `h1` (banners are `h2`, card titles `h3`); `h1` remains for
  hero statements such as the autoresponders' "Thank you".
- Two tuned lockups sit outside the table on purpose: the Countdown
  numerals (32/36 — the legend aligns by `&nbsp;` count) and the Steps
  Block `.step-num` badge (13/20 monospace chip). Everything else conforms.

## Getting Started

This project uses [MJML](https://mjml.io/) to generate responsive email HTML.

### Prerequisites

- Node.js and npm

### Installation

```bash
npm install
```

### Development

1.  **Edit Templates:** Modify the `.mjml` files in `src/`.
2.  **Build:** Compile all templates to HTML in the `dist/` directory:
    ```bash
    npm run build
    ```
3.  **Watch Mode:** Automatically rebuild templates on file changes:
    ```bash
    npm run watch
    ```

## Available Blocks

The following blocks are available for use in the "4Site Main Template":

- **TODO**: Add block names and descriptions here.

For detailed configuration options and previews, please refer to the documentation.

