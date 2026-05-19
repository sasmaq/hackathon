import { config } from "dotenv";
import { rmSync } from "node:fs";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

const dbPath = resolve(
  process.cwd(),
  process.env.DEBUG_SQLITE_PATH ?? "server/db/sqlite/debug-mirror.sqlite",
);

rmSync(dbPath, { force: true });
console.log(`SQLite mirror reset. Removed: ${dbPath}`);
