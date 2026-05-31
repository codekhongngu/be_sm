CREATE TABLE IF NOT EXISTS manager_coaching_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  coach_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coached_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coaching_time timestamptz NOT NULL,
  coaching_content text NOT NULL,
  content_to_improve text NOT NULL,
  keep_tnc integer NOT NULL DEFAULT 0,
  evaluation_result integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_coaching_logs_coach_user_id
  ON manager_coaching_logs (coach_user_id);

CREATE INDEX IF NOT EXISTS idx_manager_coaching_logs_coached_user_id
  ON manager_coaching_logs (coached_user_id);

CREATE INDEX IF NOT EXISTS idx_manager_coaching_logs_coaching_time
  ON manager_coaching_logs (coaching_time);
