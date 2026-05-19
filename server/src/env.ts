import { config } from "dotenv";

config({ path: new URL("../../.env", import.meta.url) });

const DEFAULT_PORT = 8787;
const DEFAULT_CORS_ORIGIN = "http://localhost:5173";
const DEFAULT_DEBUG_SQLITE_PATH = "server/db/sqlite/debug-mirror.sqlite";
const debugSqliteOnly = process.env.DEBUG_SQLITE_ONLY === "true";

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? DEFAULT_CORS_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const databaseUrl = process.env.DATABASE_URL;

if (!debugSqliteOnly && !databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

export const env = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  databaseUrl: databaseUrl ?? "",
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
  adminSecret: process.env.ADMIN_SECRET,
  debugSqliteMirror: process.env.DEBUG_SQLITE_MIRROR === "true",
  debugSqlitePath: process.env.DEBUG_SQLITE_PATH ?? DEFAULT_DEBUG_SQLITE_PATH,
  debugSqliteOnly,
};
