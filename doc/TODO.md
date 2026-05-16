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

## 4. Netlify Deployment via CLI

- [ ] Add `netlify-cli` as devDependency
- [ ] Create site (CLI or UI once) and record SITE_ID
- [ ] Add GitHub Secret: `NETLIFY_AUTH_TOKEN`
- [ ] Configure repository variable: `NETLIFY_SITE_ID`
- [ ] Configure CI to deploy preview builds on PRs
- [ ] Configure CI to deploy production on main
- [ ] Document local auth and manual deploy flow
- [ ] Do NOT connect repo in Netlify UI (CLI-driven only)

## 5. App Shell and Routing (Mocked)

- [x] Add app layout (header, content container)
- [x] Add routes: `/` (Project List), `/project/:id` (Details), `/propose` (Propose)
- [x] Add theme/tokens and basic global styles
- [x] Add error boundary and 404 route

## 6. Testing Foundations

- [ ] Install Playwright and browsers
- [ ] First E2E: app renders at `/`
- [ ] Wire Playwright to CI (allow failure initially if flaky)

## 7. Identity (localStorage)

- [x] Implement name prompt modal (first visit)
- [x] Store `display_name` and generated `client_id` (UUID) in localStorage
- [x] Show current display name in header

## 8. Project Cards (Mocked)

- [x] Create `ProjectCard` component (title, shortDescription, signupCount, participant chips)
- [x] Add `isSignedUp` visual state (highlight + badge)
- [x] Mock projects for dev (JSON or in-memory)
- [x] Infinite scroll: append next mocked page on bottom reach

## 9. Details View (Mocked)

- [x] Build details page (title, short description, full participant list)
- [x] Contextual CTA: Join / Switch / Give up (mocked state)
- [ ] Empty states and loading placeholders

## 10. Propose Project (Mocked)

- [x] Propose form with validation (title, shortDescription)
- [x] Submit adds to local mocked list with `pending` status
- [x] Do not show pending proposals in main list

## 11. Component and Unit Tests Expansion (Mocked)

- [ ] Tests: `ProjectCard` renders fields and chips
- [ ] Tests: name prompt stores localStorage values
- [ ] Tests: infinite scroll appends items

## 12. Supabase Project Setup

- [ ] Create Supabase project; store URL and anon key (local only)
- [ ] Create tables: `participants`, `projects`, `signups`
- [ ] Enable RLS on all tables
- [ ] Seed a few `projects` (approved and pending)
- [ ] SQL file(s) checked into `supabase/sql/`
- [ ] Document moderation flow (approve via Supabase dashboard)

## 13. Local Dev: Supabase and Edge Functions

- [ ] Install Supabase CLI and Docker
- [ ] `supabase start` to run local Postgres and APIs
- [ ] `supabase functions serve` for local Edge Functions
- [ ] Add `.env.local` and map env to local services
- [ ] Docs: how to run full stack locally

## 14. Supabase Environments (Preview + Prod)

- [ ] Create preview and prod environments (separate projects or isolated DBs)
- [ ] Configure Netlify contexts: Deploy Previews -> preview, Production -> prod
- [ ] Store context-specific Supabase URL and anon key in Netlify
- [ ] Document environment strategy and migration flow

## 15. RLS Policies (Minimum Viable)

- [ ] `projects`: read approved only; insert allowed for pending
- [ ] `participants`: allow insert; limit updates to minimal fields
- [ ] `signups`: allow insert/delete; note impersonation risk (MVP)
- [ ] Document limitations and future fix (Edge Functions or auth)

## 16. Edge Function: `get_project_cards`

- [ ] Implement nested SQL returning id, title, short_description, signup_count, participant_names_preview, is_signed_up
- [ ] Verify pagination (limit, offset) and ordering (created_at desc)
- [ ] Add function code and SQL to repo with usage notes

## 17. Frontend Integration (Read-Only)

- [ ] Add Supabase JS client and env variables
- [ ] Replace mocked list with Edge Function `get_project_cards`
- [ ] Keep infinite scroll with server pagination
- [ ] Details view: fetch full participant list for a project
- [ ] Implement loading and error states

## 18. Participant Bootstrap (Lazy)

- [ ] On first join/propose, upsert participant by `client_id`
- [ ] Store returned `participant_id` in memory

## 19. Join / Switch / Give Up (Backend)

- [ ] Implement join: insert into `signups` for current participant
- [ ] Implement give up: delete from `signups` by participant
- [ ] Create RPC `switch_signup(new_project_id, participant_id)` (transactional)
- [ ] Wire UI CTAs to mutations; optimistic update then refetch

## 20. Propose Project (Backend)

- [ ] Insert `projects` with `status='pending'`
- [ ] List shows only `approved`
- [ ] Document how to approve in Supabase dashboard

## 21. Integration Tests

- [ ] Mock Supabase in tests for list/details flows
- [ ] Tests: join -> switch -> give up lifecycle
- [ ] Tests: propose -> not visible until approved

## 22. CI/CD Enhancements

- [ ] Enforce tests and build in CI (fail PRs on errors)
- [ ] Cache `node_modules` in CI
- [ ] Ensure Netlify env vars for preview and production
- [ ] README: add CI and Netlify status badges

## 23. Security Hardening

- [ ] Netlify `_headers`: CSP (default-src 'self'; connect-src add Supabase), frame-ancestors 'none'
- [ ] Add Referrer-Policy, X-Content-Type-Options, Permissions-Policy
- [ ] Validate inputs on propose form (length, disallow script tags)
- [ ] Sanitize/escape any user-provided text rendering (React default safe)

## 24. UX Polish and Accessibility

- [x] Keyboard navigation and focus outlines
- [x] ARIA labels for buttons and forms
- [ ] High-contrast check and color tokens
- [ ] Better empty and error states
- [ ] Loading skeletons for cards and details

## 25. E2E Smoke Tests and Deploy Gates

- [ ] Playwright: first load, list renders, details open
- [ ] Playwright: join -> switch -> give up (against test Supabase)
- [ ] Add E2E job to CI (nightly or on demand)
- [ ] Netlify: run smoke tests on preview URL (optional)

## 26. Release Readiness

- [ ] Final README: setup, environment, deploy, moderation
- [ ] Confirm production Netlify deploy from `main`

## 27. Post-MVP Backlog

- [ ] Search/filter (title, newest)
- [ ] Real-time updates for counts
- [ ] Edge Functions or auth to improve RLS security
