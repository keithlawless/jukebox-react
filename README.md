# Jukebox React

A React + Vite web UI for browsing music, managing the play queue, controlling playback, and streaming internet radio through the Jukebox backend API.

## Features

- **Queue view**
  - Now Playing card with album artwork
  - Playback controls (Pause/Resume, Stop, Next Song, Empty Queue)
  - Auto-refresh every 5 seconds with countdown
  - Progress bar for standard tracks
  - Internet Radio handling (station description display, no progress bar)
- **Browse view**
  - Artist → Album → Song navigation
  - Add songs to queue
  - Friendly song titles via tag metadata
- **Radio view**
  - Station list from `/api/radio/list`
  - Play/Stop controls per station
- **Version badges**
  - UI version from `package.json`
  - API version from `/api/about/version`

## Tech Stack

- React 18
- React Router
- Vite 5
- Plain CSS

## Requirements

- Node.js 18+ (recommended)
- npm
- Jukebox backend API available

## Getting Started

```bash
npm install
npm run dev
```

By default during development, API requests use relative `/api/*` paths and are proxied by Vite.

## API Configuration

This app supports an optional environment override:

```bash
VITE_API_BASE_URL=http://your-api-host:8080
```

If not set, the app uses relative URLs (`/api/...`).

## Build for Production

```bash
npm run build
```

This generates the `dist/` folder.

## Deploying to Nginx

Deploy the contents of `dist/` and configure Nginx to:

1. Serve the SPA with fallback to `index.html`
2. Reverse-proxy `/api` to your backend API

Example snippets:

```nginx
location / {
  try_files $uri /index.html;
}

location /api/ {
  proxy_pass http://192.168.4.199:8080;
}
```

## Scripts

- `npm run dev` – start local dev server
- `npm run build` – create production build
- `npm run preview` – preview production build locally

## Project Structure

```text
src/
  api/            # API client helpers
  pages/          # Browse, Queue, Radio pages
  components/     # shared UI components
  styles.css      # global styling
```

## License

This project is licensed under the MIT License. See [LICENSE.md](./LICENSE.md).
