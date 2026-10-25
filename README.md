# Discogs Label Printer

Generate and print labels for your vinyl collection using your [Discogs](https://www.discogs.com) username or a CSV export. Runs in the browser — [torbjorn.no/discogs-labeler](https://torbjorn.no/discogs-labeler).

Supports Avery 3448 label sheets (70×37mm, 24-up A4) and an **experimental** Brother DK-1201 layout (90.3×29mm, one label per page). Template geometry lives in `src/lib/templates.js`; the print stylesheet uses each template's page size.

## How it works

Three screens: **Home → Select → Preview/Print**, plus a loading state while a collection is fetched/parsed.

**Data ingestion.** Records come in via the Discogs API (`fetchAllReleases` + `formatRelease`) or a Discogs collection/inventory CSV export (`parseDiscogsCSV`). They are normalized to a common shape. CSV can add fields the API doesn't expose: Media/Sleeve Condition, Notes, Folder, and Price. Rating is available from both the API and collection exports (Discogs collection items include `rating`).

Collection QR codes link to `/release/<release_id>`; inventory QR codes link to `/sell/item/<listing_id>`. Inventory prices are shown exactly as exported, with an optional user-entered currency prefix such as `$` or `kr `. No currency is inferred or converted. Inventory-only rows have no release ID, so they cannot fetch tracklists.

Labels can show either the imported **Price**, a separate **Price (write-in)** line for handwriting, or both.

The CSV parser is a small state machine over the whole file, so commas, escaped quotes, CRLF, a UTF-8 BOM, and newlines inside quoted notes are handled correctly.

**Label rendering.** Labels render in two places: `LabelCell.jsx` (React preview) and `print.js` (raw HTML strings, mm sizes). `FIELD_STYLES` in `fields.js` is the single source of truth for typography; preview px sizes are derived from the print mm sizes, and shared spacing/column constants live in `layout.js`. Changing a value there updates both. `LazySheet` only mounts a page when it is near the viewport, so large collections don't render all labels and QR codes at once.

**Print jobs.** Each record can be repeated up to 100 times, in grouped order (`A, A, B, B`). Avery jobs can start at any cell on the first sheet to use partially consumed sheets; later pages begin at cell one. Copies and start position are per-job settings.

**Print output.** `openPrintWindow()` opens a blank window synchronously (staying inside the click's popup permission), shows progress while QR codes are generated in chunks, writes a standalone HTML document with `@page { size: <template page size>; margin: 0 }` and a CSS grid, waits for fonts/images (with a timeout), then calls `window.print()`.

**Brother DK-1201 is experimental.** It uses the normal browser print dialog and has not been hardware-verified. Select DK-1201 / 29 × 90mm in the Brother driver, use 100% scaling, disable browser headers and footers, and verify orientation and label cutting on a test print.

**QR codes.** Generated locally with `qrcode-generator` (cached in memory), so previews and printing work offline and no release/listing URLs are sent to a third-party QR service. Print preparation yields between chunks to keep the UI responsive.

**State.** Persistent layout settings (field visibility, order, font/QR scale, padding, layout mode, second-column assignment) are stored separately per template. The global currency prefix, input mode, and sort also persist in namespaced `localStorage` keys (`discogs-labeler.*`). Stored values are validated on load, so stale or corrupt settings can't crash the UI. `searchQ` and scroll/render position stay in `SelectScreen`; preview scale, copies, start position, and fetch progress stay in `PreviewScreen`.

**Tracklist fetching.** When enabled, `fetchTracklists()` hits the Discogs release endpoint for each selected record through the same shared rate limiter as collection fetching. Results are cached in `tracklistMap` for the session; failures are left uncached so they can be retried. The preview shows an estimated time and a live countdown if Discogs rate-limits the connection.

**Templates.** `TEMPLATES` in `src/lib/templates.js` defines page/label geometry, grid dimensions, margins, and the maximum QR scale. The print document follows the selected template's page size.

## Rate limits

Discogs allows **25 requests/minute** unauthenticated (tracked by source IP) and **60 requests/minute** with a personal access token. The browser cannot read Discogs' rate-limit headers, and Discogs' `429` responses omit CORS headers, so a rate limit appears to the app as a network failure. Discogs also does not send `Retry-After`, and requests attempted while blocked still count against the window. This was verified against the live API.

The app therefore paces proactively rather than waiting for a `429`:

- Every Discogs request goes through one serialized queue (`src/lib/discogsClient.js`), shared by collection and tracklist fetching.
- Anonymous requests are spaced 3 s apart (20/min); with a token, 1.2 s apart (50/min). The headroom covers some other traffic on the same IP.
- The unauthenticated limit is per source IP, so other tabs or apps on the same connection share the 25/min budget. An authenticated request uses the token's own 60/min bucket.
- If a request fails after sustained usage (the browser-observable form of a rate limit), or a readable `429` is returned, the whole queue pauses for 60 s. Repeated hits back off to 120 s, 240 s, then 300 s. The UI shows a countdown and ETA, and nothing is retried during the pause.
- Low-usage network failures are treated as network/auth/private-collection errors instead of triggering a long pause.

**Optional token.** On the home screen, expand “Use a Discogs token”. Create one at [discogs.com/settings/developers](https://www.discogs.com/settings/developers). It is kept in `sessionStorage` only (this tab, not persistent localStorage) and is sent only to `api.discogs.com`. A token raises the limit from 25 to 60 requests/min.

The token is sent as `?token=…` rather than an `Authorization` header. Discogs accepts both, but the `Authorization` header triggers a CORS preflight on every request, and preflights consume the authenticated quota too — effectively halving the usable 60/min. A plain query-parameter GET has no preflight. The trade-off is that the token is visible in the browser's network panel and in Discogs' server logs.

For large collections, the CSV export is still the fastest path. Tracklists require one API request per selected release; the preview estimates how long that will take.

## Dev

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
```

Tests use [Vitest](https://vitest.dev), with jsdom for DOM interactions, and cover CSV validation, API cancellation, sorting/date handling, field normalization, per-template profile persistence, price formatting, pagination/copies, QR generation, tracklist errors, print HTML, and screen interactions.

## Self-hosting

It's a static SPA. To serve it from a subpath:

1. Set `base: '/your-path/'` in `vite.config.js`
2. `npm run build`
3. Drop `dist/` wherever your static host expects it

The Iosevka font files are loaded from `torbjorn.no` (with permissive CORS). Replace the `@font-face` URLs in `src/index.css` and `src/lib/print.js` (or self-host the fonts) if you want a fully self-contained deployment.

## Privacy

- Collection data goes only to the Discogs API (when using a username) or stays in the browser (CSV mode).
- An optional Discogs token is stored in `sessionStorage` (this tab only) and sent only to `api.discogs.com`. It is never stored in persistent localStorage. It is sent as a query parameter to avoid per-request CORS preflights.
- QR codes are generated locally; release and marketplace listing URLs are not sent to a QR service.
- The deployed site uses [GoatCounter](https://www.goatcounter.com) for anonymous page-view analytics. Remove the script in `index.html` if you don't want that.

## License

[AGPL v3](LICENSE)

## Stack

- [React 19](https://react.dev)
- [Vite](https://vite.dev)
- [Vitest](https://vitest.dev)
- [Discogs API](https://www.discogs.com/developers/)
- [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
