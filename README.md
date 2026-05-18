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
- Context env config: see `netlify.toml` (`VITE_API_URL` for deploy previews and production)

Environment and migration strategy for preview/production is documented in `doc/environments.md`.

The current MVP stores identity, signups, and pending proposals in `localStorage`; no backend environment variables are required yet.

## Local Postgres Setup

Copy the env template once (or edit `.env` directly):

```bash
cp .env.example .env
```

Start Postgres with Docker Compose:

```bash
docker compose up -d
```

Connection details for local development:

- Host: `localhost`
- Port: `POSTGRES_PORT` from `.env` (default `5432`)
- Database: `POSTGRES_DB` from `.env` (default `hackathon`)
- User: `POSTGRES_USER` from `.env` (default `hackathon`)
- Password: `POSTGRES_PASSWORD` from `.env` (default `hackathon`)

Apply the schema migration:

```bash
set -a; source .env; set +a
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < server/db/migrations/001_initial_schema.sql
```

Seed starter projects:

```bash
set -a; source .env; set +a
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < server/db/seeds/001_projects.sql
```

Stop the database:

```bash
docker compose down
```

## Backend Server (Hono)

Create the server env file:

```bash
cp server/.env.example server/.env
```

Server env vars:

- `DATABASE_URL` (required): Postgres connection string used by the backend.
- `CORS_ORIGIN` (required): Comma-separated allowlist. Include local frontend (`http://localhost:5173`) and production Netlify origin(s).
- `PORT` (optional): API server port (default `8787`).

Identity limitation (MVP): protected mutation routes resolve the participant from `X-Client-Id` and scope changes to that participant. This is not real authentication; if a client ID is exposed, another client could impersonate it. Future fix: replace header-only identity with session tokens or full auth.

Run the backend in dev mode:

```bash
npm run dev:server
```

Build backend output:

```bash
npm run build:server
```

Serve the built frontend from Hono (single server for app + API):

```bash
npm run build
npm run build:server
npm run start:server
```

Then open `http://localhost:8787`.

## Full Stack Local Development

Ensure local env files exist:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

Create frontend local API config in `.env.local`:

```bash
VITE_API_URL=http://localhost:8787
```

Then run full stack locally:

```bash
docker compose up -d
set -a; source .env; set +a
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < server/db/migrations/001_initial_schema.sql
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" < server/db/seeds/001_projects.sql
npm run dev:fullstack
```

This starts:

- frontend (Vite) on `http://localhost:5173`
- backend (Hono) on `http://localhost:8787`

### Moderation Flow (SQL)

The app should only list projects with `status = 'approved'`. Proposals are created as `pending`, then manually reviewed:

List pending projects:

```sql
select id, title, status, created_at
from projects
where status = 'pending'
order by created_at desc;
```

Approve a project:

```sql
update projects
set status = 'approved'
where id = '<project-uuid>';
```

Reject a project:

```sql
update projects
set status = 'rejected'
where id = '<project-uuid>';
```
