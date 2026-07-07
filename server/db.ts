import pg from 'pg';

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

export async function initDb(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        lifetime_score INTEGER NOT NULL DEFAULT 0,
        current_level INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS high_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        score INTEGER NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        moves_used INTEGER NOT NULL,
        stars INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS level_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        level INTEGER NOT NULL,
        stars INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0 AND stars <= 3),
        best_score INTEGER NOT NULL DEFAULT 0,
        completed BOOLEAN NOT NULL DEFAULT false,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(profile_id, level)
      );

      CREATE INDEX IF NOT EXISTS idx_high_scores_score ON high_scores(score DESC);
      CREATE INDEX IF NOT EXISTS idx_high_scores_profile ON high_scores(profile_id);
      CREATE INDEX IF NOT EXISTS idx_level_progress_profile ON level_progress(profile_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
    `);

    // ── Migrations: add columns missing from older schemas ──
    await client.query(`
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lifetime_score INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_level INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
      ALTER TABLE high_scores ADD COLUMN IF NOT EXISTS stars INTEGER NOT NULL DEFAULT 0;
    `);

    // ── Index on migrated column (safe after migration) ──
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_profiles_lifetime ON profiles(lifetime_score DESC);
    `);

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

export default pool;
