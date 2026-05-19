import postgres from "postgres";

import { env } from "../env.js";

export const sql = env.debugSqliteOnly
  ? null
  : postgres(env.databaseUrl, {
      max: 10,
      idle_timeout: 20,
    });
