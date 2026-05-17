# AI Coding Hackathon – Project Discovery App (PRD)

## Summary

An ultra-simple web app that lets hackathon participants discover available coding projects, view key details, and join exactly one project at a time. Participants can also propose new projects, which become visible only after a manual review step. Identity is lightweight: users enter a display name that’s stored in localStorage; names need not be unique. No real-time updates; the UI refreshes on user actions.

### Goals

- Make it fast and obvious to browse projects and join one.
- Keep the system minimal (no authentication, no owners, no admin UI).
- Support proposing new projects with a manual review step before they appear publicly.

### Non-Goals (MVP)

- No filters, sorts, or search.
- No max team size.
- No notifications (email/push/in-app), no SSO/OAuth.
- No project owners or owner moderation.
- No admin dashboard or analytics/KPIs.
- No file uploads, chat, or real-time updates.

### Users

- Hackathon participants attending a single, specific event (single-event scope).

### Core Experience

1. Browse projects as cards with infinite scroll.
2. View project details page with description and participant list/count.
3. Join exactly one project at a time (auto-accept).
4. Switch to a different project or give up current selection at any time.
5. Propose a new project idea for others to join (manual review required to publish).
6. Simple onboarding: enter display name to start (stored in localStorage).

### Discovery and Cards

- Infinite scroll; no filters/sorts/search.
- Each card displays:
  - title (from projects.title)
  - shortDescription (from projects.short_description)
  - signupCount (calculated)
  - participant names (public) — show up to N (e.g., 5) names with “+X more” if needed
  - isSignedUp is not shown as text but affects styling (highlight/badge for the user’s current project)

Reference fields (as specified):

