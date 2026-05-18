import { config } from "dotenv";

config({ path: new URL("../.env", import.meta.url) });

const DEFAULT_PORT = 8787;
const DEFAULT_CORS_ORIGIN = "http://localhost:5173";

const parseOrigins = (value: string | undefined): string[] =>
  (value ?? DEFAULT_CORS_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("Missing required environment variable: DATABASE_URL");
}

export const env = {
  port: Number(process.env.PORT ?? DEFAULT_PORT),
  databaseUrl,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN),
};
