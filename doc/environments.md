# Environments Strategy (Preview + Production)

This project uses separate frontend and backend deployments for preview and production.

## Topology

- Frontend host: Netlify
  - Deploy Preview (pull requests)
  - Production (main branch)
- Backend host: Hono Node service (for example Railway, Render, Fly.io)
  - Preview API service
  - Production API service
- Database host: managed Postgres
  - Preview database/schema
  - Production database/schema

## Required Runtime Values

Frontend (Netlify):

- `VITE_API_URL` (deploy-preview): preview API URL
- `VITE_API_URL` (production): production API URL

Backend (API host):

- `DATABASE_URL` (preview): preview Postgres URL
- `DATABASE_URL` (production): production Postgres URL
- `CORS_ORIGIN` (preview): include preview Netlify URL(s)
- `CORS_ORIGIN` (production): include production Netlify URL
- `ADMIN_SECRET` (optional): required only when admin moderation route is enabled

## Netlify Context Mapping

`netlify.toml` sets `VITE_API_URL` by context:

- `context.deploy-preview.environment.VITE_API_URL`
- `context.production.environment.VITE_API_URL`

Replace placeholder values with your actual API URLs.

## Migration Flow

Run each migration in preview first, validate, then apply to production.

- Apply to preview:

```bash
psql "$DATABASE_URL_PREVIEW" -f server/db/migrations/001_initial_schema.sql
```

- Seed preview only (if needed for QA):

```bash
psql "$DATABASE_URL_PREVIEW" -f server/db/seeds/001_projects.sql
```

- Validate preview API and frontend behavior.
- Apply the same migration to production:

```bash
psql "$DATABASE_URL_PRODUCTION" -f server/db/migrations/001_initial_schema.sql
```

- Seed production only when required by release plan.

## Rollout Checklist

- Provision preview and production Postgres resources.
- Deploy preview and production API services; record their base URLs.
- Set `VITE_API_URL` in Netlify preview/production contexts.
- Set backend `DATABASE_URL` and `CORS_ORIGIN` per environment.
- Keep `ADMIN_SECRET` unset until admin moderation endpoint is enabled.
