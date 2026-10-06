PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('microsoft', 'simple')),
  display_name TEXT NOT NULL CHECK (length(display_name) > 0),
  nickname_key TEXT UNIQUE,
  microsoft_tid TEXT,
  microsoft_sub TEXT,
  pin_salt TEXT,
  pin_hash TEXT,
  unlocked_stage INTEGER NOT NULL DEFAULT 1 CHECK (unlocked_stage BETWEEN 1 AND 20),
  highest_completed_stage INTEGER CHECK (highest_completed_stage BETWEEN 1 AND 20),
  highest_stage_best_time_seconds INTEGER CHECK (highest_stage_best_time_seconds > 0),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK ((highest_completed_stage IS NULL) = (highest_stage_best_time_seconds IS NULL)),
  CHECK (highest_completed_stage IS NULL OR highest_completed_stage <= unlocked_stage),
  CHECK (
    (auth_type = 'simple' AND nickname_key IS NOT NULL AND pin_salt IS NOT NULL AND pin_hash IS NOT NULL
      AND microsoft_tid IS NULL AND microsoft_sub IS NULL)
    OR
    (auth_type = 'microsoft' AND nickname_key IS NULL AND pin_salt IS NULL AND pin_hash IS NULL
      AND microsoft_tid IS NOT NULL AND microsoft_sub IS NOT NULL)
  ),
  UNIQUE (microsoft_tid, microsoft_sub)
);

CREATE INDEX users_leaderboard_idx ON users (
  auth_type, highest_completed_stage DESC, highest_stage_best_time_seconds ASC, id
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms)
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE oauth_flows (
  state_hash TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  expires_at_ms INTEGER NOT NULL CHECK (expires_at_ms > created_at_ms)
);

CREATE TABLE auth_throttle (
  bucket_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  window_started_at_ms INTEGER NOT NULL,
  blocked_until_ms INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 20),
  started_at_ms INTEGER NOT NULL,
  finished_at_ms INTEGER,
  status TEXT NOT NULL CHECK (status IN ('active', 'finished', 'abandoned')),
  CHECK (finished_at_ms IS NULL OR finished_at_ms >= started_at_ms),
  CHECK ((status = 'active') = (finished_at_ms IS NULL))
);
CREATE INDEX attempts_user_idx ON attempts (user_id, status, stage);

CREATE TABLE stage_records (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage INTEGER NOT NULL CHECK (stage BETWEEN 1 AND 20),
  best_time_seconds INTEGER NOT NULL CHECK (best_time_seconds > 0),
  updated_at_ms INTEGER NOT NULL,
  PRIMARY KEY (user_id, stage)
);
CREATE INDEX stage_records_user_idx ON stage_records (user_id);
