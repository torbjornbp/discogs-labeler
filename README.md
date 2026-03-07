# Discogs Label Printer

Generate and print labels for your vinyl collection using your [Discogs](https://www.discogs.com) username or a CSV export. Runs in the browser — [torbjorn.no/discogs-labeler](https://torbjorn.no/discogs-labeler).

Currently supports Avery 3448 label sheets (70×37mm, 24-up A4). Those are the only sheets I have available, but I assume it will be trivial to add support for other templates.

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
