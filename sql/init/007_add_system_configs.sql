CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_configs (key, value, description)
VALUES ('diary_start_date', '2024-01-01', 'Ngày bắt đầu cho phép nhân viên nhập nhật ký (YYYY-MM-DD)')
ON CONFLICT (key) DO NOTHING;
