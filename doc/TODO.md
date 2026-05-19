# Implementation TODO - AI Coding Hackathon

For every item:

- update documentation
- run a quick security check, and
- extend both E2E and unit tests to cover the new behavior (once testing is set up)

## 1. Init

- [x] Scaffold app with Vite (React + TypeScript) using Node.js v24 LTS
- [x] Add basic app shell
- [x] Commit lockfile and add `.gitignore`
- [x] Add minimal README (run, build, deploy)
- [x] Add ESLint (typescript, react hooks) and Prettier with scripts
- [x] Enable TypeScript strict mode

## 2. CI Pipeline

- [x] Initialize GitHub repository and push
- [x] Add CI workflow for Node.js v24
- [x] Enable dependency caching
- [x] Install dependencies
- [x] Run lint checks
- [x] Run type checks
- [x] Build the project

## 3. Initialize Unit Tests (Jest + React Testing Library)

- [x] Add Jest and React Testing Library dependencies
- [x] Add test config (jest.config, setupTests, tsconfig updates)
- [x] Add npm scripts: `test`, `test:watch`, `test:ci`
- [x] Create first unit test
- [x] Update CI workflow to run unit tests step

## 4. App Shell and Routing (Mocked)

- [x] Add app layout (header, content container)
- [x] Add routes: `/` (Project List), `/project/:id` (Details), `/propose` (Propose)
- [x] Add theme/tokens and basic global styles
- [x] Add error boundary and 404 route

## 5. Testing Foundations

- [x] Install Playwright and browsers
- [x] First E2E: app renders at `/`
- [x] Wire Playwright to CI (allow failure initially if flaky)

## 6. Identity (localStorage)

- [x] Implement name prompt modal (first visit)
- [x] Store `display_name` and generated `client_id` (UUID) in localStorage
- [x] Show current display name in header

## 7. Project Cards (Mocked)

- [x] Create `ProjectCard` component (title, shortDescription, signupCount, participant chips)
- [x] Add `isSignedUp` visual state (highlight + badge)
- [x] Mock projects for dev (JSON or in-memory)
- [x] Infinite scroll: append next mocked page on bottom reach

## 8. Details View (Mocked)

- [x] Build details page (title, short description, full participant list)
- [x] Contextual CTA: Join / Switch / Give up (mocked state)
- [x] Empty states and loading placeholders

## 9. Propose Project (Mocked)

- [x] Propose form with validation (title, shortDescription)
- [x] Submit adds to local mocked list with `pending` status
- [x] Do not show pending proposals in main list

## 10. Component and Unit Tests Expansion (Mocked)

- [x] Tests: `ProjectCard` renders fields and chips
- [x] Tests: name prompt stores localStorage values
- [x] Tests: infinite scroll appends items

## 11. Database Setup (Postgres)

- [x] Add Docker Compose for local development with Postgres
- [x] Create tables: `participants`, `projects`, `signups` (see PRD data model)
- [x] Add migration SQL under `server/db/migrations/` (or equivalent)
- [x] Seed a few `projects` (approved and pending)
- [x] Document moderation flow (SQL, DB console, or admin API route)

## 12. Hono Server Scaffold

- [x] Create `server/` with Hono and `@hono/node-server`
- [x] Add `GET /api/health` and shared error JSON shape `{ "error": "message" }`
- [x] Wire Postgres client (e.g. `postgres` or Drizzle) via `DATABASE_URL`
- [x] Add CORS for `http://localhost:5173` and production Netlify origin(s)
- [x] Add npm scripts: `dev:server`, `build:server` (as needed)
- [x] Document server env vars in README

## 13. Local Dev: Full Stack

- [x] Start Postgres locally (`docker compose up`)
- [x] Run migrations against local DB
- [x] Run Vite and Hono concurrently for local development
- [x] Add root `.env` for both frontend (`VITE_API_URL`) and backend (`DATABASE_URL`, `CORS_ORIGIN`)
- [x] Docs: how to run full stack locally

## 14. Environments (Preview + Prod)

- [ ] Provision preview and prod Postgres databases (or schemas)
- [ ] Deploy Hono API to preview and production hosts; record API base URLs
- [x] Configure Netlify contexts: Deploy Previews -> preview API, Production -> prod API
- [x] Set `VITE_API_URL` per Netlify context; set `DATABASE_URL`, `CORS_ORIGIN`, optional `ADMIN_SECRET` on API host
- [x] Document environment strategy and migration flow

## 15. API Validation and Access Rules

