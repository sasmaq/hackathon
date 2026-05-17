# AI Coding Hackathon

A small React + TypeScript app for hackathon participants to browse AI coding projects, join one project at a time, switch or give up their current selection, and propose new project ideas.

## Run Locally

Use Node.js 24:

```bash
nvm use
```

```bash
npm install
npm run dev
```

Vite will print the local URL, usually `http://localhost:5173`.

## Build

```bash
npm run build
```

The production build is written to `dist/`.

## End-to-End Tests (Playwright)

Install the Playwright browser once:

```bash
npx playwright install chromium
```

Run E2E tests:

```bash
npm run test:e2e
```

Playwright starts the app automatically and runs a smoke test against `/`.

## Deploy

Deploy the `dist/` folder to any static host. For Netlify, use:

- Build command: `npm run build`
- Publish directory: `dist`

The current MVP stores identity, signups, and pending proposals in `localStorage`; no backend environment variables are required yet.
