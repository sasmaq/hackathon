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

1) Browse projects as cards with infinite scroll.
2) View project details page with description and participant list/count.
3) Join exactly one project at a time (auto-accept).
4) Switch to a different project or give up current selection at any time.
5) Propose a new project idea for others to join (manual review required to publish).
6) Simple onboarding: enter display name to start (stored in localStorage).

### Discovery and Cards

- Infinite scroll; no filters/sorts/search.
- Each card displays:
  - title (from projects.title)
  - shortDescription (from projects.short_description)
  - signupCount (calculated)
  - participant names (public) — show up to N (e.g., 5) names with “+X more” if needed
  - isSignedUp is not shown as text but affects styling (highlight/badge for the user’s current project)

Reference fields (as specified):

| Field | Displayed on Card | Source | Purpose |
| --- | --- | --- | --- |
| id | No | Database (projects.id) | Internal identification |
| title | Yes | Database (projects.title) | Card header |
| shortDescription | Yes | Database (projects.short_description) | Description text |
| signupCount | Yes | Calculated (RPC function) | Participant count |
| isSignedUp | No (affects styling) | Calculated (user's signups) | Border highlight and badge |

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
- New proposals are set to “pending” and become visible only after manual review (no admin UI in MVP; review occurs via backend console/Supabase dashboard or a service-only action).

### Identity and Persistence

- Identity is a simple display name entered on first use.
- Name is stored in localStorage; names are not unique; no cross-device persistence beyond localStorage.
- A generated client-side UUID is also stored to associate signups with the same browser session over time.

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
- Switch: Remove existing signup for the participant, then insert the new one in a single transaction (or sequential calls with optimistic UI and rollback on failure).
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
- Security/Privacy: Participant display names and membership are public; no emails or authentication.
- Observability: Basic console logging for errors; no analytics/KPIs in MVP.

---

## Data Model (Supabase / Postgres)

### Tables

1) participants

```
id uuid primary key default gen_random_uuid(),
display_name text not null,
client_id uuid not null unique, -- stored in localStorage (browser)
created_at timestamptz not null default now()
```

2) projects

```
id uuid primary key default gen_random_uuid(),
title text not null,
short_description text not null,
status text not null default 'pending' check (status in ('pending','approved','rejected')),
created_at timestamptz not null default now()
```

3) signups

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

### RPC: get_project_cards(current_participant_id uuid, limit int, offset int)

Returns approved projects with derived fields for cards. Suggested return columns:

```
project_id uuid,
title text,
short_description text,
signup_count int,
participant_names_preview text[],
is_signed_up boolean
```

Example SQL outline:

```sql
create or replace function public.get_project_cards(
  current_participant_id uuid,
  page_limit int,
  page_offset int
)
returns table (
  project_id uuid,
  title text,
  short_description text,
  signup_count int,
  participant_names_preview text[],
  is_signed_up boolean
)
language sql stable as $$
  with approved as (
    select p.id, p.title, p.short_description
    from projects p
    where p.status = 'approved'
    order by p.created_at desc
    limit page_limit offset page_offset
  ), counts as (
    select s.project_id, count(*)::int as signup_count
    from signups s
    group by s.project_id
  ), names as (
    select s.project_id,
           array_agg(pa.display_name order by s.created_at asc)[1:5] as participant_names_preview
    from signups s
    join participants pa on pa.id = s.participant_id
    group by s.project_id
  )
  select a.id as project_id,
         a.title,
         a.short_description,
         coalesce(c.signup_count, 0) as signup_count,
         coalesce(n.participant_names_preview, '{}') as participant_names_preview,
         exists (
           select 1 from signups s
           where s.participant_id = current_participant_id and s.project_id = a.id
         ) as is_signed_up
  from approved a
  left join counts c on c.project_id = a.id
  left join names n on n.project_id = a.id
$$;
```

Note: `participant_names_preview` can be expanded to full lists in the details view via a separate query or by joining all names for a single project.

---

## Frontend Architecture

- Tech: React + TypeScript + Vite.
- State: Minimal local state + data fetching via Supabase JS client; optional React Query for caching and mutation state.
- Identity: On first load, if no `client_id` and `display_name` in localStorage, prompt for name and generate a UUID `client_id`.
- Data fetching:
  - Cards list: call `get_project_cards(current_participant_id, limit, offset)`; append results for infinite scroll.
  - Details: fetch project by id, its signupCount, and full participant list.
- Mutations:
  - Join: upsert in `participants` by `client_id` (ensure row exists), then insert into `signups` (replace any existing signup in a transaction via an RPC or sequential calls).
  - Switch: same as Join (delete then insert or transactional RPC).
  - Give up: delete from `signups` where participant_id = current.
  - Propose: insert into `projects` with status = 'pending'.
- Refresh behavior: After any mutation, refetch relevant queries; otherwise no background polling.

### Styling Cues

- Card highlight and small badge when `isSignedUp` is true.
- Participant names on cards: display up to 5 inline chips; show “+X more” if truncated.

---

## User Flows

1) First-time user

- Land → Prompt for display name → Save to localStorage (and generate client_id) → Show project list (page 1)

2) Browse and view details

- Scroll to load more → Click a card → See details with full participant list → Back to list

3) Join a project (not signed up yet)

- Details or card CTA → Create/ensure participant by client_id → Insert signup → Refresh details and card list → Card shows highlight badge

4) Switch projects (already signed up)

- Details or card CTA on another project → Delete existing signup → Insert new signup → Refresh new/old cards and details

5) Give up

- Details or card CTA → Delete signup → Refresh list/details → No project highlighted

6) Propose project

- Open “Propose” → Enter title and shortDescription → Submit → Project created as pending → Not visible in list until approved via backend

---

## Deployment & Environments

- Frontend hosting: Netlify.
- Backend: Supabase (Postgres, SQL functions, Row Level Security, Supabase JS client).
- Environment config:
  - Netlify env vars for Supabase URL and anon key.
  - Use service role key only outside the client (not in MVP frontend). Manual moderation happens via Supabase dashboard.

---

## Acceptance Criteria

- Entering a display name once persists across reloads in the same browser.
- Project list renders with infinite scroll and shows title, shortDescription, signupCount, and participant names preview.
- Joining immediately highlights the chosen project; switching/giving up updates UI accordingly.
- Users can only be signed up to one project at a time (enforced in DB via primary key on signups.participant_id).
- Proposing a project creates a pending record that is not visible until status becomes approved.
- No filters/sorts/search; no notifications; no owners; no dashboards.
- No real-time updates; data reflects actions after explicit refreshes triggered by mutations.

---

## Risks & Mitigations

- No authentication means duplicate or impersonated display names are possible.
  - Acceptable for MVP; show only display names publicly.
- Manual review without admin UI may be inconvenient.
  - Acceptable for MVP; use Supabase dashboard to approve projects.
- Client-only anon key limits ability to run server-side privileged operations.
  - MVP avoids privileged operations; all mutations are client-safe under RLS.

---

## Future Enhancements (Post-MVP)

- Simple admin UI to approve/reject projects.
- Basic search and filtering (tech tags, newest).
- Real-time participant counts.
- Optional authentication to reduce impersonation.
- Owner-like capabilities (without implying hard ownership), e.g., project curators.
