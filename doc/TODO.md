# Implementation TODO – AI Coding Hackathon (Small, AI-friendly increments)

For every item:

- update documentation
- run a quick security check, and
- extend both E2E and unit tests to cover the new behavior (once testing is set up)

1. Init
   - [x] Scaffold app with Vite (React + TypeScript) using Node.js v24 LTS
   - [x] Add basic `Hello World` page and route
   - [ ] Commit lockfile and add `.gitignore`
   - [ ] Add minimal README (run, build, deploy)
   - [ ] Add ESLint (typescript, react hooks) and Prettier with scripts
   - [ ] Enable TypeScript strict mode

2. CI pipeline
   - [ ] Initialize GitHub repository and push
   - [ ] Add CI workflow for Node.js v24
   - [ ] Enable dependency caching
   - [ ] Install dependencies
   - [ ] Run lint checks
   - [ ] Run type checks
   - [ ] Build the project

3. Initialize unit tests (Jest + React Testing Library)
   - [ ] Add Jest and React Testing Library dependencies
   - [ ] Add test config (jest.config, setupTests, tsconfig updates)
   - [ ] Add npm scripts: `test`, `test:watch`, `test:ci`
   - [ ] Create first unit test (Hello World renders)
   - [ ] Update CI workflow to run unit tests step

4. Netlify deployment via CLI
   - [ ] Add `netlify-cli` as devDependency
   - [ ] Create site (CLI or UI once) and record SITE_ID
   - [ ] Add GitHub Secret: `NETLIFY_AUTH_TOKEN`
   - [ ] Configure repository variable: `NETLIFY_SITE_ID`
   - [ ] Configure CI to deploy preview builds on PRs
   - [ ] Configure CI to deploy production on main
   - [ ] Document local auth and manual deploy flow
   - [ ] Do NOT connect repo in Netlify UI (CLI-driven only)

5. App shell and routing (mocked)
   - [ ] Add app layout (header, content container)
   - [ ] Add routes: `/` (Project List), `/project/:id` (Details), `/propose` (Propose)
   - [ ] Add theme/tokens and basic global styles
   - [ ] Add error boundary and 404 route

6. Testing foundations
   - [ ] Install Playwright and browsers
   - [ ] First E2E: Hello World renders at `/`
   - [ ] Wire Playwright to CI (allow failure initially if flaky)
   - [ ] Install Playwright and browsers
   - [ ] First E2E: Hello World renders at `/`
   - [ ] Wire Playwright to CI (allow failure initially if flaky)

7. Identity (localStorage)
   - [ ] Implement name prompt modal (first visit)
   - [ ] Store `display_name` and generated `client_id` (UUID) in localStorage
   - [ ] Show current display name in header

8. Project cards (mocked)
   - [ ] Create `ProjectCard` component (title, shortDescription, signupCount, participant chips)
   - [ ] Add `isSignedUp` visual state (highlight + badge)
   - [ ] Mock ~6–9 projects for dev (JSON or in-memory)
   - [ ] Infinite scroll: append next mocked page on bottom reach

9. Details view (mocked)
   - [ ] Build details page (title, short description, full participant list)
   - [ ] Contextual CTA: Join / Switch / Give up (mocked state)
   - [ ] Empty states and loading placeholders

10. Propose project (mocked)
   - [ ] Propose form with validation (title, shortDescription)
   - [ ] Submit adds to local mocked list with `pending` status
   - [ ] Do not show pending proposals in main list

11. Component and unit tests expansion (mocked)
   - [ ] Tests: `ProjectCard` renders fields and chips
   - [ ] Tests: name prompt stores localStorage values
   - [ ] Tests: infinite scroll appends items

12. Supabase project setup
   - [ ] Create Supabase project; store URL and anon key (local only)
   - [ ] Create tables: `participants`, `projects`, `signups`
   - [ ] Enable RLS on all tables
   - [ ] Seed a few `projects` (approved and pending)
   - [ ] SQL file(s) checked into `supabase/sql/`
   - [ ] Document moderation flow (approve via Supabase dashboard)

