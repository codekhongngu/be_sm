CREATE TABLE IF NOT EXISTS weekly_journal_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_id UUID NOT NULL REFERENCES weekly_configs(id) ON DELETE CASCADE,
  form_type VARCHAR(20) NOT NULL,
  entries JSONB NOT NULL DEFAULT '[]'::jsonb,
  submitted_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, week_id, form_type)
);

CREATE INDEX IF NOT EXISTS idx_weekly_journal_logs_week_id
ON weekly_journal_logs (week_id);

CREATE INDEX IF NOT EXISTS idx_weekly_journal_logs_user_id
ON weekly_journal_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_weekly_journal_logs_form_type
ON weekly_journal_logs (form_type);