- [x] Resolve participant from `X-Client-Id` on protected routes
- [x] Public reads return only `approved` projects
- [x] Reject join/switch on non-approved projects; validate propose payload (length, no script tags)
- [x] Scope signup mutations to the resolved participant (note `client_id` impersonation risk for MVP)
- [x] Document limitations and future fix (session tokens or real auth)

## 16. Hono Route: Project Cards and Details

- [x] `GET /api/projects/cards` — aggregation SQL (signup count, name preview, `isSignedUp`)
- [x] Verify pagination (`limit`, `offset`) and ordering (`created_at desc`)
- [x] `GET /api/projects/:id` — approved project details + full participant list
- [x] Add handler/repository tests and usage notes in repo

## 17. Frontend Integration (Read-Only)

- [x] Add thin API client (`fetch` + `VITE_API_URL`); send `X-Client-Id` on requests
- [x] Replace mocked list with `GET /api/projects/cards`
- [x] Keep infinite scroll with server pagination
- [x] Details view: `GET /api/projects/:id`
- [x] Implement loading and error states

## 18. Participant Bootstrap and Signup Mutations

- [x] `POST /api/participants/bootstrap` — upsert by `client_id` + `display_name`
- [x] `POST /api/signups/join` — insert signup for current participant
- [x] `DELETE /api/signups` — give up current signup
- [x] `POST /api/signups/switch` — transactional switch (delete + insert)
- [x] On first join/propose, call bootstrap from client; store `participant_id` in memory if returned
- [x] Wire UI CTAs to API; optimistic update then refetch
- [x] Persist current signup selection across page refresh for consistent Join/Switch/Give up CTAs

## 19. Propose Project (API + UI)

- [x] `POST /api/projects` — insert with `status='pending'`
- [x] List/cards endpoints return only `approved` projects
- [x] Optional: `PATCH /api/admin/projects/:id/status` with `ADMIN_SECRET` for moderation
- [x] Document how to approve (SQL, DB console, or admin route)

## 20. Integration Tests

- [x] Mock API (or test DB + Hono app) for list/details flows
- [x] Server tests: join -> switch -> give up lifecycle
- [x] Tests: propose -> not visible in cards until approved

## 21. CI/CD Enhancements

- [x] Enforce tests and build in CI (fail PRs on errors)
- [x] CI: lint/typecheck/build frontend and server
- [x] Cache `node_modules` in CI

## 22. Security Hardening

- [x] Netlify `_headers`: CSP (`default-src 'self'`; `connect-src` includes API origin), `frame-ancestors 'none'`
- [x] Add Referrer-Policy, X-Content-Type-Options, Permissions-Policy
- [x] Validate inputs on propose form and Hono handlers (length, disallow script tags)
- [x] Sanitize/escape any user-provided text rendering (React default safe)

## 23. UX Polish and Accessibility

- [x] Keyboard navigation and focus outlines
- [x] ARIA labels for buttons and forms
- [x] High-contrast check and color tokens
- [x] Better empty and error states
- [x] Loading skeletons for cards and details

## 24. SQLite-Only Dev Server Mode

- [x] Add env flag `DEBUG_SQLITE_ONLY=true|false` for primary DB selection
- [x] Skip `DATABASE_URL` requirement when `DEBUG_SQLITE_ONLY=true`
- [x] Add SQLite primary data adapter for participants/projects/signups reads and writes
- [x] Run API handlers against SQLite when `DEBUG_SQLITE_ONLY=true`
- [x] Add `npm run dev:server:sqlite` for no-Postgres local startup
- [x] Document SQLite-only local usage in README

## 25. Dev Debug Flag (SQLite Mirror)

- [x] Add server env flag `DEBUG_SQLITE_MIRROR=true|false` (default `false`)
- [x] Add SQLite dependency and connection setup under `server/db/sqlite/`
- [x] Define SQLite schema for debug tables: `participants`, `projects`, `signups`, `events`
- [x] Build a mirror writer utility that upserts Postgres mutation payloads into SQLite
- [x] Gate mirror writes behind `DEBUG_SQLITE_MIRROR` so production behavior is unchanged
- [x] Hook mirror writes into handlers: bootstrap, join, switch, give up, propose, admin approve/reject
- [x] Add startup log indicating whether SQLite mirror mode is enabled and where DB file is stored
- [x] Add npm scripts: `debug:sqlite:inspect` and `debug:sqlite:reset` for local troubleshooting
- [x] Add tests for mirror on/off behavior and write-failure isolation (mirror errors must not break API response)
- [x] Document local usage: enable flag, inspect data, reset DB, and known limitations

## 26. E2E Smoke Tests and Deploy Gates

- [x] Playwright: first load, list renders, details open
- [x] Playwright: join -> switch -> give up (against local or CI test API + Postgres)
- [x] Add E2E job to CI (nightly or on demand)