| Field            | Displayed on Card    | Source                                | Purpose                    |
| ---------------- | -------------------- | ------------------------------------- | -------------------------- |
| id               | No                   | Database (projects.id)                | Internal identification    |
| title            | Yes                  | Database (projects.title)             | Card header                |
| shortDescription | Yes                  | Database (projects.short_description) | Description text           |
| signupCount      | Yes                  | Calculated (API aggregation)          | Participant count          |
| isSignedUp       | No (affects styling) | Calculated (user's signups)           | Border highlight and badge |

Note: Participant names are also displayed on cards (derived from signups), even though not listed as a field above; they are not stored as a separate field.

### Project Details

- Show title, short description, full participant list (display names), and signup count.
- Join/switch/give-up actions are available here and from cards.

### Joining and Switching Rules

- One project at a time enforced globally for a participant.
- Join is auto-accept; no approvals.
- No max team size; joining is always allowed.
- Switching or giving up has no limits or cooldowns.
- No history or reason capture.

### Proposing Projects

- Participants can submit a title and short description.
- There are no project owners; proposals are not tied to ownership or future privileges.
- New proposals are set to “pending” and become visible only after manual review (no admin UI in MVP; review occurs via database console, SQL, or a service-only admin action on the Hono API).

### Identity and Persistence

- Identity is a simple display name entered on first use.
- Name is stored in localStorage; names are not unique; no cross-device persistence beyond localStorage.
- A generated client-side UUID (`client_id`) is also stored in localStorage and sent to the API on each request to associate signups with the same browser session over time.

### Real-Time and Refresh

- No websockets or real-time; data updates only on user actions and manual refresh.

### Internationalization and Accessibility

- English-only.
- Follow standard accessibility practices (labels, contrast, keyboard navigation, focus states, semantic HTML, aria where needed).

---

## Functional Requirements

### Onboarding

- As a participant, I can enter a display name to start using the app.
- The display name (and a generated UUID) are stored in localStorage.
- If a name exists in localStorage, the app skips the name prompt.

### Browse Projects (Cards + Infinite Scroll)

- Fetch approved projects in pages (e.g., 20 per page) and append on scroll bottom.
- Each card shows title, shortDescription, signupCount, participant names preview.
- If `isSignedUp` for the current user is true, the card is visually highlighted (e.g., border and badge).
- Clicking a card opens the project details view.

### Project Details

- Show title, shortDescription, full participant list, and signupCount.
- Show contextual CTA:
  - If user not signed up anywhere: “Join project”.
  - If user signed up elsewhere: “Switch to this project”.
  - If user signed up to this project: “Give up this project”.
- After actions, refresh data for the affected project and the user’s status.

### Join / Switch / Give Up

- Join: Insert a signup for the current participant and project.
- Switch: Remove existing signup for the participant, then insert the new one in a single transaction (via Hono handler + DB transaction).
- Give up: Remove existing signup for the participant.
- Enforce one active signup per participant at the database level.

### Propose Project

- Form fields: title (required), shortDescription (required).
- Submission creates a project with status = pending.
- Pending projects are not visible on the public list until status becomes approved via manual review.

---

## Non-Functional Requirements

- Reliability: Reads are eventually consistent with user actions; explicit refresh occurs after mutations.
- Performance: Initial page loads within ~1s on modern broadband; page size ~20; images are not used in MVP cards.
- Security/Privacy: Participant display names and membership are public; no emails or authentication. API validates input and scopes mutations to the participant identified by `client_id`.
- Observability: Basic console logging for errors on the Hono server; no analytics/KPIs in MVP.

---

## Data Model (Postgres)

The Hono API owns all reads and writes against Postgres. The browser never connects to the database directly.

### Tables

1. participants

```
id uuid primary key default gen_random_uuid(),
display_name text not null,
client_id uuid not null unique, -- stored in localStorage (browser)
created_at timestamptz not null default now()
```

2. projects

```
id uuid primary key default gen_random_uuid(),
title text not null,
short_description text not null,
status text not null default 'pending' check (status in ('pending','approved','rejected')),
created_at timestamptz not null default now()
```

3. signups

```
participant_id uuid not null references participants(id) on delete cascade,
project_id uuid not null references projects(id) on delete cascade,
created_at timestamptz not null default now(),
primary key (participant_id), -- enforces one project at a time
index (project_id)
```

### Visibility Rules

- Only projects with status = 'approved' are returned for browsing and details.
- Pending/rejected projects are visible only via backend tools (no admin UI in MVP).

---

## Backend Architecture (Hono)

### Stack

- **Runtime:** Node.js v24 LTS (same as frontend toolchain).
- **Framework:** [Hono](https://hono.dev/) with `@hono/node-server` for local dev and production.
- **Database:** Postgres via a lightweight query layer (e.g. `postgres` or Drizzle ORM).
- **Location:** `server/` package in the monorepo (or top-level `server/` directory alongside `src/`).

### Request identity

- The frontend sends `X-Client-Id: <uuid>` on every API request (from localStorage).
- On first join or propose, the client also sends `X-Display-Name` (or includes it in the bootstrap body) so the server can upsert the `participants` row.
- The server resolves `client_id` → `participant_id` before any signup mutation.

### API routes (MVP)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/health` | Liveness check |
| `GET` | `/api/projects/cards` | Paginated card list (`limit`, `offset` query params) |
| `GET` | `/api/projects/:id` | Approved project details + full participant list |
| `POST` | `/api/participants/bootstrap` | Upsert participant by `client_id` + `display_name` |
| `POST` | `/api/signups/join` | Join a project (`{ projectId }`) |
| `POST` | `/api/signups/switch` | Switch project in one transaction (`{ projectId }`) |
| `DELETE` | `/api/signups` | Give up current signup |
| `POST` | `/api/projects` | Propose project (`{ title, shortDescription }`) → `status: pending` |

Optional (not exposed in UI; service-only):

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `PATCH` | `/api/admin/projects/:id/status` | Approve/reject pending project (requires `ADMIN_SECRET` header) |

### `GET /api/projects/cards` response shape

Each item in the `items` array:

```json
{
  "projectId": "uuid",
  "title": "string",
  "shortDescription": "string",
  "signupCount": 0,
  "participantNamesPreview": ["name1", "name2"],
  "isSignedUp": false
}
```

Pagination: `{ items, limit, offset, hasMore }`.

Implementation note: the handler runs the same aggregation logic as the former `get_project_cards` SQL (approved projects only, signup counts, up to 5 name preview, `isSignedUp` for the requesting participant). Prefer a single SQL query or a small repository function over N+1 round trips.

### Validation and errors

- Reject unknown `projectId` with `404`.
- Reject join/switch on non-approved projects with `400`.
- Validate title and shortDescription length on propose; strip or reject obvious HTML/script payloads.
- Return consistent JSON errors: `{ "error": "message" }` with appropriate HTTP status.

### CORS

- Allow the Netlify frontend origin(s) in production and `http://localhost:5173` in development.

---

## Frontend Architecture

- Tech: React + TypeScript + Vite.
- State: Minimal local state + `fetch` (or a thin wrapper) against the Hono API base URL; optional React Query for caching and mutation state.
- Identity: On first load, if no `client_id` and `display_name` in localStorage, prompt for name and generate a UUID `client_id`.
- API base URL: `import.meta.env.VITE_API_URL` (e.g. `http://localhost:3000` locally, production API URL on Netlify deploy).
- Headers: attach `X-Client-Id` (and `X-Display-Name` when bootstrapping) on API calls.
- Data fetching:
  - Cards list: `GET /api/projects/cards?limit=20&offset=0`; append results for infinite scroll.
  - Details: `GET /api/projects/:id`.
- Mutations:
  - Join: `POST /api/participants/bootstrap` if needed, then `POST /api/signups/join`.
  - Switch: `POST /api/signups/switch`.
  - Give up: `DELETE /api/signups`.
  - Propose: `POST /api/projects`.
- Refresh behavior: After any mutation, refetch relevant queries; otherwise no background polling.

### Styling Cues

- Card highlight and small badge when `isSignedUp` is true.
- Participant names on cards: display up to 5 inline chips; show “+X more” if truncated.

---

## User Flows

1. First-time user

- Land → Prompt for display name → Save to localStorage (and generate client_id) → Show project list (page 1)

2. Browse and view details

- Scroll to load more → Click a card → See details with full participant list → Back to list

3. Join a project (not signed up yet)

- Details or card CTA → Bootstrap participant by client_id → Join via API → Refresh details and card list → Card shows highlight badge

4. Switch projects (already signed up)

- Details or card CTA on another project → Switch via API (transactional) → Refresh new/old cards and details

5. Give up

- Details or card CTA → Delete signup via API → Refresh list/details → No project highlighted

6. Propose project

- Open “Propose” → Enter title and shortDescription → Submit → Project created as pending → Not visible in list until approved via backend

---

## Deployment & Environments

- **Frontend hosting:** Netlify (static `dist/`).
- **Backend hosting:** Hono API deployed as a Node service (e.g. Fly.io, Railway, Render) or Netlify/serverless adapter if the team prefers a single host; Postgres hosted separately (e.g. Neon, Supabase Postgres-only, or RDS).
- **Local dev:** run Vite (`npm run dev`) and Hono (`npm run dev:server` or similar) concurrently; Postgres via Docker Compose.
- **Environment config:**
  - Frontend (Netlify): `VITE_API_URL` pointing at the deployed Hono API.
  - Backend: `DATABASE_URL`, `CORS_ORIGIN` (Netlify preview + production URLs), optional `ADMIN_SECRET` for moderation endpoint.
- **Manual moderation:** update `projects.status` to `approved` via SQL, DB console, or `PATCH /api/admin/projects/:id/status` with `ADMIN_SECRET` (not shipped in the public UI).

---

## Acceptance Criteria

- Entering a display name once persists across reloads in the same browser.
- Project list renders with infinite scroll and shows title, shortDescription, signupCount, and participant names preview.
- Joining immediately highlights the chosen project; switching/giving up updates UI accordingly.
- Users can only be signed up to one project at a time (enforced in DB via primary key on signups.participant_id).
- Proposing a project creates a pending record that is not visible until status becomes approved.
- No filters/sorts/search; no notifications; no owners; no dashboards.
- No real-time updates; data reflects actions after explicit refreshes triggered by mutations.
- All data access from the browser goes through the Hono API; no direct database credentials in the frontend.

---

## Risks & Mitigations

- No authentication means duplicate or impersonated display names are possible.
  - Acceptable for MVP; show only display names publicly. API trusts `X-Client-Id` for mutation scope (same limitation as client-only identity).
- Manual review without admin UI may be inconvenient.
  - Acceptable for MVP; approve via DB console or protected admin route.
- Anyone who knows another user’s `client_id` could mutate their signup.
  - Acceptable for MVP; document as known risk. Post-MVP: session tokens or real auth.

---

## Future Enhancements (Post-MVP)

- Simple admin UI to approve/reject projects.
- Basic search and filtering (tech tags, newest).
- Real-time participant counts (WebSockets or SSE from Hono).
- Optional authentication to reduce impersonation.
- Owner-like capabilities (without implying hard ownership), e.g., project curators.
