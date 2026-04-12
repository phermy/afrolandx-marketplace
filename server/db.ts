import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.PGHOST && !process.env.DATABASE_URL) {
  throw new Error(
    "Database credentials must be set. Did you forget to provision a database?",
  );
}

const connectionConfig = process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE
  ? {
      host: process.env.PGHOST,
      port: parseInt(process.env.PGPORT || '5432'),
      user: process.env.PGUSER,
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE,
      ssl: false,
    }
  : { connectionString: process.env.DATABASE_URL };

export const pool = new Pool(connectionConfig as pg.PoolConfig);
export const db = drizzle({ client: pool, schema });