## 27. Netlify Deployment via CLI

- [ ] Add `netlify-cli` as devDependency
- [ ] Create site (CLI or UI once) and record SITE_ID
- [ ] Add GitHub Secret: `NETLIFY_AUTH_TOKEN`
- [ ] Configure repository variable: `NETLIFY_SITE_ID`
- [ ] Configure CI to deploy preview builds on PRs
- [ ] Configure CI to deploy production on main
- [ ] Document local auth and manual deploy flow
- [ ] Do NOT connect repo in Netlify UI (CLI-driven only)

## 28. Release Readiness

- [ ] Final README: setup, environment, deploy (frontend + Hono API + Postgres), moderation

## 29. Post-MVP Backlog

- [ ] Search/filter (title, newest)
- [ ] Real-time updates for counts (WebSockets or SSE from Hono)

## 30. User Registration and Authentication

- [ ] Add `users` table migration (email unique, `phone_e164` unique, password hash, timestamps; link or replace `participants.client_id`)
- [ ] Add server env vars: `SESSION_SECRET`, optional `AUTH_COOKIE_*` (name, secure, sameSite); document in README and `.env.example`
- [ ] Choose auth approach (e.g. email + password with httpOnly session cookie, or magic link) and document threat model vs current `X-Client-Id` impersonation risk
- [ ] `POST /api/auth/register` — validate email format, phone (normalize to E.164), password policy, display name; hash password (e.g. bcrypt/argon2); reject duplicate email or phone (`409`)
- [ ] `POST /api/auth/login` — verify credentials; issue signed session (cookie or bearer per chosen approach)
- [ ] `POST /api/auth/logout` — invalidate session server-side (if using server sessions) and clear client cookie
- [ ] `GET /api/auth/me` — return current user/participant profile (including phone) for authenticated requests; never expose phone on public project APIs
- [ ] Add auth middleware: resolve participant from session instead of (or in addition to) `X-Client-Id` on protected routes
- [ ] Deprecate or gate `POST /api/participants/bootstrap` for anonymous-only bootstrap; registered users use auth endpoints
- [ ] Migration path: optional one-time link from existing `client_id` localStorage row to new account on first login/register
- [ ] Registration page (email, phone, password, display name) and login page (email + password only); validation, accessible labels, error states
- [ ] Header: show logged-in user; Sign out; link to Register / Log in when anonymous
- [ ] API client: send session cookie (credentials) or `Authorization` header; stop sending `X-Client-Id` once session is established
- [ ] Rate-limit register/login endpoints (per IP and per email) to reduce abuse
- [ ] Security: never log passwords; constant-time compare; CSRF protection if using cookies; tighten CORS/credentials for auth routes
- [ ] Unit tests: register validation (email, phone E.164, duplicate phone), login success/failure, protected route without session returns 401
- [ ] Integration tests: register → login → join project → logout → mutation denied
- [ ] E2E: register new user, log out, log in, join a project
- [ ] Update moderation and env docs for authenticated operators if admin routes gain user-based access later (see section 31)

## 31. Admin Dashboard (Proposed Projects)

- [ ] `GET /api/admin/projects` — return pending proposals (`status=pending` default; optional `status` filter); require `X-Admin-Secret` (same as existing PATCH)
- [ ] Response shape: `{ items: [{ projectId, title, shortDescription, status, createdAt }] }` sorted by `created_at desc`
- [ ] Reuse `PATCH /api/admin/projects/:id/status` for approve (`approved`) and reject (`rejected`) from the dashboard
- [ ] Return `401` when `ADMIN_SECRET` is missing or wrong; return `503` or `501` when `ADMIN_SECRET` is not configured on the server
- [ ] Add admin route `/admin` (not linked from public nav; optional bookmark-only)
- [ ] Admin gate: prompt for admin secret on first visit (sessionStorage) or use server-side session once section 30 auth exists for admin role
- [ ] Pending list UI: table or cards with title, short description, submitted date, and Approve / Reject actions
- [ ] On approve/reject: call PATCH, remove row or update status inline, show success/error toast
- [ ] Empty state when no pending proposals; loading and error states
- [ ] Do not expose `ADMIN_SECRET` in frontend build for production; document local-only `VITE_ADMIN_SECRET` dev pattern vs operator-entered secret
- [ ] Security: rate-limit admin routes; audit log approve/reject (console or `events` table) optional
- [ ] Unit tests: list pending requires secret; PATCH integration from list payload
- [ ] E2E (optional): enter secret → see seeded pending project → approve → project appears on public list
- [ ] Document moderation workflow in README (replace SQL/DB-console steps where possible)
