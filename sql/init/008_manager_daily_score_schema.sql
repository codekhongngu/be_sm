CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS manager_daily_score_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_code VARCHAR(30) NOT NULL,
  section_name VARCHAR(255) NOT NULL,
  section_sort_order INTEGER NOT NULL DEFAULT 0,
  item_code VARCHAR(50) NOT NULL UNIQUE,
  item_sort_order INTEGER NOT NULL DEFAULT 0,
  stt_label VARCHAR(20) NOT NULL,
  content_name TEXT NOT NULL,
  max_score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (max_score >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS manager_daily_score_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score_date DATE NOT NULL,
  employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE RESTRICT,
  total_score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total_score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (employee_id, score_date)
);

CREATE TABLE IF NOT EXISTS manager_daily_score_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES manager_daily_score_sheets(id) ON DELETE CASCADE,
  criteria_id UUID NOT NULL REFERENCES manager_daily_score_criteria(id) ON DELETE RESTRICT,
  requirement_note TEXT NOT NULL,
  score NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (score >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sheet_id, criteria_id)
);

CREATE INDEX IF NOT EXISTS idx_mgr_daily_score_sheets_score_date
ON manager_daily_score_sheets (score_date);

CREATE INDEX IF NOT EXISTS idx_mgr_daily_score_sheets_employee_id
ON manager_daily_score_sheets (employee_id);

CREATE INDEX IF NOT EXISTS idx_mgr_daily_score_sheets_manager_id
ON manager_daily_score_sheets (manager_id);

CREATE INDEX IF NOT EXISTS idx_mgr_daily_score_sheets_unit_id
ON manager_daily_score_sheets (unit_id);

CREATE INDEX IF NOT EXISTS idx_mgr_daily_score_items_sheet_id
ON manager_daily_score_items (sheet_id);

CREATE INDEX IF NOT EXISTS idx_mgr_daily_score_items_criteria_id
ON manager_daily_score_items (criteria_id);

INSERT INTO manager_daily_score_criteria
  (section_code, section_name, section_sort_order, item_code, item_sort_order, stt_label, content_name, max_score)
VALUES
  ('LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_TRAINING_PARTICIPATION', 1, '1', 'Tham gia đào tạo, giao ban hằng ngày', 5),
  ('LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_WORKBOOK_EXERCISE', 2, '2.1', 'Làm bài tập Sổ tay thực hành', 4),
  ('LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_MULTIPLE_CHOICE', 3, '2.2', 'Làm bài tập trắc nghiệm', 3),
  ('LEARNING', 'I. Học tập, rèn luyện', 1, 'LEARNING_STAGE_EXERCISE', 4, '2.3', 'Chủ động làm bài tập theo giai đoạn', 3),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_SALES_PLAN', 5, '1', 'Lập kế hoạch bán hàng (chương trình hành động cá nhân)', 3),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_PREPARE_CONSULT', 6, '2', 'Chuẩn bị câu hỏi tư vấn thu nhập cao cho từng đối tượng khách hàng', 2),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_CUSTOMERS_CONTACTED', 7, '3', 'Số khách hàng tiếp cận', 10),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_OLD_CUSTOMERS_CONSULTED', 8, '4', 'Số khách hàng cũ tư vấn (KH theo lịch hẹn/ KH hiện hữu)', 4),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_SUCCESSFUL_CARE_CALLS', 9, '5', 'Số cuộc gọi CSKH thành công (chỉ dành riêng cho TT CSKH)', 10),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_DAILY_CHECKLIST', 10, '6', 'Ghi nhật ký bán hàng, checklist hành vi', 7),
  ('BEHAVIOR', 'II. Thực hành hành vi', 2, 'BEHAVIOR_DIRECTOR_EVALUATION', 11, '7', 'Giám đốc đánh giá', 9),
  ('PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_RENEWAL_SERVICES', 12, '1', 'Số dịch vụ phát triển mới/gia hạn/nâng gói hàng chu kỳ', 10),
  ('PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_NEW_PTM_PACKAGES', 13, '2', 'Số gói ca PTM mới', 4),
  ('PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_CLOSE_RATE', 14, '3', 'Tỷ lệ chốt dịch vụ', 4),
  ('PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_REVENUE', 15, '4', 'Doanh thu PTM/GH cá nhân', 30),
  ('PERFORMANCE', 'III. Nâng cao hiệu quả hoạt động', 3, 'PERFORMANCE_RETURNING_REFERRED', 16, '5', 'Số KH quay lại giới thiệu KH mới', 2)
ON CONFLICT (item_code) DO UPDATE
SET
  section_code = EXCLUDED.section_code,
  section_name = EXCLUDED.section_name,
  section_sort_order = EXCLUDED.section_sort_order,
  item_sort_order = EXCLUDED.item_sort_order,
  stt_label = EXCLUDED.stt_label,
  content_name = EXCLUDED.content_name,
  max_score = EXCLUDED.max_score,
  is_active = TRUE,
  updated_at = NOW();
