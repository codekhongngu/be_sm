CREATE TABLE IF NOT EXISTS journey_phase_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_code VARCHAR(30) NOT NULL UNIQUE,
  phase_name VARCHAR(120) NOT NULL,
  start_day INT NOT NULL,
  end_day INT NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO journey_phase_configs (phase_code, phase_name, start_day, end_day, sort_order, is_active)
VALUES
  ('PHASE_1', 'Giai đoạn 1', 1, 30, 1, TRUE),
  ('PHASE_2', 'Giai đoạn 2', 31, 60, 2, TRUE),
  ('PHASE_3', 'Giai đoạn 3', 61, 90, 3, TRUE)
ON CONFLICT (phase_code) DO UPDATE
SET
  phase_name = EXCLUDED.phase_name,
  start_day = EXCLUDED.start_day,
  end_day = EXCLUDED.end_day,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

CREATE TABLE IF NOT EXISTS phase_3_standard_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  kept_standard TEXT NOT NULL DEFAULT '',
  backslide_sign TEXT NOT NULL DEFAULT '',
  solution TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS income_breakthrough_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  self_limit_area TEXT NOT NULL DEFAULT '',
  proof_behavior TEXT NOT NULL DEFAULT '',
  raise_standard TEXT NOT NULL DEFAULT '',
  action_plan TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, log_date)
);

CREATE TABLE IF NOT EXISTS career_commitment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  declaration_text TEXT NOT NULL DEFAULT '',
  commitment_signature TEXT NOT NULL DEFAULT '',
  UNIQUE (user_id, log_date)
);