13. Local dev: Supabase and Edge Functions
   - [ ] Install Supabase CLI and Docker
   - [ ] `supabase start` to run local Postgres and APIs
   - [ ] `supabase functions serve` for local Edge Functions
   - [ ] Add `.env.local` and map env to local services
   - [ ] Docs: how to run full stack locally

14. Supabase environments (preview + prod)
   - [ ] Create preview and prod environments (separate projects or isolated DBs)
   - [ ] Configure Netlify contexts: Deploy Previews → preview, Production → prod
   - [ ] Store context-specific Supabase URL and anon key in Netlify
   - [ ] Document environment strategy and migration flow

15. RLS policies (minimum viable)
   - [ ] `projects`: read approved only; insert allowed for pending
   - [ ] `participants`: allow insert; limit updates to minimal fields
   - [ ] `signups`: allow insert/delete; note impersonation risk (MVP)
   - [ ] Document limitations and future fix (Edge Functions or auth)

16. Edge Function: `get_project_cards`
   - [ ] Implement nested SQL returning id, title, short_description, signup_count, participant_names_preview, is_signed_up
   - [ ] Verify pagination (limit, offset) and ordering (created_at desc)
   - [ ] Add function code and SQL to repo with usage notes

17. Frontend integration (read-only)
   - [ ] Add Supabase JS client and env variables
   - [ ] Replace mocked list with Edge Function `get_project_cards`
   - [ ] Keep infinite scroll with server pagination
   - [ ] Details view: fetch full participant list for a project
   - [ ] Implement loading and error states

18. Participant bootstrap (lazy)
   - [ ] On first join/propose, upsert participant by `client_id`
   - [ ] Store returned `participant_id` in memory

19. Join / Switch / Give up (backend)
   - [ ] Implement join: insert into `signups` for current participant
   - [ ] Implement give up: delete from `signups` by participant
   - [ ] Create RPC `switch_signup(new_project_id, participant_id)` (transactional)
   - [ ] Wire UI CTAs to mutations; optimistic update then refetch

20. Propose project (backend)
   - [ ] Insert `projects` with `status='pending'`
   - [ ] List shows only `approved`
   - [ ] Document how to approve in Supabase dashboard

21. Integration tests
   - [ ] Mock Supabase in tests for list/details flows
   - [ ] Tests: join → switch → give up lifecycle
   - [ ] Tests: propose → not visible until approved

22. CI/CD enhancements
   - [ ] Enforce tests and build in CI (fail PRs on errors)
   - [ ] Cache `node_modules` in CI
   - [ ] Ensure Netlify env vars for preview and production
   - [ ] README: add CI and Netlify status badges

23. Security hardening
   - [ ] Netlify `_headers`: CSP (default-src 'self'; connect-src add Supabase), frame-ancestors 'none'
   - [ ] Add Referrer-Policy, X-Content-Type-Options, Permissions-Policy
   - [ ] Validate inputs on propose form (length, disallow script tags)
   - [ ] Sanitize/escape any user-provided text rendering (React default safe)

24. UX polish and accessibility
   - [ ] Keyboard navigation and focus outlines
   - [ ] ARIA labels for buttons and forms
   - [ ] High-contrast check and color tokens
   - [ ] Better empty and error states
   - [ ] Loading skeletons for cards and details

25. E2E smoke tests and deploy gates
   - [ ] Playwright: first load, list renders, details open
   - [ ] Playwright: join → switch → give up (against test Supabase)
   - [ ] Add E2E job to CI (nightly or on demand)
   - [ ] Netlify: run smoke tests on preview URL (optional)

26. Release readiness
   - [ ] Final README: setup, environment, deploy, moderation
   - [ ] Confirm production Netlify deploy from `main`

27. Post-MVP backlog
   - [ ] Search/filter (title, newest)
   - [ ] Real-time updates for counts
   - [ ] Edge Functions or auth to improve RLS security
