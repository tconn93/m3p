import { Router, type Request, type Response } from 'express';
import pool from './db.js';
import { hashPassword, verifyPassword } from './auth.js';

const router = Router();

// ── Auth ─────────────────────────────────────────────

router.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 4) {
      res.status(400).json({ error: 'Password must be at least 4 characters' });
      return;
    }

    const passwordHash = await hashPassword(password);

    const result = await pool.query(
      'INSERT INTO profiles (username, password_hash) VALUES ($1, $2) RETURNING id, username, lifetime_score, current_level, created_at',
      [username.trim(), passwordHash]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }
    console.error('Error registering user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, lifetime_score, current_level, created_at FROM profiles WHERE username = $1',
      [username.trim()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const profile = result.rows[0];

    if (!profile.password_hash) {
      res.status(401).json({ error: 'This account has no password. Please register again.' });
      return;
    }

    const valid = await verifyPassword(password, profile.password_hash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    const { password_hash: _, ...safeProfile } = profile;
    res.json(safeProfile);
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Profile ──────────────────────────────────────────

router.get('/api/profiles/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const result = await pool.query(
      'SELECT id, username, lifetime_score, current_level, created_at, updated_at FROM profiles WHERE username = $1',
      [username]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching profile:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Leaderboard (by lifetime score) ──────────────────

router.get('/api/leaderboard', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT username, lifetime_score, current_level, updated_at
      FROM profiles
      ORDER BY lifetime_score DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching leaderboard:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── High Scores (individual game records) ────────────

router.get('/api/highscores', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT hs.score, hs.level, hs.moves_used, hs.stars, hs.created_at, p.username
      FROM high_scores hs
      JOIN profiles p ON p.id = hs.profile_id
      ORDER BY hs.score DESC
      LIMIT 50
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching highscores:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/highscores', async (req: Request, res: Response) => {
  try {
    const { username, score, level, movesUsed, stars } = req.body;

    if (!username || score == null) {
      res.status(400).json({ error: 'username and score are required' });
      return;
    }

    const profile = await pool.query('SELECT id FROM profiles WHERE username = $1', [username]);
    if (profile.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const profileId = profile.rows[0].id;

    // Insert game record
    const result = await pool.query(
      `INSERT INTO high_scores (profile_id, score, level, moves_used, stars)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [profileId, score, level || 1, movesUsed || 0, stars || 0]
    );

    // Update lifetime score
    await pool.query(
      'UPDATE profiles SET lifetime_score = lifetime_score + $1, updated_at = now() WHERE id = $2',
      [score, profileId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error saving highscore:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Level Progress ───────────────────────────────────

router.get('/api/profiles/:username/progress', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const profile = await pool.query('SELECT id FROM profiles WHERE username = $1', [username]);
    if (profile.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const result = await pool.query(
      'SELECT level, stars, best_score, completed FROM level_progress WHERE profile_id = $1 ORDER BY level',
      [profile.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching progress:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/api/profiles/:username/progress', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { level, stars, bestScore, completed } = req.body;

    if (level == null) {
      res.status(400).json({ error: 'level is required' });
      return;
    }

    const profile = await pool.query('SELECT id FROM profiles WHERE username = $1', [username]);
    if (profile.rows.length === 0) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO level_progress (profile_id, level, stars, best_score, completed)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (profile_id, level)
       DO UPDATE SET
         stars = GREATEST(level_progress.stars, EXCLUDED.stars),
         best_score = GREATEST(level_progress.best_score, EXCLUDED.best_score),
         completed = EXCLUDED.completed OR level_progress.completed,
         updated_at = now()
       RETURNING *`,
      [profile.rows[0].id, level, stars || 0, bestScore || 0, completed || false]
    );

    // Advance current_level if this level was just completed
    if (completed) {
      await pool.query(
        `UPDATE profiles
         SET current_level = GREATEST(current_level, $1 + 1),
             updated_at = now()
         WHERE id = $2`,
        [level, profile.rows[0].id]
      );
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error saving progress:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
