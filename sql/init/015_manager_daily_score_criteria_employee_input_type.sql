ALTER TABLE manager_daily_score_criteria
ADD COLUMN IF NOT EXISTS employee_input_type VARCHAR(20) DEFAULT 'text';

UPDATE manager_daily_score_criteria
SET employee_input_type = 'text'
WHERE employee_input_type IS NULL OR employee_input_type = '';
