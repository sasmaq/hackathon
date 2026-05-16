# AI Coding Hackathon

A small React + TypeScript app for hackathon participants to browse AI coding projects, join one project at a time, switch or give up their current selection, and propose new project ideas.

## Run Locally

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

## Deploy

Deploy the `dist/` folder to any static host. For Netlify, use:

- Build command: `npm run build`
- Publish directory: `dist`

The current MVP stores identity, signups, and pending proposals in `localStorage`; no backend environment variables are required yet.
