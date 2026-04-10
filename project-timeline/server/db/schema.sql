-- server/db/schema.sql
-- Run once to create tables:
--   psql $DATABASE_URL < server/db/schema.sql

-- ── Authentication ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email         TEXT        UNIQUE NOT NULL,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- Table for express-session with connect-pg-simple
CREATE TABLE IF NOT EXISTS user_sessions (
  sid           TEXT        PRIMARY KEY,
  sess          JSONB       NOT NULL,
  expire        TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions (expire);

-- ── App state (single JSONB blob per user) ────────────────────────────────
-- This is the simplest starting point: the entire React state tree is stored
-- as one JSONB document per user, identical to what was in localStorage.
--
-- Advantages: zero schema changes needed as the UI evolves.
-- Trade-off:  cannot query individual projects/timelines via SQL.
--
-- When ready, replace with the normalized schema below (Phase 2).
-- ─────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS app_state (
  user_id     TEXT        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        JSONB       NOT NULL,             -- full React state tree
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_state_updated ON app_state (updated_at DESC);


-- ── Phase 2: Normalized schema (implement when adding multi-user auth) ────
-- Uncomment and run when ready to split out structured data.
-- These replace the JSONB blob with proper relational tables.

/*

CREATE TABLE IF NOT EXISTS teams (
  id         TEXT        PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_settings (
  team_id      TEXT        PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  exclude_days INT[]       NOT NULL DEFAULT '{5}',   -- day-of-week numbers (0=Sun)
  holidays     DATE[]      NOT NULL DEFAULT '{}',
  priority_colors JSONB    NOT NULL DEFAULT '{}'     -- { hp: "#ef4444", mp: "...", lp: "..." }
);

CREATE TABLE IF NOT EXISTS projects (
  id         TEXT        PRIMARY KEY,
  team_id    TEXT        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  members    TEXT[]      NOT NULL DEFAULT '{}',
  color      TEXT        NOT NULL DEFAULT '#3b82f6',
  sort_order INT         NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_team ON projects (team_id);

CREATE TABLE IF NOT EXISTS timelines (
  id            TEXT        PRIMARY KEY,
  team_id       TEXT        NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  plot_start    DATE        NOT NULL,
  finished_date DATE,                          -- NULL = current (active) timeline
  trashed_at    DATE,                          -- NULL = not in trash
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_timelines_team    ON timelines (team_id);
CREATE INDEX IF NOT EXISTS idx_timelines_current ON timelines (team_id, finished_date) WHERE finished_date IS NULL;

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT        PRIMARY KEY,
  timeline_id    TEXT        NOT NULL REFERENCES timelines(id) ON DELETE CASCADE,
  project_id     TEXT        NOT NULL REFERENCES projects(id)  ON DELETE CASCADE,
  priority_hours JSONB       NOT NULL DEFAULT '{}',  -- { hp_bug: 8, hp_nf: 16, ... }
  plot_start     DATE,                               -- NULL = inherit from timeline
  UNIQUE (timeline_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_timeline ON tasks (timeline_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project  ON tasks (project_id);

CREATE TABLE IF NOT EXISTS notes (
  id          TEXT        PRIMARY KEY,
  task_id     TEXT        NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  start_date  DATE        NOT NULL,
  end_date    DATE        NOT NULL,
  text        TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_task ON notes (task_id);

*/
