import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { Hono } from "hono";

import { sql } from "./db/client.js";
import { env } from "./env.js";

export const app = new Hono();
const distIndexPath = resolve(process.cwd(), "dist/index.html");

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
