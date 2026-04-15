# Fast Image Compressor

A Next.js web app that compresses images to **300–400 KB** while keeping the **original resolution**. Runs entirely in the browser — no uploads, no backend, fully offline after first load.

## Features

- Drag & drop or bulk upload (JPEG / PNG / WebP)
- PNG output with palette quantization (UPNG.js) — full resolution preserved
- Parallel processing with `createImageBitmap` + `OffscreenCanvas` — typically sub-second per image
- Live preview thumbnails with original → compressed size, % saved, dimensions, time
- Rename each file before download
- Per-file download or **Download all as ZIP**

## Tech

- Next.js 14 (App Router, static export)
- React 18
- [UPNG.js](https://github.com/photopea/UPNG.js) — PNG encoder with color quantization
- [JSZip](https://stuk.github.io/jszip/) — client-side ZIP generation

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build for Offline / Static Hosting

```bash
npm run build
```

The `out/` folder is a fully static site. Serve it with any static server:

```bash
npx serve out
```

Deploy the `out/` folder to Vercel, Netlify, GitHub Pages, or any static host.

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import the repo on [vercel.com](https://vercel.com).
3. Click **Deploy** — no configuration needed.

## How Compression Works

PNG is lossless, so the only way to reduce size without losing resolution is **color quantization** — reducing the palette from millions of colors down to 2–256. The app binary-searches the palette size until the output lands in the 300–400 KB range while preserving the original width × height.

## License

MIT
