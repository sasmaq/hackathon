import { config } from "dotenv";
import Database from "better-sqlite3";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const dbPath = resolve(
  process.cwd(),
  process.env.DEBUG_SQLITE_PATH ?? "server/db/sqlite/debug-mirror.sqlite",
);

if (!existsSync(dbPath)) {
  console.log(`No SQLite mirror file found at ${dbPath}`);
  process.exit(0);
}

const db = new Database(dbPath, { readonly: true });

const participants = db.prepare("select count(*) as count from participants").get() as { count: number };
const projects = db.prepare("select count(*) as count from projects").get() as { count: number };
const signups = db.prepare("select count(*) as count from signups").get() as { count: number };
const events = db.prepare("select count(*) as count from events").get() as { count: number };

const latestEvents = db
  .prepare(
    `
      select id, event_type as eventType, created_at as createdAt
      from events
      order by id desc
      limit 10
    `,
  )
  .all() as Array<{ id: number; eventType: string; createdAt: string }>;

console.log(`SQLite mirror file: ${dbPath}`);
console.log(`participants: ${participants.count}`);
console.log(`projects: ${projects.count}`);
console.log(`signups: ${signups.count}`);
console.log(`events: ${events.count}`);
console.log("latest events:", latestEvents);
