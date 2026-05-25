# National Geographic Society EN Marketing Tools - Template Repository

This repository contains the MJML source code, assets, and JSON exports for the National Geographic Society Engaging Networks Marketing Tools email templates.

Client Documentation can be found here: **TO DO: ADD LINK TO DOCUMENTATION**

## Project Structure

- **`src/`**: Contains the source MJML templates and assets.
  - `main.mjml`: The master email template file.
  - `style.css`: The CSS file for styling the email templates.
  - `assets/`: Contains images and other assets used in the templates.
- **`dist/`**: Contains the compiled HTML files generated from the MJML templates
- **`exports/`**: Contains the JSON definitions for the email blocks and the master template, ready for import into Engaging Networks.
- **`documentation/`**: Contains detailed documentation for the templates and blocks **TO DO: ADD LINK TO DOCUMENTATION**

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

