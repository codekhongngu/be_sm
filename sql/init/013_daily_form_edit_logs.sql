CREATE TABLE IF NOT EXISTS daily_form_edit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_id UUID NOT NULL REFERENCES journals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  form_type VARCHAR(50) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  before_value TEXT NOT NULL DEFAULT '',
  after_value TEXT NOT NULL DEFAULT '',
  edited_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  edited_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_form_edit_logs_journal
ON daily_form_edit_logs (journal_id);

CREATE INDEX IF NOT EXISTS idx_daily_form_edit_logs_user_date
ON daily_form_edit_logs (user_id, log_date);
