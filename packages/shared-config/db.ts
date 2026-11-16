import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

export const dbPool = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Kiểm tra kết nối database thực tế
 */
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    const client = await dbPool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB-Health] Database connection error:', err);
    return false;
  }
};
