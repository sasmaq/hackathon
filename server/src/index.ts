import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";

import { sql } from "./db/client.js";
import { env } from "./env.js";

type AppVariables = {
  clientId: string;
  participantId: string;
};

type CardQueryResult = {
  projectId: string;
  title: string;
  shortDescription: string;
  signupCount: number;
  participantNames: string[];
  isSignedUp: boolean;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SCRIPT_TAG_REGEX = /<\s*\/?\s*script\b/i;
const MAX_TITLE_LENGTH = 120;
const MAX_SHORT_DESCRIPTION_LENGTH = 500;

export const app = new Hono<{ Variables: AppVariables }>();
const distIndexPath = resolve(process.cwd(), "dist/index.html");
type AppMiddleware = MiddlewareHandler<{ Variables: AppVariables }>;

const getOptionalClientId = (headerValue: string | undefined): string | null => {
  if (!headerValue) {
    return null;
  }

  const clientId = headerValue.trim();
  return UUID_REGEX.test(clientId) ? clientId : null;
};

const requireClientId: AppMiddleware = async (c, next) => {
  const clientIdHeader = c.req.header("X-Client-Id");

  if (!clientIdHeader || !UUID_REGEX.test(clientIdHeader.trim())) {
    throw new HTTPException(401, { message: "Missing or invalid X-Client-Id header" });
  }

  c.set("clientId", clientIdHeader.trim());
  await next();
};

const resolveParticipant: AppMiddleware = async (c, next) => {
  const clientId = c.get("clientId");
  const participantRows = await sql<{ id: string }[]>`
    select id
    from participants
    where client_id = ${clientId}::uuid
    limit 1
  `;

  if (participantRows.length === 0) {
    throw new HTTPException(401, {
      message: "Participant not found for X-Client-Id. Call /api/participants/bootstrap first.",
    });
  }

  c.set("participantId", participantRows[0].id);
  await next();
};

const assertApprovedProject = async (projectId: string) => {
  const projectRows = await sql<{ status: string }[]>`
    select status
    from projects
    where id = ${projectId}::uuid
    limit 1
  `;

  if (projectRows.length === 0) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  if (projectRows[0].status !== "approved") {
    throw new HTTPException(400, { message: "Project must be approved" });
  }
};

const normalizeTextInput = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasScriptTag = (value: string): boolean => SCRIPT_TAG_REGEX.test(value);

app.use(
  "/api/*",
  cors({
    origin: (origin) => {
      if (!origin) {
        return env.corsOrigins[0] ?? "http://localhost:5173";
      }

      return env.corsOrigins.includes(origin) ? origin : undefined;
    },
  }),
);

app.get("/api/health", async (c) => {
  await sql`select 1`;
  return c.json({ ok: true });
});

app.post("/api/participants/bootstrap", requireClientId, async (c) => {
  const payload = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const displayName = normalizeTextInput(payload.displayName ?? c.req.header("X-Display-Name"));

  if (!displayName) {
    throw new HTTPException(400, { message: "displayName is required" });
  }

  if (hasScriptTag(displayName)) {
    throw new HTTPException(400, { message: "displayName cannot include script tags" });
  }

  const clientId = c.get("clientId");
  const rows = await sql<{ id: string; display_name: string; client_id: string }[]>`
    insert into participants (display_name, client_id)
    values (${displayName}, ${clientId}::uuid)
    on conflict (client_id)
    do update set display_name = excluded.display_name
    returning id, display_name, client_id
  `;

  return c.json({
    participantId: rows[0].id,
    displayName: rows[0].display_name,
    clientId: rows[0].client_id,
  });
});

app.get("/api/projects/cards", async (c) => {
  const limitQuery = Number(c.req.query("limit") ?? "20");
  const offsetQuery = Number(c.req.query("offset") ?? "0");
  const limit = Number.isInteger(limitQuery) && limitQuery > 0 ? Math.min(limitQuery, 100) : 20;
  const offset = Number.isInteger(offsetQuery) && offsetQuery >= 0 ? offsetQuery : 0;
  const rawClientId = getOptionalClientId(c.req.header("X-Client-Id"));

  const rows = await sql<CardQueryResult[]>`
    select
      p.id as "projectId",
      p.title,
      p.short_description as "shortDescription",
      count(s.participant_id)::int as "signupCount",
      coalesce(
        array_remove(array_agg(pt.display_name order by s.created_at asc), null),
        array[]::text[]
      ) as "participantNames",
      exists (
        select 1
        from signups s2
        join participants p2 on p2.id = s2.participant_id
        where s2.project_id = p.id
          and p2.client_id = ${rawClientId}::uuid
      ) as "isSignedUp"
    from projects p
    left join signups s on s.project_id = p.id
    left join participants pt on pt.id = s.participant_id
    where p.status = 'approved'
    group by p.id
    order by p.created_at desc
    limit ${limit + 1}
    offset ${offset}
  `;

  const items = rows.slice(0, limit).map((row) => ({
    projectId: row.projectId,
    title: row.title,
    shortDescription: row.shortDescription,
    signupCount: row.signupCount,
    participantNamesPreview: row.participantNames.slice(0, 5),
    isSignedUp: row.isSignedUp,
  }));

  return c.json({
    items,
    limit,
    offset,
    hasMore: rows.length > limit,
  });
});

app.get("/api/projects/:id", async (c) => {
  const projectId = c.req.param("id");

  if (!UUID_REGEX.test(projectId)) {
    throw new HTTPException(400, { message: "Invalid project id" });
  }

  const projectRows = await sql<{ id: string; title: string; shortDescription: string }[]>`
    select id, title, short_description as "shortDescription"
    from projects
    where id = ${projectId}::uuid
      and status = 'approved'
    limit 1
  `;

  if (projectRows.length === 0) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const participantRows = await sql<{ displayName: string }[]>`
    select p.display_name as "displayName"
    from signups s
    join participants p on p.id = s.participant_id
    where s.project_id = ${projectId}::uuid
    order by s.created_at asc
  `;

  return c.json({
    projectId: projectRows[0].id,
    title: projectRows[0].title,
    shortDescription: projectRows[0].shortDescription,
    participants: participantRows.map((row) => row.displayName),
  });
});

app.post("/api/signups/join", requireClientId, resolveParticipant, async (c) => {
  const payload = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = normalizeTextInput(payload.projectId);

  if (!projectId || !UUID_REGEX.test(projectId)) {
    throw new HTTPException(400, { message: "Valid projectId is required" });
  }

  await assertApprovedProject(projectId);

  const participantId = c.get("participantId");
  const rows = await sql<{ participant_id: string; project_id: string }[]>`
    insert into signups (participant_id, project_id)
    values (${participantId}::uuid, ${projectId}::uuid)
    on conflict (participant_id)
    do update set
      project_id = excluded.project_id,
      created_at = now()
    returning participant_id, project_id
  `;

  return c.json({
    participantId: rows[0].participant_id,
    projectId: rows[0].project_id,
  });
});

app.post("/api/signups/switch", requireClientId, resolveParticipant, async (c) => {
  const payload = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = normalizeTextInput(payload.projectId);

  if (!projectId || !UUID_REGEX.test(projectId)) {
    throw new HTTPException(400, { message: "Valid projectId is required" });
  }

  await assertApprovedProject(projectId);

  const participantId = c.get("participantId");
  const currentRows = await sql<{ project_id: string }[]>`
    select project_id
    from signups
    where participant_id = ${participantId}::uuid
    limit 1
  `;

  if (currentRows.length === 0) {
    throw new HTTPException(400, { message: "Cannot switch without an existing signup" });
  }

  const rows = await sql<{ participant_id: string; project_id: string }[]>`
    update signups
    set project_id = ${projectId}::uuid, created_at = now()
    where participant_id = ${participantId}::uuid
    returning participant_id, project_id
  `;

  return c.json({
    participantId: rows[0].participant_id,
    projectId: rows[0].project_id,
  });
});

app.delete("/api/signups", requireClientId, resolveParticipant, async (c) => {
  const participantId = c.get("participantId");
  const rows = await sql<{ participant_id: string }[]>`
    delete from signups
    where participant_id = ${participantId}::uuid
    returning participant_id
  `;

  if (rows.length === 0) {
    throw new HTTPException(404, { message: "No signup found for participant" });
  }

  return c.json({ participantId: rows[0].participant_id, deleted: true });
});

app.post("/api/projects", requireClientId, resolveParticipant, async (c) => {
  const payload = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const title = normalizeTextInput(payload.title);
  const shortDescription = normalizeTextInput(payload.shortDescription);

  if (!title || !shortDescription) {
    throw new HTTPException(400, { message: "title and shortDescription are required" });
  }

  if (title.length > MAX_TITLE_LENGTH) {
    throw new HTTPException(400, { message: `title must be <= ${MAX_TITLE_LENGTH} characters` });
  }

  if (shortDescription.length > MAX_SHORT_DESCRIPTION_LENGTH) {
    throw new HTTPException(400, {
      message: `shortDescription must be <= ${MAX_SHORT_DESCRIPTION_LENGTH} characters`,
    });
  }

  if (hasScriptTag(title) || hasScriptTag(shortDescription)) {
    throw new HTTPException(400, {
      message: "title and shortDescription cannot include script tags",
    });
  }

  const rows = await sql<{ id: string; title: string; short_description: string; status: string }[]>`
    insert into projects (id, title, short_description, status)
    values (${randomUUID()}::uuid, ${title}, ${shortDescription}, 'pending')
    returning id, title, short_description, status
  `;

  return c.json(
    {
      projectId: rows[0].id,
      title: rows[0].title,
      shortDescription: rows[0].short_description,
      status: rows[0].status,
    },
    201,
  );
});

app.use(
  "*",
  async (c, next) => {
    if (c.req.path.startsWith("/api")) {
      return next();
    }

    return serveStatic({ root: "./dist" })(c, next);
  },
);

app.get("*", async (c) => {
  if (c.req.path.startsWith("/api")) {
    return c.json({ error: "Not found" }, 404);
  }

  try {
    const indexHtml = await readFile(distIndexPath, "utf8");
    return c.html(indexHtml);
  } catch {
    return c.json({ error: "Frontend build not found. Run npm run build first." }, 503);
  }
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ error: error.message }, error.status);
  }

  console.error(error);
  return c.json({ error: "Internal Server Error" }, 500);
});

serve(
  {
    fetch: app.fetch,
    port: env.port,
  },
  (info) => {
    console.log(`Server listening on http://localhost:${info.port}`);
  },
);
