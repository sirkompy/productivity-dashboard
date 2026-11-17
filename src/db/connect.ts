import pg from "pg";
import { Repository, type Sql } from "./repository.js";
export function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new pg.Pool({
    connectionString,
    connectionTimeoutMillis: 10_000,
    max: 4,
  });
  const transaction = async <T>(fn: (sql: Sql) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const value = await fn(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };
  return { pool, repository: new Repository(pool, transaction), transaction };
}
