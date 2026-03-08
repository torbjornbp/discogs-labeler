# Discogs Label Printer

Generate and print labels for your vinyl collection using your [Discogs](https://www.discogs.com) username or a CSV export. Runs in the browser — [torbjorn.no/discogs-labeler](https://torbjorn.no/discogs-labeler).

Currently supports Avery 3448 label sheets (70×37mm, 24-up A4). Those are the only sheets I have available, but I assume it will be trivial to add support for other templates.

## How it works

Three screens: **Home → Select → Preview/Print**.

**Data ingestion.** Records come in via the Discogs API (`fetchAllReleases` + `formatRelease`) or a CSV export (`parseDiscogsCSV`). Both produce identically-shaped objects. CSV mode adds fields the API doesn't expose: Media/Sleeve Condition, Notes, Folder, Rating.

**Label rendering.** Labels render in two places: `LabelCell.jsx` (React preview, pixel sizes) and `print.js` (raw HTML strings, mm sizes). Both read from `FIELD_STYLES` in `fields.js`, which is the single source of truth for typography. Changing a style there updates both.

**Print output.** `openPrintWindow()` builds a standalone HTML document with `@page { size: A4; margin: 0 }` and a CSS grid, opens it in a new tab, waits for all QR `<img>` elements to load, then calls `window.print()`.

**State.** All persistent state (field visibility, order, font/QR scale, padding, layout mode) lives in `App.jsx` and syncs to `localStorage`. `searchQ` and scroll position stay in `SelectScreen` since resetting them on navigation is fine.

**Tracklist fetching.** When enabled, `fetchTracklists()` hits the Discogs release endpoint for each selected record, throttled to one request per 2.5 s. Results are cached in `tracklistMap` for the session.

**Templates.** `TEMPLATES` in `src/lib/templates.js` defines sheet geometry (page size, margins, grid, label dimensions in mm and px). Adding a new label format only requires a new entry there.

## Dev

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Self-hosting

It's a static SPA. To serve it from a subpath:

1. Set `base: '/your-path/'` in `vite.config.js`
2. `npm run build`
3. Drop `dist/` wherever your static host expects it

## License

[AGPL v3](LICENSE)

## Stack

- [React 19](https://react.dev)
- [Vite](https://vite.dev)
- [Discogs API](https://www.discogs.com/developers/)
