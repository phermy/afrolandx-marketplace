import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.PGHOST && !process.env.DATABASE_URL) {
  throw new Error(
    "Database credentials must be set. Did you forget to provision a database?",
  );
}

const isProduction = process.env.NODE_ENV === "production";

const connectionConfig = process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE
  ? {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    }
  : { connectionString: process.env.DATABASE_URL, ssl: isProduction ? { rejectUnauthorized: false } : false };

export const pool = new Pool(connectionConfig as pg.PoolConfig);
// pg emits an error when an idle connection is terminated by the database.
// Without a listener, Node exits even though the pool can replace that client.
// Never log the error/client objects: they may contain connection credentials.
pool.on("error", (error: Error & { code?: string }) => {
  const code = typeof error.code === "string" && /^[A-Z0-9]{5}$/.test(error.code)
    ? error.code : "unknown";
  console.error(`Database pool connection interrupted (${code}). New requests will reconnect.`);
});
export const db = drizzle({ client: pool, schema });
