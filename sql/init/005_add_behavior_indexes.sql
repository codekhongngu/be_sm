CREATE INDEX IF NOT EXISTS idx_sales_activity_reports_user_id_log_date
ON sales_activity_reports (user_id, log_date);

CREATE INDEX IF NOT EXISTS idx_belief_transformation_logs_user_id_log_date
ON belief_transformation_logs (user_id, log_date);

