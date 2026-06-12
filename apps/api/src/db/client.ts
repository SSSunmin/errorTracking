import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

export const DEFAULT_DATABASE_URL =
  "postgres://errortracking:errortracking@localhost:5432/errortracking";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
});

export const db = drizzle(pool, { schema });
