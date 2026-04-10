CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS weekly_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_name VARCHAR(100) NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  CHECK (start_date <= end_date)
);

CREATE TABLE IF NOT EXISTS behavior_checklist_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  asked_deep_question BOOLEAN NOT NULL DEFAULT FALSE,
  full_consultation BOOLEAN NOT NULL DEFAULT FALSE,
  followed_through BOOLEAN NOT NULL DEFAULT FALSE,
  customer_met_count INTEGER NOT NULL DEFAULT 0 CHECK (customer_met_count >= 0),
  employee_notes TEXT,
  manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  mgr_eval_deep_q BOOLEAN,
  mgr_eval_full_cons BOOLEAN,
  mgr_eval_follow BOOLEAN,
  manager_feedback TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date),
  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS idx_behavior_checklist_logs_log_date
ON behavior_checklist_logs (log_date);

CREATE INDEX IF NOT EXISTS idx_behavior_checklist_logs_status
ON behavior_checklist_logs (status);

CREATE INDEX IF NOT EXISTS idx_behavior_checklist_logs_manager_id
ON behavior_checklist_logs (manager_id);

CREATE INDEX IF NOT EXISTS idx_behavior_checklist_logs_user_id
ON behavior_checklist_logs (user_id);

CREATE TABLE IF NOT EXISTS mindset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  negative_thought TEXT NOT NULL,
  new_mindset TEXT NOT NULL,
  behavior_change TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS sales_activity_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_issue TEXT NOT NULL,
  consequence TEXT NOT NULL,
  solution_offered TEXT NOT NULL,
  value_based_pricing TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_activity_reports_user_id
ON sales_activity_reports (user_id);

CREATE INDEX IF NOT EXISTS idx_sales_activity_reports_log_date
ON sales_activity_reports (log_date);

CREATE TABLE IF NOT EXISTS end_of_day_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  different_action TEXT NOT NULL,
  customer_impact TEXT NOT NULL,
  tomorrow_lesson TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS belief_transformation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  situation TEXT NOT NULL,
  old_belief TEXT NOT NULL,
  new_chosen_belief TEXT NOT NULL,
  new_behavior TEXT NOT NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_belief_transformation_logs_user_id
ON belief_transformation_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_belief_transformation_logs_log_date
ON belief_transformation_logs (log_date);
