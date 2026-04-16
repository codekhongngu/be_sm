CREATE TABLE IF NOT EXISTS system_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO system_configs (key, value, description)
VALUES 
  ('diary_start_date', '2024-01-01', 'Ngày bắt đầu cho phép nhân viên nhập nhật ký (YYYY-MM-DD)'),
  ('CUTOFF_HOUR', '7', 'Giờ cắt ngày cho nhân viên (0-23)'),
  ('CUTOFF_HOUR_MANAGER', '7', 'Giờ cắt ngày cho quản lý (0-23)'),
  ('DISABLE_CROSS_TIME_MANAGER', 'false', 'Bỏ qua kiểm tra thời gian cho Quản lý (true/false)')
ON CONFLICT (key) DO NOTHING;
