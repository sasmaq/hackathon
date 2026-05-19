# AI Coding Hackathon – Project Discovery App (PRD)

## Summary

An ultra-simple web app that lets hackathon participants discover available coding projects, view key details, and join exactly one project at a time. Participants can also propose new projects, which become visible only after a manual review step.

**Identity (MVP, shipped):** users enter a display name stored in localStorage plus a browser-generated `client_id` UUID sent on each API request. Display names are not unique; there is no password or cross-device account.

**Identity (post-MVP, planned):** email, phone number, password, and display name at registration; login with email + password; server-issued sessions (see [User Registration and Authentication](#user-registration-and-authentication-post-mvp)). This replaces header-only `client_id` trust for mutations while preserving existing signups via a one-time link migration.

**Moderation (post-MVP, planned):** operators use an admin dashboard at `/admin` to list pending proposals and approve or reject them (see [Admin Dashboard](#admin-dashboard-post-mvp)). MVP uses the same `PATCH` API with `X-Admin-Secret` only (no UI).

No real-time updates; the UI refreshes on user actions.

### Goals

- Make it fast and obvious to browse projects and join one.
- Keep the system minimal for MVP (no authentication, no owners, no admin UI); add real accounts and an admin moderation dashboard post-MVP without changing core join/propose rules.
- Support proposing new projects with a manual review step before they appear publicly.

### Non-Goals (MVP)

- No filters, sorts, or search.
- No max team size.
- No notifications (email/push/in-app) in MVP; no SSO/OAuth in MVP (email/password auth is post-MVP, not enterprise SSO).
- No project owners or owner moderation.
- No admin dashboard or analytics/KPIs in MVP (admin UI is post-MVP; see [Admin Dashboard](#admin-dashboard-post-mvp)).
- No file uploads, chat, or real-time updates.

### Users

- Hackathon participants attending a single, specific event (single-event scope).
- Event operators (post-MVP): trusted staff who review pending proposals via the admin dashboard (not general participants).

### Core Experience

1. Browse projects as cards with infinite scroll.
2. View project details page with description and participant list/count.
3. Join exactly one project at a time (auto-accept).
4. Switch to a different project or give up current selection at any time.
5. Propose a new project idea for others to join (manual review required to publish).
6. Simple onboarding (MVP): enter display name to start (stored in localStorage). Post-MVP: register with email, phone number, password, and display name, or log in with email and password (optional link from prior anonymous session).

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
- New proposals are set to “pending” and become visible only after manual review.
- **MVP (current):** review via database console, SQL, or `PATCH /api/admin/projects/:id/status` with `X-Admin-Secret` (no public UI).
- **Post-MVP (planned):** operators use the admin dashboard at `/admin` to list pending proposals and approve or reject them (see [Admin Dashboard](#admin-dashboard-post-mvp)).

### Identity and Persistence

**MVP (current)**

- Identity is a simple display name entered on first use.
- Name is stored in localStorage; names are not unique; no cross-device persistence beyond localStorage.
- A generated client-side UUID (`client_id`) is also stored in localStorage and sent to the API on each request to associate signups with the same browser session over time.

**Post-MVP (planned)**

- Registered users provide email, phone number, password, and display name at sign-up; they log in with email and password. The server issues an httpOnly session cookie bound to a `users` row and linked `participants` row. Phone numbers are private (not shown on project cards or public participant lists).
- Mutations resolve the participant from the session, not from `X-Client-Id` alone.
- See [User Registration and Authentication](#user-registration-and-authentication-post-mvp) for flows, session storage, and migration from `client_id`.

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

### Registration and Login (Post-MVP)

- As a new participant, I can register with email, phone number, password, and display name and receive a logged-in session without a separate confirmation step (no email or SMS verification in this phase).
- As a returning participant, I can log in with email and password on any browser and see my existing signup state.
- As a logged-in participant, I can sign out and lose the ability to mutate signups until I log in again.
- As an anonymous participant who already has a `client_id` signup, I can register or log in once with that `client_id` supplied so my membership carries over to the account.
- Registration and login forms show accessible validation errors; failed login does not reveal whether the email exists.
- My phone number is required at registration, stored in normalized E.164 form, and visible only to me via `GET /api/auth/me` (not on project cards or participant lists).

### Project moderation (Post-MVP — admin dashboard)

- As an operator with the admin secret, I can open `/admin` and see all projects with `status=pending`, newest first.
- I can approve a proposal so it appears on the public project list, or reject it so it stays hidden.
- I cannot access the admin list or change status without a valid `X-Admin-Secret` (or future admin role).
- The admin UI is not linked from the public participant navigation (bookmark / direct URL only).

---

## Non-Functional Requirements

- Reliability: Reads are eventually consistent with user actions; explicit refresh occurs after mutations.
- Performance: Initial page loads within ~1s on modern broadband; page size ~20; images are not used in MVP cards.
- Security/Privacy: Participant display names and membership are public. MVP: no emails or phone numbers stored; API scopes mutations to the participant identified by `client_id` (impersonation risk if `client_id` leaks). Post-MVP: email, phone number, and password hash stored server-side only; phone and email are not exposed on public project APIs; mutations scoped by session; rate limits on auth endpoints.
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
- Pending/rejected projects are visible only via admin API (MVP) or admin dashboard (post-MVP), not on public routes.

---

## Backend Architecture (Hono)

### Stack

- **Runtime:** Node.js v24 LTS (same as frontend toolchain).
- **Framework:** [Hono](https://hono.dev/) with `@hono/node-server` for local dev and production.
- **Database:** Postgres via a lightweight query layer (e.g. `postgres` or Drizzle ORM).
- **Location:** `server/` package in the monorepo (or top-level `server/` directory alongside `src/`).

### Request identity

**MVP (current)**

- The frontend sends `X-Client-Id: <uuid>` on every API request (from localStorage).
- On first join or propose, the client also sends `X-Display-Name` (or includes it in the bootstrap body) so the server can upsert the `participants` row.
- The server resolves `client_id` → `participant_id` before any signup mutation.

**Post-MVP (planned)**

- Authenticated requests send the session cookie (`credentials: 'include'` from the browser); the server resolves `session` → `user_id` → `participant_id`.
- `X-Client-Id` is not trusted for mutations when a valid session is present.
- During rollout, anonymous bootstrap via `POST /api/participants/bootstrap` may remain for users who skip registration; protected routes prefer session when both are sent.

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

**Admin (MVP: API only; post-MVP: also used by dashboard UI)**

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/admin/projects` | List projects for moderation (`status` query, default `pending`) — **post-MVP** |
| `PATCH` | `/api/admin/projects/:id/status` | Set `approved` or `rejected` (body `{ status }`; requires `X-Admin-Secret`) |

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
- Admin (post-MVP): route `/admin`; attach `X-Admin-Secret` from sessionStorage; `GET /api/admin/projects` + `PATCH .../status` for moderation (see [Admin Dashboard](#admin-dashboard-post-mvp)).

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

### Post-MVP auth flows

7. Register (new account)

- Open Register → Enter email, phone number, password, display name → Submit → Server creates `users` + `participants` rows → Session cookie set → Redirect to project list
- If `client_id` exists in localStorage, send it once so the server can link the new user to the existing anonymous participant (preserves signups and display name history)

8. Log in (returning user)

- Open Log in → Enter email and password → Submit → Server validates credentials → Session cookie set → Redirect to project list
- Optional: same one-time `client_id` link if the browser still has an anonymous participant not yet tied to a user

9. Log out

- Header “Sign out” → `POST /api/auth/logout` → Server invalidates session → Cookie cleared → User may continue anonymously via bootstrap or re-register

10. Session check on load

- App calls `GET /api/auth/me` with credentials → If 200, show authenticated header and use session for mutations; if 401, fall back to MVP localStorage identity or prompt Register / Log in

### Post-MVP admin flows

11. Review pending proposals (operator)

- Open `/admin` → Enter admin secret (stored in sessionStorage for the browser session) → `GET /api/admin/projects?status=pending` → See list of title, short description, submitted date

12. Approve or reject a proposal (operator)

- Click Approve → `PATCH /api/admin/projects/:id/status` with `{ "status": "approved" }` → Row removed or marked approved → Project appears on public list after refresh
- Click Reject → `PATCH` with `{ "status": "rejected" }` → Proposal stays off the public list

---

## User Registration and Authentication (Post-MVP)

This section specifies behavior to implement after MVP. It does not change public read APIs or the one-project-at-a-time rule.

### Approach

- **Credentials:** email (unique, normalized lowercase) + phone number (unique, normalized E.164) + password (hashed with Argon2id or bcrypt; never stored or logged in plaintext). Login uses email + password only (phone is not a login identifier in this phase).
- **Session transport:** httpOnly cookie (`Set-Cookie` on register/login), `SameSite=Lax` (or `Strict` if same-site deploy allows), `Secure` in production, `Path=/api` or `/` per deployment.
- **Session storage:** server-side `sessions` table (recommended) with opaque `session_id`, `user_id`, `expires_at`, and optional `revoked_at` for logout; alternative: signed stateless token with short TTL and rotation (document trade-offs if chosen).
- **Not in scope for this phase:** email verification, SMS/phone verification, password reset, OAuth/SSO, MFA, login by phone number.

### Registration flow

1. User opens `/register` and submits `email`, `phoneNumber`, `password`, `displayName`.
2. Client validates required fields, phone format (E.164 or national input normalized client-side), and minimum password length; server is authoritative.
3. `POST /api/auth/register` with JSON body `{ email, phoneNumber, password, displayName }` (optional `clientId` for migration).
4. Server:
   - Normalizes email; rejects invalid format and duplicate email (`409`).
   - Normalizes phone to E.164 (e.g. strip spaces/dashes, require leading `+` and country code); rejects invalid format (`400`) and duplicate phone (`409`).
   - Validates `displayName` (same rules as bootstrap: length, no script tags).
   - Hashes password; inserts `users` row.
   - Creates or links `participants` row (see [Migration from `client_id`](#migration-from-client_id-identity)).
   - Creates session row; sets session cookie.
5. Response `201` with `{ userId, participantId, displayName, email, phoneNumber }` (E.164; no password hash). Phone is omitted from all public list/detail responses.
6. Client stores `participantId` in memory if needed for UI; stops relying on `X-Client-Id` for mutations.

### Login flow

1. User opens `/login` and submits `email`, `password`.
2. `POST /api/auth/login` with `{ email, password }`.
3. Server loads user by email; verifies password with constant-time compare; on failure returns `401` with generic message (“Invalid email or password”) to avoid account enumeration.
4. On success: optional `client_id` link (same as register), create session, set cookie, return `200` with profile JSON.
5. Rate limit: per IP and per email (e.g. sliding window) to reduce brute force.

### Logout flow

1. `POST /api/auth/logout` with session cookie.
2. Server marks session revoked or deletes row; responds `204` and clears cookie (`Max-Age=0`).
3. Client clears any cached profile; may re-enable anonymous `client_id` bootstrap for browsing only until user registers again.

### Session model

| Concept | Description |
| ------- | ----------- |
| Session ID | Opaque random value (e.g. 32+ bytes, base64url) stored only in httpOnly cookie |
| Binding | Each session maps to exactly one `users.id` and thus one `participants.id` |
| Lifetime | Configurable `SESSION_TTL` (e.g. 7–30 days); extend on activity optional |
| Validation | Middleware on protected routes: parse cookie → load session → reject expired/revoked → set `participantId` on context |
| CSRF | For cookie-based auth, use `SameSite` + optional double-submit token or restrict mutating methods to same-site origins already in `CORS_ORIGIN` |
| Public reads | `GET /api/projects/cards` and `GET /api/projects/:id` work without session; `isSignedUp` uses session participant when present, else `X-Client-Id` during transition |

**Protected routes (require valid session post cutover):**

- `POST /api/signups/join`, `POST /api/signups/switch`, `DELETE /api/signups`
- `POST /api/projects` (propose)

**Transition:** bootstrap and `X-Client-Id` may still resolve participant until auth rollout is complete; document cutover flag if needed (`AUTH_REQUIRED=true`).

### Auth API routes (post-MVP)

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `POST` | `/api/auth/register` | Create user + participant; set session cookie |
| `POST` | `/api/auth/login` | Verify credentials; set session cookie |
| `POST` | `/api/auth/logout` | Revoke session; clear cookie |
| `GET` | `/api/auth/me` | Current user + participant profile including `phoneNumber` (`401` if unauthenticated); never exposed on project card/detail APIs |

Existing MVP routes remain; `POST /api/participants/bootstrap` is **deprecated** for registered users and eventually limited to anonymous-only bootstrap when no session is present.

### Data model additions (Postgres)

**users**

```
id uuid primary key default gen_random_uuid(),
email text not null unique, -- store normalized lowercase
phone_e164 text not null unique, -- E.164 e.g. +14155552671
password_hash text not null,
created_at timestamptz not null default now(),
updated_at timestamptz not null default now()
```

**sessions** (if using server-side sessions)

```
id uuid primary key default gen_random_uuid(),
user_id uuid not null references users(id) on delete cascade,
token_hash text not null unique, -- hash of cookie value, not plaintext token in DB
expires_at timestamptz not null,
revoked_at timestamptz,
created_at timestamptz not null default now()
index (user_id)
index (expires_at)
```

**participants** (evolve existing table)

```
-- add nullable link; keep client_id during migration
user_id uuid unique references users(id) on delete set null,
-- client_id remains for anonymous MVP and link migration; may become nullable later
```

Invariant: at most one `participants` row per `user_id`. Signups continue to reference `participants.id` only (no schema change to `signups`).

### Migration from `client_id` identity

Goal: users who already joined or proposed under anonymous `client_id` keep their signup and display name when they register or log in.

**Link on register/login (recommended)**

1. Client includes optional `clientId` (from localStorage) in register/login body or `X-Client-Id` header one time.
2. Server looks up `participants` where `client_id = clientId` and `user_id is null`.
3. If found:
   - Set `participants.user_id` to the authenticated user’s id.
   - If display names differ, prefer the name from the registration form (or keep existing—pick one rule and document in implementation).
   - Do not create a second participant; existing `signups` rows remain attached.
4. If not found: create new `participants` row with `user_id` set and a new or retained `client_id` for debugging only.

**Conflict rules**

- If `client_id` is already linked to another `user_id`, ignore link and create a fresh participant (log warning).
- If user already has a linked participant, ignore `client_id` link (idempotent login).

**After migration**

- Frontend may clear or retain `client_id` in localStorage for telemetry only; mutations use session cookie only.
- Document that sharing `client_id` no longer grants mutation access once `AUTH_REQUIRED` is enabled.

### Frontend (post-MVP)

- Routes: `/register`, `/login` (public); header shows email or display name + Sign out when `GET /api/auth/me` succeeds.
- API client: `fetch(..., { credentials: 'include' })` for all API calls when using cookies; base URL unchanged (`VITE_API_URL`).
- On register/login success, call `GET /api/auth/me` or use response body; refetch project cards so `isSignedUp` reflects session participant.
- Register form: `type="email"`, `type="tel"` (with label describing E.164 or country + national number), password, display name; accessible labels and inline validation errors; no password or phone in URL or logs.
- Login form: email and password only.

### Security requirements (auth)

- Never log passwords or session cookie values; store only hashed passwords and hashed session tokens in the database.
- Generic error messages on login failure; duplicate email or phone on register may return `409` with a clear field-specific message.
- Do not log phone numbers in plain text in application logs; treat as PII alongside email.
- Rate limit `/api/auth/register` and `/api/auth/login`.
- CORS: allow credentials only for configured frontend origins; do not use `Access-Control-Allow-Origin: *` with cookies.
- Env: `SESSION_SECRET` (signing/encryption), optional `SESSION_TTL`, `AUTH_COOKIE_NAME`, `AUTH_COOKIE_SECURE`, `AUTH_COOKIE_SAMESITE`.

### Acceptance criteria (auth)

- New user can register, receive a session cookie, and join a project without sending `X-Client-Id` on mutations.
- Returning user can log in on a second browser and see the same signup state (cross-device).
- Logout invalidates the session; subsequent join attempt returns `401` until login.
- Anonymous user with existing signup who registers with the same browser’s `client_id` retains their project membership.
- Invalid password and unknown email on login both return `401` without revealing which failed.
- Password hashes and session secrets are not exposed in API responses or client storage.
- Registering with a valid phone number persists it; `GET /api/auth/me` returns it for the authenticated user only; project cards and details never include phone numbers.
- Duplicate phone or email on register returns `409`.

---

## Admin Dashboard (Post-MVP)

This section specifies the operator UI for moderating proposed projects. Public participants continue to use the main app; operators use a separate route.

### Goals

- Replace SQL/DB-console moderation for typical approve/reject workflows.
- Show only proposals awaiting review by default; make approve/reject a single click from the list.
- Reuse the existing `PATCH /api/admin/projects/:id/status` handler and `ADMIN_SECRET` server configuration.

### Access model

- **Authentication:** shared secret via `X-Admin-Secret` header on every admin API call (same as MVP API). Header value must match server `ADMIN_SECRET`.
- **MVP vs post-MVP:** MVP ships the PATCH endpoint only; post-MVP adds `GET /api/admin/projects` and the `/admin` React route.
- **Operator entry:** on first visit to `/admin`, prompt for the secret; store in `sessionStorage` for the tab session (not `localStorage`). Do not embed `ADMIN_SECRET` in production frontend builds.
- **Local dev:** optional `VITE_ADMIN_SECRET` for convenience only; document that production operators type or paste the secret at runtime.
- **Future:** optional admin role on registered users (section 30) may replace shared-secret headers; until then, secret-based access only.
- **Discovery:** `/admin` is not linked from the public header or footer (bookmark or shared URL only).

### List pending proposals

1. Operator opens `/admin` and supplies the admin secret if not already stored.
2. Client calls `GET /api/admin/projects?status=pending` with `X-Admin-Secret`.
3. Server returns only projects matching the `status` filter (default `pending`), ordered by `created_at desc`.
4. Response shape:

```json
{
  "items": [
    {
      "projectId": "uuid",
      "title": "string",
      "shortDescription": "string",
      "status": "pending",
      "createdAt": "2026-05-20T12:00:00.000Z"
    }
  ]
}
```

5. Empty list shows an empty state (“No pending proposals”).
6. Errors: `401` invalid/missing secret; `503` when `ADMIN_SECRET` is not configured on the server.

Optional query: `status` may be `pending`, `approved`, or `rejected` for audit/history views; default remains `pending`.

### Approve and reject

1. Each row exposes **Approve** and **Reject** actions.
2. Approve: `PATCH /api/admin/projects/:projectId/status` with body `{ "status": "approved" }` and `X-Admin-Secret`.
3. Reject: same path with `{ "status": "rejected" }`.
4. On success (`200`), remove the row from the pending list or update inline; show brief success feedback.
5. On error, show message from `{ "error": "..." }` without clearing the secret.
6. Approved projects immediately qualify for `GET /api/projects/cards` and `GET /api/projects/:id` on the next public refresh.

Existing PATCH behavior (status enum validation, `404` for unknown id) is unchanged.

### Admin API routes (summary)

| Method | Path | Auth | Purpose |
| ------ | ---- | ---- | ------- |
| `GET` | `/api/admin/projects` | `X-Admin-Secret` | List projects for moderation (`?status=pending` default) |
| `PATCH` | `/api/admin/projects/:id/status` | `X-Admin-Secret` | Set `approved`, `rejected`, or `pending` |

### Frontend (admin)

- Route: `/admin` (React Router), not in public nav.
- Layout: simple table or card list; columns/fields: title, short description, submitted date (`createdAt`), actions.
- Loading skeleton while fetching; error banner on `401`/`503` with option to re-enter secret.
- Accessibility: labeled actions, keyboard-focusable Approve/Reject buttons, clear status messages.
- No participant PII on this screen (proposals are title + description only).

### Security

- Rate-limit `GET` and `PATCH` under `/api/admin/*` per IP.
- Never commit `ADMIN_SECRET` to the repo; set only on the API host and operator entry UI.
- Optional: append approve/reject events to the debug `events` table or structured logs for audit.
- CSP: admin route uses same origin; `connect-src` must include API origin (already required for MVP).

### Acceptance criteria (admin dashboard)

- Operator with valid secret sees all `pending` proposals in one list.
- Approving a proposal makes it visible on the public project list after refresh.
- Rejecting keeps the proposal off the public list.
- Wrong or missing secret returns `401` on list and PATCH; unconfigured server returns `503`.
- Public participants cannot reach the pending list without the secret.
- Production build does not ship a hard-coded admin secret.

---

## Deployment & Environments

- **Frontend hosting:** Netlify (static `dist/`).
- **Backend hosting:** Hono API deployed as a Node service (e.g. Fly.io, Railway, Render) or Netlify/serverless adapter if the team prefers a single host; Postgres hosted separately (e.g. Neon, Supabase Postgres-only, or RDS).
- **Local dev:** run Vite (`npm run dev`) and Hono (`npm run dev:server` or similar) concurrently; Postgres via Docker Compose.
- **Environment config:**
  - Frontend (Netlify): `VITE_API_URL` pointing at the deployed Hono API.
  - Backend: `DATABASE_URL`, `CORS_ORIGIN` (Netlify preview + production URLs), optional `ADMIN_SECRET` for moderation endpoint.
  - Backend (post-MVP auth): `SESSION_SECRET`, `SESSION_TTL`, optional `AUTH_COOKIE_*`, `AUTH_REQUIRED` for enforcing session on mutations.
- **Moderation (MVP):** update `projects.status` via SQL, DB console, or `PATCH /api/admin/projects/:id/status` with `X-Admin-Secret`.
- **Moderation (post-MVP):** operators use `/admin` dashboard (see [Admin Dashboard](#admin-dashboard-post-mvp)); SQL/DB console remains a fallback.

---

## Acceptance Criteria

- Entering a display name once persists across reloads in the same browser.
- Project list renders with infinite scroll and shows title, shortDescription, signupCount, and participant names preview.
- Joining immediately highlights the chosen project; switching/giving up updates UI accordingly.
- Users can only be signed up to one project at a time (enforced in DB via primary key on signups.participant_id).
- Proposing a project creates a pending record that is not visible until status becomes approved.
- No filters/sorts/search; no notifications; no owners; no participant-facing dashboards (admin dashboard is post-MVP only).
- No real-time updates; data reflects actions after explicit refreshes triggered by mutations.
- All data access from the browser goes through the Hono API; no direct database credentials in the frontend.

---

## Risks & Mitigations

- No authentication means duplicate or impersonated display names are possible.
  - Acceptable for MVP; show only display names publicly. API trusts `X-Client-Id` for mutation scope (same limitation as client-only identity).
- Manual review without admin UI may be inconvenient.
  - Acceptable for MVP; approve via DB console or protected admin API. Post-MVP: mitigated by [Admin Dashboard](#admin-dashboard-post-mvp).
- Leaked `ADMIN_SECRET` grants full moderation access.
  - Mitigate: short-lived rotation, rate limits, do not ship secret in frontend builds; future admin role replaces shared secret.
- Anyone who knows another user’s `client_id` could mutate their signup.
  - Acceptable for MVP; document as known risk. Post-MVP: mitigated by session-based auth and deprecating `X-Client-Id` for mutations (see [User Registration and Authentication](#user-registration-and-authentication-post-mvp)).
- Credential stuffing / weak passwords (post-MVP).
  - Mitigate with rate limits, minimum password length, and Argon2id/bcrypt; defer breach detection and reset flows.

---

## Future Enhancements (Post-MVP)

- User registration and authentication (specified above).
- Admin dashboard to approve/reject projects (specified above).
- Basic search and filtering (tech tags, newest).
- Real-time participant counts (WebSockets or SSE from Hono).
- Email and SMS verification; password reset; login by phone number.
- Owner-like capabilities (without implying hard ownership), e.g., project curators.
