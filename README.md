# Web Tools Collection

A collection of simple, useful web tools.

## Tools

- **Tap Counter** (`/page-apps/counter`) - A simple tap counter with dark mode support
- **Image to BMP Converter** (`/page-apps/bmp-convert`) - Convert PNG/JPEG images to BMP format locally in your browser

## Local Development

To run locally, use a local server (required for ES6 modules):

```bash
npx serve
```

Then open the URL shown in your terminal (typically `http://localhost:3000`).

- Home page: `http://localhost:3000/page-apps/`
- Counter tool: `http://localhost:3000/page-apps/counter`
- BMP Converter: `http://localhost:3000/page-apps/bmp-convert`

## Deployment

This repository is configured for GitHub Pages:

1. Enable GitHub Pages in repository settings
2. Select the branch to deploy (usually `main` or `master`)
3. Select the root directory as the source
4. The site will be available at `https://username.github.io/page-apps/`

## Adding New Tools

To add a new tool:

1. Create a new directory (e.g., `/new-tool/`)
2. Add `index.html` in that directory (and any CSS/JS files needed)
3. Add tool entry to the `tools` array in `/index.html` with path `/page-apps/new-tool`
